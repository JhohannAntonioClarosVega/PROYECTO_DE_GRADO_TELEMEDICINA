import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Platform, TextInput, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { Camera } from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import CustomModal from '@/components/CustomModal';

type CallRole = 'doctor' | 'patient';

interface ConsultationIdentity {
  triageId: string | null;
  patientId: string | null;
  role: CallRole;
}

interface CallTriage {
  id: string;
  patient_id: string;
  status: string;
  urgency_level?: string;
  reported_symptoms?: string;
  ai_recommendation?: string;
}

interface CallAppointment {
  id: string;
  triage_id: string;
  patient_id: string;
  doctor_id: string;
}

interface CallContext {
  triage: CallTriage;
  appointment: CallAppointment | null;
}

interface CallRecord {
  id?: string;
  appointment_id: string;
  patient_id: string;
  doctor_id: string;
  diagnosis: string;
  treatment_plan: string;
  clinical_notes: string | null;
  created_at: string;
}

interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  time: string;
}

interface SaveProgress {
  running: boolean;
  recordWritten: boolean;
  uncertainWrite: boolean;
  completed: boolean;
}

// Only write status is retained across screen visits; clinical text stays in its consultation.
const savesByTriage = new Map<string, SaveProgress>();
const definiteInsertRejections = new Set(['23502', '23503', '23505', '23514', '42501', '22001', '22P02']);

class ConsultationChanged extends Error {
  constructor() {
    super('La consulta cambió o se cerró.');
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function routeValue(value: string | string[] | undefined): string | null {
  return (Array.isArray(value) ? value[0] : value) || null;
}

function errorMessage(error: unknown): string {
  return isRecord(error) && typeof error.message === 'string'
    ? error.message
    : 'No se pudo guardar el registro clínico en la base de datos.';
}

function parseTriage(value: unknown, identity: ConsultationIdentity): CallTriage {
  if (!identity.triageId || !identity.patientId || !isRecord(value) ||
      typeof value.id !== 'string' || typeof value.patient_id !== 'string' || value.id !== identity.triageId ||
      value.patient_id !== identity.patientId || typeof value.status !== 'string') {
    throw new Error('El triaje no corresponde al paciente de esta consulta.');
  }
  return {
    id: value.id,
    patient_id: value.patient_id,
    status: value.status,
    urgency_level: typeof value.urgency_level === 'string' ? value.urgency_level : undefined,
    reported_symptoms: typeof value.reported_symptoms === 'string' ? value.reported_symptoms : undefined,
    ai_recommendation: typeof value.ai_recommendation === 'string' ? value.ai_recommendation : undefined,
  };
}

function parseAppointment(value: unknown, triage: CallTriage): CallAppointment {
  if (!isRecord(value) || typeof value.id !== 'string' ||
      value.triage_id !== triage.id || value.patient_id !== triage.patient_id ||
      typeof value.doctor_id !== 'string') {
    throw new Error('La cita no corresponde al triaje y al paciente de esta consulta.');
  }
  return {
    id: value.id,
    triage_id: value.triage_id,
    patient_id: value.patient_id,
    doctor_id: value.doctor_id,
  };
}

function parseRecord(value: unknown, context: CallContext): CallRecord {
  const appointment = context.appointment;
  if (!appointment || !isRecord(value) || value.appointment_id !== appointment.id ||
      value.patient_id !== context.triage.patient_id || value.doctor_id !== appointment.doctor_id) {
    throw new Error('El registro médico no corresponde a la cita, al paciente y al médico de esta consulta.');
  }
  return {
    id: typeof value.id === 'string' ? value.id : undefined,
    appointment_id: appointment.id,
    patient_id: context.triage.patient_id,
    doctor_id: appointment.doctor_id,
    diagnosis: typeof value.diagnosis === 'string' ? value.diagnosis : '',
    treatment_plan: typeof value.treatment_plan === 'string' ? value.treatment_plan : '',
    clinical_notes: typeof value.clinical_notes === 'string' ? value.clinical_notes : null,
    created_at: typeof value.created_at === 'string' ? value.created_at : '',
  };
}

export default function VideoCallScreen() {
  const params = useLocalSearchParams<{
    role?: string | string[];
    patientId?: string | string[];
    triageId?: string | string[];
    doctorName?: string | string[];
  }>();
  const identity: ConsultationIdentity = {
    triageId: routeValue(params.triageId),
    patientId: routeValue(params.patientId),
    role: routeValue(params.role) === 'doctor' ? 'doctor' : 'patient',
  };

  // A new identity owns new form, recipe, appointment, call, modal and resource states.
  return (
    <VideoConsultation
      key={JSON.stringify([identity.triageId, identity.patientId, identity.role])}
      identity={identity}
      doctorNameParam={routeValue(params.doctorName) || 'Médico Asignado'}
    />
  );
}

function VideoConsultation({
  identity,
  doctorNameParam,
}: {
  identity: ConsultationIdentity;
  doctorNameParam: string;
}) {
  const { triageId, patientId, role } = identity;
  const isDoctor = role === 'doctor';

  const [camActive] = useState(true);
  const [, setCallDuration] = useState(0);
  const [connecting, setConnecting] = useState(true);
  const [isCallEnded, setIsCallEnded] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: '1', sender: isDoctor ? 'patient' : 'doctor', text: 'Hola, buenas tardes.', time: '14:30' },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [treatment, setTreatment] = useState('');
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [patientTriage, setPatientTriage] = useState<CallTriage | null>(null);
  const [showPatientRecord, setShowPatientRecord] = useState(false);
  const [medicalRecord, setMedicalRecord] = useState<CallRecord | null>(null);
  const [fetchingRecord, setFetchingRecord] = useState(false);
  const [appointmentId, setAppointmentId] = useState<string | null>(null);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const mountedRef = useRef(false);
  const readControllersRef = useRef(new Set<AbortController>());
  const chatTimersRef = useRef(new Set<ReturnType<typeof setTimeout>>());
  const sendingChannelsRef = useRef(new Set<ReturnType<typeof supabase.channel>>());
  const sendingCancellationsRef = useRef(new Set<() => void>());
  const pendingRecordRef = useRef<Promise<void> | null>(null);
  const receivedRecordRef = useRef<CallRecord | null>(null);
  const receivedEndRef = useRef(false);
  const savingRef = useRef(false);
  const endingRef = useRef(false);

  const [modalConfig, setModalConfig] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type: 'alert' | 'confirm';
    confirmText: string;
    onConfirm?: () => void;
    onCancel?: () => void;
  }>({
    visible: false,
    title: '',
    message: '',
    type: 'alert',
    confirmText: 'Aceptar',
  });

  useEffect(() => {
    mountedRef.current = true;
    const controllers = readControllersRef.current;
    const timers = chatTimersRef.current;
    const channels = sendingChannelsRef.current;
    const cancellations = sendingCancellationsRef.current;
    return () => {
      mountedRef.current = false;
      controllers.forEach(controller => controller.abort());
      controllers.clear();
      timers.forEach(timer => clearTimeout(timer));
      timers.clear();
      cancellations.forEach(cancel => cancel());
      cancellations.clear();
      channels.forEach(channel => { void supabase.removeChannel(channel); });
      channels.clear();
    };
  }, []);

  const isCurrent = useCallback(() => mountedRef.current, []);
  const ensureCurrent = useCallback(() => {
    if (!mountedRef.current) throw new ConsultationChanged();
  }, []);

  const runRead = useCallback(async function runRead<T>(
    query: (signal: AbortSignal) => PromiseLike<T>
  ): Promise<T> {
    ensureCurrent();
    const controller = new AbortController();
    readControllersRef.current.add(controller);
    try {
      const result = await query(controller.signal);
      ensureCurrent();
      return result;
    } finally {
      readControllersRef.current.delete(controller);
    }
  }, [ensureCurrent]);

  const closeModal = useCallback(() => {
    if (isCurrent()) setModalConfig(prev => ({ ...prev, visible: false }));
  }, [isCurrent]);

  const returnToMenu = useCallback(() => {
    if (isCurrent()) router.replace(isDoctor ? '/(doctor)/dashboard' : '/(patient)/menu');
  }, [isCurrent, isDoctor]);

  const readContext = useCallback(async (): Promise<CallContext> => {
    if (!triageId || !patientId) throw new Error('Falta identificar el triaje o el paciente de la consulta.');
    const { data: triageData, error: triageError } = await runRead(signal => supabase
      .from('triages')
      .select('*, patients(id, blood_type, allergies, emergency_contact, profiles(full_name, identity_card))')
      .eq('id', triageId)
      .abortSignal(signal)
      .single());
    if (triageError) throw triageError;
    const triage = parseTriage(triageData, { triageId, patientId, role });
    const { data: appointmentData, error: appointmentError } = await runRead(signal => supabase
      .from('appointments')
      .select('id, triage_id, patient_id, doctor_id')
      .eq('triage_id', triage.id)
      .abortSignal(signal)
      .maybeSingle());
    if (appointmentError) throw appointmentError;
    return { triage, appointment: appointmentData ? parseAppointment(appointmentData, triage) : null };
  }, [triageId, patientId, role, runRead]);

  const findRecord = useCallback(async (context: CallContext): Promise<CallRecord | null> => {
    const appointment = context.appointment;
    if (!appointment) return null;
    const { data, error } = await runRead(signal => supabase
      .from('medical_records')
      .select('*')
      .eq('appointment_id', appointment.id)
      .abortSignal(signal)
      .maybeSingle());
    if (error) throw error;
    return data ? parseRecord(data, context) : null;
  }, [runRead]);

  const presentRecord = useCallback((record: CallRecord, ended = false) => {
    if (!isCurrent()) return;
    const firstRecord = receivedRecordRef.current === null;
    const firstEnd = ended && !receivedEndRef.current;
    receivedRecordRef.current = record;
    if (ended) {
      receivedEndRef.current = true;
      setIsCallEnded(true);
    }
    setMedicalRecord(record);
    if (firstRecord || firstEnd) {
      setModalConfig({
        visible: true,
        title: ended ? 'Consulta Finalizada' : 'Nueva Indicación Médica',
        message: ended
          ? 'El doctor ha finalizado la consulta y emitido tu receta digital. La videollamada ha terminado.'
          : 'El doctor ha registrado tu diagnóstico y tratamiento. Puedes revisarlo presionando el botón de Registro Clínico en la llamada.',
        type: 'alert',
        confirmText: ended ? 'Ver Receta Digital' : 'Ver Registro',
        onConfirm: () => {
          if (!isCurrent()) return;
          closeModal();
          setShowPatientRecord(true);
          setShowChat(false);
        },
        onCancel: closeModal,
      });
    }
  }, [isCurrent, closeModal]);

  const fetchPatientRecord = useCallback((
    canUpdate: () => boolean = () => true
  ): Promise<void> => {
    if (!isCurrent() || !canUpdate()) return Promise.resolve();
    if (pendingRecordRef.current) return pendingRecordRef.current;
    const pending = (async () => {
      try {
        const context = await readContext();
        if (!isCurrent() || !canUpdate()) return;
        setAppointmentId(context.appointment?.id ?? null);
        const record = await findRecord(context);
        if (!isCurrent() || !canUpdate()) return;
        if (record) presentRecord(record);
      } catch (error: unknown) {
        if (isCurrent() && canUpdate()) console.warn('Error al buscar registro médico del paciente:', error);
      } finally {
        pendingRecordRef.current = null;
      }
    })();
    pendingRecordRef.current = pending;
    return pending;
  }, [readContext, findRecord, presentRecord, isCurrent]);

  useEffect(() => {
    let active = true;
    const requestPermissions = async () => {
      if (Platform.OS !== 'web') {
        try {
          const { status: cameraStatus } = await Camera.requestCameraPermissionsAsync();
          if (!active || !isCurrent()) return;
          const { status: audioStatus } = await Camera.requestMicrophonePermissionsAsync();
          if (!active || !isCurrent()) return;
          if (cameraStatus !== 'granted' || audioStatus !== 'granted') {
            console.warn('Los permisos de cámara/micrófono son necesarios.');
          }
        } catch (error: unknown) {
          if (active && isCurrent()) console.warn('Error solicitando permisos', error);
        }
      }
    };
    void requestPermissions();
    const connTimeout = setTimeout(() => {
      if (active && isCurrent()) setConnecting(false);
    }, 3000);
    const interval = setInterval(() => {
      if (active && isCurrent()) setCallDuration(prev => prev + 1);
    }, 1000);
    return () => {
      active = false;
      clearTimeout(connTimeout);
      clearInterval(interval);
    };
  }, [isCurrent]);

  useEffect(() => {
    if (!isDoctor || !triageId) return;
    let active = true;
    void readContext().then(context => {
      if (!active || !isCurrent()) return;
      setPatientTriage(context.triage);
      setAppointmentId(context.appointment?.id ?? null);
    }).catch((error: unknown) => {
      if (active && isCurrent()) console.error('Error cargando triaje para videollamada:', error);
    });
    return () => { active = false; };
  }, [readContext, isDoctor, triageId, isCurrent]);

  useEffect(() => {
    let active = true;
    const stopLocalCamera = () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
      }
      if (localVideoRef.current) localVideoRef.current.srcObject = null;
    };
    const startLocalCamera = async () => {
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          if (!active || !isCurrent()) {
            stream.getTracks().forEach(track => track.stop());
            return;
          }
          localStreamRef.current = stream;
          if (localVideoRef.current) localVideoRef.current.srcObject = stream;
        }
      } catch (error: unknown) {
        if (active && isCurrent()) console.warn('No se pudo acceder a la cámara física:', error);
      }
    };
    if (Platform.OS === 'web' && camActive && !connecting && !isCallEnded) {
      void startLocalCamera();
    } else {
      stopLocalCamera();
    }
    return () => {
      active = false;
      stopLocalCamera();
    };
  }, [camActive, connecting, isCallEnded, isCurrent]);

  useEffect(() => {
    if (isDoctor || !triageId) return;
    let active = true;
    const canUpdate = () => active && isCurrent();
    void fetchPatientRecord(canUpdate);
    const interval = setInterval(() => { void fetchPatientRecord(canUpdate); }, 5000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [triageId, isDoctor, fetchPatientRecord, isCurrent]);

  const emitCallEnded = useCallback((context: CallContext, record: CallRecord | null): Promise<boolean> => {
    if (!isCurrent()) return Promise.resolve(false);
    let channel: ReturnType<typeof supabase.channel>;
    try {
      channel = supabase.channel('rt_call_' + context.triage.id);
    } catch (error: unknown) {
      console.warn('No se pudo iniciar el aviso de fin de llamada:', error);
      return Promise.resolve(false);
    }
    return new Promise(resolve => {
      let settled = false;
      let sending = false;
      const finish = (sent: boolean, detail?: unknown) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        sendingCancellationsRef.current.delete(cancel);
        sendingChannelsRef.current.delete(channel);
        void supabase.removeChannel(channel);
        if (!sent && detail !== undefined && isCurrent()) {
          console.warn('No se pudo confirmar el aviso de fin de llamada:', detail);
        }
        resolve(sent);
      };
      const cancel = () => finish(false);
      const timeout = setTimeout(() => finish(false, 'Tiempo de espera agotado.'), 5000);
      sendingChannelsRef.current.add(channel);
      sendingCancellationsRef.current.add(cancel);
      try {
        channel.subscribe(status => {
          if (settled) return;
          if (!isCurrent()) {
            finish(false);
            return;
          }
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            finish(false, status);
            return;
          }
          if (status !== 'SUBSCRIBED' || sending) return;
          sending = true;
          void channel.send({
            type: 'broadcast',
            event: 'call_ended',
            payload: {
              triageId: context.triage.id,
              patientId: context.triage.patient_id,
              appointmentId: context.appointment?.id ?? null,
              diagnosis: record?.diagnosis ?? 'Consulta finalizada sin registro.',
              treatment_plan: record?.treatment_plan ?? 'Contacte a administración.',
            },
          }).then(result => finish(result === 'ok', result === 'ok' ? undefined : result))
            .catch((error: unknown) => finish(false, error));
        });
      } catch (error: unknown) {
        finish(false, error);
      }
    });
  }, [isCurrent]);

  useEffect(() => {
    if (isDoctor || !triageId) return;
    let active = true;
    const canUpdate = () => active && isCurrent();
    const callChannel = supabase
      .channel('rt_call_' + triageId)
      .on('broadcast', { event: 'call_ended' }, async (event: unknown) => {
        if (!canUpdate() || !isRecord(event) || !isRecord(event.payload)) return;
        const payload = event.payload;
        if ((payload.triageId !== undefined && payload.triageId !== triageId) ||
            (payload.patientId !== undefined && payload.patientId !== patientId)) return;
        try {
          const context = await readContext();
          if (!canUpdate()) return;
          if (payload.appointmentId !== undefined && payload.appointmentId !== (context.appointment?.id ?? null)) return;
          const record = await findRecord(context);
          if (!canUpdate()) return;
          const identifiedPayload = payload.triageId === context.triage.id &&
            payload.patientId === context.triage.patient_id &&
            payload.appointmentId === (context.appointment?.id ?? null);
          if (!record && !identifiedPayload) {
            if (context.triage.status === 'completed' || context.triage.status === 'resolved') {
              setIsCallEnded(true);
            } else {
              console.warn('Se ignoró un aviso sin identidad ni un cierre confirmado de esta consulta.');
            }
            return;
          }
          const { error } = await supabase.from('triages').update({ status: 'completed' }).eq('id', context.triage.id);
          if (error) throw error;
          if (!canUpdate()) return;
          if (record) {
            presentRecord(record, true);
          } else if (context.appointment) {
            presentRecord({
              appointment_id: context.appointment.id,
              patient_id: context.triage.patient_id,
              doctor_id: context.appointment.doctor_id,
              diagnosis: typeof payload.diagnosis === 'string' ? payload.diagnosis : 'Consulta finalizada sin registro.',
              treatment_plan: typeof payload.treatment_plan === 'string' ? payload.treatment_plan : 'Contacte a administración.',
              clinical_notes: null,
              created_at: new Date().toISOString(),
            }, true);
          } else {
            setIsCallEnded(true);
          }
        } catch (error: unknown) {
          if (canUpdate()) console.warn('Error al verificar el fin de esta consulta:', error);
        }
      })
      .subscribe();

    let dbChannel: ReturnType<typeof supabase.channel> | null = null;
    if (appointmentId) {
      dbChannel = supabase
        .channel('rt_db_' + appointmentId)
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'medical_records', filter: 'appointment_id=eq.' + appointmentId,
        }, async () => {
          if (!canUpdate()) return;
          try {
            const context = await readContext();
            if (!canUpdate() || context.appointment?.id !== appointmentId) return;
            const record = await findRecord(context);
            if (canUpdate() && record) presentRecord(record, true);
          } catch (error: unknown) {
            if (canUpdate()) console.warn('Error al verificar el registro de esta consulta:', error);
          }
        })
        .subscribe();
    }
    return () => {
      active = false;
      void supabase.removeChannel(callChannel);
      if (dbChannel) void supabase.removeChannel(dbChannel);
    };
  }, [triageId, patientId, appointmentId, isDoctor, readContext, findRecord, presentRecord, isCurrent]);

  const handleOpenPatientRecord = async () => {
    if (!isCurrent()) return;
    setShowPatientRecord(true);
    setShowChat(false);
    setFetchingRecord(true);
    await fetchPatientRecord();
    if (isCurrent()) setFetchingRecord(false);
  };

  const handleSendMessage = () => {
    if (!isCurrent() || !chatInput.trim()) return;
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      sender: 'self',
      text: chatInput,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }]);
    setChatInput('');
    const timer = setTimeout(() => {
      chatTimersRef.current.delete(timer);
      if (!isCurrent()) return;
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        sender: isDoctor ? 'patient' : 'doctor',
        text: isDoctor ? 'Entendido doctor, ya anoté la indicación.' : 'De acuerdo, por favor tome asiento.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }]);
    }, 2000);
    chatTimersRef.current.add(timer);
  };

  const showSaved = (noticeSent: boolean) => {
    if (!isCurrent()) return;
    setIsCallEnded(true);
    setModalConfig({
      visible: true,
      title: 'Historial Guardado',
      message: noticeSent
        ? 'El registro e historial médico ha sido guardado exitosamente. La llamada ha finalizado.'
        : 'El registro e historial médico ha sido guardado exitosamente. La llamada ha finalizado, pero no se confirmó el aviso al paciente.',
      type: 'alert',
      confirmText: 'Volver al Inicio',
      onCancel: closeModal,
      onConfirm: () => {
        if (!isCurrent()) return;
        closeModal();
        returnToMenu();
      },
    });
  };

  const handleSaveMedicalRecord = async () => {
    if (!isCurrent() || !isDoctor || savingRef.current || endingRef.current) return;
    if (!diagnosis || !treatment) {
      setModalConfig({
        visible: true,
        title: 'Campos requeridos',
        message: 'Por favor complete el Diagnóstico y el Tratamiento.',
        type: 'alert',
        confirmText: 'Entendido',
        onConfirm: closeModal,
        onCancel: closeModal,
      });
      return;
    }

    savingRef.current = true;
    setSavingNotes(true);
    let progress: SaveProgress | undefined;
    let ownsLock = false;
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      ensureCurrent();
      if (authError) throw authError;
      if (!user) throw new Error('No hay una sesión médica activa.');
      const context = await readContext();
      ensureCurrent();
      const appointment = context.appointment;
      if (!appointment) throw new Error('No se puede guardar sin una cita asociada a este triaje.');
      if (appointment.doctor_id !== user.id) throw new Error('El médico autenticado no corresponde a esta cita.');

      progress = savesByTriage.get(context.triage.id);
      if (!progress) {
        progress = { running: false, recordWritten: false, uncertainWrite: false, completed: false };
        savesByTriage.set(context.triage.id, progress);
      }
      if (progress.running) throw new Error('Ya hay un guardado de esta consulta en curso. Espere a que finalice.');
      progress.running = true;
      ownsLock = true;

      let savedRecord = await findRecord(context);
      ensureCurrent();
      if (savedRecord) {
        progress.recordWritten = true;
        progress.uncertainWrite = false;
      } else {
        if (progress.recordWritten || progress.uncertainWrite) {
          throw new Error('Hay un guardado previo de esta consulta pendiente de verificación. Revise su registro antes de reintentar para evitar duplicados.');
        }
        const recordData = {
          patient_id: context.triage.patient_id,
          doctor_id: user.id,
          appointment_id: appointment.id,
          diagnosis,
          treatment_plan: treatment,
          clinical_notes: notes || null,
        };
        // Sent writes cannot be safely undone: remember an acknowledgement even after unmount.
        progress.uncertainWrite = true;
        const { error } = await supabase.from('medical_records').insert(recordData);
        if (error) {
          if (definiteInsertRejections.has(error.code)) progress.uncertainWrite = false;
          throw error;
        }
        progress.recordWritten = true;
        progress.uncertainWrite = false;
        savedRecord = { ...recordData, created_at: new Date().toISOString() };
      }
      ensureCurrent();

      if (!(progress.completed && context.triage.status === 'completed')) {
        const { error } = await supabase.from('triages')
          .update({ status: 'completed' }).eq('id', context.triage.id).select().single();
        if (error) throw new Error('El registro se guardó, pero falló el cambio de estado de la cita. ' + error.message);
        progress.completed = true;
        ensureCurrent();
      }
      setIsCallEnded(true);
      const noticeSent = await emitCallEnded(context, savedRecord);
      ensureCurrent();
      showSaved(noticeSent);
    } catch (error: unknown) {
      if (isCurrent()) {
        console.error('Error al guardar registro médico:', error);
        setModalConfig({
          visible: true,
          title: 'Error al Guardar',
          message: errorMessage(error),
          type: 'alert',
          confirmText: 'Aceptar',
          onCancel: closeModal,
          onConfirm: closeModal,
        });
      } else if (!(error instanceof ConsultationChanged)) {
        console.warn('El resultado de un guardado anterior requiere verificación:', error);
      }
    } finally {
      if (progress && ownsLock) progress.running = false;
      savingRef.current = false;
      if (isCurrent()) setSavingNotes(false);
    }
  };

  const handleEndCall = () => {
    if (!isCurrent() || savingRef.current || endingRef.current) return;
    if (!isDoctor || (diagnosis && treatment)) {
      setIsCallEnded(true);
      returnToMenu();
      return;
    }
    setModalConfig({
      visible: true,
      title: 'Registro Incompleto',
      message: 'Se recomienda llenar el Registro Médico antes de salir. Si deseas salir sin registrar, puedes confirmarlo ahora.',
      type: 'confirm',
      confirmText: 'Salir sin guardar',
      onCancel: closeModal,
      onConfirm: async () => {
        if (!isCurrent() || savingRef.current || endingRef.current) return;
        endingRef.current = true;
        closeModal();
        let progress: SaveProgress | undefined;
        let ownsLock = false;
        try {
          const { data: { user }, error: authError } = await supabase.auth.getUser();
          ensureCurrent();
          if (authError) throw authError;
          if (!user) throw new Error('No hay una sesión médica activa.');
          const context = await readContext();
          ensureCurrent();
          if (context.appointment && context.appointment.doctor_id !== user.id) {
            throw new Error('El médico autenticado no corresponde a esta cita.');
          }
          progress = savesByTriage.get(context.triage.id);
          if (!progress) {
            progress = { running: false, recordWritten: false, uncertainWrite: false, completed: false };
            savesByTriage.set(context.triage.id, progress);
          }
          if (progress.running) throw new Error('Ya hay un guardado de esta consulta en curso. Espere a que finalice.');
          progress.running = true;
          ownsLock = true;
          const { error } = await supabase.from('triages').update({ status: 'completed' }).eq('id', context.triage.id);
          if (error) throw error;
          ensureCurrent();
          setIsCallEnded(true);
          const noticeSent = await emitCallEnded(context, null);
          ensureCurrent();
          if (noticeSent) {
            returnToMenu();
          } else {
            setModalConfig({
              visible: true,
              title: 'Consulta Finalizada',
              message: 'La consulta ha finalizado, pero no se confirmó el aviso al paciente.',
              type: 'alert',
              confirmText: 'Volver al Inicio',
              onCancel: closeModal,
              onConfirm: () => {
                if (!isCurrent()) return;
                closeModal();
                returnToMenu();
              },
            });
          }
        } catch (error: unknown) {
          if (isCurrent()) {
            console.warn('Error al finalizar esta consulta:', error);
            setModalConfig({
              visible: true,
              title: 'Error al Finalizar',
              message: errorMessage(error),
              type: 'alert',
              confirmText: 'Aceptar',
              onCancel: closeModal,
              onConfirm: closeModal,
            });
          }
        } finally {
          if (progress && ownsLock) progress.running = false;
          endingRef.current = false;
        }
      },
    });
    setShowNotes(true);
  };

  // Usamos Whereby (Líder en WebRTC para iframes, diseño súper limpio)
  const WHEREBY_BASE_URL = 'https://telemedicina.whereby.com/consultad2702ad1-6c7d-474a-b4dd-afeba02617c8';
  
  // Parámetros mágicos de Whereby para ocultar todo lo innecesario y forzar el modo incrustado
  const wherebyParams = new URLSearchParams({
    embed: 'true',
    audio: 'on',
    video: 'on',
    chat: 'off',
    people: 'off',
    leaveButton: 'off', // APAGADO para evitar el error 'Ha salido de la sala'
    background: 'off',
    displayName: isDoctor ? 'Doctor' : 'Paciente'
  }).toString();

  const videoUrl: `https://${string}` = `${WHEREBY_BASE_URL}?${wherebyParams}`;
  
  // Enlace externo (Por si se quiere abrir fuera de la app)
  const launchExternalMeet = () => {
    if (!isCurrent()) return;
    if (Platform.OS === 'web') {
      window.open(videoUrl, '_blank');
    } else {
      router.push(videoUrl);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-950">
      {/* Contenido de Video Principal */}
      <View className="flex-1 justify-center items-center">
        {isCallEnded ? (
          <View className="items-center justify-center p-8 bg-slate-900 rounded-[32px] w-[90%] max-w-[400px] border border-slate-800" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 15, elevation: 10 }}>
            <View className="w-20 h-20 bg-emerald-500/20 rounded-full justify-center items-center mb-6">
              <Ionicons name="shield-checkmark" size={40} color="#10b981" />
            </View>
            <Text className="text-white text-[22px] font-extrabold text-center tracking-wide">Consulta Finalizada</Text>
            {isDoctor ? (
              <Text className="text-slate-400 text-[15px] mt-3 text-center leading-6">El registro clínico fue guardado de forma segura en el sistema.</Text>
            ) : (
              <Text className="text-slate-400 text-[15px] mt-3 text-center leading-6">Por favor revisa tu receta digital en tu historial.</Text>
            )}
          </View>
        ) : connecting ? (
          <View className="items-center justify-center p-8">
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text className="text-white text-[18px] font-bold mt-5 tracking-wide">Estableciendo canal seguro...</Text>
            <Text className="text-slate-500 text-[14px] mt-2 font-medium">Telemedicina IA - Encriptación E2E</Text>
          </View>
        ) : (
          <View className="w-full h-full relative bg-slate-900">
            {/* Videollamada Real con Whereby/Jitsi */}
            {Platform.OS === 'web' ? (
              <iframe 
                src={videoUrl}
                allow="camera; microphone; fullscreen; display-capture; autoplay"
                style={{ width: '100%', height: '100%', border: 'none' }}
              />
            ) : (
              <WebView
                source={{ uri: videoUrl }}
                style={{ flex: 1, backgroundColor: 'transparent' }}
                allowsInlineMediaPlayback={true}
                mediaPlaybackRequiresUserAction={false}
                javaScriptEnabled={true}
              />
            )}
          </View>
        )}
      </View>

      {/* Barra de Herramientas Flotante Lateral (Glassmorphism) */}
      <View className="absolute right-4 top-1/4 flex-col rounded-full px-3 py-5 gap-4 items-center z-20" style={{ backgroundColor: 'rgba(15, 23, 42, 0.7)', borderColor: 'rgba(51, 65, 85, 0.5)', borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 15, elevation: 10 }}>
        <TouchableOpacity 
          className={`w-[46px] h-[46px] rounded-full justify-center items-center relative ${showChat ? 'bg-blue-600' : 'bg-slate-800'}`}
          onPress={() => {
            setShowChat(!showChat);
            setShowNotes(false);
            setShowPatientRecord(false);
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="chatbubbles" size={20} color="#ffffff" />
          {messages.length > 0 && <View className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-red-500 border-2 border-slate-800" />}
        </TouchableOpacity>

        {isDoctor ? (
          <TouchableOpacity 
            className={`w-[46px] h-[46px] rounded-full justify-center items-center ${showNotes ? 'bg-blue-600' : 'bg-slate-800'}`}
            onPress={() => {
              setShowNotes(!showNotes);
              setShowChat(false);
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="document-text" size={20} color="#ffffff" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity 
            className={`w-[46px] h-[46px] rounded-full justify-center items-center relative ${showPatientRecord ? 'bg-blue-600' : 'bg-slate-800'}`}
            onPress={() => {
              if (showPatientRecord) {
                setShowPatientRecord(false);
              } else {
                handleOpenPatientRecord();
              }
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="document-text" size={20} color="#ffffff" />
            {medicalRecord && <View className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-slate-800" />}
          </TouchableOpacity>
        )}

        <TouchableOpacity 
          className="bg-emerald-500/20 px-3 py-3 w-[46px] h-[46px] rounded-full justify-center items-center border border-emerald-500/30"
          onPress={launchExternalMeet}
          activeOpacity={0.7}
        >
          <Ionicons name="videocam-outline" size={20} color="#10b981" />
        </TouchableOpacity>

        <TouchableOpacity 
          className="w-[46px] h-[46px] rounded-full bg-red-500 justify-center items-center rotate-[135deg]"
          style={{ shadowColor: '#ef4444', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 8 }}
          onPress={handleEndCall}
          activeOpacity={0.7}
        >
          <Ionicons name="call" size={22} color="#ffffff" />
        </TouchableOpacity>
      </View>

      {/* Panel Deslizable Lateral: Chat */}
      {showChat && (
        <View className="absolute top-0 bottom-0 right-0 w-full max-w-[360px] border-l border-slate-800 z-30 pt-10 sm:pt-6" style={{ backgroundColor: 'rgba(15, 23, 42, 0.95)' }}>
          <View className="flex-row justify-between items-center px-5 py-4 border-b border-slate-800">
            <Text className="text-white text-[16px] font-extrabold tracking-wide">Chat Seguro</Text>
            <TouchableOpacity onPress={() => setShowChat(false)} className="bg-slate-800 w-8 h-8 rounded-full items-center justify-center">
              <Ionicons name="close" size={18} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          <ScrollView className="flex-1 px-4 py-4" contentContainerStyle={{ gap: 12 }}>
            {messages.map(msg => (
              <View 
                key={msg.id} 
                className={`p-3 rounded-[16px] max-w-[85%] ${msg.sender === 'self' ? 'bg-blue-600 self-end rounded-br-sm' : 'bg-slate-800 self-start rounded-bl-sm'}`}
              >
                <Text className="text-white text-[14px] leading-5">{msg.text}</Text>
                <Text className="text-white/50 text-[10px] mt-1 self-end font-medium">{msg.time}</Text>
              </View>
            ))}
          </ScrollView>

          <View className="flex-row px-4 py-4 bg-slate-900 border-t border-slate-800 items-center gap-3">
            <TextInput
              className="flex-1 bg-slate-800 rounded-full px-5 py-3.5 text-white text-[14px]"
              placeholder="Escribe aquí..."
              placeholderTextColor="#64748b"
              value={chatInput}
              onChangeText={setChatInput}
              onSubmitEditing={handleSendMessage}
            />
            <TouchableOpacity className="w-[44px] h-[44px] rounded-full bg-blue-600 justify-center items-center" style={{ shadowColor: '#3b82f6', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 3, elevation: 2 }} onPress={handleSendMessage}>
              <Ionicons name="send" size={18} color="#ffffff" className="ml-1" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Panel Deslizable Lateral: Registro Clínico (Solo Médico) */}
      {showNotes && isDoctor && (
        <View className="absolute top-0 bottom-0 right-0 w-full max-w-[420px] bg-white z-30 pt-10 sm:pt-6" style={{ shadowColor: '#000', shadowOffset: { width: -10, height: 0 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 20 }}>
          <View className="flex-row justify-between items-center px-6 py-5 border-b border-slate-100">
            <Text className="text-slate-900 text-[18px] font-extrabold">Historial Clínico</Text>
            <TouchableOpacity onPress={() => setShowNotes(false)} className="bg-slate-100 w-8 h-8 rounded-full items-center justify-center">
              <Ionicons name="close" size={20} color="#64748b" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
            {/* Resumen del Triaje */}
            {patientTriage && (
              <View className="bg-slate-50 rounded-[20px] p-5 border border-slate-100 mb-6">
                <Text className="text-[11px] text-slate-400 font-extrabold tracking-widest mb-3">RESUMEN DE TRIAJE IA</Text>
                
                <Text className="text-[11px] text-slate-400 font-bold uppercase mb-1">Nivel de Urgencia</Text>
                <Text className={`text-[14px] font-extrabold mb-3 ${patientTriage.urgency_level === 'Critical' ? 'text-red-500' : 'text-amber-500'}`}>
                  {patientTriage.urgency_level === 'Critical' ? 'CRÍTICO' : 'MEDIO'}
                </Text>
                
                <Text className="text-[11px] text-slate-400 font-bold uppercase mb-1">Síntomas analizados</Text>
                <Text className="text-slate-700 text-[13px] leading-5 mb-3">{patientTriage.reported_symptoms}</Text>
                
                <Text className="text-[11px] text-slate-400 font-bold uppercase mb-1">Recomendación IA</Text>
                <Text className="text-slate-700 text-[13px] leading-5">{patientTriage.ai_recommendation}</Text>
              </View>
            )}

            {/* Inputs clínicos */}
            <View className="mb-5">
              <Text className="text-slate-600 text-[13px] font-bold mb-2">Diagnóstico Clínico *</Text>
              <TextInput
                className="bg-slate-50 border border-slate-200 rounded-[16px] p-4 text-slate-900 text-[14px] min-h-[90px]"
                placeholder="Indique el diagnóstico final del paciente..."
                placeholderTextColor="#94a3b8"
                multiline
                textAlignVertical="top"
                value={diagnosis}
                onChangeText={setDiagnosis}
              />
            </View>

            <View className="mb-5">
              <Text className="text-slate-600 text-[13px] font-bold mb-2">Tratamiento / Receta Electrónica *</Text>
              <TextInput
                className="bg-slate-50 border border-slate-200 rounded-[16px] p-4 text-slate-900 text-[14px] min-h-[90px]"
                placeholder="Medicamentos, dosis e indicaciones..."
                placeholderTextColor="#94a3b8"
                multiline
                textAlignVertical="top"
                value={treatment}
                onChangeText={setTreatment}
              />
            </View>

            <View className="mb-6">
              <Text className="text-slate-600 text-[13px] font-bold mb-2">Notas Internas</Text>
              <TextInput
                className="bg-slate-50 border border-slate-200 rounded-[16px] p-4 text-slate-900 text-[14px] min-h-[70px]"
                placeholder="Notas adicionales privadas..."
                placeholderTextColor="#94a3b8"
                multiline
                textAlignVertical="top"
                value={notes}
                onChangeText={setNotes}
              />
            </View>

            <TouchableOpacity 
              className={`py-4 rounded-[16px] flex-row justify-center items-center ${savingNotes ? 'bg-emerald-400' : 'bg-emerald-500'}`}
              style={{ shadowColor: '#10b981', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 3, elevation: 2 }}
              activeOpacity={0.8}
              onPress={handleSaveMedicalRecord}
              disabled={savingNotes}
            >
              {savingNotes ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color="#ffffff" />
                  <Text className="text-white font-extrabold text-[15px] ml-2">Guardar y Finalizar</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}

      {/* Panel Deslizable Lateral: Registro Médico para Pacientes */}
      {showPatientRecord && !isDoctor && (
        <View className="absolute top-0 bottom-0 right-0 w-full max-w-[420px] bg-white z-30 pt-10 sm:pt-6 shadow-2xl">
          <View className="flex-row justify-between items-center px-6 py-5 border-b border-slate-100">
            <Text className="text-slate-900 text-[18px] font-extrabold">Mi Consulta</Text>
            <TouchableOpacity onPress={() => setShowPatientRecord(false)} className="bg-slate-100 w-8 h-8 rounded-full items-center justify-center">
              <Ionicons name="close" size={20} color="#64748b" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
            {fetchingRecord ? (
              <View className="items-center py-10">
                <ActivityIndicator size="small" color="#3b82f6" />
                <Text className="text-slate-400 mt-4 text-[14px] font-medium">Buscando indicaciones...</Text>
              </View>
            ) : medicalRecord ? (
              <View>
                <View className="bg-blue-50/50 rounded-[20px] p-5 border border-blue-100/50 mb-6">
                  <Text className="text-[11px] text-blue-400 font-extrabold tracking-widest mb-3">DATOS DE LA RECETA</Text>
                  
                  <Text className="text-[11px] text-slate-400 font-bold uppercase mb-1">Médico Tratante</Text>
                  <Text className="text-[15px] text-blue-600 font-extrabold mb-3">{doctorNameParam}</Text>
                  
                  <Text className="text-[11px] text-slate-400 font-bold uppercase mb-1">Fecha de Emisión</Text>
                  <Text className="text-slate-700 text-[14px] font-medium">
                    {new Date(medicalRecord.created_at).toLocaleString('es-BO', {
                      day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
                    })}
                  </Text>
                </View>

                <View className="mb-6">
                  <Text className="text-slate-600 text-[13px] font-bold mb-2">Diagnóstico Clínico</Text>
                  <View className="bg-slate-50 border border-slate-200 rounded-[16px] p-5 min-h-[90px]">
                    <Text className="text-slate-800 text-[14px] leading-6">{medicalRecord.diagnosis || 'No especificado'}</Text>
                  </View>
                </View>

                <View className="mb-6">
                  <Text className="text-emerald-700 text-[13px] font-bold mb-2">Tratamiento / Receta Médica</Text>
                  <View className="bg-emerald-50 border border-emerald-200/60 rounded-[16px] p-5 min-h-[90px]">
                    <Text className="text-emerald-900 text-[14px] leading-6 font-medium">{medicalRecord.treatment_plan || 'No especificado'}</Text>
                  </View>
                </View>

                <View className="bg-slate-50 rounded-xl p-4 flex-row items-center mt-2 border border-slate-100">
                  <Ionicons name="information-circle" size={20} color="#94a3b8" />
                  <Text className="text-slate-500 text-[12px] leading-4 ml-3 flex-1">
                    Esta receta digital ya está disponible permanentemente en tu historial clínico del menú principal.
                  </Text>
                </View>
              </View>
            ) : (
              <View className="items-center justify-center py-16">
                <View className="w-20 h-20 rounded-full bg-slate-50 justify-center items-center mb-6">
                  <Ionicons name="document-text-outline" size={32} color="#94a3b8" />
                </View>
                <Text className="text-slate-500 text-[16px] font-bold text-center">Aún sin registros</Text>
                <Text className="text-slate-400 text-[14px] mt-2 text-center leading-6 max-w-[280px]">
                  El médico está redactando tu diagnóstico y receta. Aparecerán aquí automáticamente.
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      )}

      {/* Botón flotante para salir directamente en la esquina superior */}
      <TouchableOpacity 
        className="absolute top-12 left-6 w-11 h-11 rounded-full bg-slate-900/60 justify-center items-center z-20 border border-slate-700/50"
        style={{ backdropFilter: 'blur(8px)' }}
        onPress={returnToMenu}
      >
        <Ionicons name="arrow-back" size={20} color="#ffffff" />
      </TouchableOpacity>

      <CustomModal 
        visible={modalConfig.visible}
        title={modalConfig.title}
        message={modalConfig.message}
        type={modalConfig.type}
        onConfirm={modalConfig.onConfirm || closeModal}
        onCancel={modalConfig.onCancel}
        confirmText={modalConfig.confirmText}
      />
    </SafeAreaView>
  );
}


import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, TextInput, ActivityIndicator, Image } from 'react-native';
import { WebView } from 'react-native-webview';
import { Camera } from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import CustomModal from '@/components/CustomModal';

export default function VideoCallScreen() {
  const params = useLocalSearchParams();
  const role = params.role || 'patient'; // 'doctor' or 'patient'
  const patientId = params.patientId;
  const patientNameParam = params.patientName || 'Paciente';
  const triageId = params.triageId;
  const doctorNameParam = params.doctorName || 'Médico Asignado';

  const isDoctor = role === 'doctor';

  // Estados de control de la llamada
  const [micActive, setMicActive] = useState(true);
  const [camActive, setCamActive] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  const [connecting, setConnecting] = useState(true);
  const [isCallEnded, setIsCallEnded] = useState(false);

  // Paneles de interacción
  const [showChat, setShowChat] = useState(false);
  const [showNotes, setShowNotes] = useState(false); // Solo médico
  
  // Chat interno de la videollamada
  const [messages, setMessages] = useState<any[]>([
    { id: '1', sender: isDoctor ? 'patient' : 'doctor', text: 'Hola, buenas tardes.', time: '14:30' },
  ]);
  const [chatInput, setChatInput] = useState('');

  // Formulario clínico (Doctor)
  const [diagnosis, setDiagnosis] = useState('');
  const [treatment, setTreatment] = useState('');
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  // Datos de triaje del paciente (Doctor)
  const [patientTriage, setPatientTriage] = useState<any>(null);

  // Estados para ver el registro médico (Paciente)
  const [showPatientRecord, setShowPatientRecord] = useState(false);
  const [medicalRecord, setMedicalRecord] = useState<any>(null);
  const [fetchingRecord, setFetchingRecord] = useState(false);
  const [appointmentId, setAppointmentId] = useState<string | null>(null);

  // Referencias para la cámara local en Web
  const localVideoRef = useRef<any>(null);
  const localStreamRef = useRef<any>(null);

  // Configuración del modal de alertas
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

  const closeModal = () => setModalConfig(prev => ({ ...prev, visible: false }));

  // Contadores y temporizadores
  useEffect(() => {
    // Pedir permisos en móviles antes de renderizar Jitsi
    const requestPermissions = async () => {
      if (Platform.OS !== 'web') {
        try {
          const { status: cameraStatus } = await Camera.requestCameraPermissionsAsync();
          const { status: audioStatus } = await Camera.requestMicrophonePermissionsAsync();
          if (cameraStatus !== 'granted' || audioStatus !== 'granted') {
            console.warn('Los permisos de cámara/micrófono son necesarios.');
          }
        } catch (e) {
          console.warn('Error solicitando permisos', e);
        }
      }
    };
    requestPermissions();

    // Simular retraso de conexión de 3 segundos
    const connTimeout = setTimeout(() => {
      setConnecting(false);
    }, 3000);

    // Cronómetro de llamada
    const interval = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);

    // Limpiar historial previo si cambia el paciente (Expo Router reusa el componente)
    setDiagnosis('');
    setTreatment('');
    setNotes('');
    setMedicalRecord(null);
    setShowNotes(false);
    setShowPatientRecord(false);
    setShowChat(false);

    // Obtener datos del triaje si es doctor
    if (isDoctor && triageId) {
      fetchTriageData();
    }

    return () => {
      clearTimeout(connTimeout);
      clearInterval(interval);
      // Apagar cámara si está activa (en Web)
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track: any) => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web' && camActive && !connecting && !isCallEnded) {
      startLocalCamera();
    } else {
      stopLocalCamera();
    }
  }, [camActive, connecting, isCallEnded]);

  const startLocalCamera = async () => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false // El audio no lo capturamos para evitar acoples locales
        });
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      }
    } catch (err) {
      console.warn('No se pudo acceder a la cámara física:', err);
    }
  };

  const stopLocalCamera = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track: any) => track.stop());
      localStreamRef.current = null;
    }
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
  };

  // Obtener el appointment_id y activar consulta periódica para el paciente
  useEffect(() => {
    if (isDoctor) return;

    let active = true;
    let pollInterval: any = null;

    const initPatientPolling = async () => {
      if (!triageId) return;
      try {
        const { data: appt } = await supabase
          .from('appointments')
          .select('id')
          .eq('triage_id', triageId)
          .limit(1)
          .maybeSingle();

        if (appt && active) {
          setAppointmentId(appt.id);
          // Primera búsqueda
          fetchPatientRecord(appt.id);
          
          // Encuesta cada 5 segundos
          pollInterval = setInterval(() => {
            if (active) {
              fetchPatientRecord(appt.id);
            }
          }, 5000);
        } else if (active) {
          // Si no hay appointment aún, intentamos buscar de todas formas cada 5 segundos
          fetchPatientRecord();
          pollInterval = setInterval(() => {
            if (active) {
              fetchPatientRecord();
            }
          }, 5000);
        }
      } catch (err) {
        console.error('Error al inicializar consulta de registro:', err);
      }
    };

    initPatientPolling();

    return () => {
      active = false;
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [triageId]);

  // Suscripción Realtime para indicaciones médicas y fin de llamada (Paciente)
  useEffect(() => {
    if (isDoctor || !triageId) return;

    // 1. Canal para cuando el doctor finaliza y guarda la receta
    const callChannel = supabase
      .channel(`rt_call_${triageId}`)
      .on('broadcast', { event: 'call_ended' }, async (payload) => {
        setIsCallEnded(true);
        
        // El paciente actualiza su propio triage a completado para evitar bloqueos de RLS del doctor
        await supabase.from('triages').update({ status: 'completed' }).eq('id', triageId);

        setMedicalRecord({
          diagnosis: payload.payload.diagnosis,
          treatment_plan: payload.payload.treatment_plan,
          created_at: new Date().toISOString()
        });
        setModalConfig({
          visible: true,
          title: 'Consulta Finalizada',
          message: 'El doctor ha finalizado la consulta y emitido tu receta digital. La videollamada ha terminado.',
          type: 'alert',
          confirmText: 'Ver Receta Digital',
          onConfirm: () => {
            closeModal();
            setShowPatientRecord(true);
            setShowChat(false);
          },
        });
      })
      .subscribe();

    // 2. Canal tradicional a nivel DB (por si falla el broadcast)
    let dbChannel: any = null;
    if (appointmentId) {
      dbChannel = supabase
        .channel(`rt_db_${appointmentId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'medical_records', filter: `appointment_id=eq.${appointmentId}` },
          (payload) => {
            if (payload.new) {
              setMedicalRecord((prev: any) => {
                if (!prev) {
                  setIsCallEnded(true);
                  setModalConfig({
                    visible: true,
                    title: 'Nueva Indicación Médica',
                    message: 'El doctor ha registrado tu diagnóstico y tratamiento.',
                    type: 'alert',
                    confirmText: 'Ver Registro',
                    onConfirm: () => {
                      closeModal();
                      setShowPatientRecord(true);
                      setShowChat(false);
                    },
                    onCancel: closeModal,
                  });
                }
                return payload.new;
              });
            }
          }
        )
        .subscribe();
    }

    return () => {
      supabase.removeChannel(callChannel);
      if (dbChannel) supabase.removeChannel(dbChannel);
    };
  }, [triageId, appointmentId]);

  const fetchPatientRecord = async (apptId?: string) => {
    try {
      let targetApptId = apptId || appointmentId;
      
      // Intentar obtener el appointment_id asociado al triage si no lo tenemos
      if (!targetApptId && triageId) {
        const { data: appt } = await supabase
          .from('appointments')
          .select('id')
          .eq('triage_id', triageId)
          .limit(1)
          .maybeSingle();
        if (appt) {
          targetApptId = appt.id;
          setAppointmentId(appt.id);
        }
      }

      // Si tenemos un appointment_id, buscamos por él
      if (targetApptId) {
        const { data, error } = await supabase
          .from('medical_records')
          .select('*')
          .eq('appointment_id', targetApptId)
          .limit(1)
          .maybeSingle();

        if (error) throw error;
        if (data) {
          setMedicalRecord((prev: any) => {
            if (!prev) {
              setModalConfig({
                visible: true,
                title: 'Nueva Indicación Médica',
                message: 'El doctor ha registrado tu diagnóstico y tratamiento. Puedes revisarlo presionando el botón de Registro Clínico en la llamada.',
                type: 'alert',
                confirmText: 'Ver Registro',
                onConfirm: () => {
                  closeModal();
                  setShowPatientRecord(true);
                  setShowChat(false);
                },
                onCancel: closeModal,
              });
            }
            return data;
          });
          return;
        }
      }
      // NOTA: Se eliminó el "fallback" por patientId porque causaba que se cargaran
      // recetas antiguas de otras consultas si el paciente probaba la app varias veces.
    } catch (err) {
      console.warn('Error al buscar registro médico del paciente:', err);
    }
  };

  const handleOpenPatientRecord = async () => {
    setShowPatientRecord(true);
    setShowChat(false);
    setFetchingRecord(true);
    await fetchPatientRecord();
    setFetchingRecord(false);
  };

  const fetchTriageData = async () => {
    try {
      const { data, error } = await supabase
        .from('triages')
        .select(`
          *,
          patients (
            id,
            blood_type,
            allergies,
            emergency_contact,
            profiles (
              full_name,
              identity_card
            )
          )
        `)
        .eq('id', triageId)
        .single();
      if (error) throw error;
      setPatientTriage(data);
    } catch (err) {
      console.error('Error cargando triaje para videollamada:', err);
    }
  };

  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSendMessage = () => {
    if (!chatInput.trim()) return;
    const newMsg = {
      id: Date.now().toString(),
      sender: 'self',
      text: chatInput,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setMessages(prev => [...prev, newMsg]);
    setChatInput('');

    // Simular respuesta automática del paciente/médico tras 2 segundos
    setTimeout(() => {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        sender: isDoctor ? 'patient' : 'doctor',
        text: isDoctor ? 'Entendido doctor, ya anoté la indicación.' : 'De acuerdo, por favor tome asiento.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
    }, 2000);
  };

  const handleSaveMedicalRecord = async () => {
    if (!diagnosis || !treatment) {
      setModalConfig({
        visible: true,
        title: 'Campos requeridos',
        message: 'Por favor complete el Diagnóstico y el Tratamiento.',
        type: 'alert',
        confirmText: 'Entendido',
        onConfirm: closeModal,
        onCancel: closeModal
      });
      return;
    }

    setSavingNotes(true);
    try {
      // 1. Obtener usuario autenticado (médico)
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No hay una sesión médica activa.');

      // 2. Obtener el appointment_id asociado al triage
      let appointmentId = null;
      if (triageId) {
        const { data: appt } = await supabase
          .from('appointments')
          .select('id')
          .eq('triage_id', triageId)
          .limit(1)
          .maybeSingle();
        if (appt) {
          appointmentId = appt.id;
        }
      }

      // 3. Guardar en la tabla medical_records
      const { error } = await supabase.from('medical_records').insert({
        patient_id: patientId || null,
        doctor_id: user.id,
        appointment_id: appointmentId,
        diagnosis: diagnosis,
        treatment_plan: treatment,
        clinical_notes: notes || null,
      });

      if (error) throw error;

      // 4. Marcar el triage como completado
      if (triageId) {
        const { error: updateTriageError } = await supabase.from('triages').update({ status: 'completed' }).eq('id', triageId).select().single();
        if (updateTriageError) {
           console.error('Error al completar el triaje:', updateTriageError);
           throw new Error('El registro se guardó, pero falló el cambio de estado de la cita. Supabase dice: ' + updateTriageError.message + ' (Code: ' + updateTriageError.code + ')');
        }
      }

      // 5. Señal Broadcast instantánea al paciente para cortar su llamada
      if (triageId) {
        const channel = supabase.channel(`rt_call_${triageId}`);
        channel.subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await channel.send({
              type: 'broadcast',
              event: 'call_ended',
              payload: { diagnosis, treatment_plan: treatment }
            });
          }
        });
      }

      setSavingNotes(false);
      setIsCallEnded(true); // Corta la cámara del doctor instantáneamente
      setModalConfig({
        visible: true,
        title: 'Historial Guardado',
        message: 'El registro e historial médico ha sido guardado exitosamente. La llamada ha finalizado.',
        type: 'alert',
        confirmText: 'Volver al Inicio',
        onCancel: closeModal,
        onConfirm: () => {
          closeModal();
          router.replace('/(doctor)/dashboard');
        }
      });
    } catch (error: any) {
      console.error('Error al guardar registro médico:', error);
      setSavingNotes(false);
      setModalConfig({
        visible: true,
        title: 'Error al Guardar',
        message: error.message || 'No se pudo guardar el registro clínico en la base de datos.',
        type: 'alert',
        confirmText: 'Aceptar',
        onCancel: closeModal,
        onConfirm: closeModal
      });
    }
  };

  const handleEndCall = () => {
    if (isDoctor) {
      // Si el doctor cuelga, le recordamos guardar la ficha
      if (diagnosis && treatment) {
        setIsCallEnded(true);
        router.replace('/(doctor)/dashboard');
      } else {
        setModalConfig({
          visible: true,
          title: 'Registro Incompleto',
          message: 'Se recomienda llenar el Registro Médico antes de salir. Si deseas salir sin registrar, puedes confirmarlo ahora.',
          type: 'confirm',
          confirmText: 'Salir sin guardar',
          onCancel: closeModal,
          onConfirm: async () => {
            closeModal();
            setIsCallEnded(true);
            
            // Forzar completado del triage si el médico se va
            if (triageId) {
              await supabase.from('triages').update({ status: 'completed' }).eq('id', triageId);
              const channel = supabase.channel(`rt_call_${triageId}`);
              channel.subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                  await channel.send({
                    type: 'broadcast',
                    event: 'call_ended',
                    payload: { diagnosis: 'Consulta finalizada sin registro.', treatment_plan: 'Contacte a administración.' }
                  });
                }
              });
            }
            
            router.replace('/(doctor)/dashboard');
          }
        });
        setShowNotes(true);
      }
    } else {
      setIsCallEnded(true);
      router.replace('/(patient)/menu');
    }
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

  const videoUrl = `${WHEREBY_BASE_URL}?${wherebyParams}`;
  
  // Enlace externo (Por si se quiere abrir fuera de la app)
  const launchExternalMeet = () => {
    if (Platform.OS === 'web') {
      window.open(videoUrl, '_blank');
    } else {
      router.push(videoUrl as any);
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
        onPress={() => router.replace(isDoctor ? '/(doctor)/dashboard' : '/(patient)/menu')}
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


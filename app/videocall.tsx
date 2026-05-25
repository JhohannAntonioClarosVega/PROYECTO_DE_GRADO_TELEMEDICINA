import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, TextInput, ActivityIndicator, Image } from 'react-native';
import { WebView } from 'react-native-webview';
import { Camera } from 'expo-camera';
import { Audio } from 'expo-av';
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
  const [modalConfig, setModalConfig] = useState({
    visible: false,
    title: '',
    message: '',
    type: 'alert' as 'alert'|'confirm',
    confirmText: 'Aceptar',
    onConfirm: () => {},
    onCancel: () => {}
  });

  const closeModal = () => setModalConfig(prev => ({ ...prev, visible: false }));

  // Contadores y temporizadores
  useEffect(() => {
    // Pedir permisos en móviles antes de renderizar Jitsi
    const requestPermissions = async () => {
      if (Platform.OS !== 'web') {
        try {
          const { status: cameraStatus } = await Camera.requestCameraPermissionsAsync();
          const { status: audioStatus } = await Audio.requestPermissionsAsync();
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

  // Control de la cámara local física en Web
  useEffect(() => {
    if (Platform.OS === 'web' && camActive && !connecting) {
      startLocalCamera();
    } else {
      stopLocalCamera();
    }
  }, [camActive, connecting]);

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

  // Suscripción Realtime para la tabla medical_records del paciente
  useEffect(() => {
    if (isDoctor || !patientId) return;

    const channel = supabase
      .channel('realtime_patient_medical_record')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'medical_records',
          filter: `patient_id=eq.${patientId}`,
        },
        (payload) => {
          if (payload.new) {
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
              return payload.new;
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [patientId]);

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

      // Fallback: buscar el último registro médico reciente de este paciente (última hora)
      if (patientId) {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const { data, error } = await supabase
          .from('medical_records')
          .select('*')
          .eq('patient_id', patientId)
          .gte('created_at', oneHourAgo)
          .order('created_at', { ascending: false })
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
        }
      }
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

      setSavingNotes(false);
      setModalConfig({
        visible: true,
        title: 'Historial Guardado',
        message: 'El registro e historial médico ha sido guardado exitosamente.',
        type: 'alert',
        confirmText: 'Aceptar',
        onCancel: closeModal,
        onConfirm: () => {
          closeModal();
          router.replace('/dashboard');
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
        router.replace('/dashboard');
      } else {
        setModalConfig({
          visible: true,
          title: 'Registro Incompleto',
          message: 'Se recomienda llenar el Registro Médico antes de salir. Si deseas salir sin registrar, puedes confirmarlo ahora.',
          type: 'confirm',
          confirmText: 'Salir sin guardar',
          onCancel: closeModal,
          onConfirm: () => {
            closeModal();
            router.replace('/dashboard');
          }
        });
        setShowNotes(true);
      }
    } else {
      router.replace('/patient-menu');
    }
  };

  const roomName = `Telemedicina_Cochabamba_${triageId || 'sala_general'}`;
  const jitsiUrl = `https://meet.jit.si/${roomName}#config.prejoinPageEnabled=false`;

  // Enlace a Jitsi Meet real para videollamada funcional WebRTC (Por si se quiere abrir externo)
  const launchJitsiMeet = () => {
    const roomName = `Telemedicina_Cochabamba_${triageId || 'consulta'}`;
    const jitsiUrl = `https://meet.jit.si/${roomName}#config.prejoinPageEnabled=false`;
    if (Platform.OS === 'web') {
      window.open(jitsiUrl, '_blank');
    } else {
      // En móvil redirige mediante WebBrowser o enlace directo
      router.push(jitsiUrl as any);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Contenido de Video Principal */}
      <View style={styles.videoGrid}>
        {connecting ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={styles.connectingText}>Estableciendo canal seguro encriptado...</Text>
            <Text style={styles.subConnectingText}>Telemedicina IA - Cochabamba</Text>
          </View>
        ) : (
          <View style={styles.remoteVideoContainer}>
            {/* Videollamada Real con Jitsi incrustado */}
            {Platform.OS === 'web' ? (
              <iframe 
                src={jitsiUrl}
                allow="camera; microphone; fullscreen; display-capture; autoplay"
                style={{ width: '100%', height: '100%', border: 'none' }}
              />
            ) : (
              <WebView
                source={{ uri: jitsiUrl }}
                style={{ flex: 1 }}
                allowsInlineMediaPlayback={true}
                mediaPlaybackRequiresUserAction={false}
                javaScriptEnabled={true}
              />
            )}
          </View>
        )}
      </View>

      {/* Barra de Herramientas Flotante Inferior */}
      <View style={styles.controlBar}>
        <TouchableOpacity 
          style={[styles.controlBtn, !micActive && styles.controlBtnActive]}
          onPress={() => setMicActive(!micActive)}
          activeOpacity={0.7}
        >
          <Ionicons 
            name={micActive ? "mic" : "mic-off"} 
            size={22} 
            color={micActive ? "#ffffff" : "#ef4444"} 
          />
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.controlBtn, !camActive && styles.controlBtnActive]}
          onPress={() => setCamActive(!camActive)}
          activeOpacity={0.7}
        >
          <Ionicons 
            name={camActive ? "videocam" : "videocam-off"} 
            size={22} 
            color={camActive ? "#ffffff" : "#ef4444"} 
          />
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.controlBtn, showChat && styles.controlBtnActivePanel]}
          onPress={() => {
            setShowChat(!showChat);
            setShowNotes(false);
            setShowPatientRecord(false);
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="chatbubbles" size={22} color="#ffffff" />
          {messages.length > 0 && <View style={styles.badgeDot} />}
        </TouchableOpacity>

        {isDoctor ? (
          <TouchableOpacity 
            style={[styles.controlBtn, showNotes && styles.controlBtnActivePanel]}
            onPress={() => {
              setShowNotes(!showNotes);
              setShowChat(false);
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="document-text" size={22} color="#ffffff" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity 
            style={[styles.controlBtn, showPatientRecord && styles.controlBtnActivePanel]}
            onPress={() => {
              if (showPatientRecord) {
                setShowPatientRecord(false);
              } else {
                handleOpenPatientRecord();
              }
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="document-text" size={22} color="#ffffff" />
            {medicalRecord && <View style={[styles.badgeDot, { backgroundColor: '#10b981' }]} />}
          </TouchableOpacity>
        )}

        <TouchableOpacity 
          style={[styles.controlBtn, styles.jitsiBtn]}
          onPress={launchJitsiMeet}
          activeOpacity={0.7}
        >
          <Ionicons name="globe-outline" size={20} color="#10b981" />
          <Text style={styles.jitsiBtnText}>Jitsi</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.controlBtn, styles.endCallBtn]}
          onPress={handleEndCall}
          activeOpacity={0.7}
        >
          <Ionicons name="call" size={22} color="#ffffff" />
        </TouchableOpacity>
      </View>

      {/* Panel Deslizable Lateral: Chat */}
      {showChat && (
        <View style={styles.sidePanel}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>Chat de Consulta</Text>
            <TouchableOpacity onPress={() => setShowChat(false)}>
              <Ionicons name="close" size={24} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.messageList} contentContainerStyle={{ padding: 12 }}>
            {messages.map(msg => (
              <View 
                key={msg.id} 
                style={[
                  styles.msgBubble, 
                  msg.sender === 'self' ? styles.msgSelf : styles.msgRemote
                ]}
              >
                <Text style={styles.msgText}>{msg.text}</Text>
                <Text style={styles.msgTime}>{msg.time}</Text>
              </View>
            ))}
          </ScrollView>

          <View style={styles.chatInputContainer}>
            <TextInput
              style={styles.chatInput}
              placeholder="Escribe un mensaje..."
              placeholderTextColor="#64748b"
              value={chatInput}
              onChangeText={setChatInput}
              onSubmitEditing={handleSendMessage}
            />
            <TouchableOpacity style={styles.chatSendBtn} onPress={handleSendMessage}>
              <Ionicons name="send" size={16} color="#ffffff" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Panel Deslizable Lateral: Registro Clínico (Solo Médico) */}
      {showNotes && isDoctor && (
        <View style={[styles.sidePanel, styles.notesPanel]}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>Registro e Historial Clínico</Text>
            <TouchableOpacity onPress={() => setShowNotes(false)}>
              <Ionicons name="close" size={24} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.notesScrollContent}>
            {/* Resumen del Triaje */}
            {patientTriage && (
              <View style={styles.triageBriefCard}>
                <Text style={styles.triageBriefTitle}>RESUMEN DE TRIAJE IA</Text>
                <Text style={styles.triageBriefLabel}>Nivel de Urgencia:</Text>
                <Text style={[styles.triageBriefValue, { color: patientTriage.urgency_level === 'Critical' ? '#ef4444' : '#f59e0b' }]}>
                  {patientTriage.urgency_level === 'Critical' ? 'CRÍTICO' : 'MEDIO'}
                </Text>
                <Text style={styles.triageBriefLabel}>Síntomas analizados:</Text>
                <Text style={styles.triageBriefText}>{patientTriage.reported_symptoms}</Text>
                <Text style={styles.triageBriefLabel}>Recomendación del sistema:</Text>
                <Text style={styles.triageBriefText}>{patientTriage.ai_recommendation}</Text>
              </View>
            )}

            {/* Inputs clínicos */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Diagnóstico Clínico *</Text>
              <TextInput
                style={styles.panelTextArea}
                placeholder="Indique el diagnóstico final del paciente..."
                placeholderTextColor="#64748b"
                multiline
                textAlignVertical="top"
                value={diagnosis}
                onChangeText={setDiagnosis}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Tratamiento / Receta Electrónica *</Text>
              <TextInput
                style={styles.panelTextArea}
                placeholder="Medicamentos, dosis e indicaciones..."
                placeholderTextColor="#64748b"
                multiline
                textAlignVertical="top"
                value={treatment}
                onChangeText={setTreatment}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Notas Internas</Text>
              <TextInput
                style={[styles.panelTextArea, { minHeight: 60 }]}
                placeholder="Notas adicionales privadas..."
                placeholderTextColor="#64748b"
                multiline
                textAlignVertical="top"
                value={notes}
                onChangeText={setNotes}
              />
            </View>

            <TouchableOpacity 
              style={styles.saveBtn} 
              activeOpacity={0.8}
              onPress={handleSaveMedicalRecord}
              disabled={savingNotes}
            >
              {savingNotes ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={18} color="#ffffff" />
                  <Text style={styles.saveBtnText}>Guardar y Cerrar Consulta</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}

      {/* Panel Deslizable Lateral: Registro Médico para Pacientes */}
      {showPatientRecord && !isDoctor && (
        <View style={[styles.sidePanel, styles.notesPanel]}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>Mi Registro de Consulta</Text>
            <TouchableOpacity onPress={() => setShowPatientRecord(false)}>
              <Ionicons name="close" size={24} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.notesScrollContent}>
            {fetchingRecord ? (
              <View style={styles.centerContainer}>
                <ActivityIndicator size="small" color="#3b82f6" />
                <Text style={{ color: '#94a3b8', marginTop: 10, fontWeight: '500' }}>Buscando indicaciones...</Text>
              </View>
            ) : medicalRecord ? (
              <View>
                <View style={styles.triageBriefCard}>
                  <Text style={styles.triageBriefTitle}>INFORMACIÓN DE LA CONSULTA</Text>
                  <Text style={styles.triageBriefLabel}>Médico Tratante:</Text>
                  <Text style={[styles.triageBriefValue, { color: '#3b82f6' }]}>
                    {doctorNameParam}
                  </Text>
                  
                  <Text style={styles.triageBriefLabel}>Fecha y Hora:</Text>
                  <Text style={styles.triageBriefText}>
                    {new Date(medicalRecord.created_at).toLocaleString('es-BO', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </Text>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Diagnóstico Clínico</Text>
                  <View style={styles.patientRecordBox}>
                    <Text style={styles.patientRecordText}>
                      {medicalRecord.diagnosis || 'No especificado'}
                    </Text>
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Tratamiento / Receta Electrónica</Text>
                  <View style={[styles.patientRecordBox, { borderColor: 'rgba(16, 185, 129, 0.4)' }]}>
                    <Text style={styles.patientRecordText}>
                      {medicalRecord.treatment_plan || 'No especificado'}
                    </Text>
                  </View>
                </View>

                <Text style={{ color: '#64748b', fontSize: 12, textAlign: 'center', marginTop: 12, lineHeight: 16 }}>
                  Este registro ya está disponible en tu historial clínico del menú principal.
                </Text>
              </View>
            ) : (
              <View style={[styles.centerContainer, { paddingVertical: 40 }]}>
                <Ionicons name="document-text-outline" size={48} color="#475569" />
                <Text style={{ color: '#94a3b8', textAlign: 'center', marginTop: 12, fontSize: 14, fontWeight: '600' }}>
                  Aún no se ha guardado el registro.
                </Text>
                <Text style={{ color: '#64748b', textAlign: 'center', marginTop: 6, fontSize: 12, lineHeight: 18 }}>
                  El médico está registrando tu diagnóstico y receta. Se mostrará aquí de forma automática en cuanto se guarde.
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      )}

      {/* Botón flotante para salir directamente en la esquina superior */}
      <TouchableOpacity 
        style={styles.closeCallHeaderBtn} 
        onPress={() => router.replace(isDoctor ? '/dashboard' : '/patient-menu')}
      >
        <Ionicons name="close" size={24} color="#ffffff" />
      </TouchableOpacity>

      <CustomModal 
        visible={modalConfig.visible}
        title={modalConfig.title}
        message={modalConfig.message}
        type={modalConfig.type}
        onConfirm={modalConfig.onConfirm}
        onCancel={modalConfig.onCancel}
        confirmText={modalConfig.confirmText}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090d16', // Slate dark premium
  },
  videoGrid: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  connectingText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 20,
    textAlign: 'center',
  },
  subConnectingText: {
    color: '#64748b',
    fontSize: 14,
    marginTop: 6,
    fontWeight: '500',
  },
  remoteVideoContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
    backgroundColor: '#111827',
  },
  remoteVideoPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    padding: 24,
  },
  remoteAvatar: {
    marginBottom: 16,
  },
  remoteName: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  remoteStatus: {
    color: '#3b82f6',
    fontSize: 13,
    marginTop: 6,
    fontWeight: '600',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 24,
    height: 40,
  },
  waveBar: {
    width: 4,
    backgroundColor: '#10b981', // Verde esmeralda para ondas
    borderRadius: 2,
  },
  localVideoContainer: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 110,
    height: 160,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#3b82f6',
    backgroundColor: '#1e293b',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  webVideoElement: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  mobileCameraMock: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#334155',
  },
  mobileCamText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  controlBar: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 60 : 40,
    alignSelf: 'center',
    flexDirection: 'row',
    backgroundColor: 'rgba(15, 23, 42, 0.85)', // Glassmorphic
    borderRadius: 30,
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(51, 65, 85, 0.5)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 20,
  },
  controlBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  controlBtnActive: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  controlBtnActivePanel: {
    backgroundColor: '#3b82f6',
  },
  badgeDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
  },
  jitsiBtn: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    width: 'auto',
    borderRadius: 20,
    gap: 4,
  },
  jitsiBtnText: {
    color: '#10b981',
    fontWeight: '700',
    fontSize: 12,
  },
  endCallBtn: {
    backgroundColor: '#ef4444', // Red end call button
    transform: [{ rotate: '135deg' }],
  },
  closeCallHeaderBtn: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 40 : 20,
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  sidePanel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#0f172a',
    borderLeftWidth: 1,
    borderLeftColor: '#1e293b',
    zIndex: 30,
    flexDirection: 'column',
  },
  notesPanel: {
    maxWidth: 400,
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    paddingTop: Platform.OS === 'android' ? 40 : 16,
  },
  panelTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  messageList: {
    flex: 1,
  },
  msgBubble: {
    padding: 12,
    borderRadius: 14,
    marginBottom: 10,
    maxWidth: '85%',
  },
  msgSelf: {
    backgroundColor: '#3b82f6',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 2,
  },
  msgRemote: {
    backgroundColor: '#1e293b',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 2,
  },
  msgText: {
    color: '#ffffff',
    fontSize: 14,
  },
  msgTime: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  chatInputContainer: {
    flexDirection: 'row',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    backgroundColor: '#090d16',
    alignItems: 'center',
    gap: 8,
  },
  chatInput: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 8,
    color: '#ffffff',
    fontSize: 14,
  },
  chatSendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  notesScrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  triageBriefCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 20,
  },
  triageBriefTitle: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  triageBriefLabel: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 8,
    textTransform: 'uppercase',
  },
  triageBriefValue: {
    fontSize: 14,
    fontWeight: '800',
    marginTop: 2,
  },
  triageBriefText: {
    color: '#e2e8f0',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  panelTextArea: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    padding: 12,
    minHeight: 85,
    color: '#ffffff',
    fontSize: 14,
  },
  saveBtn: {
    backgroundColor: '#10b981',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 14,
    borderRadius: 10,
    gap: 8,
    marginTop: 10,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  saveBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 15,
  },
  patientRecordBox: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    padding: 12,
    minHeight: 80,
    marginTop: 4,
  },
  patientRecordText: {
    color: '#ffffff',
    fontSize: 14,
    lineHeight: 20,
  }
});

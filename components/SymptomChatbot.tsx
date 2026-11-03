import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { triageService } from '@/services/triage.service';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import CustomModal from '@/components/CustomModal';
import * as Speech from 'expo-speech';
import { useAudioRecorder, RecordingPresets, setAudioModeAsync } from 'expo-audio';
import { Camera } from 'expo-camera';
import * as FileSystem from 'expo-file-system/legacy';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

// Tipos para los mensajes
type Message = {
  id: string;
  text: string;
  quechuaText?: string;
  sender: 'bot' | 'user';
  timestamp: Date;
};

type TriageData = {
  detected_language: string;
  standardized_symptoms: string;
  urgency_level: string;
  ai_recommendation: string;
  recommended_specialty: string;
};

export default function SymptomChatbot() {
  const insets = useSafeAreaInsets();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Mensaje inicial de bienvenida
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: '¡Hola! Soy tu asistente médico virtual. Para comenzar, ¿cuál es tu síntoma principal o motivo de consulta?',
      quechuaText: '¡Allinllachu! Ñuqa kani hampiq yanapaqniyki. Qallarinapaq, ¿Ima nanayniykitataq utaq unquyniykitataq willariwankiman?',
      sender: 'bot',
      timestamp: new Date()
    }
  ]);

  const speakMessage = (text: string, quechuaText?: string) => {
    Speech.stop();
    if (quechuaText) {
      Speech.speak(quechuaText, { language: 'es-BO', rate: 0.9 });
      Speech.speak(text, { language: 'es-BO', rate: 1.0 });
    } else {
      Speech.speak(text, { language: 'es-BO', rate: 1.0 });
    }
  };

  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [pendingTriage, setPendingTriage] = useState<TriageData | null>(null);
  const [createdTriageId, setCreatedTriageId] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');

  // Estados para grabación de voz
  const recorder = useAudioRecorder(RecordingPresets.LOW_QUALITY);
  const [isRecording, setIsRecording] = useState(false);
  const [audioBase64, setAudioBase64] = useState<string | null>(null);

  // Obtener el ID del paciente logueado al montar
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: patientData } = await supabase
          .from('patients')
          .select('id')
          .eq('id', user.id)
          .single();
        if (patientData) {
          setCurrentUserId(patientData.id);
        } else {
          setCurrentUserId(user.id);
        }
      }
    };
    fetchUser();
  }, []);

  // Funciones de grabación
  async function startRecording() {
    try {
      const permission = await Camera.requestMicrophonePermissionsAsync();
      if (permission.status === 'granted') {
        if (Platform.OS === 'ios') {
          await setAudioModeAsync({
            allowsRecording: true,
            playsInSilentMode: true,
          });
        }
        await recorder.prepareToRecordAsync();
        recorder.record();
        setIsRecording(true);
      } else {
        setAlertMessage('Permiso de micrófono denegado');
        setAlertVisible(true);
      }
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  }

  const transcribeAudio = async (base64: string) => {
    setAlertMessage('Transcribiendo audio con IA... Por favor espera.');
    setAlertVisible(true);
    
    try {
      const apiUrl = process.env.EXPO_PUBLIC_AI_API_URL || 'http://localhost:8000';
      const res = await fetch(`${apiUrl}/api/transcribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Bypass-Tunnel-Reminder': 'true',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({ audio_base64: base64 })
      });
      const data = await res.json();
      setAlertVisible(false);
      
      if (data.transcription && !data.transcription.includes('[Error')) {
        setInputText(prev => prev ? prev + ' ' + data.transcription : data.transcription);
      } else {
        setInputText(prev => prev ? prev + ' [Audio adjunto]' : '[Audio adjunto]');
      }
    } catch(e) {
      setAlertVisible(false);
      console.error('Error al transcribir:', e);
      setInputText(prev => prev ? prev + ' [Audio adjunto]' : '[Audio adjunto]');
    }
  };

  async function stopRecording() {
    setIsRecording(false);

    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (uri) {
        if (Platform.OS === 'web') {
          const response = await fetch(uri);
          const blob = await response.blob();
          const reader = new FileReader();
          reader.readAsDataURL(blob);
          reader.onloadend = async () => {
            const base64data = reader.result as string;
            const base64 = base64data.split(',')[1];
            setAudioBase64(base64);
            await transcribeAudio(base64);
          };
        } else {
          const base64 = await FileSystem.readAsStringAsync(uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          setAudioBase64(base64);
          await transcribeAudio(base64);
        }
      }
    } catch (err) {
      console.error('Failed to stop recording', err);
    }
  }

  // Guardar el triaje en Supabase y activar botón de pago
  const commitTriage = async (triageData: TriageData) => {
    try {
      setIsTyping(true);
      const userText = messages
        .filter(m => m.sender === 'user')
        .map(m => m.text)
        .join('\n');

      const result = await triageService.createTriage({
        patient_id: currentUserId || '95432c20-caed-43ca-8a01-4255e7a9dc1c',
        reported_symptoms: triageData.standardized_symptoms || userText || 'Consulta general de telemedicina',
        ai_raw_analysis: triageData.standardized_symptoms || userText,
        urgency_level: (triageData.urgency_level as any) || 'Medium',
        ai_recommendation: triageData.ai_recommendation || 'Evaluación médica ambulatoria recomendada.',
        detected_language: triageData.detected_language || 'Español',
        recommended_specialty: triageData.recommended_specialty || 'Medicina General'
      });

      if (result && result.id) {
        setCreatedTriageId(result.id);
        // Redirigir automáticamente a la sala de espera de la videollamada tras 1.5 segundos
        setTimeout(() => {
          router.replace({
            pathname: '/(patient)/waiting-room' as any,
            params: { triageId: result.id }
          });
        }, 1500);
      }

      setMessages(prev => [
        ...prev,
        {
          id: Date.now().toString(),
          text: `¡Ficha de triaje generada con éxito!\n\nEspecialidad recomendada: ${triageData.recommended_specialty}\nNivel de prioridad: ${triageData.urgency_level}\nRecomendación: ${triageData.ai_recommendation}\n\nIngresando a la sala de espera para aguardar al médico de turno...`,
          quechuaText: `¡Ñañam qillqapusqayki unquyniykimanta (${triageData.recommended_specialty})! Suyana wasiman yaykuchkanki hampiqwan rimanaykipaq...`,
          sender: 'bot',
          timestamp: new Date()
        }
      ]);
    } catch (error: any) {
      console.error('Error guardando triaje en Supabase:', error);
      setAlertMessage('Error al guardar el triaje: ' + (error?.message || JSON.stringify(error)));
      setAlertVisible(true);
    } finally {
      setIsTyping(false);
    }
  };

  // Solicitar finalizar triaje directamente
  const handleRequestFinishTriage = async () => {
    if (isTyping) return;
    if (pendingTriage) {
      await commitTriage(pendingTriage);
      return;
    }

    setIsTyping(true);
    try {
      const apiUrl = process.env.EXPO_PUBLIC_AI_API_URL || 'http://localhost:8000';
      const payloadMessages = messages.map(m => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: m.text
      }));

      const res = await fetch(`${apiUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Bypass-Tunnel-Reminder': 'true',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({
          patient_id: currentUserId || 'guest',
          messages: payloadMessages,
          finish_triage: true
        })
      });

      if (!res.ok) {
        throw new Error(`Error en el asistente (${res.status})`);
      }

      const data = await res.json();
      if (data.triage_data) {
        await commitTriage(data.triage_data);
      } else {
        const userSummary = messages.filter(m => m.sender === 'user').map(m => m.text).join('\n');
        await commitTriage({
          detected_language: 'Español',
          standardized_symptoms: userSummary || 'Consulta médica general',
          urgency_level: 'Medium',
          ai_recommendation: 'Evaluación médica por videollamada.',
          recommended_specialty: 'Medicina General'
        });
      }
    } catch (err: any) {
      console.error(err);
      setAlertMessage('No se pudo finalizar el triaje: ' + (err?.message || err));
      setAlertVisible(true);
      setIsTyping(false);
    }
  };

  // Enviar mensaje interactivo como asistente de WhatsApp
  const sendMessage = async () => {
    if (inputText.trim().length === 0 || isTyping) return;

    const currentText = inputText.trim();

    const userMessage: Message = {
      id: Date.now().toString(),
      text: currentText,
      sender: 'user',
      timestamp: new Date()
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInputText('');
    setIsTyping(true);

    try {
      const apiUrl = process.env.EXPO_PUBLIC_AI_API_URL || 'http://localhost:8000';
      const payloadMessages = nextMessages.map(m => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: m.text
      }));

      const currentAudio = audioBase64;
      setAudioBase64(null);

      const res = await fetch(`${apiUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Bypass-Tunnel-Reminder': 'true',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({
          patient_id: currentUserId || 'guest',
          messages: payloadMessages,
          finish_triage: false,
          ...(currentAudio ? { audio_base64: currentAudio } : {})
        })
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error('API Chat Error:', res.status, errorText);
        throw new Error(`Error del servidor (${res.status})`);
      }

      const data = await res.json();

      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: data.reply_text || 'Te escucho, por favor cuéntame más.',
        quechuaText: data.reply_quechua || undefined,
        sender: 'bot',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, botMessage]);

      if (data.is_triage_ready && data.triage_data) {
        setPendingTriage(data.triage_data);
      }
    } catch (error: any) {
      console.error('Error enviando mensaje al chatbot:', error);
      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          text: 'Disculpa, tuve un problema de conexión momentáneo. ¿Podrías volver a escribir tu mensaje?',
          quechuaText: 'Pampachaway, llika pantay karqan. ¿Kutillatawanchu willariwankiman?',
          sender: 'bot',
          timestamp: new Date()
        }
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  // Auto-scroll al final del chat cuando se envía un nuevo mensaje
  useEffect(() => {
    if (flatListRef.current && messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages, isTyping]);

  const userMessagesCount = messages.filter(m => m.sender === 'user').length;

  const renderMessage = ({ item }: { item: Message }) => {
    const isBot = item.sender === 'bot';
    return (
      <View style={[styles.messageWrapper, isBot ? styles.messageWrapperBot : styles.messageWrapperUser]}>
        {isBot && (
          <View style={styles.botAvatar}>
            <Ionicons name="medical" size={16} color="#ffffff" />
          </View>
        )}
        <View style={[styles.messageBubble, isBot ? styles.messageBubbleBot : styles.messageBubbleUser]}>
          {item.quechuaText && (
            <Text style={[styles.messageText, isBot ? styles.messageTextBotQuechua : styles.messageTextUser]}>
              {item.quechuaText}
            </Text>
          )}
          <Text style={[styles.messageText, isBot ? styles.messageTextBot : styles.messageTextUser]}>
            {item.text}
          </Text>
          
          <View style={styles.messageFooter}>
            {isBot && (
              <TouchableOpacity 
                style={styles.ttsButton}
                onPress={() => speakMessage(item.text, item.quechuaText)}
              >
                <Ionicons name="volume-high" size={16} color="#059669" />
              </TouchableOpacity>
            )}
            <Text style={[styles.timeText, isBot ? styles.timeTextBot : styles.timeTextUser]}>
              {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      {/* Cabecera del Chat */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/(patient)/menu')}>
          <Ionicons name="arrow-back" size={24} color="#64748b" />
        </TouchableOpacity>
        <View style={styles.headerIcon}>
          <Ionicons name="hardware-chip" size={24} color="#3b82f6" />
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>Asistente de Triaje IA</Text>
          <Text style={styles.headerSubtitle}>Gobierno Autónomo Municipal de Cochabamba</Text>
        </View>
        <View style={styles.onlineBadge}>
          <View style={styles.onlineDot} />
          <Text style={styles.onlineText}>En línea</Text>
        </View>
      </View>

      {/* Lista de Mensajes */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={item => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.chatContainer}
        showsVerticalScrollIndicator={false}
      />

      {/* Indicador de que el Asistente está "Escribiendo..." */}
      {isTyping && (
        <View style={styles.typingIndicator}>
          <ActivityIndicator size="small" color="#059669" />
          <Text style={styles.typingText}>El asistente médico está escribiendo...</Text>
        </View>
      )}

      {/* Barra de acción rápida para pasar al médico cuando el triaje está listo o se han compartido síntomas */}
      {!createdTriageId && (
        <View style={styles.quickActionBar}>
          {pendingTriage ? (
            <TouchableOpacity 
              style={styles.triageReadyBanner}
              onPress={() => commitTriage(pendingTriage)}
              activeOpacity={0.85}
            >
              <View style={styles.triageReadyIcon}>
                <Ionicons name="checkmark-done-circle" size={22} color="#059669" />
              </View>
              <View style={styles.triageReadyTextContainer}>
                <Text style={styles.triageReadyTitle}>
                  Triaje Listo: <Text style={styles.triageReadySpecialty}>{pendingTriage.recommended_specialty}</Text>
                </Text>
                <Text style={styles.triageReadySubtitle}>Toca aquí para pasar a consulta médica</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#059669" />
            </TouchableOpacity>
          ) : userMessagesCount >= 1 ? (
            <TouchableOpacity 
              style={styles.finishTriageChip}
              onPress={handleRequestFinishTriage}
              activeOpacity={0.8}
            >
              <Ionicons name="clipboard-outline" size={16} color="#059669" />
              <Text style={styles.finishTriageChipText}>Finalizar y ser derivado al médico</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}

      {/* Input para escribir mensajes o botón directo a sala de espera */}
      {createdTriageId ? (
        <View style={styles.waitingRoomContainer}>
          <TouchableOpacity 
            style={styles.waitingRoomBtn}
            onPress={() => router.replace({
              pathname: '/(patient)/waiting-room' as any,
              params: { triageId: createdTriageId }
            })}
            activeOpacity={0.8}
          >
            <Ionicons name="videocam" size={20} color="#ffffff" />
            <Text style={styles.waitingRoomBtnText}>Ingresar a la Sala de Espera</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={[styles.inputContainer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <TextInput
            style={styles.input}
            placeholder="Escribe o graba tus síntomas..."
            placeholderTextColor="#9ca3af"
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
            onSubmitEditing={sendMessage}
          />
          <TouchableOpacity
            style={[styles.micButton, isRecording && styles.micButtonRecording]}
            onPress={isRecording ? stopRecording : startRecording}
            activeOpacity={0.8}
          >
            <Ionicons name={isRecording ? "stop" : "mic"} size={20} color={isRecording ? "#ef4444" : "#64748b"} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.sendButton, (!inputText.trim() || isTyping) && styles.sendButtonDisabled]} 
            onPress={sendMessage}
            disabled={!inputText.trim() || isTyping}
            activeOpacity={0.8}
          >
            <Ionicons name="send" size={18} color="#ffffff" style={styles.sendIcon} />
          </TouchableOpacity>
        </View>
      )}

      <CustomModal
        visible={alertVisible}
        title="Atención"
        message={alertMessage}
        type="alert"
        onConfirm={() => setAlertVisible(false)}
      />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 3,
    zIndex: 10,
  },
  backBtn: {
    padding: 8,
    marginRight: 4,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
    fontWeight: '500',
  },
  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
    marginRight: 4,
  },
  onlineText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
  },
  chatContainer: {
    padding: 16,
    paddingBottom: 20,
  },
  messageWrapper: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-end',
  },
  messageWrapperBot: {
    justifyContent: 'flex-start',
  },
  messageWrapperUser: {
    justifyContent: 'flex-end',
  },
  botAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginBottom: 4,
  },
  messageBubble: {
    maxWidth: '82%',
    padding: 14,
    borderRadius: 20,
  },
  messageBubbleBot: {
    backgroundColor: '#ffffff',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  messageBubbleUser: {
    backgroundColor: '#059669',
    borderBottomRightRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  messageTextBot: {
    color: '#334155',
  },
  messageTextBotQuechua: {
    color: '#059669',
    fontStyle: 'italic',
    fontWeight: '600',
    marginBottom: 6,
  },
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 6,
  },
  ttsButton: {
    padding: 6,
    backgroundColor: '#ecfdf5',
    borderRadius: 12,
  },
  messageTextUser: {
    color: '#ffffff',
  },
  timeText: {
    fontSize: 10,
    marginTop: 6,
    alignSelf: 'flex-end',
  },
  timeTextBot: {
    color: '#94a3b8',
  },
  timeTextUser: {
    color: '#a7f3d0',
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  typingText: {
    fontSize: 13,
    color: '#059669',
    marginLeft: 8,
    fontStyle: 'italic',
    fontWeight: '500',
  },
  quickActionBar: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  triageReadyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    borderWidth: 1.5,
    borderColor: '#10b981',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  triageReadyIcon: {
    marginRight: 10,
  },
  triageReadyTextContainer: {
    flex: 1,
  },
  triageReadyTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#065f46',
  },
  triageReadySpecialty: {
    color: '#047857',
    fontWeight: '800',
  },
  triageReadySubtitle: {
    fontSize: 11,
    color: '#059669',
    marginTop: 2,
  },
  finishTriageChip: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#059669',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  finishTriageChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
    marginLeft: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 14 : 10,
    paddingBottom: Platform.OS === 'ios' ? 14 : 10,
    fontSize: 15,
    maxHeight: 120,
    color: '#0f172a',
  },
  sendButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  sendButtonDisabled: {
    backgroundColor: '#cbd5e1',
  },
  sendIcon: {
    marginLeft: 2,
  },
  waitingRoomContainer: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  waitingRoomBtn: {
    width: '100%',
    backgroundColor: '#059669',
    paddingVertical: 14,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  waitingRoomBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 15,
    marginLeft: 8,
  },
  micButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  micButtonRecording: {
    backgroundColor: '#fee2e2',
  }
});

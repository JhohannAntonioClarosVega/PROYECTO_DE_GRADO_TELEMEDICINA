import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { triageService } from '@/services/triage.service';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import CustomModal from '@/components/CustomModal';

// Tipos para los mensajes
type Message = {
  id: string;
  text: string;
  sender: 'bot' | 'user';
  timestamp: Date;
};

export default function SymptomChatbot() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: '¡Hola! Soy tu asistente médico virtual. Para comenzar, ¿cuál es tu síntoma principal o motivo de consulta?',
      sender: 'bot',
      timestamp: new Date()
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [chatStep, setChatStep] = useState(0);
  const [collectedData, setCollectedData] = useState({
    main: '',
    time: '',
    meds: ''
  });
  const [createdTriageId, setCreatedTriageId] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');

  // Obtener el ID del paciente logueado al montar
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Buscar el registro del paciente asociado a este usuario
        const { data: patientData } = await supabase
          .from('patients')
          .select('id')
          .eq('id', user.id)
          .single();
        if (patientData) {
          setCurrentUserId(patientData.id);
        } else {
          // Fallback: usar el user.id directamente
          setCurrentUserId(user.id);
        }
      }
    };
    fetchUser();
  }, []);

  const sendMessage = async () => {
    if (inputText.trim().length === 0) return;

    const currentText = inputText.trim();

    const userMessage: Message = {
      id: Date.now().toString(),
      text: currentText,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsTyping(true);

    if (chatStep === 0) {
      setCollectedData(prev => ({ ...prev, main: currentText }));
      setChatStep(1);
      setTimeout(() => {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          text: 'Comprendo. ¿Hace cuánto tiempo empezaron estos síntomas y del 1 al 10 qué tan fuerte es el malestar?',
          sender: 'bot',
          timestamp: new Date()
        }]);
        setIsTyping(false);
      }, 1000);
    } else if (chatStep === 1) {
      setCollectedData(prev => ({ ...prev, time: currentText }));
      setChatStep(2);
      setTimeout(() => {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          text: 'Entendido. Por último, ¿has tomado algún medicamento el día de hoy para tratar de aliviar esto?',
          sender: 'bot',
          timestamp: new Date()
        }]);
        setIsTyping(false);
      }, 1000);
    } else if (chatStep === 2) {
      // Paso final: Juntar todo y enviar a Supabase
      const finalSymptomReport = `Síntomas principales: ${collectedData.main}\nTiempo/Intensidad: ${collectedData.time}\nMedicamentos previos: ${currentText}`;

      try {
        const result = await triageService.createTriage({
          patient_id: currentUserId || '95432c20-caed-43ca-8a01-4255e7a9dc1c',
          reported_symptoms: finalSymptomReport,
          ai_raw_analysis: 'Pendiente de evaluación de IA...',
          urgency_level: 'Medium',
          ai_recommendation: 'Análisis en proceso.',
          detected_language: 'es'
        });

        if (result && result.id) {
          setCreatedTriageId(result.id);
        }

        setTimeout(() => {
          setMessages(prev => [...prev, {
            id: Date.now().toString(),
            text: '✅ ¡He creado tu informe clínico y se ha enviado al doctor! Por favor presiona el botón inferior para ingresar a la sala de espera.',
            sender: 'bot',
            timestamp: new Date()
          }]);
          setIsTyping(false);
        }, 1500);
        
        setChatStep(3); // Fin de la conversación
      } catch (error: any) {
        console.error(error);
        setIsTyping(false);
        setAlertMessage('Error de Supabase: ' + (error?.message || JSON.stringify(error)));
        setAlertVisible(true);
      }
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
          <Text style={[styles.messageText, isBot ? styles.messageTextBot : styles.messageTextUser]}>
            {item.text}
          </Text>
          <Text style={[styles.timeText, isBot ? styles.timeTextBot : styles.timeTextUser]}>
            {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Cabecera del Chat */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/patient-menu')}>
          <Ionicons name="arrow-back" size={24} color="#64748b" />
        </TouchableOpacity>
        <View style={styles.headerIcon}>
          <Ionicons name="hardware-chip" size={24} color="#3b82f6" />
        </View>
        <View>
          <Text style={styles.headerTitle}>Asistente de Triaje IA</Text>
          <Text style={styles.headerSubtitle}>Gobierno Autónomo Municipal de Cochabamba</Text>
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

      {/* Indicador de que la IA está "Escribiendo..." */}
      {isTyping && (
        <View style={styles.typingIndicator}>
          <ActivityIndicator size="small" color="#3b82f6" />
          <Text style={styles.typingText}>La IA está analizando tus síntomas...</Text>
        </View>
      )}

      {/* Input para escribir mensajes o botón de sala de espera */}
      {createdTriageId ? (
        <View style={styles.waitingRoomContainer}>
          <TouchableOpacity 
            style={styles.waitingRoomBtn}
            onPress={() => router.push({
              pathname: '/waiting-room' as any,
              params: { triageId: createdTriageId }
            })}
            activeOpacity={0.8}
          >
            <Ionicons name="videocam" size={20} color="#ffffff" />
            <Text style={styles.waitingRoomBtnText}>Ingresar a la Sala de Espera</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Escribe tus síntomas aquí..."
            placeholderTextColor="#9ca3af"
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
          />
          <TouchableOpacity 
            style={[styles.sendButton, (!inputText.trim() || chatStep === 3) && styles.sendButtonDisabled]} 
            onPress={sendMessage}
            disabled={!inputText.trim() || chatStep === 3}
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 16,
    paddingTop: Platform.OS === 'android' ? 40 : 16, // Espacio para la barra de estado en Android
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
    marginRight: 8,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '500',
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
    backgroundColor: '#3b82f6',
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
    backgroundColor: '#2563eb',
    borderBottomRightRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  messageTextBot: {
    color: '#334155',
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
    color: '#93c5fd', // Light blue for contrast on dark background
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  typingText: {
    fontSize: 13,
    color: '#64748b',
    marginLeft: 8,
    fontStyle: 'italic',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
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
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  sendButtonDisabled: {
    backgroundColor: '#cbd5e1',
  },
  sendIcon: {
    marginLeft: 4,
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
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563eb',
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
  }
});

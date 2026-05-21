import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

export default function TriageEvaluation({ onBack, triage }: { onBack?: () => void; triage?: any }) {
  // Usamos los datos reales si existen, o datos de respaldo si venimos sin parámetros
  const triageData = triage ? {
    patient: {
      full_name: triage.patients?.profiles?.full_name || "Desconocido",
      identity_card: triage.patients?.profiles?.identity_card || "No registrado",
      blood_type: triage.patients?.blood_type || "No especificado",
      allergies: triage.patients?.allergies || "No reportadas",
      emergency_contact: triage.patients?.emergency_contact || "No reportado"
    },
    symptoms: triage.reported_symptoms || "Sin síntomas reportados",
    ai_analysis: {
      urgency_level: triage.urgency_level || "Medium",
      raw_analysis: triage.ai_raw_analysis || "Sin análisis.",
      recommendation: triage.ai_recommendation || "Sin recomendación."
    }
  } : {
    patient: {
      full_name: "Juan Perez",
      identity_card: "12345678",
      blood_type: "O+",
      allergies: "Penicilina",
      emergency_contact: "70012345"
    },
    symptoms: "Datos de prueba...",
    ai_analysis: {
      urgency_level: "Critical",
      raw_analysis: "Análisis de prueba...",
      recommendation: "Recomendación de prueba..."
    }
  };

  const isCritical = triageData.ai_analysis.urgency_level === 'Critical';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Ionicons name="arrow-back" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Evaluación de Caso IA</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Nivel de Urgencia Principal */}
        <View style={[styles.urgencyBanner, { backgroundColor: isCritical ? '#ef4444' : '#f59e0b', shadowColor: isCritical ? '#ef4444' : '#f59e0b' }]}>
          <Ionicons name="warning" size={28} color="#ffffff" />
          <View style={styles.urgencyTextContainer}>
            <Text style={styles.urgencyTitle}>
              {isCritical ? 'NIVEL CRÍTICO (Prioridad 1)' : `NIVEL ${triageData.ai_analysis.urgency_level.toUpperCase()}`}
            </Text>
            <Text style={styles.urgencySubtitle}>
              {isCritical ? 'Riesgo de vida potencial - Atención Inmediata' : 'Requiere evaluación médica pronta'}
            </Text>
          </View>
        </View>

        {/* Perfil del Paciente */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="person" size={20} color="#3b82f6" />
            <Text style={styles.cardTitle}>Datos Clínicos del Paciente</Text>
          </View>
          <View style={styles.patientInfoGrid}>
            <View style={styles.infoCol}>
              <Text style={styles.infoLabel}>Nombre Completo</Text>
              <Text style={styles.infoValue}>{triageData.patient.full_name}</Text>
            </View>
            <View style={styles.infoCol}>
              <Text style={styles.infoLabel}>Carnet (CI)</Text>
              <Text style={styles.infoValue}>{triageData.patient.identity_card}</Text>
            </View>
            <View style={styles.infoCol}>
              <Text style={styles.infoLabel}>Tipo de Sangre</Text>
              <Text style={[styles.infoValue, { color: '#ef4444', fontWeight: 'bold' }]}>{triageData.patient.blood_type}</Text>
            </View>
            <View style={styles.infoCol}>
              <Text style={styles.infoLabel}>Alergias Registradas</Text>
              <Text style={styles.infoValue}>{triageData.patient.allergies}</Text>
            </View>
          </View>
        </View>

        {/* Análisis de la Inteligencia Artificial */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="hardware-chip" size={20} color="#8b5cf6" />
            <Text style={styles.cardTitle}>Análisis de la Inteligencia Artificial</Text>
          </View>
          
          <Text style={styles.sectionLabel}>SÍNTOMAS REPORTADOS POR PACIENTE:</Text>
          <Text style={styles.textBlock}>{triageData.symptoms}</Text>

          <View style={styles.divider} />

          <Text style={styles.sectionLabel}>RAZONAMIENTO CLÍNICO IA:</Text>
          <Text style={styles.textBlock}>{triageData.ai_analysis.raw_analysis}</Text>

          <View style={styles.divider} />

          <Text style={styles.sectionLabel}>RECOMENDACIÓN DEL SISTEMA:</Text>
          <View style={styles.recommendationBox}>
            <Ionicons name="bulb-outline" size={20} color="#059669" />
            <Text style={styles.recommendationText}>{triageData.ai_analysis.recommendation}</Text>
          </View>
        </View>

        {/* Botones de Acción */}
        <View style={styles.actionContainer}>
          <TouchableOpacity style={[styles.actionButton, styles.btnEmergency]} activeOpacity={0.8}>
            <Ionicons name="alert-circle" size={20} color="#ffffff" />
            <Text style={styles.actionBtnText}>Derivar Emergencia</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButton, styles.btnAccept]} 
            activeOpacity={0.8}
            onPress={() => router.push({
              pathname: '/videocall' as any,
              params: {
                role: 'doctor',
                patientId: triage?.patient_id || '95432c20-caed-43ca-8a01-4255e7a9dc1c',
                patientName: triageData.patient.full_name,
                triageId: triage?.id || `room_eval_${triage?.patient_id || 'general'}`,
                doctorName: 'Dr. Marco Antonio'
              }
            })}
          >
            <Ionicons name="videocam" size={20} color="#ffffff" />
            <Text style={styles.actionBtnText}>Atender Ahora</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingTop: Platform.OS === 'android' ? 40 : 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  urgencyBanner: {
    backgroundColor: '#ef4444',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  urgencyTextContainer: {
    marginLeft: 16,
  },
  urgencyTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  urgencySubtitle: {
    color: '#fca5a5',
    fontSize: 13,
    marginTop: 4,
    fontWeight: '500',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f8fafc',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 12,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1e293b',
    marginLeft: 8,
  },
  patientInfoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  infoCol: {
    width: '45%',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '700',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  infoValue: {
    fontSize: 15,
    color: '#0f172a',
    fontWeight: '600',
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748b',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  textBlock: {
    fontSize: 15,
    color: '#334155',
    lineHeight: 24,
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 16,
  },
  recommendationBox: {
    backgroundColor: '#ecfdf5',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderLeftWidth: 4,
    borderLeftColor: '#10b981',
  },
  recommendationText: {
    flex: 1,
    color: '#065f46',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 10,
    lineHeight: 22,
  },
  actionContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap', // Permite que los botones bajen si no hay espacio
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
    minWidth: '45%', // En celulares chicos tomará el 100% al bajar de línea
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  btnEmergency: {
    backgroundColor: '#dc2626', // Rojo oscuro
  },
  btnAccept: {
    backgroundColor: '#2563eb', // Azul médico
  },
  actionBtnText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 14,
    marginLeft: 8,
  }
});

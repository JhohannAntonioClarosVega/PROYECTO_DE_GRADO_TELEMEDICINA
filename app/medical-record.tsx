import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, SafeAreaView, Platform, KeyboardAvoidingView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

export default function MedicalRecordScreen() {
  const [diagnosis, setDiagnosis] = useState('');
  const [treatment, setTreatment] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedPharmacy, setSelectedPharmacy] = useState<string | null>(null);

  const pharmacies = [
    { id: '1', name: 'Farmacia Chávez - Sucursal Prado' },
    { id: '2', name: 'Farmacorp - Av. América' },
    { id: '3', name: 'Farmacias Bolivia - Zona Sur' }
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="close" size={24} color="#1f2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Registro Médico</Text>
          <TouchableOpacity style={styles.saveHeaderButton}>
            <Text style={styles.saveHeaderText}>Guardar</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          
          {/* Ficha del Paciente */}
          <View style={styles.patientBanner}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>JP</Text>
            </View>
            <View>
              <Text style={styles.patientName}>Juan Perez</Text>
              <Text style={styles.patientSubtitle}>Cita: Cardiología - Urgencia IA</Text>
            </View>
          </View>

          {/* Diagnóstico */}
          <View style={styles.formSection}>
            <Text style={styles.sectionLabel}>DIAGNÓSTICO MÉDICO <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={styles.textArea}
              placeholder="Escribe el diagnóstico final del paciente..."
              placeholderTextColor="#94a3b8"
              multiline
              textAlignVertical="top"
              value={diagnosis}
              onChangeText={setDiagnosis}
            />
          </View>

          {/* Plan de Tratamiento */}
          <View style={styles.formSection}>
            <Text style={styles.sectionLabel}>PLAN DE TRATAMIENTO Y RECETA <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={styles.textArea}
              placeholder="Medicamentos, dosis, duración y recomendaciones generales..."
              placeholderTextColor="#94a3b8"
              multiline
              textAlignVertical="top"
              value={treatment}
              onChangeText={setTreatment}
            />
          </View>

          {/* Notas Clínicas */}
          <View style={styles.formSection}>
            <Text style={styles.sectionLabel}>NOTAS CLÍNICAS (Solo visible para médicos)</Text>
            <TextInput
              style={[styles.textArea, { minHeight: 80 }]}
              placeholder="Observaciones internas sobre la evolución o sospechas..."
              placeholderTextColor="#94a3b8"
              multiline
              textAlignVertical="top"
              value={notes}
              onChangeText={setNotes}
            />
          </View>

          {/* Selector de Farmacia Aliada */}
          <View style={styles.pharmacyCard}>
            <View style={styles.pharmacyHeader}>
              <Ionicons name="medical" size={18} color="#10b981" />
              <Text style={styles.pharmacyTitle}>Derivar Receta a Farmacia Aliada</Text>
            </View>
            <Text style={styles.pharmacyDesc}>La receta electrónica se enviará automáticamente al sistema de la farmacia para que el paciente recoja sus medicamentos con su CI.</Text>
            
            <View style={styles.pharmacyList}>
              {pharmacies.map(pharmacy => (
                <TouchableOpacity 
                  key={pharmacy.id} 
                  style={[styles.pharmacyOption, selectedPharmacy === pharmacy.id && styles.pharmacyOptionSelected]}
                  onPress={() => setSelectedPharmacy(pharmacy.id)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.radioCircle, selectedPharmacy === pharmacy.id && styles.radioCircleSelected]}>
                    {selectedPharmacy === pharmacy.id && <View style={styles.radioInner} />}
                  </View>
                  <Text style={[styles.pharmacyName, selectedPharmacy === pharmacy.id && styles.pharmacyNameSelected]}>
                    {pharmacy.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity 
            style={[styles.submitButton, (!diagnosis || !treatment) && styles.submitButtonDisabled]}
            activeOpacity={0.8}
            disabled={!diagnosis || !treatment}
          >
            <Ionicons name="checkmark-circle" size={20} color="#ffffff" />
            <Text style={styles.submitButtonText}>Finalizar y Guardar Consulta</Text>
          </TouchableOpacity>
        </View>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 40 : 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  saveHeaderButton: {
    padding: 4,
  },
  saveHeaderText: {
    color: '#2563eb',
    fontWeight: '600',
    fontSize: 16,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  patientBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 18,
  },
  patientName: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1e293b',
  },
  patientSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  formSection: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748b',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  required: {
    color: '#ef4444',
  },
  textArea: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 16,
    minHeight: 120,
    fontSize: 15,
    color: '#0f172a',
  },
  pharmacyCard: {
    backgroundColor: '#f0fdf4',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    marginBottom: 20,
  },
  pharmacyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  pharmacyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#065f46',
    marginLeft: 8,
  },
  pharmacyDesc: {
    fontSize: 13,
    color: '#047857',
    marginBottom: 16,
    lineHeight: 20,
  },
  pharmacyList: {
    gap: 10,
  },
  pharmacyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dcfce3',
  },
  pharmacyOptionSelected: {
    borderColor: '#10b981',
    backgroundColor: '#ecfdf5',
  },
  radioCircle: {
    height: 20,
    width: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  radioCircleSelected: {
    borderColor: '#10b981',
  },
  radioInner: {
    height: 10,
    width: 10,
    borderRadius: 5,
    backgroundColor: '#10b981',
  },
  pharmacyName: {
    fontSize: 15,
    color: '#334155',
    fontWeight: '500',
  },
  pharmacyNameSelected: {
    color: '#065f46',
    fontWeight: '700',
  },
  footer: {
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 30 : 16,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  submitButton: {
    flexDirection: 'row',
    backgroundColor: '#2563eb',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#94a3b8',
  },
  submitButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
  }
});

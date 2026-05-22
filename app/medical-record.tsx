import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, SafeAreaView, Platform, KeyboardAvoidingView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import CustomModal from '@/components/CustomModal';

export default function MedicalRecordScreen() {
  const params = useLocalSearchParams();
  const patientId = params.patientId as string;
  const patientName = (params.patientName as string) || 'Paciente';
  const triageId = params.triageId as string;

  const [diagnosis, setDiagnosis] = useState('');
  const [treatment, setTreatment] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedPharmacy, setSelectedPharmacy] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pharmacies, setPharmacies] = useState<any[]>([
    { id: '1', name: 'Farmacia Chávez - Sucursal Prado' },
    { id: '2', name: 'Farmacorp - Av. América' },
    { id: '3', name: 'Farmacias Bolivia - Zona Sur' }
  ]);

  const [modalConfig, setModalConfig] = useState({
    visible: false,
    title: '',
    message: '',
    type: 'alert' as 'alert' | 'confirm',
    confirmText: 'Aceptar',
    onConfirm: () => {},
    onCancel: () => {}
  });

  const closeModal = () => setModalConfig(prev => ({ ...prev, visible: false }));

  // Cargar farmacias de la base de datos
  useEffect(() => {
    const fetchPharmacies = async () => {
      try {
        const { data, error } = await supabase
          .from('allied_pharmacies')
          .select('id, name')
          .eq('is_active', true);
        
        if (error) throw error;
        if (data && data.length > 0) {
          setPharmacies(data);
        }
      } catch (err) {
        console.warn('Error al cargar farmacias de Supabase, usando fallback local:', err);
      }
    };
    fetchPharmacies();
  }, []);

  const handleSaveRecord = async () => {
    if (!diagnosis || !treatment) {
      setModalConfig({
        visible: true,
        title: 'Campos requeridos',
        message: 'Por favor complete el Diagnóstico y el Plan de Tratamiento.',
        type: 'alert',
        confirmText: 'Entendido',
        onConfirm: closeModal,
        onCancel: closeModal
      });
      return;
    }

    setSaving(true);
    try {
      // 1. Obtener el doctor actual autenticado
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No hay una sesión médica activa.');

      // 2. Obtener el appointmentId asociado al triage si existe
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

      // 3. Guardar en medical_records
      const { error } = await supabase.from('medical_records').insert({
        patient_id: patientId || null,
        doctor_id: user.id,
        appointment_id: appointmentId,
        diagnosis,
        treatment_plan: treatment,
        clinical_notes: notes || null,
        allied_pharmacy_id: selectedPharmacy || null
      });

      if (error) throw error;

      setSaving(false);
      setModalConfig({
        visible: true,
        title: 'Registro Guardado',
        message: 'El historial clínico y la derivación se han guardado de manera exitosa en la base de datos.',
        type: 'alert',
        confirmText: 'Aceptar',
        onCancel: () => {
          closeModal();
          router.back();
        },
        onConfirm: () => {
          closeModal();
          router.back();
        }
      });
    } catch (error: any) {
      console.error('Error al guardar el registro manual:', error);
      setSaving(false);
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

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .filter(Boolean)
      .map(word => word[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

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
          <TouchableOpacity 
            style={styles.saveHeaderButton} 
            onPress={handleSaveRecord}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#2563eb" />
            ) : (
              <Text style={styles.saveHeaderText}>Guardar</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          
          {/* Ficha del Paciente */}
          <View style={styles.patientBanner}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{getInitials(patientName)}</Text>
            </View>
            <View>
              <Text style={styles.patientName}>{patientName}</Text>
              <Text style={styles.patientSubtitle}>Consulta de Telemedicina</Text>
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
              editable={!saving}
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
              editable={!saving}
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
              editable={!saving}
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
                  onPress={() => setSelectedPharmacy(selectedPharmacy === pharmacy.id ? null : pharmacy.id)}
                  activeOpacity={0.7}
                  disabled={saving}
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
            disabled={!diagnosis || !treatment || saving}
            onPress={handleSaveRecord}
          >
            {saving ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="#ffffff" />
                <Text style={styles.submitButtonText}>Finalizar y Guardar Consulta</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

      </KeyboardAvoidingView>

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
    minWidth: 60,
    alignItems: 'flex-end',
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
    fontSize: 16,
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

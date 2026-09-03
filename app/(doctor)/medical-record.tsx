import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, SafeAreaView, Platform, KeyboardAvoidingView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import CustomModal from '@/components/CustomModal';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

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
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [generatedPdfUri, setGeneratedPdfUri] = useState<string | null>(null);
  const [doctorName, setDoctorName] = useState('Dr. Médico Tratante');
  const [pharmacies, setPharmacies] = useState<any[]>([
    { id: '1', name: 'Farmacia Chávez - Sucursal Prado' },
    { id: '2', name: 'Farmacorp - Av. América' },
    { id: '3', name: 'Farmacias Bolivia - Zona Sur' }
  ]);

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

  // Cargar farmacias y perfil del médico
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', user.id)
            .single();
          if (profile?.full_name) {
            setDoctorName(`Dr. ${profile.full_name}`);
          }
        }

        const { data: pharmData, error: pharmErr } = await supabase
          .from('allied_pharmacies')
          .select('id, name')
          .eq('is_active', true);
        
        if (pharmErr) throw pharmErr;
        if (pharmData && pharmData.length > 0) {
          setPharmacies(pharmData);
        }
      } catch (err) {
        console.warn('Aviso al cargar datos iniciales en medical-record:', err);
      }
    };
    fetchInitialData();
  }, []);

  const generatePdfTemplate = (pharmacyName: string) => {
    const currentDate = new Date().toLocaleDateString('es-BO', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Receta Médica Digital</title>
        <style>
          body { font-family: 'Arial', sans-serif; padding: 40px; color: #1e293b; line-height: 1.6; }
          .header { text-align: center; border-bottom: 3px solid #2563eb; padding-bottom: 16px; margin-bottom: 24px; }
          .header h1 { margin: 0; color: #0f172a; font-size: 22px; text-transform: uppercase; }
          .header h2 { margin: 4px 0 0; color: #2563eb; font-size: 15px; }
          .header p { margin: 4px 0 0; color: #64748b; font-size: 12px; }
          .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
          .meta-table td { padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
          .meta-label { font-weight: bold; color: #475569; width: 30%; }
          .section { margin-bottom: 20px; background: #f8fafc; padding: 16px; border-radius: 8px; border-left: 4px solid #2563eb; }
          .section-title { font-size: 13px; font-weight: bold; color: #2563eb; text-transform: uppercase; margin-bottom: 8px; }
          .section-content { font-size: 14px; color: #0f172a; white-space: pre-wrap; }
          .pharmacy-box { background: #ecfdf5; border: 1px solid #a7f3d0; padding: 14px; border-radius: 8px; margin-top: 16px; }
          .pharmacy-title { font-weight: bold; color: #065f46; font-size: 12px; text-transform: uppercase; }
          .pharmacy-name { color: #047857; font-size: 14px; margin-top: 4px; font-weight: bold; }
          .footer { margin-top: 50px; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 24px; }
          .signature-line { width: 200px; border-top: 1px solid #0f172a; margin: 0 auto 8px; }
          .signature-title { font-size: 13px; font-weight: bold; color: #0f172a; }
          .signature-sub { font-size: 11px; color: #64748b; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Gobierno Autónomo Municipal de Cochabamba</h1>
          <h2>Sistema de Telemedicina IA & Red Salud UNIVALLE</h2>
          <p>Receta Médica y Prescripción Digital</p>
        </div>

        <table class="meta-table">
          <tr>
            <td class="meta-label">Paciente:</td>
            <td><strong>${patientName}</strong></td>
          </tr>
          <tr>
            <td class="meta-label">Médico Tratante:</td>
            <td><strong>${doctorName}</strong></td>
          </tr>
          <tr>
            <td class="meta-label">Fecha de Emisión:</td>
            <td>${currentDate}</td>
          </tr>
        </table>

        <div class="section">
          <div class="section-title">Diagnóstico Clínico</div>
          <div class="section-content">${diagnosis}</div>
        </div>

        <div class="section" style="border-left-color: #10b981;">
          <div class="section-title" style="color: #10b981;">Plan de Tratamiento y Receta</div>
          <div class="section-content">${treatment}</div>
        </div>

        ${pharmacyName ? `
          <div class="pharmacy-box">
            <div class="pharmacy-title">Farmacia Aliada Sugerida</div>
            <div class="pharmacy-name">${pharmacyName}</div>
          </div>
        ` : ''}

        <div class="footer">
          <div class="signature-line"></div>
          <div class="signature-title">${doctorName}</div>
          <div class="signature-sub">Firma y Registro Médico Digital</div>
          <p style="font-size: 10px; color: #94a3b8; margin-top: 16px;">Documento oficial expedido electrónicamente por el G.A.M. Cochabamba.</p>
        </div>
      </body>
      </html>
    `;
  };

  const handleGenerateAndSharePdf = async () => {
    if (!diagnosis || !treatment) {
      setModalConfig({
        visible: true,
        title: 'Campos requeridos',
        message: 'Complete el Diagnóstico y Tratamiento antes de generar el PDF.',
        type: 'alert',
        confirmText: 'Entendido',
        onConfirm: closeModal,
        onCancel: closeModal
      });
      return;
    }

    setGeneratingPdf(true);
    try {
      const selectedPharm = pharmacies.find(p => p.id === selectedPharmacy);
      const htmlContent = generatePdfTemplate(selectedPharm ? selectedPharm.name : '');
      const { uri } = await Print.printToFileAsync({ html: htmlContent });

      setGeneratedPdfUri(uri);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Receta Médica - ${patientName}`,
          UTI: 'com.adobe.pdf'
        });
      } else {
        setModalConfig({
          visible: true,
          title: 'PDF Generado',
          message: `La receta PDF ha sido creada exitosamente en: ${uri}`,
          type: 'alert',
          confirmText: 'Aceptar',
          onConfirm: closeModal,
          onCancel: closeModal
        });
      }
    } catch (err: any) {
      console.error('Error al generar PDF de la receta:', err);
      setModalConfig({
        visible: true,
        title: 'Error PDF',
        message: err.message || 'No se pudo compilar el documento PDF.',
        type: 'alert',
        confirmText: 'Entendido',
        onConfirm: closeModal,
        onCancel: closeModal
      });
    } finally {
      setGeneratingPdf(false);
    }
  };

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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No hay una sesión médica activa.');

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

      // Si aún no hemos generado el PDF, generamos uno automáticamente para la BD
      let pdfFileUrl = generatedPdfUri;
      if (!pdfFileUrl) {
        const selectedPharm = pharmacies.find(p => p.id === selectedPharmacy);
        const htmlContent = generatePdfTemplate(selectedPharm ? selectedPharm.name : '');
        const { uri } = await Print.printToFileAsync({ html: htmlContent });
        pdfFileUrl = uri;
      }

      const { error } = await supabase.from('medical_records').insert({
        patient_id: patientId || null,
        doctor_id: user.id,
        appointment_id: appointmentId,
        diagnosis,
        treatment_plan: treatment,
        clinical_notes: notes || null,
        allied_pharmacy_id: selectedPharmacy || null,
        prescription_file_url: pdfFileUrl
      });

      if (error) throw error;

      setSaving(false);
      setModalConfig({
        visible: true,
        title: 'Registro Guardado',
        message: 'El historial clínico y la receta PDF se han guardado exitosamente.',
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
          <Text style={styles.headerTitle}>Registro Médico & Receta PDF</Text>
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
              <Text style={styles.patientSubtitle}>Consulta de Telemedicina - G.A.M. Cochabamba</Text>
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

          {/* Botón Flotante para Generar y Compartir PDF */}
          <TouchableOpacity 
            style={styles.pdfGenerateBtn}
            onPress={handleGenerateAndSharePdf}
            disabled={generatingPdf || !diagnosis || !treatment}
            activeOpacity={0.8}
          >
            {generatingPdf ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <Ionicons name="document-text-outline" size={20} color="#ffffff" />
                <Text style={styles.pdfGenerateBtnText}>Descargar / Compartir Receta PDF</Text>
              </>
            )}
          </TouchableOpacity>

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
        onConfirm={modalConfig.onConfirm || closeModal}
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
    fontSize: 17,
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
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2563eb',
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
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  formSection: {
    marginBottom: 20,
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
    minHeight: 110,
    fontSize: 15,
    color: '#0f172a',
  },
  pdfGenerateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8b5cf6',
    padding: 14,
    borderRadius: 12,
    gap: 8,
    marginBottom: 20,
  },
  pdfGenerateBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
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


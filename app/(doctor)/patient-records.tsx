import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  SafeAreaView,
  Platform,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Alert,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';

interface PatientProfile {
  id: string;
  full_name: string;
  identity_card: string;
  phone_number: string;
  gender: string;
  blood_type: string;
  allergies: string;
  emergency_contact: string;
}

interface MedicalRecord {
  id: string;
  diagnosis: string;
  treatment_plan: string;
  clinical_notes: string | null;
  created_at: string;
}

async function loadDirectory(): Promise<PatientProfile[] | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // 1. Obtener todos los medical_records creados por este doctor
  const { data: records, error } = await supabase
    .from('medical_records')
    .select('patient_id')
    .eq('doctor_id', user.id);

  if (error) throw error;

  // 2. Extraer IDs únicos de pacientes atendidos
  const patientIds = [...new Set(records.map(r => r.patient_id).filter(Boolean))];

  if (patientIds.length === 0) {
    return [];
  }

  // 3. Consultar datos de perfil y médicos
  const { data: profilesData } = await supabase
    .from('profiles')
    .select('id, full_name, identity_card, phone_number, gender')
    .in('id', patientIds);

  const { data: patientsData } = await supabase
    .from('patients')
    .select('id, blood_type, allergies, emergency_contact')
    .in('id', patientIds);

  const patientMap = new Map();
  patientsData?.forEach(p => patientMap.set(p.id, p));

  const formattedPatients: PatientProfile[] = (profilesData || []).map(profile => {
    const pData = patientMap.get(profile.id) || {};
    return {
      id: profile.id,
      full_name: profile.full_name || 'Paciente sin nombre',
      identity_card: profile.identity_card || 'S/N',
      phone_number: profile.phone_number || '-',
      gender: profile.gender || 'No especificado',
      blood_type: pData.blood_type || 'No reg.',
      allergies: pData.allergies || 'Ninguna registrada',
      emergency_contact: pData.emergency_contact || '-',
    };
  });

  formattedPatients.sort((a, b) => a.full_name.localeCompare(b.full_name));
  return formattedPatients;
}

export default function PatientRecordsScreen() {
  const [loading, setLoading] = useState(true);
  const [patients, setPatients] = useState<PatientProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal de Detalles (Ojo)
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<PatientProfile | null>(null);
  const [patientRecords, setPatientRecords] = useState<MedicalRecord[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Modal de Edición (Lápiz)
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingPatient, setEditingPatient] = useState<PatientProfile | null>(null);
  const [editForm, setEditForm] = useState({
    full_name: '',
    phone_number: '',
    blood_type: '',
    emergency_contact: '',
    allergies: '',
  });
  const [savingEdit, setSavingEdit] = useState(false);

  // Modal de Eliminación (Confirmación de Seguridad)
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [patientToDelete, setPatientToDelete] = useState<PatientProfile | null>(null);
  const [deleting, setDeleting] = useState(false);

  const requestVersion = useRef(0);
  const fetchDirectory = useCallback(() => {
    const version = ++requestVersion.current;
    return loadDirectory()
      .then(data => {
        if (version === requestVersion.current && data) setPatients(data);
      })
      .catch((err: unknown) => {
        if (version === requestVersion.current) console.error('Error cargando expedientes:', err);
      })
      .finally(() => {
        if (version === requestVersion.current) setLoading(false);
      });
  }, []);

  useEffect(() => {
    void fetchDirectory();
    return () => { requestVersion.current += 1; };
  }, [fetchDirectory]);

  const refreshDirectory = () => {
    setLoading(true);
    void fetchDirectory();
  };

  // Abrir Modal de Detalles (Ojo)
  const handleOpenDetailModal = async (patient: PatientProfile) => {
    setSelectedPatient(patient);
    setDetailModalVisible(true);
    setLoadingDetail(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: records, error } = await supabase
        .from('medical_records')
        .select('id, diagnosis, treatment_plan, clinical_notes, created_at')
        .eq('patient_id', patient.id)
        .eq('doctor_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPatientRecords(records || []);
    } catch (err) {
      console.error('Error al cargar historial médico:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Abrir Modal de Edición (Lápiz)
  const handleOpenEditModal = (patient: PatientProfile) => {
    setEditingPatient(patient);
    setEditForm({
      full_name: patient.full_name,
      phone_number: patient.phone_number === '-' ? '' : patient.phone_number,
      blood_type: patient.blood_type === 'No reg.' ? '' : patient.blood_type,
      emergency_contact: patient.emergency_contact === '-' ? '' : patient.emergency_contact,
      allergies: patient.allergies === 'Ninguna registrada' ? '' : patient.allergies,
    });
    setEditModalVisible(true);
  };

  // Guardar Cambios de Edición
  const handleSaveEdit = async () => {
    if (!editingPatient) return;
    setSavingEdit(true);

    try {
      // 1. Actualizar perfil
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: editForm.full_name.trim(),
          phone_number: editForm.phone_number.trim(),
        })
        .eq('id', editingPatient.id);

      if (profileError) throw profileError;

      // 2. Actualizar datos médicos en tabla patients
      const { error: patientError } = await supabase
        .from('patients')
        .update({
          blood_type: editForm.blood_type.trim(),
          emergency_contact: editForm.emergency_contact.trim(),
          allergies: editForm.allergies.trim(),
        })
        .eq('id', editingPatient.id);

      if (patientError) throw patientError;

      // Actualizar estado local
      const updatedList = patients.map(p => {
        if (p.id === editingPatient.id) {
          return {
            ...p,
            full_name: editForm.full_name.trim() || p.full_name,
            phone_number: editForm.phone_number.trim() || '-',
            blood_type: editForm.blood_type.trim() || 'No reg.',
            emergency_contact: editForm.emergency_contact.trim() || '-',
            allergies: editForm.allergies.trim() || 'Ninguna registrada',
          };
        }
        return p;
      });

      setPatients(updatedList);
      setEditModalVisible(false);
      setEditingPatient(null);
      Alert.alert('Éxito', 'Los datos del paciente han sido actualizados.');
    } catch (err: any) {
      console.error('Error al actualizar paciente:', err);
      Alert.alert('Error', err.message || 'No se pudo guardar los cambios.');
    } finally {
      setSavingEdit(false);
    }
  };

  // Abrir Modal de Confirmación de Eliminación
  const handlePromptDelete = (patient: PatientProfile) => {
    setPatientToDelete(patient);
    setDeleteModalVisible(true);
  };

  // Confirmar y Ejecutar Eliminación
  const handleConfirmDelete = async () => {
    if (!patientToDelete) return;
    setDeleting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('medical_records')
        .delete()
        .eq('patient_id', patientToDelete.id)
        .eq('doctor_id', user.id);

      if (error) throw error;

      setPatients(prev => prev.filter(p => p.id !== patientToDelete.id));
      setDeleteModalVisible(false);
      setPatientToDelete(null);
    } catch (err: any) {
      console.error('Error al eliminar expediente:', err);
      Alert.alert('Error', err.message || 'No se pudo eliminar el expediente.');
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('es-BO', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const filteredPatients = patients.filter(p => {
    const q = searchQuery.toLowerCase();
    return p.full_name.toLowerCase().includes(q) || p.identity_card.toLowerCase().includes(q);
  });

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#0f172a" />
        </TouchableOpacity>
        <View style={styles.headerTitleBox}>
          <Text style={styles.headerTitle}>Expedientes Clínicos</Text>
          <Text style={styles.headerSubtitle}>Tabla de pacientes atendidos</Text>
        </View>
        <TouchableOpacity style={styles.headerBtn} onPress={refreshDirectory} disabled={loading}>
          <Ionicons name="refresh" size={22} color="#64748b" />
        </TouchableOpacity>
      </View>

      {/* Barra de Búsqueda y Contador */}
      <View style={styles.searchBarWrapper}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color="#94a3b8" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por Nombre o C.I..."
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.counterBadge}>
          <Ionicons name="people" size={15} color="#2563eb" />
          <Text style={styles.counterBadgeText}>{filteredPatients.length} pacientes</Text>
        </View>
      </View>

      {/* Contenido Principal */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Cargando expedientes médicos...</Text>
        </View>
      ) : filteredPatients.length === 0 ? (
        <View style={styles.centerContainer}>
          <View style={styles.emptyIconBg}>
            <Ionicons name="folder-open-outline" size={44} color="#64748b" />
          </View>
          <Text style={styles.emptyTitle}>
            {searchQuery ? 'Sin coincidencias' : 'No hay pacientes registrados'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {searchQuery
              ? 'No se encontraron pacientes con ese nombre o documento.'
              : 'Aún no has registrado atenciones médicas en el sistema.'}
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.scrollVertical} showsVerticalScrollIndicator={true}>
          {/* Contenedor de la Tabla con Scroll Horizontal para Móviles */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={true}
            contentContainerStyle={styles.tableScrollContent}
          >
            <View style={styles.tableContainer}>
              {/* Encabezado de la Tabla */}
              <View style={styles.tableHeaderRow}>
                <View style={[styles.thCell, { width: 220 }]}>
                  <Ionicons name="person" size={14} color="#475569" style={styles.thIcon} />
                  <Text style={styles.thText}>PACIENTE</Text>
                </View>
                <View style={[styles.thCell, { width: 120 }]}>
                  <Ionicons name="card" size={14} color="#475569" style={styles.thIcon} />
                  <Text style={styles.thText}>C.I.</Text>
                </View>
                <View style={[styles.thCell, { width: 130 }]}>
                  <Ionicons name="call" size={14} color="#475569" style={styles.thIcon} />
                  <Text style={styles.thText}>TELÉFONO</Text>
                </View>
                <View style={[styles.thCell, { width: 100 }]}>
                  <Ionicons name="water" size={14} color="#475569" style={styles.thIcon} />
                  <Text style={styles.thText}>SANGRE</Text>
                </View>
                <View style={[styles.thCell, { width: 170 }]}>
                  <Ionicons name="warning" size={14} color="#475569" style={styles.thIcon} />
                  <Text style={styles.thText}>ALERGIAS</Text>
                </View>
                <View style={[styles.thCell, { width: 150, justifyContent: 'center' }]}>
                  <Ionicons name="settings-sharp" size={14} color="#475569" style={styles.thIcon} />
                  <Text style={styles.thText}>ACCIONES</Text>
                </View>
              </View>

              {/* Filas de la Tabla */}
              {filteredPatients.map((patient, index) => {
                const isEven = index % 2 === 0;
                return (
                  <View
                    key={patient.id}
                    style={[styles.tableRow, isEven ? styles.rowEven : styles.rowOdd]}
                  >
                    {/* Paciente */}
                    <View style={[styles.tdCell, { width: 220 }]}>
                      <View style={styles.avatarMini}>
                        <Text style={styles.avatarMiniText}>
                          {patient.full_name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.patientInfoBox}>
                        <Text style={styles.patientFullName} numberOfLines={1}>
                          {patient.full_name}
                        </Text>
                        <Text style={styles.patientGender} numberOfLines={1}>
                          {patient.gender}
                        </Text>
                      </View>
                    </View>

                    {/* CI */}
                    <View style={[styles.tdCell, { width: 120 }]}>
                      <Text style={styles.tdText}>{patient.identity_card}</Text>
                    </View>

                    {/* Teléfono */}
                    <View style={[styles.tdCell, { width: 130 }]}>
                      <Text style={styles.tdText}>{patient.phone_number}</Text>
                    </View>

                    {/* Tipo de Sangre */}
                    <View style={[styles.tdCell, { width: 100 }]}>
                      <View style={styles.bloodBadge}>
                        <Ionicons name="water" size={12} color="#dc2626" />
                        <Text style={styles.bloodBadgeText}>{patient.blood_type}</Text>
                      </View>
                    </View>

                    {/* Alergias */}
                    <View style={[styles.tdCell, { width: 170 }]}>
                      <Text style={styles.tdTextMuted} numberOfLines={1}>
                        {patient.allergies}
                      </Text>
                    </View>

                    {/* Acciones: OJO (Ver detalles) | LÁPIZ (Editar) | BASURERO (Eliminar) */}
                    <View style={[styles.tdCell, styles.actionsCell, { width: 150 }]}>
                      {/* Botón Ver Detalles (Ojo) */}
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.actionBtnView]}
                        onPress={() => handleOpenDetailModal(patient)}
                        activeOpacity={0.7}
                        accessibilityLabel="Ver detalles completos"
                      >
                        <Ionicons name="eye" size={17} color="#2563eb" />
                      </TouchableOpacity>

                      {/* Botón Editar (Lápiz) */}
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.actionBtnEdit]}
                        onPress={() => handleOpenEditModal(patient)}
                        activeOpacity={0.7}
                        accessibilityLabel="Editar paciente"
                      >
                        <Ionicons name="pencil" size={16} color="#d97706" />
                      </TouchableOpacity>

                      {/* Botón Eliminar (Basura) */}
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.actionBtnDelete]}
                        onPress={() => handlePromptDelete(patient)}
                        activeOpacity={0.7}
                        accessibilityLabel="Eliminar expediente"
                      >
                        <Ionicons name="trash" size={16} color="#dc2626" />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </ScrollView>
      )}

      {/* ========================================================= */}
      {/* MODAL 1: VER DETALLES COMPLETOS (OJO)                     */}
      {/* ========================================================= */}
      <Modal
        visible={detailModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Cabecera del Modal */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTitleBox}>
                <Ionicons name="document-text" size={22} color="#2563eb" />
                <Text style={styles.modalTitle}>Detalles del Expediente</Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setDetailModalVisible(false)}
              >
                <Ionicons name="close" size={22} color="#475569" />
              </TouchableOpacity>
            </View>

            {/* Cuerpo del Modal de Detalles */}
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {selectedPatient && (
                <View>
                  {/* Ficha Resumen del Paciente */}
                  <View style={styles.detailProfileCard}>
                    <View style={styles.detailAvatarBox}>
                      <Text style={styles.detailAvatarText}>
                        {selectedPatient.full_name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.detailProfileInfo}>
                      <Text style={styles.detailName}>{selectedPatient.full_name}</Text>
                      <Text style={styles.detailId}>C.I.: {selectedPatient.identity_card}</Text>
                    </View>
                  </View>

                  {/* Cuadrícula de Datos Personales */}
                  <View style={styles.infoGrid}>
                    <View style={styles.infoBox}>
                      <View style={styles.infoBoxHeader}>
                        <Ionicons name="male-female" size={14} color="#64748b" />
                        <Text style={styles.infoBoxLabel}>GÉNERO</Text>
                      </View>
                      <Text style={styles.infoBoxValue}>{selectedPatient.gender}</Text>
                    </View>

                    <View style={styles.infoBox}>
                      <View style={styles.infoBoxHeader}>
                        <Ionicons name="water" size={14} color="#dc2626" />
                        <Text style={styles.infoBoxLabel}>GRUPO SANGUÍNEO</Text>
                      </View>
                      <Text style={[styles.infoBoxValue, { color: '#dc2626' }]}>
                        {selectedPatient.blood_type}
                      </Text>
                    </View>

                    <View style={styles.infoBox}>
                      <View style={styles.infoBoxHeader}>
                        <Ionicons name="call" size={14} color="#64748b" />
                        <Text style={styles.infoBoxLabel}>TELÉFONO</Text>
                      </View>
                      <Text style={styles.infoBoxValue}>{selectedPatient.phone_number}</Text>
                    </View>

                    <View style={styles.infoBox}>
                      <View style={styles.infoBoxHeader}>
                        <Ionicons name="medkit" size={14} color="#64748b" />
                        <Text style={styles.infoBoxLabel}>C. EMERGENCIA</Text>
                      </View>
                      <Text style={styles.infoBoxValue}>{selectedPatient.emergency_contact}</Text>
                    </View>
                  </View>

                  {/* Alergias */}
                  <View style={styles.detailAllergiesCard}>
                    <View style={styles.detailAllergiesHeader}>
                      <Ionicons name="warning" size={16} color="#d97706" />
                      <Text style={styles.detailAllergiesTitle}>Alergias Conocidas</Text>
                    </View>
                    <Text style={styles.detailAllergiesText}>{selectedPatient.allergies}</Text>
                  </View>

                  {/* Historial de Atenciones Registradas */}
                  <View style={styles.sectionHeaderRow}>
                    <Ionicons name="calendar" size={18} color="#0f172a" />
                    <Text style={styles.sectionTitle}>Historial de Atenciones Clínicas</Text>
                  </View>

                  {loadingDetail ? (
                    <View style={styles.modalCenterLoading}>
                      <ActivityIndicator size="small" color="#2563eb" />
                      <Text style={styles.loadingText}>Cargando historial clínico...</Text>
                    </View>
                  ) : patientRecords.length === 0 ? (
                    <View style={styles.modalEmptyBox}>
                      <Ionicons name="document-outline" size={32} color="#94a3b8" />
                      <Text style={styles.modalEmptyText}>
                        No hay registros de consultas registrados para este paciente.
                      </Text>
                    </View>
                  ) : (
                    patientRecords.map((record, idx) => (
                      <View key={record.id} style={styles.recordTimelineItem}>
                        <View style={styles.timelineIndexBadge}>
                          <Text style={styles.timelineIndexText}>#{patientRecords.length - idx}</Text>
                        </View>
                        <View style={styles.recordCard}>
                          <View style={styles.recordHeader}>
                            <Ionicons name="time-outline" size={14} color="#2563eb" />
                            <Text style={styles.recordDateText}>
                              Fecha: {formatDate(record.created_at)}
                            </Text>
                          </View>

                          <Text style={styles.recordSubTitle}>Diagnóstico:</Text>
                          <Text style={styles.recordBodyText}>{record.diagnosis}</Text>

                          <Text style={styles.recordSubTitle}>Plan de Tratamiento:</Text>
                          <Text style={styles.recordBodyText}>{record.treatment_plan}</Text>

                          {record.clinical_notes && (
                            <>
                              <Text style={styles.recordSubTitle}>Notas Clínicas:</Text>
                              <Text style={styles.recordBodyText}>{record.clinical_notes}</Text>
                            </>
                          )}
                        </View>
                      </View>
                    ))
                  )}
                </View>
              )}
            </ScrollView>

            {/* Pie del modal */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCloseBottomBtn}
                onPress={() => setDetailModalVisible(false)}
              >
                <Ionicons name="checkmark-circle-outline" size={18} color="#ffffff" />
                <Text style={styles.modalCloseBottomText}>Cerrar Expediente</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================= */}
      {/* MODAL 2: EDITAR PACIENTE (LÁPIZ)                           */}
      {/* ========================================================= */}
      <Modal
        visible={editModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => { if (!savingEdit) setEditModalVisible(false); }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.editModalContent}>
            {/* Header del Modal de Edición */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTitleBox}>
                <Ionicons name="create" size={20} color="#d97706" />
                <Text style={styles.modalTitle}>Editar Datos del Paciente</Text>
              </View>
              {!savingEdit && (
                <TouchableOpacity
                  style={styles.modalCloseBtn}
                  onPress={() => setEditModalVisible(false)}
                >
                  <Ionicons name="close" size={22} color="#475569" />
                </TouchableOpacity>
              )}
            </View>

            {/* Formulario */}
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Nombre Completo</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="person-outline" size={18} color="#64748b" style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    value={editForm.full_name}
                    onChangeText={text => setEditForm(prev => ({ ...prev, full_name: text }))}
                    placeholder="Ej. Juan Pérez"
                    placeholderTextColor="#94a3b8"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Teléfono de Contacto</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="call-outline" size={18} color="#64748b" style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    value={editForm.phone_number}
                    onChangeText={text => setEditForm(prev => ({ ...prev, phone_number: text }))}
                    placeholder="Ej. 70123456"
                    placeholderTextColor="#94a3b8"
                    keyboardType="phone-pad"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Grupo Sanguíneo</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="water-outline" size={18} color="#64748b" style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    value={editForm.blood_type}
                    onChangeText={text => setEditForm(prev => ({ ...prev, blood_type: text }))}
                    placeholder="Ej. O+, A+, B-"
                    placeholderTextColor="#94a3b8"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Contacto de Emergencia</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="medkit-outline" size={18} color="#64748b" style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    value={editForm.emergency_contact}
                    onChangeText={text => setEditForm(prev => ({ ...prev, emergency_contact: text }))}
                    placeholder="Ej. María Pérez (Madre) - 78912345"
                    placeholderTextColor="#94a3b8"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Alergias Registradas</Text>
                <View style={[styles.inputWrapper, { height: 75, alignItems: 'flex-start' }]}>
                  <Ionicons name="warning-outline" size={18} color="#64748b" style={[styles.inputIcon, { marginTop: 10 }]} />
                  <TextInput
                    style={[styles.textInput, { height: '100%', textAlignVertical: 'top', paddingTop: 8 }]}
                    value={editForm.allergies}
                    onChangeText={text => setEditForm(prev => ({ ...prev, allergies: text }))}
                    placeholder="Ej. Penicilina, Mariscos, Polvo..."
                    placeholderTextColor="#94a3b8"
                    multiline
                  />
                </View>
              </View>
            </ScrollView>

            {/* Botones de Acción */}
            <View style={styles.editFooter}>
              <TouchableOpacity
                style={[styles.btnCancel, savingEdit && { opacity: 0.6 }]}
                onPress={() => setEditModalVisible(false)}
                disabled={savingEdit}
              >
                <Ionicons name="close-circle-outline" size={18} color="#64748b" />
                <Text style={styles.btnCancelText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btnSave, savingEdit && { opacity: 0.7 }]}
                onPress={handleSaveEdit}
                disabled={savingEdit}
              >
                {savingEdit ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Ionicons name="save-outline" size={18} color="#ffffff" />
                    <Text style={styles.btnSaveText}>Guardar Cambios</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ========================================================= */}
      {/* MODAL 3: CONFIRMAR ELIMINACIÓN                            */}
      {/* ========================================================= */}
      <Modal
        visible={deleteModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => { if (!deleting) setDeleteModalVisible(false); }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.deleteModalBox}>
            {/* Icono de advertencia */}
            <View style={styles.deleteIconBg}>
              <Ionicons name="warning" size={32} color="#dc2626" />
            </View>

            <Text style={styles.deleteModalTitle}>Confirmar Eliminación</Text>
            <Text style={styles.deleteModalDesc}>
              ¿Está seguro de que desea eliminar el expediente médico de atención de este paciente?
            </Text>

            {patientToDelete && (
              <View style={styles.deletePatientCard}>
                <View style={styles.deleteAvatar}>
                  <Text style={styles.deleteAvatarText}>
                    {patientToDelete.full_name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.deleteInfoBox}>
                  <Text style={styles.deletePatientName} numberOfLines={1}>
                    {patientToDelete.full_name}
                  </Text>
                  <Text style={styles.deletePatientMeta}>
                    C.I.: {patientToDelete.identity_card} · {patientToDelete.gender}
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.deleteWarningBox}>
              <Ionicons name="alert-circle" size={16} color="#b91c1c" />
              <Text style={styles.deleteWarningText}>
                Esta acción quitará las atenciones registradas por usted. Esta operación no se puede deshacer.
              </Text>
            </View>

            {/* Botones Cancelar / Confirmar */}
            <View style={styles.deleteButtonRow}>
              <TouchableOpacity
                style={[styles.btnDeleteCancel, deleting && { opacity: 0.6 }]}
                onPress={() => {
                  setDeleteModalVisible(false);
                  setPatientToDelete(null);
                }}
                disabled={deleting}
              >
                <Ionicons name="close-outline" size={18} color="#475569" />
                <Text style={styles.btnDeleteCancelText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btnDeleteConfirm, deleting && { opacity: 0.7 }]}
                onPress={handleConfirmDelete}
                disabled={deleting}
              >
                {deleting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Ionicons name="trash-outline" size={18} color="#ffffff" />
                    <Text style={styles.btnDeleteConfirmText}>Sí, Eliminar</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
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
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingTop: Platform.OS === 'android' ? 40 : 14,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerBtn: {
    padding: 8,
  },
  headerTitleBox: {
    flex: 1,
    marginLeft: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
    marginTop: 1,
  },
  searchBarWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0f172a',
  },
  counterBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dbeafe',
    gap: 6,
  },
  counterBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1e40af',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 14,
    color: '#64748b',
    fontSize: 14,
    fontWeight: '500',
  },
  emptyIconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#334155',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 20,
  },
  scrollVertical: {
    flex: 1,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  tableScrollContent: {
    paddingBottom: 24,
  },
  tableContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderBottomWidth: 1.5,
    borderBottomColor: '#cbd5e1',
    paddingVertical: 12,
  },
  thCell: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  thIcon: {
    marginRight: 6,
  },
  thText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingVertical: 12,
  },
  rowEven: {
    backgroundColor: '#ffffff',
  },
  rowOdd: {
    backgroundColor: '#fafcff',
  },
  tdCell: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  tdText: {
    fontSize: 13,
    color: '#1e293b',
    fontWeight: '600',
  },
  tdTextMuted: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  avatarMini: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarMiniText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  patientInfoBox: {
    flex: 1,
  },
  patientFullName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  patientGender: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  bloodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
    gap: 4,
  },
  bloodBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#dc2626',
  },
  actionsCell: {
    justifyContent: 'center',
    gap: 8,
  },
  actionBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  actionBtnView: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
  },
  actionBtnEdit: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
  },
  actionBtnDelete: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },

  // ESTILOS DE MODAL
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    width: '100%',
    maxHeight: '88%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 8,
  },
  editModalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    width: '100%',
    maxWidth: 500,
    maxHeight: '85%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  modalHeaderTitleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalBody: {
    padding: 20,
  },
  detailProfileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  detailAvatarBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  detailAvatarText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
  },
  detailProfileInfo: {
    flex: 1,
  },
  detailName: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 2,
  },
  detailId: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  infoBox: {
    width: '48%',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  infoBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  infoBoxLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
  },
  infoBoxValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  detailAllergiesCard: {
    backgroundColor: '#fffbeb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fde68a',
    padding: 12,
    marginBottom: 20,
  },
  detailAllergiesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  detailAllergiesTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#d97706',
  },
  detailAllergiesText: {
    fontSize: 13,
    color: '#92400e',
    fontWeight: '600',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  modalCenterLoading: {
    padding: 30,
    alignItems: 'center',
  },
  modalEmptyBox: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  modalEmptyText: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 8,
  },
  recordTimelineItem: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  timelineIndexBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    marginRight: 10,
    marginTop: 2,
  },
  timelineIndexText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2563eb',
  },
  recordCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  recordHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  recordDateText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563eb',
  },
  recordSubTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    marginTop: 4,
    marginBottom: 2,
  },
  recordBodyText: {
    fontSize: 13,
    color: '#1e293b',
    lineHeight: 18,
    marginBottom: 4,
  },
  modalFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  modalCloseBottomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  modalCloseBottomText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },

  // FORMULARIO DE EDICIÓN
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 12,
    height: 44,
  },
  inputIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: '#0f172a',
  },
  editFooter: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  btnCancel: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingVertical: 12,
    gap: 6,
  },
  btnCancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  btnSave: {
    flex: 1.4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 12,
    gap: 6,
  },
  btnSaveText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },

  // ESTILOS DE MODAL DE ELIMINACIÓN
  deleteModalBox: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    width: '100%',
    maxWidth: 400,
    padding: 22,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 10,
  },
  deleteIconBg: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  deleteModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 6,
    textAlign: 'center',
  },
  deleteModalDesc: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  deletePatientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    width: '100%',
    marginBottom: 12,
  },
  deleteAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  deleteAvatarText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  deleteInfoBox: {
    flex: 1,
  },
  deletePatientName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  deletePatientMeta: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  deleteWarningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff1f2',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#ffe4e6',
    gap: 8,
    width: '100%',
    marginBottom: 18,
  },
  deleteWarningText: {
    flex: 1,
    fontSize: 11,
    color: '#9f1239',
    lineHeight: 16,
    fontWeight: '500',
  },
  deleteButtonRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  btnDeleteCancel: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    paddingVertical: 12,
    gap: 6,
  },
  btnDeleteCancelText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  btnDeleteConfirm: {
    flex: 1.3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dc2626',
    borderRadius: 10,
    paddingVertical: 12,
    gap: 6,
  },
  btnDeleteConfirmText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
});

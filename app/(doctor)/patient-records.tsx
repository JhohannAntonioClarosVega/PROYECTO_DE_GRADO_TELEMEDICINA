import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, SafeAreaView, Platform, TouchableOpacity, ActivityIndicator } from 'react-native';
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

export default function PatientRecordsScreen() {
  const [viewMode, setViewMode] = useState<'directory' | 'detail'>('directory');
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  
  const [patients, setPatients] = useState<PatientProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [selectedPatient, setSelectedPatient] = useState<PatientProfile | null>(null);
  const [patientRecords, setPatientRecords] = useState<MedicalRecord[]>([]);

  useEffect(() => {
    if (viewMode === 'directory') {
      fetchDirectory();
    }
  }, [viewMode]);

  const fetchDirectory = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Obtener todos los medical_records creados por este doctor
      const { data: records, error } = await supabase
        .from('medical_records')
        .select('patient_id')
        .eq('doctor_id', user.id);

      if (error) throw error;

      // 2. Extraer los IDs únicos de los pacientes
      const patientIds = [...new Set(records.map(r => r.patient_id).filter(Boolean))];

      if (patientIds.length === 0) {
        setPatients([]);
        return;
      }

      // 3. Consultar perfiles y datos médicos base de esos pacientes
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
          full_name: profile.full_name || 'Paciente Desconocido',
          identity_card: profile.identity_card || 'S/N',
          phone_number: profile.phone_number || '-',
          gender: profile.gender || 'No especificado',
          blood_type: pData.blood_type || 'No reg.',
          allergies: pData.allergies || 'Ninguna registrada',
          emergency_contact: pData.emergency_contact || '-'
        };
      });

      // Ordenar alfabéticamente
      formattedPatients.sort((a, b) => a.full_name.localeCompare(b.full_name));
      setPatients(formattedPatients);
    } catch (err) {
      console.error('Error cargando directorio:', err);
    } finally {
      setLoading(false);
    }
  };

  const openPatientDetail = async (patient: PatientProfile) => {
    setSelectedPatient(patient);
    setViewMode('detail');
    setLoadingDetail(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Consultar historial del paciente (solo los creados por este doctor por seguridad RLS actual)
      const { data: records, error } = await supabase
        .from('medical_records')
        .select('id, diagnosis, treatment_plan, clinical_notes, created_at')
        .eq('patient_id', patient.id)
        .eq('doctor_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPatientRecords(records || []);
    } catch (err) {
      console.error('Error cargando historial del paciente:', err);
    } finally {
      setLoadingDetail(false);
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
    } catch (e) {
      return dateStr;
    }
  };

  const filteredPatients = patients.filter(p => {
    const q = searchQuery.toLowerCase();
    return p.full_name.toLowerCase().includes(q) || p.identity_card.toLowerCase().includes(q);
  });

  // =====================
  // RENDER DIRECTORY
  // =====================
  const renderPatientCard = ({ item }: { item: PatientProfile }) => (
    <TouchableOpacity 
      style={styles.card} 
      activeOpacity={0.7} 
      onPress={() => openPatientDetail(item)}
    >
      <View style={styles.cardHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{item.full_name.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.cardHeaderInfo}>
          <Text style={styles.patientName}>{item.full_name}</Text>
          <Text style={styles.patientId}>CI: {item.identity_card}</Text>
        </View>
        <Ionicons name="chevron-forward" size={24} color="#cbd5e1" />
      </View>
      <View style={styles.cardFooter}>
        <View style={styles.footerItem}>
          <Ionicons name="water" size={14} color="#ef4444" />
          <Text style={styles.footerText}>{item.blood_type}</Text>
        </View>
        <View style={styles.footerItem}>
          <Ionicons name="call" size={14} color="#64748b" />
          <Text style={styles.footerText}>{item.phone_number}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (viewMode === 'directory') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#0f172a" />
          </TouchableOpacity>
          <View style={styles.titleContainer}>
            <Text style={styles.headerTitle}>Expedientes Clínicos</Text>
            <Text style={styles.headerSubtitle}>Directorio de pacientes atendidos</Text>
          </View>
          <TouchableOpacity style={styles.refreshBtn} onPress={fetchDirectory} disabled={loading}>
            <Ionicons name="refresh" size={22} color="#64748b" />
          </TouchableOpacity>
        </View>

        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#94a3b8" style={styles.searchIcon} />
          <TextInput 
            style={styles.searchInput}
            placeholder="Buscar por Nombre o CI..."
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

        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#2563eb" />
            <Text style={styles.loadingText}>Cargando directorio...</Text>
          </View>
        ) : filteredPatients.length === 0 ? (
          <View style={styles.centerContainer}>
            <View style={styles.emptyIconBg}>
              <Ionicons name="people-outline" size={48} color="#94a3b8" />
            </View>
            <Text style={styles.emptyTitle}>
              {searchQuery ? 'Sin resultados' : 'Directorio Vacío'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery 
                ? 'No hay pacientes que coincidan con la búsqueda.' 
                : 'Aún no has registrado atenciones médicas.'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredPatients}
            keyExtractor={item => item.id}
            renderItem={renderPatientCard}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
          />
        )}
      </SafeAreaView>
    );
  }

  // =====================
  // RENDER DETAIL
  // =====================
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => setViewMode('directory')}>
          <Ionicons name="arrow-back" size={24} color="#0f172a" />
        </TouchableOpacity>
        <View style={styles.titleContainer}>
          <Text style={styles.headerTitle}>Historia Clínica</Text>
          <Text style={styles.headerSubtitle}>Perfil del paciente</Text>
        </View>
      </View>

      <FlatList
        data={patientRecords}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.detailContainer}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={() => (
          <View>
            {selectedPatient && (
              <View style={styles.profileCard}>
                <View style={styles.profileHeaderRow}>
                  <View style={[styles.avatar, { width: 56, height: 56, borderRadius: 28 }]}>
                    <Text style={[styles.avatarText, { fontSize: 24 }]}>{selectedPatient.full_name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={styles.profileHeaderText}>
                    <Text style={styles.profileName}>{selectedPatient.full_name}</Text>
                    <Text style={styles.profileId}>CI: {selectedPatient.identity_card}</Text>
                  </View>
                </View>

                <View style={styles.profileGrid}>
                  <View style={styles.profileDataBox}>
                    <Text style={styles.dataLabel}>Género</Text>
                    <Text style={styles.dataValue}>{selectedPatient.gender}</Text>
                  </View>
                  <View style={styles.profileDataBox}>
                    <Text style={styles.dataLabel}>Sangre</Text>
                    <Text style={[styles.dataValue, { color: '#ef4444' }]}>{selectedPatient.blood_type}</Text>
                  </View>
                  <View style={styles.profileDataBox}>
                    <Text style={styles.dataLabel}>Teléfono</Text>
                    <Text style={styles.dataValue}>{selectedPatient.phone_number}</Text>
                  </View>
                  <View style={styles.profileDataBox}>
                    <Text style={styles.dataLabel}>C. Emergencia</Text>
                    <Text style={styles.dataValue}>{selectedPatient.emergency_contact}</Text>
                  </View>
                </View>

                <View style={styles.allergiesBox}>
                  <View style={styles.allergiesHeader}>
                    <Ionicons name="warning" size={16} color="#f59e0b" />
                    <Text style={styles.allergiesTitle}>Alergias Conocidas</Text>
                  </View>
                  <Text style={styles.allergiesText}>{selectedPatient.allergies}</Text>
                </View>
              </View>
            )}

            <Text style={styles.timelineTitle}>Línea de Tiempo de Atenciones</Text>

            {loadingDetail && (
              <View style={[styles.centerContainer, { padding: 40 }]}>
                <ActivityIndicator size="small" color="#2563eb" />
              </View>
            )}

            {!loadingDetail && patientRecords.length === 0 && (
              <Text style={styles.noRecordsText}>No hay registros médicos disponibles.</Text>
            )}
          </View>
        )}
        renderItem={({ item }) => (
          <View style={styles.timelineItem}>
            <View style={styles.timelineDot} />
            <View style={styles.timelineLine} />
            <View style={styles.timelineContent}>
              <Text style={styles.recordDate}>{formatDate(item.created_at)}</Text>
              
              <Text style={styles.recordSectionTitle}>Diagnóstico</Text>
              <Text style={styles.recordText}>{item.diagnosis}</Text>
              
              <Text style={styles.recordSectionTitle}>Plan de Tratamiento</Text>
              <Text style={styles.recordText}>{item.treatment_plan}</Text>

              {item.clinical_notes && (
                <>
                  <Text style={styles.recordSectionTitle}>Notas Clínicas</Text>
                  <Text style={styles.recordText}>{item.clinical_notes}</Text>
                </>
              )}
            </View>
          </View>
        )}
      />
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
    padding: 16,
    paddingTop: Platform.OS === 'android' ? 40 : 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    zIndex: 10,
  },
  backBtn: {
    padding: 8,
    marginRight: 8,
  },
  titleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '500',
  },
  refreshBtn: {
    padding: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    margin: 16,
    borderRadius: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    fontSize: 14,
    color: '#0f172a',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 16,
    color: '#64748b',
    fontSize: 15,
    fontWeight: '500',
  },
  emptyIconBg: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#334155',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  listContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
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
    fontSize: 18,
    fontWeight: '700',
  },
  cardHeaderInfo: {
    flex: 1,
  },
  patientName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 2,
  },
  patientId: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  cardFooter: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 12,
    gap: 16,
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  footerText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  
  // DETAIL STYLES
  detailContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  profileCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  profileHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  profileHeaderText: {
    flex: 1,
    marginLeft: 16,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },
  profileId: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
  },
  profileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  profileDataBox: {
    width: '47%',
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  dataLabel: {
    fontSize: 11,
    color: '#64748b',
    textTransform: 'uppercase',
    fontWeight: '700',
    marginBottom: 4,
  },
  dataValue: {
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '700',
  },
  allergiesBox: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 10,
    padding: 12,
  },
  allergiesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 6,
  },
  allergiesTitle: {
    fontSize: 13,
    color: '#d97706',
    fontWeight: '800',
  },
  allergiesText: {
    fontSize: 14,
    color: '#92400e',
    fontWeight: '500',
  },
  timelineTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  noRecordsText: {
    color: '#64748b',
    textAlign: 'center',
    padding: 20,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#2563eb',
    marginTop: 6,
    zIndex: 2,
  },
  timelineLine: {
    position: 'absolute',
    left: 13.5,
    top: 18,
    bottom: -30,
    width: 2,
    backgroundColor: '#e2e8f0',
    zIndex: 1,
  },
  timelineContent: {
    flex: 1,
    marginLeft: 16,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  recordDate: {
    fontSize: 12,
    color: '#2563eb',
    fontWeight: '800',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  recordSectionTitle: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  recordText: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 20,
    marginBottom: 12,
  }
});

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, SafeAreaView, Platform, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';

interface MedicalRecord {
  id: string;
  diagnosis: string;
  treatment_plan: string;
  clinical_notes: string | null;
  created_at: string;
  patients: {
    profiles: {
      full_name: string;
    } | null;
  } | null;
  allied_pharmacies: {
    name: string;
  } | null;
}

export default function DoctorHistoryScreen() {
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const fetchRecords = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('No se pudo encontrar una sesión activa de doctor.');
      }

      // Paso 1: Traer los registros médicos del doctor
      const { data: rawRecords, error } = await supabase
        .from('medical_records')
        .select('id, diagnosis, treatment_plan, clinical_notes, created_at, patient_id, allied_pharmacy_id')
        .eq('doctor_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase error en medical_records:', JSON.stringify(error));
        throw new Error(`Error de base de datos: ${error.message}`);
      }

      if (!rawRecords || rawRecords.length === 0) {
        setRecords([]);
        return;
      }

      // Paso 2: Traer los perfiles de los pacientes y farmacias
      const patientIds = [...new Set(rawRecords.map((r: any) => r.patient_id).filter(Boolean))];
      const pharmacyIds = [...new Set(rawRecords.map((r: any) => r.allied_pharmacy_id).filter(Boolean))];

      const [patientsResult, pharmaciesResult] = await Promise.all([
        patientIds.length > 0
          ? supabase.from('profiles').select('id, full_name').in('id', patientIds)
          : Promise.resolve({ data: [] }),
        pharmacyIds.length > 0
          ? supabase.from('allied_pharmacies').select('id, name').in('id', pharmacyIds)
          : Promise.resolve({ data: [] })
      ]);

      const patientMap: Record<string, string> = {};
      (patientsResult.data || []).forEach((p: any) => { patientMap[p.id] = p.full_name; });

      const pharmacyMap: Record<string, string> = {};
      (pharmaciesResult.data || []).forEach((p: any) => { pharmacyMap[p.id] = p.name; });

      const formattedRecords: MedicalRecord[] = rawRecords.map((item: any) => ({
        id: item.id,
        diagnosis: item.diagnosis || '',
        treatment_plan: item.treatment_plan || '',
        clinical_notes: item.clinical_notes || null,
        created_at: item.created_at,
        patients: item.patient_id
          ? { profiles: { full_name: patientMap[item.patient_id] || 'Paciente Desconocido' } }
          : null,
        allied_pharmacies: item.allied_pharmacy_id
          ? { name: pharmacyMap[item.allied_pharmacy_id] || '' }
          : null
      }));

      setRecords(formattedRecords);
    } catch (err: any) {
      console.error('Error cargando registros del doctor:', err);
      setErrorMsg(err.message || 'Error al conectar con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('es-BO', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return dateStr;
    }
  };

  // Filtrar registros por diagnóstico o por nombre del paciente
  const filteredRecords = records.filter(record => {
    const patientName = record.patients?.profiles?.full_name || 'Paciente Desconocido';
    const diagnosisText = record.diagnosis || '';
    const treatmentText = record.treatment_plan || '';
    const query = searchQuery.toLowerCase();

    return (
      patientName.toLowerCase().includes(query) ||
      diagnosisText.toLowerCase().includes(query) ||
      treatmentText.toLowerCase().includes(query)
    );
  });

  const renderRecordCard = ({ item }: { item: MedicalRecord }) => {
    const patientName = item.patients?.profiles?.full_name || 'Paciente Desconocido';
    const pharmacyName = item.allied_pharmacies?.name || '';
    const hasPharmacy = !!pharmacyName;

    return (
      <View style={styles.recordCard}>
        <View style={styles.cardHeader}>
          <View style={styles.doctorInfo}>
            <View style={styles.doctorAvatar}>
              <Ionicons name="person" size={16} color="#2563eb" />
            </View>
            <View>
              <Text style={styles.doctorLabel}>Paciente Atendido</Text>
              <Text style={styles.doctorName}>{patientName}</Text>
            </View>
          </View>
          <Text style={styles.dateText}>{formatDate(item.created_at)}</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.contentSection}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="pulse" size={16} color="#ef4444" style={styles.sectionIcon} />
            <Text style={styles.sectionTitle}>Diagnóstico Médico</Text>
          </View>
          <Text style={styles.sectionText}>{item.diagnosis}</Text>
        </View>

        <View style={styles.contentSection}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="receipt-outline" size={16} color="#059669" style={styles.sectionIcon} />
            <Text style={styles.sectionTitle}>Plan de Tratamiento y Receta</Text>
          </View>
          <Text style={styles.sectionText}>{item.treatment_plan}</Text>
        </View>

        {hasPharmacy && (
          <View style={styles.pharmacyBadge}>
            <Ionicons name="medical" size={14} color="#047857" />
            <Text style={styles.pharmacyText}>
              Receta derivada a: <Text style={styles.pharmacyName}>{pharmacyName}</Text>
            </Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#0f172a" />
        </TouchableOpacity>
        <View style={styles.titleContainer}>
          <Text style={styles.headerTitle}>Pacientes Atendidos</Text>
          <Text style={styles.headerSubtitle}>Registro de atenciones y recetas emitidas</Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={fetchRecords} disabled={loading}>
          <Ionicons name="refresh" size={22} color="#64748b" />
        </TouchableOpacity>
      </View>

      {/* Buscador */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#94a3b8" style={styles.searchIcon} />
        <TextInput 
          style={styles.searchInput}
          placeholder="Buscar por diagnóstico, médico o medicamento..."
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
          <Text style={styles.loadingText}>Cargando tu historial médico...</Text>
        </View>
      ) : errorMsg ? (
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle-outline" size={60} color="#ef4444" />
          <Text style={styles.errorText}>{errorMsg}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchRecords}>
            <Text style={styles.retryText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      ) : filteredRecords.length === 0 ? (
        <View style={styles.centerContainer}>
          <View style={styles.emptyIconBg}>
            <Ionicons name="folder-open-outline" size={48} color="#94a3b8" />
          </View>
          <Text style={styles.emptyTitle}>
            {searchQuery ? 'No se encontraron resultados' : 'Historial Clínico Vacío'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {searchQuery 
              ? 'Prueba modificando los términos de tu búsqueda.' 
              : 'Aún no tienes registros médicos guardados en el sistema.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredRecords}
          keyExtractor={item => item.id}
          renderItem={renderRecordCard}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      )}
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
  errorText: {
    color: '#ef4444',
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 16,
  },
  retryBtn: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: {
    color: '#ffffff',
    fontWeight: '700',
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
  recordCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  doctorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  doctorAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  doctorLabel: {
    fontSize: 10,
    color: '#64748b',
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  doctorName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
  },
  dateText: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
    textAlign: 'right',
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 14,
  },
  contentSection: {
    marginBottom: 14,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  sectionIcon: {
    marginRight: 6,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionText: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 20,
    paddingLeft: 22,
  },
  pharmacyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginTop: 6,
  },
  pharmacyText: {
    marginLeft: 6,
    fontSize: 12,
    color: '#065f46',
  },
  pharmacyName: {
    fontWeight: '700',
  }
});

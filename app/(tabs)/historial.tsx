import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  Platform, TouchableOpacity, ActivityIndicator, RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';

interface DoctorRecord {
  id: string;
  diagnosis: string;
  treatment_plan: string;
  clinical_notes: string | null;
  created_at: string;
  patient_name: string;
  pharmacy_name: string;
}

export default function HistorialScreen() {
  const [records, setRecords] = useState<DoctorRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const fetchDoctorRecords = useCallback(async () => {
    setErrorMsg('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Sin sesión activa.');

      // Query simple a medical_records filtrando por doctor_id
      const { data: raw, error } = await supabase
        .from('medical_records')
        .select('id, diagnosis, treatment_plan, clinical_notes, created_at, patient_id, allied_pharmacy_id')
        .eq('doctor_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error historial médico:', JSON.stringify(error));
        throw new Error(error.message);
      }

      if (!raw || raw.length === 0) {
        setRecords([]);
        return;
      }

      // Obtener nombres de pacientes y farmacias en paralelo
      const patientIds = [...new Set(raw.map((r: any) => r.patient_id).filter(Boolean))];
      const pharmacyIds = [...new Set(raw.map((r: any) => r.allied_pharmacy_id).filter(Boolean))];

      const [patientsResult, pharmaciesResult] = await Promise.all([
        patientIds.length > 0
          ? supabase.from('profiles').select('id, full_name').in('id', patientIds)
          : Promise.resolve({ data: [] }),
        pharmacyIds.length > 0
          ? supabase.from('allied_pharmacies').select('id, name').in('id', pharmacyIds)
          : Promise.resolve({ data: [] }),
      ]);

      const patientMap: Record<string, string> = {};
      (patientsResult.data || []).forEach((p: any) => { patientMap[p.id] = p.full_name; });

      const pharmacyMap: Record<string, string> = {};
      (pharmaciesResult.data || []).forEach((p: any) => { pharmacyMap[p.id] = p.name; });

      const formatted: DoctorRecord[] = raw.map((item: any) => ({
        id: item.id,
        diagnosis: item.diagnosis || '',
        treatment_plan: item.treatment_plan || '',
        clinical_notes: item.clinical_notes || null,
        created_at: item.created_at,
        patient_name: item.patient_id ? (patientMap[item.patient_id] || 'Paciente') : 'Paciente',
        pharmacy_name: item.allied_pharmacy_id ? (pharmacyMap[item.allied_pharmacy_id] || '') : '',
      }));

      setRecords(formatted);
    } catch (err: any) {
      console.error('Error en historial del doctor:', err);
      setErrorMsg(err.message || 'No se pudo cargar el historial.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDoctorRecords();
  }, [fetchDoctorRecords]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDoctorRecords();
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('es-BO', {
        day: '2-digit', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    } catch { return dateStr; }
  };

  const filtered = records.filter(r => {
    const q = searchQuery.toLowerCase();
    return (
      r.patient_name.toLowerCase().includes(q) ||
      r.diagnosis.toLowerCase().includes(q) ||
      r.treatment_plan.toLowerCase().includes(q)
    );
  });

  const renderCard = ({ item }: { item: DoctorRecord }) => (
    <View style={styles.card}>
      {/* Cabecera */}
      <View style={styles.cardHeader}>
        <View style={styles.patientRow}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>
              {item.patient_name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={styles.patientLabel}>PACIENTE</Text>
            <Text style={styles.patientName}>{item.patient_name}</Text>
          </View>
        </View>
        <Text style={styles.dateText}>{formatDate(item.created_at)}</Text>
      </View>

      <View style={styles.divider} />

      {/* Diagnóstico */}
      <View style={styles.section}>
        <View style={styles.sectionTitleRow}>
          <Ionicons name="pulse" size={14} color="#ef4444" style={styles.sectionIcon} />
          <Text style={styles.sectionTitle}>DIAGNÓSTICO</Text>
        </View>
        <Text style={styles.sectionText} numberOfLines={3}>{item.diagnosis}</Text>
      </View>

      {/* Tratamiento */}
      <View style={styles.section}>
        <View style={styles.sectionTitleRow}>
          <Ionicons name="receipt-outline" size={14} color="#059669" style={styles.sectionIcon} />
          <Text style={styles.sectionTitle}>TRATAMIENTO Y RECETA</Text>
        </View>
        <Text style={styles.sectionText} numberOfLines={3}>{item.treatment_plan}</Text>
      </View>

      {/* Notas internas */}
      {!!item.clinical_notes && (
        <View style={styles.notesBox}>
          <Ionicons name="lock-closed" size={12} color="#7c3aed" />
          <Text style={styles.notesText} numberOfLines={2}> {item.clinical_notes}</Text>
        </View>
      )}

      {/* Farmacia */}
      {!!item.pharmacy_name && (
        <View style={styles.pharmacyBadge}>
          <Ionicons name="medical" size={13} color="#047857" />
          <Text style={styles.pharmacyText}>
            Receta derivada a: <Text style={styles.pharmacyName}>{item.pharmacy_name}</Text>
          </Text>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Encabezado */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Mis Consultas</Text>
          <Text style={styles.headerSubtitle}>Registros clínicos que has emitido</Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh} disabled={loading}>
          <Ionicons name="refresh" size={22} color="#64748b" />
        </TouchableOpacity>
      </View>

      {/* Métricas rápidas */}
      <View style={styles.metricsRow}>
        <View style={styles.metricBox}>
          <Text style={styles.metricValue}>{records.length}</Text>
          <Text style={styles.metricLabel}>Total Registros</Text>
        </View>
        <View style={styles.metricBox}>
          <Text style={[styles.metricValue, { color: '#2563eb' }]}>
            {records.filter(r => {
              const d = new Date(r.created_at);
              const now = new Date();
              return d.toDateString() === now.toDateString();
            }).length}
          </Text>
          <Text style={styles.metricLabel}>Hoy</Text>
        </View>
        <View style={styles.metricBox}>
          <Text style={[styles.metricValue, { color: '#10b981' }]}>
            {records.filter(r => !!r.pharmacy_name).length}
          </Text>
          <Text style={styles.metricLabel}>Con Receta</Text>
        </View>
      </View>

      {/* Buscador */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color="#94a3b8" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por paciente, diagnóstico..."
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

      {/* Contenido principal */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Cargando tu historial clínico...</Text>
        </View>
      ) : errorMsg ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={56} color="#ef4444" />
          <Text style={styles.errorText}>{errorMsg}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={onRefresh}>
            <Text style={styles.retryText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyIconBg}>
            <Ionicons name="folder-open-outline" size={44} color="#94a3b8" />
          </View>
          <Text style={styles.emptyTitle}>
            {searchQuery ? 'Sin resultados' : 'Historial vacío'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {searchQuery
              ? 'Prueba con otros términos de búsqueda.'
              : 'Aún no has guardado registros clínicos.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={renderCard}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: Platform.OS === 'android' ? 40 : 20,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#0f172a', letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 13, color: '#64748b', marginTop: 3, fontWeight: '500' },
  refreshBtn: { padding: 8 },
  metricsRow: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  metricBox: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 14,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  metricValue: { fontSize: 22, fontWeight: '900', color: '#1e293b' },
  metricLabel: { fontSize: 10, color: '#64748b', marginTop: 4, fontWeight: '700', textTransform: 'uppercase', textAlign: 'center' },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchIcon: { marginRight: 8 },
  searchInput: {
    flex: 1,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    fontSize: 14,
    color: '#0f172a',
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  loadingText: { marginTop: 14, color: '#64748b', fontSize: 15, fontWeight: '500' },
  errorText: { color: '#ef4444', textAlign: 'center', fontSize: 15, fontWeight: '600', marginTop: 12, marginBottom: 16 },
  retryBtn: { backgroundColor: '#2563eb', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  retryText: { color: '#ffffff', fontWeight: '700' },
  emptyIconBg: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: '#e2e8f0',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#334155', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 20, paddingHorizontal: 16 },
  list: { padding: 16, paddingBottom: 100 },
  card: {
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
    marginBottom: 2,
  },
  patientRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatarCircle: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: '#2563eb',
    alignItems: 'center', justifyContent: 'center',
    marginRight: 10,
  },
  avatarText: { color: '#ffffff', fontWeight: '800', fontSize: 15 },
  patientLabel: { fontSize: 9, color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  patientName: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  dateText: { fontSize: 11, color: '#94a3b8', fontWeight: '600', textAlign: 'right', maxWidth: 100 },
  divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 12 },
  section: { marginBottom: 12 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  sectionIcon: { marginRight: 5 },
  sectionTitle: { fontSize: 10, fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionText: { fontSize: 14, color: '#334155', lineHeight: 20, paddingLeft: 19 },
  notesBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f5f3ff',
    borderColor: '#ddd6fe',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  notesText: { fontSize: 12, color: '#5b21b6', flex: 1 },
  pharmacyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
  },
  pharmacyText: { marginLeft: 6, fontSize: 12, color: '#065f46' },
  pharmacyName: { fontWeight: '700' },
});

import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Platform, ActivityIndicator, RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';

interface Appointment {
  id: string;            // triage id (used as room id)
  patientId: string;
  patientName: string;
  patientCI: string;
  urgency: 'Critical' | 'Medium' | 'Low';
  waitingMins: number;
  type: string;
}

const urgencyColor = (u: string) => {
  switch (u) {
    case 'Critical': return '#ef4444';
    case 'Medium':   return '#f59e0b';
    case 'Low':      return '#10b981';
    default:         return '#6b7280';
  }
};

const urgencyLabel = (u: string) => {
  switch (u) {
    case 'Critical': return 'Crítico';
    case 'Medium':   return 'Medio';
    case 'Low':      return 'Bajo';
    default:         return u;
  }
};

export default function ConsultasScreen() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [errorMsg, setErrorMsg]         = useState('');
  const [activeTab, setActiveTab]       = useState<'active' | 'completed'>('active');

  const fetchAppointments = useCallback(async () => {
    setErrorMsg('');
    try {
      const { data, error } = await supabase
        .from('triages')
        .select(`
          id,
          patient_id,
          urgency_level,
          reported_symptoms,
          created_at,
          patients (
            id,
            profiles (
              full_name,
              identity_card
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error consultas:', JSON.stringify(error));
        throw new Error(error.message);
      }

      const formatted: Appointment[] = (data || []).map((t: any) => {
        const profile = t.patients?.profiles;
        const name = profile?.full_name || 'Paciente';
        const ci   = profile?.identity_card || '—';
        const mins = Math.max(1, Math.round(
          (Date.now() - new Date(t.created_at).getTime()) / 60000
        ));
        return {
          id:          t.id,
          patientId:   t.patient_id || t.patients?.id || '',
          patientName: name,
          patientCI:   ci,
          urgency:     t.urgency_level || 'Medium',
          waitingMins: mins,
          type:        t.reported_symptoms
            ? t.reported_symptoms.substring(0, 40) + '...'
            : 'Consulta General',
        };
      });

      setAppointments(formatted);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al cargar las consultas.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchAppointments(); }, [fetchAppointments]);

  const onRefresh = () => { setRefreshing(true); fetchAppointments(); };

  const renderItem = ({ item }: { item: Appointment }) => {
    const color = urgencyColor(item.urgency);
    return (
      <View style={styles.card}>
        {/* Cabecera de la tarjeta */}
        <View style={styles.cardHeader}>
          <View style={[styles.urgencyDot, { backgroundColor: color }]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.patientName}>{item.patientName}</Text>
            <Text style={styles.patientCI}>CI: {item.patientCI}</Text>
          </View>
          <View style={[styles.urgencyBadge, { backgroundColor: color + '20', borderColor: color + '50' }]}>
            <Text style={[styles.urgencyText, { color }]}>{urgencyLabel(item.urgency)}</Text>
          </View>
        </View>

        {/* Síntomas */}
        <View style={styles.symptomsRow}>
          <Ionicons name="clipboard-outline" size={14} color="#94a3b8" />
          <Text style={styles.symptomsText} numberOfLines={2}>{item.type}</Text>
        </View>

        {/* Tiempo de espera */}
        <View style={styles.waitRow}>
          <Ionicons name="time-outline" size={14} color="#64748b" />
          <Text style={styles.waitText}>Esperando {item.waitingMins} min</Text>
        </View>

        {/* Acciones */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.btn, styles.btnVideo]}
            activeOpacity={0.8}
            onPress={() => router.push({
              pathname: '/videocall' as any,
              params: {
                role:        'doctor',
                patientId:   item.patientId,
                patientName: item.patientName,
                triageId:    item.id,
                doctorName:  'Dr.'
              }
            })}
          >
            <Ionicons name="videocam" size={16} color="#ffffff" />
            <Text style={styles.btnTextVideo}>Iniciar Llamada</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, styles.btnRecord]}
            activeOpacity={0.8}
            onPress={() => router.push({
              pathname: '/medical-record' as any,
              params: {
                patientId:   item.patientId,
                patientName: item.patientName,
                triageId:    item.id,
              }
            })}
          >
            <Ionicons name="document-text" size={16} color="#2563eb" />
            <Text style={styles.btnTextRecord}>Registro</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Encabezado */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Consultas Activas</Text>
          <Text style={styles.headerSubtitle}>Pacientes en sala de espera</Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh} disabled={loading}>
          <Ionicons name="refresh" size={22} color="#64748b" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'active' && styles.tabActive]}
          onPress={() => setActiveTab('active')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, activeTab === 'active' && styles.tabTextActive]}>
            En Espera ({appointments.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'completed' && styles.tabActive]}
          onPress={() => router.push('/historial' as any)}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, activeTab === 'completed' && styles.tabTextActive]}>
            Mis Registros
          </Text>
        </TouchableOpacity>
      </View>

      {/* Contenido */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Cargando pacientes en espera...</Text>
        </View>
      ) : errorMsg ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={52} color="#ef4444" />
          <Text style={styles.errorText}>{errorMsg}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={onRefresh}>
            <Text style={styles.retryText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={appointments}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <View style={styles.emptyIconBg}>
                <Ionicons name="checkmark-done-circle" size={48} color="#10b981" />
              </View>
              <Text style={styles.emptyTitle}>Sin pacientes en espera</Text>
              <Text style={styles.emptySubtitle}>
                No hay triajes activos en este momento. Pulsa el botón de actualizar para verificar.
              </Text>
            </View>
          }
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
  headerTitle:    { fontSize: 24, fontWeight: '800', color: '#0f172a', letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 13, color: '#64748b', marginTop: 3, fontWeight: '500' },
  refreshBtn:     { padding: 8 },
  tabsContainer:  {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive:     { borderBottomColor: '#2563eb' },
  tabText:       { fontSize: 14, fontWeight: '600', color: '#64748b' },
  tabTextActive: { color: '#2563eb' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  loadingText:   { marginTop: 14, color: '#64748b', fontSize: 15, fontWeight: '500' },
  errorText:     { color: '#ef4444', textAlign: 'center', fontSize: 15, fontWeight: '600', marginTop: 12, marginBottom: 16 },
  retryBtn:      { backgroundColor: '#2563eb', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  retryText:     { color: '#ffffff', fontWeight: '700' },
  emptyIconBg:   { width: 88, height: 88, borderRadius: 44, backgroundColor: '#d1fae5', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle:    { fontSize: 18, fontWeight: '800', color: '#334155', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 20, paddingHorizontal: 16 },
  listContainer: { padding: 16, paddingBottom: 100 },
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
  cardHeader:    { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  urgencyDot:    { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  patientName:   { fontSize: 17, fontWeight: '800', color: '#1e293b' },
  patientCI:     { fontSize: 12, color: '#94a3b8', fontWeight: '600', marginTop: 2 },
  urgencyBadge:  { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1 },
  urgencyText:   { fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  symptomsRow:   { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  symptomsText:  { flex: 1, marginLeft: 6, fontSize: 13, color: '#475569', lineHeight: 18 },
  waitRow:       { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  waitText:      { marginLeft: 6, fontSize: 12, color: '#64748b', fontWeight: '600' },
  actionRow:     { flexDirection: 'row', gap: 10 },
  btn:           { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 10 },
  btnVideo:      { backgroundColor: '#2563eb' },
  btnRecord:     { backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe' },
  btnTextVideo:  { color: '#ffffff', fontWeight: '700', fontSize: 13, marginLeft: 6 },
  btnTextRecord: { color: '#2563eb', fontWeight: '700', fontSize: 13, marginLeft: 6 },
});

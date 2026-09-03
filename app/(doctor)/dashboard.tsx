import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator, Modal, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { triageService } from '@/services/triage.service';
import { supabase } from '@/lib/supabase';

export default function DoctorDashboardScreen() {
  const [triages, setTriages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [doctorName, setDoctorName] = useState('Médico');

  const [doctorSpecialty, setDoctorSpecialty] = useState<string | null>(null);
  const [filterBySpecialty, setFilterBySpecialty] = useState(true);
  const [rawTriages, setRawTriages] = useState<any[]>([]);

  const loadData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      let specName = null;

      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single();
        if (data && data.full_name) {
          setDoctorName(data.full_name);
        }

        const { data: doctorData } = await supabase
          .from('doctors')
          .select('specialties(name)')
          .eq('id', user.id)
          .single();
        
        const spec = Array.isArray(doctorData?.specialties) 
          ? doctorData?.specialties[0] 
          : doctorData?.specialties;

        if (spec?.name) {
          specName = spec.name;
          setDoctorSpecialty(specName);
        }
      }
      await fetchTriages(specName, filterBySpecialty);
    } catch (err) {
      console.error(err);
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchTriages = async (currentSpecialty: string | null = doctorSpecialty, applyFilter: boolean = filterBySpecialty) => {
    try {
      const data = await triageService.getActiveTriages();
      setRawTriages(data || []);
      let filtered = data || [];

      // Filtro Inteligente por especialidad (Loose) para atrapar variaciones como "Pediatría" vs "Pediatra"
      if (applyFilter && currentSpecialty && currentSpecialty !== 'Medicina General') {
        const normalize = (s: string) => s ? s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() : '';
        filtered = filtered.filter((t: any) => {
          const doc = normalize(currentSpecialty);
          const ai = normalize(t.recommended_specialty);
          return ai === doc || ai.includes(doc) || doc.includes(ai) || (ai.length > 4 && ai.substring(0, 5) === doc.substring(0, 5));
        });
      }
      
      setTriages(filtered);
    } catch (error: any) {
      console.error('Error cargando la cola de pacientes:', error);
      alert('Error fetching triages: ' + (error?.message || JSON.stringify(error)));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
    
    // Suscribirse a nuevos triajes
    const subscription = supabase
      .channel('public:triages')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'triages' }, payload => {
        loadData(); // Recargar datos frescos
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [filterBySpecialty]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchTriages(doctorSpecialty, filterBySpecialty);
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'Critical': return '#ef4444';
      case 'Medium': return '#f59e0b';
      case 'Low': return '#10b981';
      default: return '#6b7280';
    }
  };
  
  const getUrgencyText = (urgency: string) => {
    switch (urgency) {
      case 'Critical': return 'Alta';
      case 'Medium': return 'Media';
      case 'Low': return 'Baja';
      default: return urgency;
    }
  };

  const [selectedTriage, setSelectedTriage] = useState<any>(null);

  const handleAttend = async (item: any, patientName: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Enviar señal de broadcast inmediata para destrabar al paciente (útil si hay retrasos RLS/BD)
      const channel = supabase.channel(`rt_waiting_${item.id}`);
      channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.send({
            type: 'broadcast',
            event: 'doctor_ready',
            payload: { triageId: item.id }
          });
        }
      });

      // Crear la cita oficialmente aquí
      const { error: apptError } = await supabase.from('appointments').insert({
        triage_id: item.id,
        patient_id: item.patient_id,
        doctor_id: user?.id,
        status: 'scheduled',
        scheduled_time: new Date().toISOString()
      });

      if (apptError) {
        console.warn('No se pudo crear la cita (puede que ya exista o falten campos):', apptError);
      }

      // Actualizar el estado a en atención
      const { error: triageError } = await supabase
        .from('triages')
        .update({ status: 'in_progress' })
        .eq('id', item.id)
        .select()
        .single();

      if (triageError) {
        console.error('Error al actualizar estado del triaje a in_progress:', triageError);
        alert('ATENCIÓN: Tu base de datos Supabase bloqueó el cambio de estado por falta de permisos (RLS). Por favor, ejecuta el script SQL que te di para permitir que los doctores modifiquen la tabla triages. El sistema te dejará entrar a la llamada de todos modos por emergencia.');
      }
      
      router.push({
        pathname: '/(doctor)/videocall' as any,
        params: {
          role: 'doctor',
          triageId: item.id,
          patientId: item.patient_id,
          patientName: patientName,
          doctorName: doctorName
        }
      });
    } catch (error) {
      console.error('Error al actualizar estado del triaje:', error);
    }
  };

  const renderTriageItem = ({ item }: { item: any }) => {
    const patientName = item.patients?.profiles?.full_name || 'Paciente Desconocido';
    
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.patientInfo}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={20} color="#2563eb" />
            </View>
            <View>
              <Text style={styles.patientName}>{patientName}</Text>
              <Text style={styles.timeAgo}>{new Date(item.created_at).toLocaleTimeString()}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
            <View style={[styles.badge, { backgroundColor: getUrgencyColor(item.urgency_level) }]}>
              <Text style={styles.badgeText}>Prioridad {getUrgencyText(item.urgency_level)}</Text>
            </View>
            {item.status === 'in_progress' && (
              <View style={[styles.badge, { backgroundColor: '#3b82f6' }]}>
                <Text style={styles.badgeText}>En Atención</Text>
              </View>
            )}
            {item._isOtherSpecialty && (
              <View style={[styles.badge, { backgroundColor: '#ef4444' }]}>
                <Text style={styles.badgeText}>ESPECIALIDAD DIFERENTE</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.cardBody}>
          <Text style={styles.symptomsTitle}>Síntomas Reportados (IA):</Text>
          <Text style={styles.symptomsText} numberOfLines={2}>
            {item.reported_symptoms?.replace(/\\n/g, ' ')}
          </Text>
          
          {item.recommended_specialty && (
            <View style={styles.specialtyContainer}>
              <Ionicons name="medkit" size={14} color="#64748b" />
              <Text style={styles.specialtyText}>Sugerido: {item.recommended_specialty}</Text>
            </View>
          )}
        </View>

        <View style={styles.cardFooter}>
          <TouchableOpacity 
            style={styles.detailsBtn}
            onPress={() => setSelectedTriage(item)}
          >
            <Ionicons name="information-circle-outline" size={18} color="#2563eb" style={{ marginRight: 6 }} />
            <Text style={styles.detailsBtnText}>Detalles IA</Text>
          </TouchableOpacity>

          {(item.status === 'completed' || item.status === 'resolved') ? (
            <View style={[styles.attendBtn, { backgroundColor: '#94a3b8' }]}>
              <Ionicons name="checkmark-done" size={18} color="#ffffff" style={{ marginRight: 8 }} />
              <Text style={styles.attendBtnText}>
                {item.status === 'completed' ? 'Ya Atendido' : 'Cancelado'}
              </Text>
            </View>
          ) : (
            <TouchableOpacity 
              style={[styles.attendBtn, item.status === 'in_progress' && { backgroundColor: '#f59e0b' }]}
              onPress={() => handleAttend(item, patientName)}
            >
              <Ionicons name="videocam" size={18} color="#ffffff" style={{ marginRight: 8 }} />
              <Text style={styles.attendBtnText}>
                {item.status === 'in_progress' ? 'Reconectar' : 'Atender'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Sala de Espera (Cola)</Text>
          <Text style={styles.headerSubtitle}>
            {doctorSpecialty ? `Especialidad: ${doctorSpecialty}` : 'Pacientes pendientes de atención'}
          </Text>
        </View>
        <TouchableOpacity style={styles.reloadBtn} onPress={onRefresh} disabled={refreshing}>
          <Ionicons name="reload" size={18} color="#ffffff" />
          <Text style={styles.reloadBtnText}>Recargar</Text>
        </TouchableOpacity>
      </View>

      {doctorSpecialty && doctorSpecialty !== 'Medicina General' && (
        <View style={{ flexDirection: 'row', paddingHorizontal: 16, marginBottom: 12, gap: 8 }}>
          <TouchableOpacity
            style={[
              { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1 },
              filterBySpecialty 
                ? { backgroundColor: '#2563eb', borderColor: '#2563eb' }
                : { backgroundColor: '#f1f5f9', borderColor: '#cbd5e1' }
            ]}
            onPress={() => {
              setFilterBySpecialty(true);
              fetchTriages(doctorSpecialty, true);
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: '600', color: filterBySpecialty ? '#ffffff' : '#475569' }}>
              Solo {doctorSpecialty}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1 },
              !filterBySpecialty 
                ? { backgroundColor: '#2563eb', borderColor: '#2563eb' }
                : { backgroundColor: '#f1f5f9', borderColor: '#cbd5e1' }
            ]}
            onPress={() => {
              setFilterBySpecialty(false);
              fetchTriages(doctorSpecialty, false);
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: '600', color: !filterBySpecialty ? '#ffffff' : '#475569' }}>
              Todos los pacientes ({rawTriages.length})
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loaderText}>Buscando pacientes...</Text>
        </View>
      ) : triages.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="checkmark-circle-outline" size={64} color="#10b981" />
          <Text style={styles.emptyTitle}>No hay pacientes en espera</Text>
          <Text style={styles.emptyText}>
            {filterBySpecialty && doctorSpecialty && doctorSpecialty !== 'Medicina General' && rawTriages.length > 0
              ? `No hay pacientes derivados a ${doctorSpecialty} en este momento. Hay ${rawTriages.length} paciente(s) en espera en otras especialidades.`
              : 'La cola de triaje está vacía actualmente.'}
          </Text>
          {filterBySpecialty && doctorSpecialty && doctorSpecialty !== 'Medicina General' && rawTriages.length > 0 && (
            <TouchableOpacity 
              style={[styles.reloadBtn, { marginTop: 16, backgroundColor: '#2563eb', paddingHorizontal: 16, paddingVertical: 10 }]}
              onPress={() => {
                setFilterBySpecialty(false);
                fetchTriages(doctorSpecialty, false);
              }}
            >
              <Ionicons name="people" size={18} color="#ffffff" style={{ marginRight: 6 }} />
              <Text style={styles.reloadBtnText}>Ver todos los pacientes ({rawTriages.length})</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={triages}
          keyExtractor={(item) => item.id}
          renderItem={renderTriageItem}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563eb" />}
        />
      )}
      {/* Modal de Detalles del Triaje IA */}
      <Modal
        visible={!!selectedTriage}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setSelectedTriage(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="hardware-chip" size={24} color="#2563eb" />
                <Text style={styles.modalTitle}>Análisis de Triaje (IA)</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedTriage(null)}>
                <Ionicons name="close-circle" size={28} color="#94a3b8" />
              </TouchableOpacity>
            </View>
            
            {selectedTriage && (
              <ScrollView style={styles.modalScroll}>
                <View style={styles.modalSection}>
                  <Text style={styles.modalLabel}>Paciente:</Text>
                  <Text style={styles.modalValue}>{selectedTriage.patients?.profiles?.full_name || 'Desconocido'}</Text>
                </View>

                <View style={styles.modalSection}>
                  <Text style={styles.modalLabel}>Prioridad Calculada:</Text>
                  <View style={[styles.badge, { alignSelf: 'flex-start', backgroundColor: getUrgencyColor(selectedTriage.urgency_level) }]}>
                    <Text style={styles.badgeText}>{getUrgencyText(selectedTriage.urgency_level)}</Text>
                  </View>
                </View>

                <View style={styles.modalSection}>
                  <Text style={styles.modalLabel}>Síntomas Identificados:</Text>
                  <Text style={styles.modalValueBox}>{selectedTriage.reported_symptoms?.replace(/\\n/g, '\n')}</Text>
                </View>

                {selectedTriage.recommended_specialty && (
                  <View style={styles.modalSection}>
                    <Text style={styles.modalLabel}>Especialidad Recomendada por la IA:</Text>
                    <Text style={[styles.modalValue, { color: '#2563eb', fontWeight: 'bold' }]}>{selectedTriage.recommended_specialty}</Text>
                  </View>
                )}
              </ScrollView>
            )}
            
            <TouchableOpacity style={styles.closeModalBtn} onPress={() => setSelectedTriage(null)}>
              <Text style={styles.closeModalBtnText}>Cerrar Detalles</Text>
            </TouchableOpacity>
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
  headerRow: {
    flexDirection: 'row',
    padding: 24,
    paddingTop: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reloadBtn: {
    backgroundColor: '#2563eb',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  reloadBtnText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
  },
  detailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#eff6ff',
    marginRight: 10,
  },
  detailsBtnText: {
    color: '#2563eb',
    fontWeight: '700',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    width: '100%',
    maxWidth: 500,
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 10,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingBottom: 16,
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
  },
  modalScroll: {
    marginBottom: 20,
  },
  modalSection: {
    marginBottom: 16,
  },
  modalLabel: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
    marginBottom: 6,
  },
  modalValue: {
    fontSize: 16,
    color: '#334155',
    fontWeight: '500',
  },
  modalValueBox: {
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    fontSize: 15,
    color: '#334155',
    lineHeight: 22,
  },
  closeModalBtn: {
    backgroundColor: '#0f172a',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  closeModalBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loaderText: {
    marginTop: 12,
    color: '#64748b',
    fontSize: 15,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 8,
    textAlign: 'center',
  },
  listContent: {
    padding: 16,
  },
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
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  patientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  patientName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
  },
  timeAgo: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  cardBody: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  symptomsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 4,
  },
  symptomsText: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 20,
    fontStyle: 'italic',
  },
  specialtyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  specialtyText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
    marginLeft: 6,
  },
  cardFooter: {
    borderTopWidth: 0,
  },
  attendBtn: {
    backgroundColor: '#2563eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
  },
  attendBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  }
});

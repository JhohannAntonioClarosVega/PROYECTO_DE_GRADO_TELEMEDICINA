import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator, Modal, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { triageService } from '@/services/triage.service';
import { supabase } from '@/lib/supabase';
import CustomModal from '@/components/CustomModal';

export default function DoctorDashboardScreen() {
  const [triages, setTriages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [doctorName, setDoctorName] = useState('Médico');
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);

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

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      setLogoutModalVisible(false);
      router.replace('/');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
      setLogoutModalVisible(false);
      router.replace('/');
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
      <View className="bg-white rounded-[24px] p-5 mb-5 border border-slate-100" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 }}>
        <View className="flex-row justify-between items-center mb-4">
          <View className="flex-row items-center">
            <View className="w-11 h-11 rounded-full bg-blue-50 justify-center items-center mr-3">
              <Ionicons name="person" size={20} color="#0066CC" />
            </View>
            <View>
              <Text className="text-base font-bold text-slate-800">{patientName}</Text>
              <Text className="text-[11px] text-slate-400 font-medium mt-0.5">{new Date(item.created_at).toLocaleTimeString()}</Text>
            </View>
          </View>
          <View className="flex-col items-end gap-1.5">
            <View className="px-2.5 py-1 rounded-full" style={{ backgroundColor: getUrgencyColor(item.urgency_level) }}>
              <Text className="text-[10px] text-white font-extrabold uppercase tracking-widest">
                {getUrgencyText(item.urgency_level)}
              </Text>
            </View>
            {item.status === 'in_progress' && (
              <View className="px-2.5 py-1 rounded-full bg-blue-500">
                <Text className="text-[10px] text-white font-extrabold uppercase tracking-widest">En Atención</Text>
              </View>
            )}
            {item._isOtherSpecialty && (
              <View className="px-2.5 py-1 rounded-full bg-red-500">
                <Text className="text-[10px] text-white font-extrabold uppercase tracking-widest">DERIVADO</Text>
              </View>
            )}
          </View>
        </View>

        <View className="bg-slate-50 rounded-2xl p-4 mb-4">
          <Text className="text-[13px] font-bold text-slate-500 mb-1.5">Síntomas y Análisis IA:</Text>
          <Text className="text-[14px] text-slate-700 leading-5" numberOfLines={3}>
            {item.ai_raw_analysis ? item.ai_raw_analysis.replace(/\\n/g, '\n') : item.reported_symptoms?.replace(/\\n/g, ' ')}
          </Text>
          
          {item.recommended_specialty && (
            <View className="flex-row items-center mt-3 pt-3 border-t border-slate-200/60">
              <Ionicons name="medkit" size={14} color="#64748b" />
              <Text className="text-[13px] text-slate-500 font-semibold ml-1.5">Especialidad: <Text className="text-blue-600">{item.recommended_specialty}</Text></Text>
            </View>
          )}
        </View>

        <View className="flex-row justify-between items-center gap-3">
          <TouchableOpacity 
            className="flex-row flex-1 items-center justify-center py-3.5 rounded-xl bg-blue-50"
            onPress={() => setSelectedTriage(item)}
          >
            <Ionicons name="sparkles" size={16} color="#0066CC" className="mr-2" />
            <Text className="text-blue-600 font-bold text-[14px] ml-1.5">Detalles IA</Text>
          </TouchableOpacity>

          {(item.status === 'completed' || item.status === 'resolved') ? (
            <View className="flex-row flex-1 items-center justify-center py-3.5 rounded-xl bg-slate-200">
              <Ionicons name="checkmark-done" size={18} color="#64748b" />
              <Text className="text-slate-500 font-bold text-[14px] ml-1.5">
                {item.status === 'completed' ? 'Ya Atendido' : 'Cancelado'}
              </Text>
            </View>
          ) : (
            <TouchableOpacity 
              className={`flex-row flex-1 items-center justify-center py-3.5 rounded-xl ${item.status === 'in_progress' ? 'bg-amber-500' : 'bg-[#0066CC]'}`}
              style={{ shadowColor: item.status === 'in_progress' ? '#f59e0b' : '#3b82f6', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 2 }}
              onPress={() => handleAttend(item, patientName)}
            >
              <Ionicons name="videocam" size={18} color="#ffffff" />
              <Text className="text-white font-bold text-[14px] ml-1.5">
                {item.status === 'in_progress' ? 'Reconectar' : 'Atender'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <View className="flex-row px-6 pt-5 pb-6 border-b border-slate-100 justify-between items-center z-10" style={{ backgroundColor: 'rgba(255, 255, 255, 0.8)' }}>
        <View className="flex-1">
          <Text className="text-[28px] font-extrabold text-slate-900 tracking-tight">Pacientes</Text>
          <Text className="text-[14px] text-slate-500 font-medium mt-1">
            {doctorSpecialty ? `Especialidad: ${doctorSpecialty}` : 'Cola de espera general'}
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          <TouchableOpacity className="flex-row items-center px-4 py-3 rounded-2xl" style={{ backgroundColor: 'rgba(241, 245, 249, 0.8)' }} onPress={onRefresh} disabled={refreshing}>
            <Ionicons name="reload" size={20} color="#0066CC" />
          </TouchableOpacity>
          <TouchableOpacity className="flex-row items-center px-4 py-3 rounded-2xl border border-red-100" style={{ backgroundColor: 'rgba(254, 242, 242, 0.8)' }} onPress={() => setLogoutModalVisible(true)}>
            <Ionicons name="log-out-outline" size={20} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </View>

      {doctorSpecialty && doctorSpecialty !== 'Medicina General' && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row px-6 my-4 max-h-12">
          <TouchableOpacity
            className={`px-5 py-2.5 rounded-full border mr-3 justify-center items-center ${filterBySpecialty ? 'bg-slate-900 border-slate-900' : 'bg-white border-slate-200'}`}
            style={filterBySpecialty ? { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 } : {}}
            onPress={() => {
              setFilterBySpecialty(true);
              fetchTriages(doctorSpecialty, true);
            }}
          >
            <Text className={`text-[13px] font-bold ${filterBySpecialty ? 'text-white' : 'text-slate-600'}`}>
              Solo {doctorSpecialty}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            className={`px-5 py-2.5 rounded-full border mr-6 justify-center items-center ${!filterBySpecialty ? 'bg-slate-900 border-slate-900' : 'bg-white border-slate-200'}`}
            style={!filterBySpecialty ? { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 } : {}}
            onPress={() => {
              setFilterBySpecialty(false);
              fetchTriages(doctorSpecialty, false);
            }}
          >
            <Text className={`text-[13px] font-bold ${!filterBySpecialty ? 'text-white' : 'text-slate-600'}`}>
              Todos ({rawTriages.length})
            </Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#0066CC" />
          <Text className="mt-4 text-slate-500 font-medium text-[15px]">Actualizando lista...</Text>
        </View>
      ) : triages.length === 0 ? (
        <View className="flex-1 justify-center items-center px-8">
          <View className="w-24 h-24 bg-green-50 rounded-full justify-center items-center mb-6">
            <Ionicons name="checkmark-done-outline" size={48} color="#10b981" />
          </View>
          <Text className="text-[20px] font-extrabold text-slate-900 text-center">Todo al día</Text>
          <Text className="text-[15px] text-slate-500 mt-2 text-center leading-6">
            {filterBySpecialty && doctorSpecialty && doctorSpecialty !== 'Medicina General' && rawTriages.length > 0
              ? `No hay pacientes en ${doctorSpecialty}. Hay ${rawTriages.length} en otras áreas.`
              : 'La sala de espera virtual está vacía en este momento.'}
          </Text>
          {filterBySpecialty && doctorSpecialty && doctorSpecialty !== 'Medicina General' && rawTriages.length > 0 && (
            <TouchableOpacity 
              className="mt-8 bg-slate-900 px-6 py-3.5 rounded-xl flex-row items-center"
              style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 }}
              onPress={() => {
                setFilterBySpecialty(false);
                fetchTriages(doctorSpecialty, false);
              }}
            >
              <Ionicons name="people" size={18} color="#ffffff" />
              <Text className="text-white font-bold ml-2">Ver todos los pacientes</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={triages}
          keyExtractor={(item) => item.id}
          renderItem={renderTriageItem}
          contentContainerStyle={{ padding: 24, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0066CC" />}
        />
      )}

      {/* Modal Detalles IA */}
      <Modal visible={!!selectedTriage} transparent={true} animationType="slide" onRequestClose={() => setSelectedTriage(null)}>
        <View className="flex-1 justify-end sm:justify-center p-0 sm:p-6" style={{ backgroundColor: 'rgba(15, 23, 42, 0.4)' }}>
          <View className="bg-white rounded-t-[32px] sm:rounded-[32px] p-8 w-full max-h-[90%]" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 }}>
            <View className="w-12 h-1.5 bg-slate-200 rounded-full self-center mb-8 sm:hidden" />
            
            <View className="flex-row justify-between items-center border-b border-slate-100 pb-5 mb-6">
              <View className="flex-row items-center gap-3">
                <View className="w-10 h-10 rounded-full bg-blue-50 justify-center items-center">
                  <Ionicons name="sparkles" size={20} color="#0066CC" />
                </View>
                <Text className="text-[22px] font-extrabold text-slate-900 tracking-tight">Análisis IA</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedTriage(null)} className="w-8 h-8 bg-slate-100 rounded-full justify-center items-center">
                <Ionicons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>
            
            {selectedTriage && (
              <ScrollView className="mb-6" showsVerticalScrollIndicator={false}>
                <View className="mb-6">
                  <Text className="text-[13px] text-slate-400 font-bold uppercase tracking-widest mb-2">Paciente</Text>
                  <Text className="text-[18px] text-slate-800 font-bold">{selectedTriage.patients?.profiles?.full_name || 'Desconocido'}</Text>
                </View>

                <View className="mb-6">
                  <Text className="text-[13px] text-slate-400 font-bold uppercase tracking-widest mb-2">Prioridad de Atención</Text>
                  <View className="self-start px-3 py-1.5 rounded-full" style={{ backgroundColor: getUrgencyColor(selectedTriage.urgency_level) }}>
                    <Text className="text-white font-extrabold uppercase tracking-widest text-[11px]">{getUrgencyText(selectedTriage.urgency_level)}</Text>
                  </View>
                </View>

                <View className="mb-6">
                  <Text className="text-[13px] text-slate-400 font-bold uppercase tracking-widest mb-2">Entrada Original del Paciente</Text>
                  <View className="bg-slate-50 p-4 rounded-2xl border border-slate-100 mb-4">
                    <Text className="text-[15px] text-slate-500 leading-6 italic">{selectedTriage.reported_symptoms?.replace(/\\n/g, '\n')}</Text>
                  </View>
                  
                  <Text className="text-[13px] text-[#0066CC] font-bold uppercase tracking-widest mb-2">Transcripción y Análisis Clínico (IA)</Text>
                  <View className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                    <Text className="text-[15px] text-slate-800 leading-6 font-medium">
                      {selectedTriage.ai_raw_analysis ? selectedTriage.ai_raw_analysis.replace(/\\n/g, '\n') : "Análisis no disponible"}
                    </Text>
                  </View>
                </View>

                {selectedTriage.recommended_specialty && (
                  <View className="mb-2">
                    <Text className="text-[13px] text-slate-400 font-bold uppercase tracking-widest mb-2">Sugerencia Clínica</Text>
                    <Text className="text-[18px] text-blue-600 font-bold">{selectedTriage.recommended_specialty}</Text>
                  </View>
                )}
              </ScrollView>
            )}
            
            <TouchableOpacity className="bg-slate-900 py-4 rounded-2xl items-center" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 }} onPress={() => setSelectedTriage(null)}>
              <Text className="text-white font-bold text-[16px]">Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <CustomModal
        visible={logoutModalVisible}
        title="Cerrar Sesión"
        message="¿Estás seguro de que deseas salir de tu cuenta médica?"
        type="confirm"
        onConfirm={handleLogout}
        onCancel={() => setLogoutModalVisible(false)}
        confirmText="Salir"
      />
    </SafeAreaView>
  );
}



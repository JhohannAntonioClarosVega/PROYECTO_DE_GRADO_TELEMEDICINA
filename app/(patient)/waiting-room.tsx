import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState, useRef } from 'react';
import { 
  ActivityIndicator, 
  Platform, 
  ScrollView, 
  StyleSheet, 
  Text, 
  TouchableOpacity, 
  View 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function WaitingRoomScreen() {
  const params = useLocalSearchParams();
  const triageId = params.triageId as string;
  const [activeTriageId, setActiveTriageId] = useState<string | null>(triageId || null);
  const [triage, setTriage] = useState<any>(null);
  const [assignedDoctorName, setAssignedDoctorName] = useState<string>('Médico Tratante');
  const [loading, setLoading] = useState(true);
  const [isDoctorReady, setIsDoctorReady] = useState(false);
  const [noActiveRoom, setNoActiveRoom] = useState(false);
  const [glowingScale, setGlowingScale] = useState(1);
  const hasNavigated = useRef(false);

  // Efecto visual de latido/pulso
  useEffect(() => {
    const interval = setInterval(() => {
      setGlowingScale(prev => (prev === 1 ? 1.15 : 1));
    }, 1200);
    return () => clearInterval(interval);
  }, []);

  // Función para comprobar el estado actual (Triaje y Cita)
  const checkStatus = async (targetId: string) => {
    try {
      // 1. Obtener detalles del triaje
      const { data: triageData, error: triageError } = await supabase
        .from('triages')
        .select(`
          *,
          patients (
            id,
            profiles (
              full_name
            )
          )
        `)
        .eq('id', targetId)
        .maybeSingle();

      if (triageError) {
        console.warn('Supabase error fetching triage:', triageError);
        return; // Ignorar errores de red temporales, el polling reintentará
      }

      if (!triageData) {
        setNoActiveRoom(true);
        setLoading(false);
        return;
      }

      if (triageData.status === 'completed' || triageData.status === 'resolved') {
        setNoActiveRoom(true);
        setLoading(false);
        return;
      }
      
      setTriage(triageData);

      // 2. Verificar si hay cita creada para este triaje
      const { data: apptData, error: apptError } = await supabase
        .from('appointments')
        .select('id, doctor_id, status')
        .eq('triage_id', targetId)
        .limit(1)
        .maybeSingle();

      if (apptError) {
        console.warn('Error fetching appointment:', apptError);
      }

      if (apptData?.doctor_id) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', apptData.doctor_id)
          .single();
        if (prof?.full_name) {
          setAssignedDoctorName(`Dr. ${prof.full_name}`);
        }
      }

      // El médico está listo si el triaje pasó a in_progress O si ya existe una cita en appointments
      const ready = triageData?.status === 'in_progress' || !!apptData;
      if (ready) {
        setIsDoctorReady(true);
      }
    } catch (err) {
      console.warn('Error crítico comprobando estado en sala de espera:', err);
    } finally {
      setLoading(false);
    }
  };

  // Inicialización del ID del triaje (con fallback automático por usuario si no llega por params)
  useEffect(() => {
    let resolvedId = triageId;
    const init = async () => {
      if (!resolvedId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: latest, error: latestError } = await supabase
          .from('triages')
          .select('id')
          .eq('patient_id', user.id)
          .in('status', ['pending', 'waiting', 'in_progress'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
          
        if (latestError) {
          console.warn('Error obteniendo último triaje:', latestError);
        }

        if (latest?.id) {
          resolvedId = latest.id;
          setActiveTriageId(latest.id);
        }
        }
      } else {
        setActiveTriageId(resolvedId);
      }

      if (resolvedId && !noActiveRoom) {
        await checkStatus(resolvedId);
      } else {
        // Si al final del proceso no tenemos un ID de triaje válido, no hay sala activa
        setNoActiveRoom(true);
        setLoading(false);
      }
    };
    init();
  }, [triageId]);

  // Polling activo cada 2 segundos + Suscripción Realtime dual (triages y appointments)
  useEffect(() => {
    if (!activeTriageId) return;

    // 1. Polling periódico infalible cada 2 segundos
    const pollInterval = setInterval(() => {
      checkStatus(activeTriageId);
    }, 2000);

    // 2. Suscripción en tiempo real a cambios de estado y citas
    const channel = supabase
      .channel(`rt_waiting_${activeTriageId}`)
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'triages',
        filter: `id=eq.${activeTriageId}`
      }, payload => {
        if (payload.new?.status === 'in_progress') {
          setIsDoctorReady(true);
          setTriage((prev: any) => ({ ...prev, status: 'in_progress' }));
        }
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'appointments'
      }, payload => {
        if (payload.new?.triage_id === activeTriageId) {
          setIsDoctorReady(true);
          checkStatus(activeTriageId);
        }
      })
      .on('broadcast', { event: 'doctor_ready' }, payload => {
        setIsDoctorReady(true);
        setTriage((prev: any) => ({ ...prev, status: 'in_progress' }));
      })
      .subscribe();

    return () => {
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, [activeTriageId]);

  // Auto-navegación cuando el médico se conecta
  const handleJoinCall = () => {
    if (hasNavigated.current) return;
    hasNavigated.current = true;

    const patientName = triage?.patients?.profiles?.full_name || 'Paciente';

    router.push({
      pathname: '/(doctor)/videocall' as any,
      params: {
        role: 'patient',
        patientId: triage?.patient_id || '95432c20-caed-43ca-8a01-4255e7a9dc1c',
        patientName: patientName,
        triageId: activeTriageId || '',
        doctorName: assignedDoctorName
      }
    });
  };

  useEffect(() => {
    if (isDoctorReady && !hasNavigated.current) {
      // Pequeño retardo de 1.2 segundos para que el usuario vea la transición a verde antes de entrar
      const timer = setTimeout(() => {
        handleJoinCall();
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [isDoctorReady]);

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'Critical': return '#ef4444';
      case 'Medium': return '#f59e0b';
      case 'Low': return '#10b981';
      default: return '#64748b';
    }
  };

  const getUrgencyText = (urgency: string) => {
    switch (urgency) {
      case 'Critical': return 'CRÍTICO - Prioridad 1';
      case 'Medium': return 'MEDIO - Prioridad 2';
      case 'Low': return 'BAJO - Prioridad 3';
      default: return urgency || 'Evaluado';
    }
  };

  const patientName = triage?.patients?.profiles?.full_name || 'Paciente';
  const urgency = triage?.urgency_level || 'Medium';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Cabecera en tema blanco */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/')}>
            <Ionicons name="home-outline" size={22} color="#0f172a" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Sala de Espera Virtual</Text>
          <View style={{ width: 40 }} />
        </View>

        {loading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color="#2563eb" />
            <Text style={styles.loaderText}>Cargando datos de tu consulta...</Text>
          </View>
        ) : noActiveRoom ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="information-circle" size={48} color="#94a3b8" />
            </View>
            <Text style={styles.emptyTitle}>Sin Citas Activas</Text>
            <Text style={styles.emptyDesc}>
              No cuentas con alguna sala activa en este momento. Si necesitas atención, por favor inicia un nuevo triaje.
            </Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => router.replace('/(patient)/menu')}>
              <Text style={styles.emptyBtnText}>Volver al Menú Principal</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.content}>
            {/* Animación del radar de espera (Blanco / Azul / Verde) */}
            <View style={styles.radarContainer}>
              <View style={[
                styles.radarPulseOuter,
                { transform: [{ scale: glowingScale }] },
                isDoctorReady && { backgroundColor: 'rgba(16, 185, 129, 0.15)', borderColor: 'rgba(16, 185, 129, 0.35)' }
              ]} />
              <View style={[styles.radarCenter, isDoctorReady && { borderColor: '#10b981', backgroundColor: '#f0fdf4' }]}>
                <Ionicons 
                  name={isDoctorReady ? "checkmark-circle" : "videocam"} 
                  size={32} 
                  color={isDoctorReady ? "#10b981" : "#2563eb"} 
                />
              </View>
            </View>

            <Text style={[styles.statusTitle, isDoctorReady && { color: '#059669' }]}>
              {isDoctorReady ? '¡El médico te está esperando!' : 'Esperando Conexión Médica'}
            </Text>
            <Text style={styles.statusDesc}>
              {isDoctorReady 
                ? 'La consulta ya ha iniciado. Ingresando automáticamente o pulsa el botón inferior para entrar ahora.' 
                : 'Un médico especialista del Gobierno Autónomo Municipal de Cochabamba revisará tu triaje e iniciará la videollamada en breve.'}
            </Text>

            {/* Tarjeta de estado de Triage (Tema blanco) */}
            <View style={styles.triageCard}>
              <View style={styles.cardHeader}>
                <Ionicons name="document-text-outline" size={18} color="#2563eb" />
                <Text style={styles.cardHeaderTitle}>Resumen de tu Evaluación IA</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Paciente:</Text>
                <Text style={styles.infoValue}>{patientName}</Text>
              </View>

              {triage?.recommended_specialty && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Especialidad Derivada:</Text>
                  <Text style={[styles.infoValue, { color: '#2563eb' }]}>{triage.recommended_specialty}</Text>
                </View>
              )}

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Nivel de Urgencia:</Text>
                <View style={[styles.badge, { backgroundColor: getUrgencyColor(urgency) }]}>
                  <Text style={styles.badgeText}>{getUrgencyText(urgency)}</Text>
                </View>
              </View>
              
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Estado:</Text>
                <View style={[styles.badge, { backgroundColor: isDoctorReady ? '#10b981' : '#f59e0b' }]}>
                  <Text style={styles.badgeText}>{isDoctorReady ? 'En Atención' : 'En Espera'}</Text>
                </View>
              </View>

              {triage?.reported_symptoms && (
                <View style={styles.symptomsBox}>
                  <Text style={styles.symptomsTitle}>Síntomas Reportados:</Text>
                  <Text style={styles.symptomsText} numberOfLines={3}>
                    {triage.reported_symptoms.replace(/\\n/g, '\n')}
                  </Text>
                </View>
              )}
            </View>

            {/* Consejos rápidos */}
            <View style={styles.tipsCard}>
              <Text style={styles.tipsTitle}>Recomendaciones para tu llamada:</Text>

              <View style={styles.tipItem}>
                <Ionicons name="volume-high-outline" size={18} color="#16a34a" style={styles.tipIcon} />
                <Text style={styles.tipText}>Usa audífonos para evitar eco y escuchar con claridad al doctor.</Text>
              </View>

              <View style={styles.tipItem}>
                <Ionicons name="sunny-outline" size={18} color="#16a34a" style={styles.tipIcon} />
                <Text style={styles.tipText}>Ubícate en un lugar bien iluminado y sin ruidos fuertes.</Text>
              </View>

              <View style={styles.tipItem}>
                <Ionicons name="wifi-outline" size={18} color="#16a34a" style={styles.tipIcon} />
                <Text style={styles.tipText}>Asegúrate de contar con una conexión a Internet estable.</Text>
              </View>
            </View>

            {/* Botón de Entrada a la llamada */}
            <TouchableOpacity
              style={[
                styles.joinBtn, 
                isDoctorReady ? styles.joinBtnReady : styles.joinBtnLocked,
                isDoctorReady && { transform: [{ scale: 1.02 }] }
              ]}
              activeOpacity={0.8}
              disabled={!isDoctorReady}
              onPress={handleJoinCall}
            >
              {isDoctorReady ? (
                <Ionicons name="videocam" size={22} color="#ffffff" />
              ) : (
                <ActivityIndicator color="#64748b" size="small" />
              )}
              <Text style={[
                styles.joinBtnText,
                { color: isDoctorReady ? '#ffffff' : '#64748b' }
              ]}>
                {isDoctorReady ? '¡ENTRAR A LA CONSULTA AHORA!' : 'Aguardando al médico...'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelBtn}
              activeOpacity={0.6}
              onPress={async () => {
                if (activeTriageId) {
                  // Cancelar el triaje marcándolo como resuelto/cancelado para que no quede fantasma
                  await supabase.from('triages').update({ status: 'resolved' }).eq('id', activeTriageId);
                }
                router.replace('/(patient)/menu');
              }}
            >
              <Text style={styles.cancelBtnText}>Cancelar y salir de la sala</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc', // Fondo blanco limpio
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: Platform.OS === 'android' ? 40 : 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backBtn: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
  },
  headerTitle: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  loaderContainer: {
    padding: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderText: {
    color: '#64748b',
    marginTop: 16,
    fontSize: 15,
    fontWeight: '500',
  },
  content: {
    padding: 20,
    alignItems: 'center',
    maxWidth: 580,
    width: '100%',
    alignSelf: 'center',
  },
  emptyContainer: {
    flex: 1,
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 400,
  },
  emptyIconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 10,
  },
  emptyDesc: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 30,
    maxWidth: 300,
  },
  emptyBtn: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  emptyBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  radarContainer: {
    width: 100,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 16,
  },
  radarPulseOuter: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
    borderWidth: 2,
    borderColor: 'rgba(37, 99, 235, 0.25)',
  },
  radarCenter: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ffffff',
    borderWidth: 2.5,
    borderColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 4,
  },
  statusTitle: {
    color: '#0f172a',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  statusDesc: {
    color: '#64748b',
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 12,
  },
  triageCard: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 10,
  },
  cardHeaderTitle: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  infoLabel: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '500',
  },
  infoValue: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '700',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  symptomsBox: {
    marginTop: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  symptomsTitle: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  symptomsText: {
    color: '#334155',
    fontSize: 14,
    lineHeight: 20,
  },
  tipsCard: {
    width: '100%',
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
    marginBottom: 24,
  },
  tipsTitle: {
    color: '#166534',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 12,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  tipIcon: {
    marginRight: 10,
    marginTop: 2,
  },
  tipText: {
    flex: 1,
    color: '#15803d',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  joinBtn: {
    width: '100%',
    padding: 16,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  joinBtnReady: {
    backgroundColor: '#10b981',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  joinBtnLocked: {
    backgroundColor: '#e2e8f0',
  },
  joinBtnText: {
    fontWeight: '800',
    fontSize: 16,
    marginLeft: 8,
  },
  cancelBtn: {
    padding: 12,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '600',
  }
});

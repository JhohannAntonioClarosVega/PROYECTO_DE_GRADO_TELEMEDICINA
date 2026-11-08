import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useEffectEvent, useState, useRef } from 'react';
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

interface WaitingTriage {
  id: string;
  status: string;
  patient_id?: string;
  urgency_level?: string;
  recommended_specialty?: string;
  reported_symptoms?: string;
  patients?: { profiles?: { full_name?: string } };
}

interface WaitingStatus {
  triageId: string;
  triage: WaitingTriage | null;
  ready: boolean;
  noActiveRoom: boolean;
  doctorName: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readTriage(value: unknown, expectedId: string): WaitingTriage {
  if (!isRecord(value) || value.id !== expectedId || typeof value.status !== 'string') {
    throw new Error('La respuesta del triaje no corresponde a la consulta solicitada.');
  }
  const profiles = isRecord(value.patients) && isRecord(value.patients.profiles)
    ? value.patients.profiles
    : null;
  return {
    id: expectedId,
    status: value.status,
    patient_id: typeof value.patient_id === 'string' ? value.patient_id : undefined,
    urgency_level: typeof value.urgency_level === 'string' ? value.urgency_level : undefined,
    recommended_specialty: typeof value.recommended_specialty === 'string' ? value.recommended_specialty : undefined,
    reported_symptoms: typeof value.reported_symptoms === 'string' ? value.reported_symptoms : undefined,
    patients: { profiles: { full_name: typeof profiles?.full_name === 'string' ? profiles.full_name : undefined } },
  };
}

export default function WaitingRoomScreen() {
  const params = useLocalSearchParams<{ triageId?: string | string[] }>();
  const requestedId = Array.isArray(params.triageId) ? params.triageId[0] : params.triageId;
  const triageId = requestedId || null;
  // Cada cambio de consulta crea su propio estado, incluso en una secuencia A → B → A.
  return <WaitingRoomContent key={triageId ?? 'latest'} triageId={triageId} />;
}

function WaitingRoomContent({ triageId }: { triageId: string | null }) {
  const [activeTriageId, setActiveTriageId] = useState<string | null>(triageId);
  const [triage, setTriage] = useState<WaitingTriage | null>(null);
  const [loading, setLoading] = useState(true);
  const [readyTriageId, setReadyTriageId] = useState<string | null>(null);
  const [noActiveRoom, setNoActiveRoom] = useState(false);
  const [glowingScale, setGlowingScale] = useState(1);
  const hasNavigated = useRef(false);
  const joining = useRef(false);
  const session = useRef({ mounted: false, triageId });
  const pendingStatus = useRef<Promise<WaitingStatus | null> | null>(null);
  const isDoctorReady = activeTriageId !== null && readyTriageId === activeTriageId && triage?.id === activeTriageId;

  useEffect(() => {
    const currentSession = session.current;
    currentSession.mounted = true;
    return () => { currentSession.mounted = false; };
  }, []);

  const isCurrent = useCallback((expectedId: string) =>
    session.current.mounted && session.current.triageId === expectedId,
  []);

  // Efecto visual de latido/pulso
  useEffect(() => {
    const interval = setInterval(() => {
      setGlowingScale(prev => (prev === 1 ? 1.15 : 1));
    }, 1200);
    return () => clearInterval(interval);
  }, []);

  const readStatus = useCallback(async (targetId: string): Promise<WaitingStatus | null> => {
    if (!isCurrent(targetId)) return null;
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
    if (!isCurrent(targetId)) return null;
    if (triageError) throw triageError;
    if (!triageData) {
      return { triageId: targetId, triage: null, ready: false, noActiveRoom: true, doctorName: 'Médico Tratante' };
    }
    const currentTriage = readTriage(triageData, targetId);
    if (currentTriage.status === 'completed' || currentTriage.status === 'resolved') {
      return { triageId: targetId, triage: currentTriage, ready: false, noActiveRoom: true, doctorName: 'Médico Tratante' };
    }

    // 2. Verificar si hay cita creada para este triaje
    const { data: apptData, error: apptError } = await supabase
      .from('appointments')
      .select('id, doctor_id, status, triage_id')
      .eq('triage_id', targetId)
      .limit(1)
      .maybeSingle();
    if (!isCurrent(targetId)) return null;
    if (apptError) {
      console.warn('Error fetching appointment:', apptError);
    }
    if (apptData && (!isRecord(apptData) || apptData.triage_id !== targetId)) {
      throw new Error('La cita recibida no corresponde al triaje solicitado.');
    }
    const ownAppointment = !apptError && isRecord(apptData) && typeof apptData.id === 'string';
    let doctorName = 'Médico Tratante';
    if (ownAppointment && typeof apptData.doctor_id === 'string') {
      const { data: prof, error: profileError } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', apptData.doctor_id)
        .single();
      if (!isCurrent(targetId)) return null;
      if (profileError) console.warn('Error fetching doctor profile:', profileError);
      if (isRecord(prof) && typeof prof.full_name === 'string' && prof.full_name) {
        doctorName = `Dr. ${prof.full_name}`;
      }
    }
    // El médico está listo si el triaje pasó a in_progress O si ya existe una cita en appointments
    return {
      triageId: targetId,
      triage: currentTriage,
      ready: currentTriage.status === 'in_progress' || ownAppointment,
      noActiveRoom: false,
      doctorName,
    };
  }, [isCurrent]);

  const checkStatus = useCallback(function checkStatus(
    targetId: string,
    requireFresh = false
  ): Promise<WaitingStatus | null> {
    if (!isCurrent(targetId)) return Promise.resolve(null);
    const pending = pendingStatus.current;
    if (pending) {
      // La entrada espera cualquier lectura anterior y solicita una confirmación nueva.
      return requireFresh ? pending.then(() => checkStatus(targetId, true)) : pending;
    }
    const request = readStatus(targetId).then(snapshot => {
      if (!isCurrent(targetId) || !snapshot) return null;
      setTriage(snapshot.triage);
      setNoActiveRoom(snapshot.noActiveRoom);
      setReadyTriageId(snapshot.ready ? targetId : null);
      return snapshot;
    }).catch((err: unknown) => {
      if (isCurrent(targetId)) {
        console.warn('Error crítico comprobando estado en sala de espera:', err);
        setReadyTriageId(null);
      }
      return null;
    }).finally(() => {
      pendingStatus.current = null;
      if (isCurrent(targetId)) setLoading(false);
    });
    pendingStatus.current = request;
    return request;
  }, [isCurrent, readStatus]);

  // Inicialización del ID del triaje (con fallback automático por usuario si no llega por params)
  useEffect(() => {
    let active = true;
    const init = async () => {
      try {
        let resolvedId = triageId;
        if (!resolvedId) {
          const { data: { user }, error: authError } = await supabase.auth.getUser();
          if (!active || !session.current.mounted) return;
          if (authError) throw authError;
          if (user) {
            const { data: latest, error: latestError } = await supabase
              .from('triages')
              .select('id')
              .eq('patient_id', user.id)
              .in('status', ['pending', 'waiting', 'in_progress'])
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            if (!active || !session.current.mounted) return;
            if (latestError) throw latestError;
            if (typeof latest?.id === 'string') resolvedId = latest.id;
          }
        }
        if (!active || !session.current.mounted) return;
        session.current.triageId = resolvedId;
        if (resolvedId) {
          setActiveTriageId(resolvedId);
          await checkStatus(resolvedId);
        } else {
          setNoActiveRoom(true);
          setLoading(false);
        }
      } catch (err) {
        if (!active || !session.current.mounted) return;
        console.warn('Error obteniendo el triaje de la sala de espera:', err);
        setNoActiveRoom(true);
        setLoading(false);
      }
    };
    void init();
    return () => { active = false; };
  }, [triageId, checkStatus]);

  // Polling activo cada 2 segundos + Suscripción Realtime dual (triages y appointments)
  useEffect(() => {
    if (!activeTriageId) return;

    // 1. Polling periódico infalible cada 2 segundos
    const pollInterval = setInterval(() => {
      void checkStatus(activeTriageId);
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
        if (isCurrent(activeTriageId) && payload.new?.id === activeTriageId) {
          void checkStatus(activeTriageId);
        }
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'appointments'
      }, payload => {
        if (isCurrent(activeTriageId) && payload.new?.triage_id === activeTriageId) {
          void checkStatus(activeTriageId);
        }
      })
      .on('broadcast', { event: 'doctor_ready' }, payload => {
        if (isCurrent(activeTriageId) && isRecord(payload.payload) && payload.payload.triageId === activeTriageId) {
          void checkStatus(activeTriageId);
        }
      })
      .subscribe();

    return () => {
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, [activeTriageId, checkStatus, isCurrent]);

  // Auto-navegación cuando el médico se conecta
  const handleJoinCall = useCallback(async (expectedId: string) => {
    if (!isCurrent(expectedId) || readyTriageId !== expectedId || hasNavigated.current || joining.current) return;
    joining.current = true;
    try {
      const snapshot = await checkStatus(expectedId, true);
      if (!isCurrent(expectedId) || !snapshot?.ready || snapshot.triageId !== expectedId || snapshot.triage?.id !== expectedId || hasNavigated.current) return;
      hasNavigated.current = true;
      router.push({
        pathname: '/(doctor)/videocall',
        params: {
          role: 'patient',
          patientId: snapshot.triage.patient_id || '95432c20-caed-43ca-8a01-4255e7a9dc1c',
          patientName: snapshot.triage.patients?.profiles?.full_name || 'Paciente',
          triageId: expectedId,
          doctorName: snapshot.doctorName,
        }
      });
    } finally {
      joining.current = false;
    }
  }, [isCurrent, readyTriageId, checkStatus]);

  const joinReadyCall = useEffectEvent((expectedId: string) => { void handleJoinCall(expectedId); });

  useEffect(() => {
    if (activeTriageId && readyTriageId === activeTriageId && !hasNavigated.current) {
      const expectedId = activeTriageId;
      // Pequeño retardo de 1.2 segundos para que el usuario vea la transición a verde antes de entrar
      const timer = setTimeout(() => {
        joinReadyCall(expectedId);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [activeTriageId, readyTriageId]);

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
              onPress={() => { if (activeTriageId) void handleJoinCall(activeTriageId); }}
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
                const expectedId = activeTriageId;
                if (!expectedId || !isCurrent(expectedId)) return;
                // Cancelar el triaje marcándolo como resuelto/cancelado para que no quede fantasma
                await supabase.from('triages').update({ status: 'resolved' }).eq('id', expectedId);
                if (!isCurrent(expectedId)) return;
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

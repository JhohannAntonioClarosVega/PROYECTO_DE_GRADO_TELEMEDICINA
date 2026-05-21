import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';

export default function WaitingRoomScreen() {
  const { triageId } = useLocalSearchParams();
  const [triage, setTriage] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [glowingScale, setGlowingScale] = useState(1);

  // Efecto de latido / resplandor para el indicador visual
  useEffect(() => {
    const interval = setInterval(() => {
      setGlowingScale(prev => (prev === 1 ? 1.15 : 1));
    }, 1200);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (triageId) {
      fetchTriageDetails();
    } else {
      setLoading(false);
    }
  }, [triageId]);

  const fetchTriageDetails = async () => {
    try {
      const { data, error } = await supabase
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
        .eq('id', triageId)
        .single();

      if (error) throw error;
      setTriage(data);
    } catch (err) {
      console.error('Error al obtener triaje en sala de espera:', err);
    } finally {
      setLoading(false);
    }
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
        {/* Cabecera */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/')}>
            <Ionicons name="home-outline" size={24} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Sala de Espera Virtual</Text>
          <View style={{ width: 40 }} />
        </View>

        {loading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={styles.loaderText}>Cargando datos de tu triaje...</Text>
          </View>
        ) : (
          <View style={styles.content}>
            {/* Animación del radar/pulsador de espera */}
            <View style={styles.radarContainer}>
              <View style={[
                styles.radarPulseOuter, 
                { transform: [{ scale: glowingScale }] }
              ]} />
              <View style={styles.radarCenter}>
                <Ionicons name="videocam" size={32} color="#3b82f6" />
              </View>
            </View>

            <Text style={styles.statusTitle}>Esperando Conexión Médica</Text>
            <Text style={styles.statusDesc}>
              Un médico del Gobierno Autónomo Municipal de Cochabamba revisará tu triaje e iniciará la videollamada en breve.
            </Text>

            {/* Tarjeta de estado de Triage */}
            <View style={styles.triageCard}>
              <View style={styles.cardHeader}>
                <Ionicons name="document-text-outline" size={20} color="#94a3b8" />
                <Text style={styles.cardHeaderTitle}>Resumen de tu Evaluación IA</Text>
              </View>
              
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Paciente:</Text>
                <Text style={styles.infoValue}>{patientName}</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Nivel de Urgencia:</Text>
                <View style={[styles.badge, { backgroundColor: getUrgencyColor(urgency) }]}>
                  <Text style={styles.badgeText}>{getUrgencyText(urgency)}</Text>
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
                <Ionicons name="volume-high-outline" size={18} color="#10b981" style={styles.tipIcon} />
                <Text style={styles.tipText}>Usa audífonos para evitar eco y escuchar mejor al doctor.</Text>
              </View>

              <View style={styles.tipItem}>
                <Ionicons name="sunny-outline" size={18} color="#10b981" style={styles.tipIcon} />
                <Text style={styles.tipText}>Ubícate en un lugar bien iluminado y sin mucho ruido.</Text>
              </View>

              <View style={styles.tipItem}>
                <Ionicons name="wifi-outline" size={18} color="#10b981" style={styles.tipIcon} />
                <Text style={styles.tipText}>Asegúrate de tener una conexión a Internet estable.</Text>
              </View>
            </View>

            {/* Acción de Entrada a la llamada */}
            <TouchableOpacity 
              style={styles.joinBtn} 
              activeOpacity={0.8}
              onPress={() => router.push({
                pathname: '/videocall' as any,
                params: {
                  role: 'patient',
                  patientId: triage?.patient_id || '95432c20-caed-43ca-8a01-4255e7a9dc1c',
                  patientName: patientName,
                  triageId: triageId || '',
                  doctorName: 'Médico Asignado'
                }
              })}
            >
              <Ionicons name="videocam" size={22} color="#ffffff" />
              <Text style={styles.joinBtnText}>Entrar a Sala de Videoconsulta</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.cancelBtn} 
              activeOpacity={0.6}
              onPress={() => router.replace('/')}
            >
              <Text style={styles.cancelBtnText}>Salir de la sala de espera</Text>
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
    backgroundColor: '#0f172a', // Fondo oscuro premium
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: Platform.OS === 'android' ? 40 : 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  backBtn: {
    padding: 8,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  loaderContainer: {
    padding: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderText: {
    color: '#94a3b8',
    marginTop: 16,
    fontSize: 16,
    fontWeight: '500',
  },
  content: {
    padding: 24,
    alignItems: 'center',
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  radarContainer: {
    width: 100,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 20,
  },
  radarPulseOuter: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderWidth: 2,
    borderColor: 'rgba(59, 130, 246, 0.4)',
  },
  radarCenter: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#1e293b',
    borderWidth: 2,
    borderColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  statusTitle: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 10,
    textAlign: 'center',
  },
  statusDesc: {
    color: '#94a3b8',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 32,
    paddingHorizontal: 12,
  },
  triageCard: {
    width: '100%',
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 24,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    paddingBottom: 10,
  },
  cardHeaderTitle: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 8,
    textTransform: 'uppercase',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoLabel: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600',
  },
  infoValue: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  symptomsBox: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  symptomsTitle: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  symptomsText: {
    color: '#e2e8f0',
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  tipsCard: {
    width: '100%',
    backgroundColor: '#022c22', // Fondo verde muy oscuro
    borderColor: '#064e3b',
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
  },
  tipsTitle: {
    color: '#a7f3d0',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 14,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  tipIcon: {
    marginRight: 10,
    marginTop: 2,
  },
  tipText: {
    flex: 1,
    color: '#34d399',
    fontSize: 13,
    lineHeight: 18,
  },
  joinBtn: {
    width: '100%',
    backgroundColor: '#2563eb',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 16,
  },
  joinBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 16,
    marginLeft: 8,
  },
  cancelBtn: {
    padding: 12,
  },
  cancelBtnText: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '600',
  }
});

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Platform, StatusBar, ActivityIndicator, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { triageService } from '@/services/triage.service';
import { Ionicons } from '@expo/vector-icons';

export default function TriageMonitor() {
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTriages = async () => {
    try {
      const data = await triageService.getActiveTriages();
      if (data) {
        const formattedData = data.map((triage: any) => {
          // Extraemos el nombre del paciente si el JOIN funcionó
          const patientName = triage.patients?.profiles?.full_name || 'Paciente Nuevo';
          
          // Calculamos minutos
          const createdAt = new Date(triage.created_at);
          const now = new Date();
          const diffMins = Math.max(1, Math.round((now.getTime() - createdAt.getTime()) / 60000));
          
          return {
            id: triage.id,
            name: patientName,
            urgency: triage.urgency_level,
            symptoms: triage.reported_symptoms,
            time: `${diffMins} min`,
            raw: triage
          };
        });
        setPatients(formattedData);
      }
    } catch (error) {
      console.error("Error al cargar triajes:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTriages();
    // Refrescar cada 10 segundos
    const interval = setInterval(fetchTriages, 10000);
    return () => clearInterval(interval);
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchTriages();
  };
  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'Critical': return '#ef4444'; // Red
      case 'Medium': return '#f59e0b'; // Amber
      case 'Low': return '#10b981'; // Green
      default: return '#6b7280'; // Gray
    }
  };

  const getUrgencyText = (urgency: string) => {
    switch (urgency) {
      case 'Critical': return 'Crítico';
      case 'Medium': return 'Medio';
      case 'Low': return 'Bajo';
      default: return urgency;
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.headerRow}>
          <View style={styles.header}>
            <Text style={styles.title}>Monitor de Triaje IA</Text>
            <Text style={styles.subtitle}>Priorización en Tiempo Real - Cochabamba</Text>
          </View>
          <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn}>
            <Ionicons name="refresh" size={24} color="#4b5563" />
          </TouchableOpacity>
        </View>

        {loading && !refreshing ? (
          <ActivityIndicator size="large" color="#2563eb" style={{ marginTop: 50 }} />
        ) : patients.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="checkmark-done-circle" size={60} color="#10b981" />
            <Text style={styles.emptyText}>No hay pacientes en sala de espera.</Text>
            <Text style={styles.emptySubtext}>Todos los triajes han sido atendidos.</Text>
          </View>
        ) : (
          <View style={styles.listContainer}>
            {patients.map(p => (
              <View key={p.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View>
                    <Text style={styles.patientName}>{p.name}</Text>
                    <Text style={styles.timeText}>Tiempo espera: {p.time}</Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: getUrgencyColor(p.urgency) }]}>
                    <Text style={styles.badgeText}>{getUrgencyText(p.urgency)}</Text>
                  </View>
                </View>
                
                <View style={styles.cardBody}>
                  <Text style={styles.symptomsLabel}>SÍNTOMAS ANALIZADOS POR IA:</Text>
                  <Text style={styles.symptomsText}>{p.symptoms}</Text>
                </View>

                <View style={styles.cardFooter}>
                  <TouchableOpacity 
                    style={styles.button} 
                    activeOpacity={0.8}
                    onPress={() => router.push({ pathname: '/evaluation', params: { data: JSON.stringify(p.raw) } })}
                  >
                    <Text style={styles.buttonText}>Evaluar Caso</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  header: {
    flex: 1,
  },
  refreshBtn: {
    padding: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 12,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#374151',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: '#4b5563',
    fontWeight: '500',
  },
  listContainer: {
    gap: 16,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  patientName: {
    fontSize: 19,
    fontWeight: '700',
    color: '#1f2937',
  },
  timeText: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
    fontWeight: '500',
  },
  badge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardBody: {
    backgroundColor: '#f9fafb',
    padding: 14,
    borderRadius: 12,
    marginBottom: 20,
    borderLeftWidth: 3,
    borderLeftColor: '#3b82f6',
  },
  symptomsLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6b7280',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  symptomsText: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 22,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingTop: 16,
  },
  button: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});

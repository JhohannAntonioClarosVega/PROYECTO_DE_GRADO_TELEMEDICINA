import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { router } from 'expo-router';

export default function AdminReportsScreen() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalTriages: 0,
    criticalTriages: 0,
    mediumTriages: 0,
    lowTriages: 0,
    totalRevenue: 0,
    completedTriages: 0
  });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      // Obtener todos los triajes
      const { data, error } = await supabase
        .from('triages')
        .select('*');

      if (error) throw error;

      if (data) {
        const total = data.length;
        const critical = data.filter(t => t.urgency_level === 'Critical').length;
        const medium = data.filter(t => t.urgency_level === 'Medium').length;
        const low = data.filter(t => t.urgency_level === 'Low').length;
        
        // Simular pacientes que pasaron a pago o completados.
        // Asumimos que status = 'waiting' o 'completed' implica pago realizado (50 Bs)
        const paidCount = data.filter(t => t.status === 'waiting' || t.status === 'completed' || t.status === 'in_progress').length;
        const revenue = paidCount * 50; // 50 Bs por consulta

        setStats({
          totalTriages: total,
          criticalTriages: critical,
          mediumTriages: medium,
          lowTriages: low,
          totalRevenue: revenue,
          completedTriages: paidCount
        });
      }
    } catch (err) {
      console.error('Error al obtener estadísticas:', err);
    } finally {
      setLoading(false);
    }
  };

  const renderProgressBar = (value: number, total: number, color: string) => {
    const percentage = total === 0 ? 0 : Math.round((value / total) * 100);
    return (
      <View style={styles.barContainer}>
        <View style={[styles.barFill, { width: `${percentage}%`, backgroundColor: color }]} />
        <Text style={styles.barText}>{percentage}%</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.menuBtn} onPress={() => (router as any).push('/(admin)/dashboard')}>
          <Ionicons name="arrow-back" size={24} color="#f8fafc" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reportes y Finanzas</Text>
        <TouchableOpacity style={styles.menuBtn} onPress={fetchStats}>
          <Ionicons name="refresh" size={22} color="#f8fafc" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={{ marginTop: 10, color: '#64748b' }}>Generando análisis estadístico...</Text>
          </View>
        ) : (
          <>
            <View style={styles.summaryGrid}>
              <View style={styles.summaryCard}>
                <View style={[styles.iconCircle, { backgroundColor: '#dbeafe' }]}>
                  <Ionicons name="people" size={24} color="#3b82f6" />
                </View>
                <Text style={styles.summaryValue}>{stats.totalTriages}</Text>
                <Text style={styles.summaryLabel}>Pacientes Atendidos</Text>
              </View>

              <View style={styles.summaryCard}>
                <View style={[styles.iconCircle, { backgroundColor: '#d1fae5' }]}>
                  <Ionicons name="cash" size={24} color="#10b981" />
                </View>
                <Text style={styles.summaryValue}>{stats.totalRevenue} Bs</Text>
                <Text style={styles.summaryLabel}>Ingresos por Consultas</Text>
              </View>
            </View>

            <View style={styles.chartCard}>
              <Text style={styles.cardTitle}>Niveles de Urgencia (Triaje IA)</Text>
              <Text style={styles.cardSubtitle}>Distribución de pacientes según severidad</Text>
              
              <View style={styles.chartRow}>
                <Text style={styles.chartLabel}>Crítico (Emergencia)</Text>
                {renderProgressBar(stats.criticalTriages, stats.totalTriages, '#ef4444')}
                <Text style={styles.chartCount}>{stats.criticalTriages}</Text>
              </View>

              <View style={styles.chartRow}>
                <Text style={styles.chartLabel}>Medio (Urgencia)</Text>
                {renderProgressBar(stats.mediumTriages, stats.totalTriages, '#f59e0b')}
                <Text style={styles.chartCount}>{stats.mediumTriages}</Text>
              </View>

              <View style={styles.chartRow}>
                <Text style={styles.chartLabel}>Leve (Gen.)</Text>
                {renderProgressBar(stats.lowTriages, stats.totalTriages, '#10b981')}
                <Text style={styles.chartCount}>{stats.lowTriages}</Text>
              </View>
            </View>

            <View style={styles.infoCard}>
              <Ionicons name="information-circle" size={24} color="#3b82f6" />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.infoCardTitle}>Modelo de Ingresos (Comisiones)</Text>
                <Text style={styles.infoCardDesc}>
                  El sistema genera 50.00 Bs por cada consulta validada mediante QR. Hasta la fecha, se han procesado {stats.completedTriages} pagos exitosos.
                </Text>
              </View>
            </View>

          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#0f172a',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f8fafc',
  },
  menuBtn: {
    padding: 8,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    minHeight: 300,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  summaryCard: {
    width: '48%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
  },
  chartCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 20,
    marginTop: 2,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  chartLabel: {
    width: 80,
    fontSize: 12,
    color: '#334155',
    fontWeight: '600',
  },
  barContainer: {
    flex: 1,
    height: 20,
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    marginHorizontal: 12,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
  },
  barFill: {
    height: '100%',
    borderRadius: 10,
    position: 'absolute',
    left: 0,
    top: 0,
  },
  barText: {
    position: 'absolute',
    right: 8,
    fontSize: 10,
    fontWeight: 'bold',
    color: '#334155',
  },
  chartCount: {
    width: 24,
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'right',
  },
  infoCard: {
    backgroundColor: '#eff6ff',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  infoCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e3a8a',
    marginBottom: 4,
  },
  infoCardDesc: {
    fontSize: 13,
    color: '#1e40af',
    lineHeight: 20,
  }
});

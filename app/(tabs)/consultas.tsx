import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

const appointments = [
  {
    id: '1',
    patientName: 'Juan Perez',
    time: '14:30',
    status: 'waiting', // waiting, in_progress, completed
    type: 'Cardiología - Urgencia IA',
    meetingLink: 'https://meet.google.com/abc-defg-hij'
  },
  {
    id: '2',
    patientName: 'Ana Lopez',
    time: '15:00',
    status: 'scheduled',
    type: 'Medicina General',
    meetingLink: 'https://meet.google.com/xyz-uvw-123'
  }
];

export default function ConsultasScreen() {
  const [activeTab, setActiveTab] = useState('active');

  const renderAppointment = ({ item }: { item: typeof appointments[0] }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.timeBadge}>
          <Ionicons name="time-outline" size={14} color="#2563eb" />
          <Text style={styles.timeText}>{item.time}</Text>
        </View>
        <View style={[styles.statusBadge, item.status === 'waiting' ? styles.statusWaiting : styles.statusScheduled]}>
          <Text style={[styles.statusText, item.status === 'waiting' ? styles.textWaiting : styles.textScheduled]}>
            {item.status === 'waiting' ? 'En Sala de Espera' : 'Programada'}
          </Text>
        </View>
      </View>

      <Text style={styles.patientName}>{item.patientName}</Text>
      <Text style={styles.appointmentType}>{item.type}</Text>

      <View style={styles.actionRow}>
        <TouchableOpacity style={[styles.button, styles.btnVideo]} activeOpacity={0.8}>
          <Ionicons name="videocam" size={18} color="#ffffff" />
          <Text style={styles.btnTextVideo}>Iniciar Llamada</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.button, styles.btnRecord]} 
          activeOpacity={0.8}
          onPress={() => router.push('/medical-record')}
        >
          <Ionicons name="document-text" size={18} color="#3b82f6" />
          <Text style={styles.btnTextRecord}>Historial</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Consultas Activas</Text>
        <Text style={styles.headerSubtitle}>Tus citas programadas para hoy</Text>
      </View>

      {/* Selector de Pestañas */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'active' && styles.tabActive]}
          onPress={() => setActiveTab('active')}
          activeOpacity={0.6}
        >
          <Text style={[styles.tabText, activeTab === 'active' && styles.tabTextActive]}>Citas de Hoy</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'history' && styles.tabActive]}
          onPress={() => setActiveTab('history')}
          activeOpacity={0.6}
        >
          <Text style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}>Completadas</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={activeTab === 'active' ? appointments : []} // En 'history' estaría vacío por ahora
        keyExtractor={item => item.id}
        renderItem={renderAppointment}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="checkmark-circle-outline" size={48} color="#cbd5e1" />
            <Text style={styles.emptyStateText}>No tienes citas en esta sección.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    padding: 20,
    paddingTop: Platform.OS === 'android' ? 40 : 20,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
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
    fontWeight: '500',
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
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
  tabActive: {
    borderBottomColor: '#2563eb',
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748b',
  },
  tabTextActive: {
    color: '#2563eb',
  },
  listContainer: {
    padding: 16,
    paddingBottom: 100, // Espacio extra para que no tape la barra de navegación en celular
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
    shadowRadius: 5,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  timeText: {
    marginLeft: 4,
    fontSize: 13,
    fontWeight: '700',
    color: '#2563eb',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusWaiting: {
    backgroundColor: '#fef2f2',
  },
  statusScheduled: {
    backgroundColor: '#f1f5f9',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  textWaiting: {
    color: '#ef4444',
  },
  textScheduled: {
    color: '#64748b',
  },
  patientName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 4,
  },
  appointmentType: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 16,
    fontWeight: '500',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
  },
  btnVideo: {
    backgroundColor: '#2563eb',
  },
  btnRecord: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  btnTextVideo: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
    marginLeft: 6,
  },
  btnTextRecord: {
    color: '#3b82f6',
    fontWeight: '700',
    fontSize: 13,
    marginLeft: 6,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  emptyStateText: {
    color: '#94a3b8',
    fontSize: 16,
    marginTop: 12,
    fontWeight: '500',
  }
});

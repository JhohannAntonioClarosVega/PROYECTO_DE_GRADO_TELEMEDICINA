import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, SafeAreaView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Mock Data para el Historial
const historyData = [
  { id: '101', date: 'Hoy, 09:15 AM', name: 'Laura Mendez', ci: '9876543', urgency: 'Critical', action: 'Derivado a Emergencias' },
  { id: '102', date: 'Hoy, 08:30 AM', name: 'Pedro Guzman', ci: '4567891', urgency: 'Medium', action: 'Atendido (Dr. Claros)' },
  { id: '103', date: 'Ayer, 16:45 PM', name: 'Sofia Rios', ci: '3344556', urgency: 'Low', action: 'Atendido (Dr. Claros)' },
  { id: '104', date: 'Ayer, 14:20 PM', name: 'Luis Arze', ci: '7766554', urgency: 'Medium', action: 'Atendido (Dr. Vargas)' },
  { id: '105', date: '12 May, 10:00 AM', name: 'Carmen Paz', ci: '9988776', urgency: 'Low', action: 'Consulta Cancelada' },
];

export default function HistorialScreen() {
  const [searchQuery, setSearchQuery] = useState('');

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'Critical': return '#ef4444'; // Rojo
      case 'Medium': return '#f59e0b'; // Naranja
      case 'Low': return '#10b981'; // Verde
      default: return '#6b7280';
    }
  };

  const getUrgencyLabel = (urgency: string) => {
    switch (urgency) {
      case 'Critical': return 'Crítico';
      case 'Medium': return 'Medio';
      case 'Low': return 'Bajo';
      default: return urgency;
    }
  };

  // Filtrador de búsqueda
  const filteredData = historyData.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    item.ci.includes(searchQuery)
  );

  const renderHistoryCard = ({ item }: { item: typeof historyData[0] }) => (
    <View style={styles.historyCard}>
      <View style={styles.cardHeader}>
        <Text style={styles.dateText}>{item.date}</Text>
        <View style={[styles.urgencyBadge, { backgroundColor: getUrgencyColor(item.urgency) + '15' }]}>
          <View style={[styles.dot, { backgroundColor: getUrgencyColor(item.urgency) }]} />
          <Text style={[styles.urgencyText, { color: getUrgencyColor(item.urgency) }]}>
            {getUrgencyLabel(item.urgency)}
          </Text>
        </View>
      </View>
      
      <Text style={styles.patientName}>{item.name}</Text>
      <Text style={styles.patientCi}>CI: {item.ci}</Text>
      
      <View style={styles.actionFooter}>
        <Ionicons 
          name={item.action.includes('Emergencias') ? 'warning' : 'checkmark-circle'} 
          size={16} 
          color={item.action.includes('Emergencias') ? '#ef4444' : '#10b981'} 
        />
        <Text style={styles.actionText}>{item.action}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Historial de Triaje</Text>
        <Text style={styles.headerSubtitle}>Registro general de evaluaciones y auditoría IA</Text>
      </View>

      {/* Tarjetas de Métricas Rápidas */}
      <View style={styles.metricsContainer}>
        <View style={styles.metricBox}>
          <Text style={styles.metricValue}>145</Text>
          <Text style={styles.metricLabel}>Total Semana</Text>
        </View>
        <View style={styles.metricBox}>
          <Text style={[styles.metricValue, { color: '#ef4444' }]}>12</Text>
          <Text style={styles.metricLabel}>Críticos</Text>
        </View>
        <View style={styles.metricBox}>
          <Text style={[styles.metricValue, { color: '#10b981' }]}>2.5s</Text>
          <Text style={styles.metricLabel}>Tiempo Prom.</Text>
        </View>
      </View>

      {/* Buscador */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#94a3b8" style={styles.searchIcon} />
        <TextInput 
          style={styles.searchInput}
          placeholder="Buscar por paciente o CI..."
          placeholderTextColor="#94a3b8"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Lista del Historial */}
      <FlatList
        data={filteredData}
        keyExtractor={item => item.id}
        renderItem={renderHistoryCard}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
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
  metricsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  metricBox: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1e293b',
  },
  metricLabel: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 6,
    fontWeight: '700',
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    fontSize: 15,
    color: '#0f172a',
  },
  listContainer: {
    padding: 16,
    paddingBottom: 100, // Espacio para el navbar móvil
  },
  historyCard: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#cbd5e1',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  dateText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
  urgencyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  urgencyText: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  patientName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1e293b',
  },
  patientCi: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
    marginBottom: 12,
    fontWeight: '500',
  },
  actionFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 12,
  },
  actionText: {
    marginLeft: 6,
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  }
});

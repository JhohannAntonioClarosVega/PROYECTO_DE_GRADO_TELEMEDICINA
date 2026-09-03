import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, Href } from 'expo-router';
import { supabase } from '@/lib/supabase';
import CustomModal from '@/components/CustomModal';

export default function PatientMenuScreen() {
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [patientName, setPatientName] = useState('Paciente');

  const [activeTriageStatus, setActiveTriageStatus] = useState<string | null>(null);

  useEffect(() => {
    const fetchPatientProfileAndTriage = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data, error } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', user.id)
            .single();
          if (data && data.full_name) {
            setPatientName(data.full_name);
          }

          // Verificar si el paciente tiene un triaje activo (pendiente, waiting o en progreso)
          const { data: triage } = await supabase
            .from('triages')
            .select('status')
            .eq('patient_id', user.id)
            .in('status', ['pending', 'waiting', 'in_progress'])
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          if (triage) {
            setActiveTriageStatus(triage.status);
          } else {
            setActiveTriageStatus(null);
          }
        }
      } catch (err) {
        console.error('Error al cargar perfil del paciente:', err);
      }
    };
    fetchPatientProfileAndTriage();
  }, []);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      setLogoutModalVisible(false);
      router.replace('/');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
      setLogoutModalVisible(false);
      // Fallback
      router.replace('/');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Hola, {patientName}</Text>
          <Text style={styles.headerSubtitle}>Bienvenido a Telemedicina IA</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={() => setLogoutModalVisible(true)}>
          <Ionicons name="log-out-outline" size={22} color="#ef4444" />
          <Text style={styles.logoutText}>Salir</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>Acciones Rápidas</Text>
        
        <View style={styles.cardsWrapper}>
          <TouchableOpacity 
            style={[styles.gridCard, { backgroundColor: '#ecfdf5', borderColor: '#d1fae5' }]} 
            activeOpacity={0.8}
            onPress={() => router.push('/(patient)/chatbot')}
          >
            <View style={[styles.gridIconCircle, { backgroundColor: '#10b981' }]}>
              <Ionicons name="hardware-chip" size={32} color="#ffffff" />
            </View>
            <Text style={styles.gridTitle}>Triaje IA</Text>
            <Text style={styles.gridDesc}>Evalúa tus síntomas ahora</Text>
          </TouchableOpacity>

          {activeTriageStatus && (
            <TouchableOpacity 
              style={[
                styles.gridCard, 
                activeTriageStatus === 'in_progress' 
                  ? { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' } 
                  : { backgroundColor: '#eff6ff', borderColor: '#dbeafe' }
              ]} 
              activeOpacity={0.8}
              onPress={() => router.push('/(patient)/waiting-room')}
            >
              <View style={[
                styles.gridIconCircle, 
                activeTriageStatus === 'in_progress' ? { backgroundColor: '#16a34a' } : { backgroundColor: '#3b82f6' }
              ]}>
                <Ionicons name={activeTriageStatus === 'in_progress' ? "videocam" : "time"} size={32} color="#ffffff" />
              </View>
              <Text style={styles.gridTitle}>Sala Espera</Text>
              <Text style={styles.gridDesc}>
                {activeTriageStatus === 'in_progress' ? '¡Médico listo!' : 'Únete a tu consulta'}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity 
            style={[styles.gridCard, { backgroundColor: '#f5f3ff', borderColor: '#ede9fe' }]} 
            activeOpacity={0.8}
            onPress={() => router.push('/(patient)/profile')}
          >
            <View style={[styles.gridIconCircle, { backgroundColor: '#8b5cf6' }]}>
              <Ionicons name="person" size={32} color="#ffffff" />
            </View>
            <Text style={styles.gridTitle}>Mi Perfil</Text>
            <Text style={styles.gridDesc}>Actualiza tus datos</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.gridCard, { backgroundColor: '#fffbeb', borderColor: '#fef3c7' }]} 
            activeOpacity={0.8}
            onPress={() => router.push('/(patient)/history')}
          >
            <View style={[styles.gridIconCircle, { backgroundColor: '#f59e0b' }]}>
              <Ionicons name="document-text" size={32} color="#ffffff" />
            </View>
            <Text style={styles.gridTitle}>Historial</Text>
            <Text style={styles.gridDesc}>Tus recetas médicas</Text>
          </TouchableOpacity>
        </View>
        
        
        <View style={styles.banner}>
          <Ionicons name="shield-checkmark" size={24} color="#10b981" />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.bannerTitle}>Telemedicina Segura</Text>
            <Text style={styles.bannerDesc}>Tus datos médicos están protegidos y encriptados en nuestro sistema.</Text>
          </View>
        </View>

      </ScrollView>

      <CustomModal
        visible={logoutModalVisible}
        title="Cerrar Sesión"
        message="¿Estás seguro de que deseas salir de tu cuenta?"
        type="confirm"
        onConfirm={handleLogout}
        onCancel={() => setLogoutModalVisible(false)}
        confirmText="Salir"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    paddingTop: Platform.OS === 'android' ? 10 : 24,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  logoutText: {
    color: '#ef4444',
    fontWeight: '700',
    marginLeft: 4,
    fontSize: 14,
  },
  content: {
    padding: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 20,
  },
  cardsWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 16,
  },
  gridCard: {
    width: '47%',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
  },
  gridIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  gridTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 4,
    textAlign: 'center',
  },
  gridDesc: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 16,
  },
  banner: {
    marginTop: 20,
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  bannerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  bannerDesc: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
  }
});

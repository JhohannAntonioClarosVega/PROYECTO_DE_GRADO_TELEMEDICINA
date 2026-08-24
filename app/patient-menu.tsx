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

  useEffect(() => {
    const fetchPatientProfile = async () => {
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
        }
      } catch (err) {
        console.error('Error al cargar perfil del paciente:', err);
      }
    };
    fetchPatientProfile();
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
        <Text style={styles.sectionTitle}>¿Qué necesitas hoy?</Text>

        <TouchableOpacity 
          style={styles.card} 
          activeOpacity={0.8}
          onPress={() => router.push('/chatbot')}
        >
          <View style={styles.iconContainer}>
            <Ionicons name="chatbubbles" size={32} color="#ffffff" />
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>Evaluar Síntomas</Text>
            <Text style={styles.cardDesc}>Usa nuestro asistente de inteligencia artificial para evaluar tus síntomas y recibir una recomendación de triaje.</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#94a3b8" />
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.card, { marginTop: 16 }]} 
          activeOpacity={0.8}
          onPress={() => router.push('/patient-records' as Href)}
        >
          <View style={[styles.iconContainer, { backgroundColor: '#10b981' }]}>
            <Ionicons name="receipt" size={32} color="#ffffff" />
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>Mi Historial Clínico y Recetas</Text>
            <Text style={styles.cardDesc}>Consulta tus diagnósticos, recetas y planes de tratamiento indicados por tus médicos.</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#94a3b8" />
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.card, { marginTop: 16 }]} 
          activeOpacity={0.8}
          onPress={() => router.push('/profile')}
        >
          <View style={[styles.iconContainer, { backgroundColor: '#8b5cf6' }]}>
            <Ionicons name="person-circle" size={32} color="#ffffff" />
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>Mi Perfil</Text>
            <Text style={styles.cardDesc}>Actualiza tus datos de contacto, teléfono, dirección y antecedentes clínicos.</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#94a3b8" />
        </TouchableOpacity>
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
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    paddingTop: Platform.OS === 'android' ? 40 : 24,
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
    fontWeight: '700',
    color: '#334155',
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
  }
});

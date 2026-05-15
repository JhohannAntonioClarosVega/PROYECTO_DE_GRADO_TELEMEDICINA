import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function WelcomeScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <View style={styles.logoCircle}>
            <Ionicons name="medical" size={48} color="#ffffff" />
          </View>
          <Text style={styles.title}>Telemedicina IA</Text>
          <Text style={styles.subtitle}>Sistema de Triaje Inteligente</Text>
          <Text style={styles.gamc}>Gobierno Autónomo Municipal de Cochabamba</Text>
        </View>

        <View style={styles.cardsContainer}>
          {/* Tarjeta de Paciente */}
          <TouchableOpacity 
            style={[styles.card, styles.patientCard]} 
            activeOpacity={0.8}
            onPress={() => router.push({ pathname: '/login', params: { role: 'patient' } })}
          >
            <View style={styles.iconCirclePatient}>
              <Ionicons name="body" size={32} color="#059669" />
            </View>
            <Text style={styles.cardTitle}>Portal Pacientes</Text>
            <Text style={styles.cardDesc}>Reporta tus síntomas para recibir evaluación inicial mediante Inteligencia Artificial.</Text>
            <View style={styles.arrowContainer}>
              <Text style={[styles.arrowText, { color: '#059669' }]}>Iniciar Triaje</Text>
              <Ionicons name="arrow-forward" size={16} color="#059669" />
            </View>
          </TouchableOpacity>

          {/* Tarjeta de Médico */}
          <TouchableOpacity 
            style={[styles.card, styles.doctorCard]} 
            activeOpacity={0.8}
            onPress={() => router.push({ pathname: '/login', params: { role: 'doctor' } })}
          >
            <View style={styles.iconCircleDoctor}>
              <Ionicons name="medkit" size={32} color="#2563eb" />
            </View>
            <Text style={styles.cardTitle}>Portal Médico</Text>
            <Text style={styles.cardDesc}>Accede al Monitor en tiempo real para evaluar casos y gestionar citas activas.</Text>
            <View style={styles.arrowContainer}>
              <Text style={[styles.arrowText, { color: '#2563eb' }]}>Ingresar al Monitor</Text>
              <Ionicons name="arrow-forward" size={16} color="#2563eb" />
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    maxWidth: 600, // Para que no se estire feo en pantallas de computadora
    width: '100%',
    alignSelf: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 50,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 18,
    color: '#3b82f6',
    fontWeight: '700',
    marginTop: 4,
  },
  gamc: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 8,
    fontWeight: '600',
  },
  cardsContainer: {
    gap: 20,
  },
  card: {
    padding: 24,
    borderRadius: 24,
    borderWidth: 2,
    flexDirection: 'column',
  },
  patientCard: {
    backgroundColor: '#ffffff',
    borderColor: '#dcfce3',
  },
  doctorCard: {
    backgroundColor: '#ffffff',
    borderColor: '#dbeafe',
  },
  iconCirclePatient: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  iconCircleDoctor: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 8,
  },
  cardDesc: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 22,
    marginBottom: 20,
    fontWeight: '500',
  },
  arrowContainer: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  arrowText: {
    fontWeight: '700',
    fontSize: 14,
    marginRight: 6,
  }
});

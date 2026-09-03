import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';

export default function DoctorProfileScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Campos editables
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [address, setAddress] = useState('');
  
  // Campos de solo lectura
  const [email, setEmail] = useState('');
  const [identityCard, setIdentityCard] = useState('');
  const [gender, setGender] = useState('');
  const [specialtyName, setSpecialtyName] = useState('Cargando...');
  const [isActive, setIsActive] = useState(false);

  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      // Cargar datos completos del perfil
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (profileData) {
        setFullName(profileData.full_name || '');
        setPhoneNumber(profileData.phone_number || '');
        setAddress(profileData.address || '');
        setEmail(profileData.email || user.email || '');
        setIdentityCard(profileData.identity_card || '');
        setGender(profileData.gender === 'M' ? 'Masculino' : profileData.gender === 'F' ? 'Femenino' : 'No especificado');
      }

      // Cargar especialidad y estado
      const { data: doctorData } = await supabase
        .from('doctors')
        .select('is_active, specialties(name)')
        .eq('id', user.id)
        .single();
      
      if (doctorData) {
        setIsActive(doctorData.is_active);
        const spec = Array.isArray(doctorData?.specialties) 
          ? doctorData?.specialties[0] 
          : doctorData?.specialties;

        if (spec?.name) {
          setSpecialtyName(spec.name);
        } else {
          setSpecialtyName('No asignada');
        }
      }
    } catch (error) {
      console.error('Error cargando perfil:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveProfile = async () => {
    if (!userId) return;
    if (!fullName.trim() || !phoneNumber.trim()) {
      if (Platform.OS === 'web') window.alert('El nombre y el celular no pueden estar vacíos');
      else Alert.alert('Error', 'El nombre y el celular no pueden estar vacíos');
      return;
    }

    try {
      setSaving(true);
      const { error } = await supabase
        .from('profiles')
        .update({ 
          full_name: fullName.trim(),
          phone_number: phoneNumber.trim(),
          address: address.trim()
        })
        .eq('id', userId);
      
      if (error) throw error;
      
      if (Platform.OS === 'web') {
        window.alert('Perfil actualizado correctamente');
      } else {
        Alert.alert('Éxito', 'Perfil actualizado correctamente');
      }
    } catch (error: any) {
      console.error('Error guardando perfil:', error);
      if (Platform.OS === 'web') {
        window.alert('Error al guardar: ' + error.message);
      } else {
        Alert.alert('Error', 'No se pudo actualizar el perfil');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            <Ionicons name="person" size={50} color="#3b82f6" />
            <View style={[styles.statusBadge, { backgroundColor: isActive ? '#10b981' : '#f59e0b' }]} />
          </View>
          <Text style={styles.headerTitle}>{fullName || 'Doctor'}</Text>
          <Text style={styles.headerSubtitle}>{specialtyName}</Text>
          <View style={[styles.activeBadge, { backgroundColor: isActive ? '#d1fae5' : '#fef3c7' }]}>
            <Text style={[styles.activeBadgeText, { color: isActive ? '#059669' : '#d97706' }]}>
              {isActive ? 'Cuenta Verificada y Activa' : 'Cuenta Pendiente de Aprobación'}
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Datos Profesionales (Solo Lectura)</Text>
          
          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <Ionicons name="medkit" size={20} color="#6366f1" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Especialidad Asignada</Text>
              <Text style={styles.infoValue}>{specialtyName}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <Ionicons name="card" size={20} color="#64748b" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Carnet de Identidad (CI)</Text>
              <Text style={styles.infoValue}>{identityCard}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <Ionicons name="mail" size={20} color="#64748b" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Correo Electrónico</Text>
              <Text style={styles.infoValue}>{email}</Text>
            </View>
          </View>
          
          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <Ionicons name="male-female" size={20} color="#64748b" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Género</Text>
              <Text style={styles.infoValue}>{gender}</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Información Personal (Editable)</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nombres y Apellidos completos</Text>
            <TextInput
              style={styles.input}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Ej. Dr. Juan Pérez"
              placeholderTextColor="#94a3b8"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Número de Celular</Text>
            <TextInput
              style={styles.input}
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              keyboardType="phone-pad"
              placeholder="Ej. 70012345"
              placeholderTextColor="#94a3b8"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Dirección (Opcional)</Text>
            <TextInput
              style={styles.input}
              value={address}
              onChangeText={setAddress}
              placeholder="Ej. Av. Blanco Galindo Km 3"
              placeholderTextColor="#94a3b8"
            />
          </View>

          <TouchableOpacity 
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]} 
            onPress={saveProfile}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="save-outline" size={20} color="#fff" />
                <Text style={styles.saveBtnText}>Guardar Cambios</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 20,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
    marginTop: 20,
  },
  avatarContainer: {
    position: 'relative',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 2,
    borderColor: '#bfdbfe',
  },
  statusBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 3,
    borderColor: '#f8fafc',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#64748b',
    marginTop: 4,
    marginBottom: 12,
  },
  activeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  activeBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 3,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 10,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#334155',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 8,
  },
  specialtyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  specialtyText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e40af',
    marginLeft: 10,
  },
  input: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    color: '#0f172a',
  },
  saveBtn: {
    backgroundColor: '#3b82f6',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginTop: 10,
  },
  saveBtnDisabled: {
    backgroundColor: '#93c5fd',
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});

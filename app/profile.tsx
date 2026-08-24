import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { Picker } from '@react-native-picker/picker';
import CustomModal from '@/components/CustomModal';

export default function ProfileScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userRole, setUserRole] = useState<'patient' | 'doctor' | 'admin'>('patient');
  const [userId, setUserId] = useState<string | null>(null);

  // Common Profile Fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [identityCard, setIdentityCard] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [address, setAddress] = useState('');
  const [gender, setGender] = useState('Masculino');

  // Patient Fields
  const [bloodType, setBloodType] = useState('O+');
  const [allergies, setAllergies] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');

  // Doctor Schedule Fields
  const [schedules, setSchedules] = useState<any[]>([]);
  const [selectedDay, setSelectedDay] = useState('Lunes');
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('16:00');

  // Modal alert configuration
  const [modalConfig, setModalConfig] = useState({
    visible: false,
    title: '',
    message: '',
    type: 'alert' as 'alert' | 'confirm',
    confirmText: 'Aceptar',
    onConfirm: () => {},
  });

  const closeModal = () => setModalConfig(prev => ({ ...prev, visible: false }));

  useEffect(() => {
    fetchProfileData();
  }, []);

  const fetchProfileData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('No se encontró sesión activa.');
      }
      setUserId(user.id);

      // 1. Obtener Perfil Principal
      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileErr) throw profileErr;

      if (profile) {
        setFullName(profile.full_name || '');
        setEmail(profile.email || user.email || '');
        setIdentityCard(profile.identity_card || '');
        setPhoneNumber(profile.phone_number || '');
        setAddress(profile.address || '');
        setGender(profile.gender || 'Masculino');
        setUserRole(profile.role || 'patient');

        // 2. Si es Paciente, cargar datos de la tabla patients
        if (profile.role === 'patient') {
          const { data: patient } = await supabase
            .from('patients')
            .select('*')
            .eq('id', user.id)
            .maybeSingle();

          if (patient) {
            setBloodType(patient.blood_type || 'O+');
            setAllergies(patient.allergies || '');
            setEmergencyContact(patient.emergency_contact || '');
          }
        }

        // 3. Si es Médico, cargar sus horarios
        if (profile.role === 'doctor') {
          const { data: schedData } = await supabase
            .from('doctor_schedules')
            .select('*')
            .eq('doctor_id', user.id);

          if (schedData && schedData.length > 0) {
            setSchedules(schedData);
          }
        }
      }
    } catch (err: any) {
      console.error('Error cargando perfil:', err);
      setModalConfig({
        visible: true,
        title: 'Error de carga',
        message: err.message || 'No se pudieron cargar los datos del perfil.',
        type: 'alert',
        confirmText: 'Entendido',
        onConfirm: closeModal
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!phoneNumber || !address) {
      setModalConfig({
        visible: true,
        title: 'Campos requeridos',
        message: 'Por favor completa el número de teléfono y la dirección.',
        type: 'alert',
        confirmText: 'Entendido',
        onConfirm: closeModal
      });
      return;
    }

    setSaving(true);
    try {
      if (!userId) throw new Error('Sin ID de usuario.');

      // 1. Actualizar perfil básico
      const { error: updateProfileErr } = await supabase
        .from('profiles')
        .update({
          phone_number: phoneNumber,
          address: address,
          gender: gender,
        })
        .eq('id', userId);

      if (updateProfileErr) throw updateProfileErr;

      // 2. Actualizar según rol
      if (userRole === 'patient') {
        const { error: patientErr } = await supabase
          .from('patients')
          .upsert({
            id: userId,
            blood_type: bloodType,
            allergies: allergies,
            emergency_contact: emergencyContact,
          });

        if (patientErr) throw patientErr;
      } else if (userRole === 'doctor') {
        // Guardar o actualizar un horario básico para el día seleccionado
        const { error: schedErr } = await supabase
          .from('doctor_schedules')
          .upsert({
            doctor_id: userId,
            day_of_week: selectedDay,
            start_time: startTime,
            end_time: endTime,
            is_available: true
          });

        if (schedErr) console.warn('Aviso en doctor_schedules:', schedErr.message);
      }

      setSaving(false);
      setModalConfig({
        visible: true,
        title: 'Perfil Actualizado',
        message: 'Tus datos personales han sido guardados correctamente en el sistema.',
        type: 'alert',
        confirmText: 'Aceptar',
        onConfirm: () => {
          closeModal();
          router.back();
        }
      });
    } catch (err: any) {
      console.error('Error al guardar perfil:', err);
      setSaving(false);
      setModalConfig({
        visible: true,
        title: 'Error al Guardar',
        message: err.message || 'Ocurrió un error al actualizar los datos.',
        type: 'alert',
        confirmText: 'Entendido',
        onConfirm: closeModal
      });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#0f172a" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Mi Perfil de Usuario</Text>
          <View style={{ width: 40 }} />
        </View>

        {loading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color="#2563eb" />
            <Text style={styles.loaderText}>Cargando información personal...</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Header del Perfil */}
            <View style={styles.profileHeader}>
              <View style={[styles.avatarCircle, { backgroundColor: userRole === 'doctor' ? '#2563eb' : '#059669' }]}>
                <Ionicons name={userRole === 'doctor' ? "medkit" : "person"} size={40} color="#ffffff" />
              </View>
              <Text style={styles.userName}>{fullName}</Text>
              <Text style={styles.userRoleTag}>
                {userRole === 'doctor' ? 'Médico de Guardia' : userRole === 'admin' ? 'Administrador' : 'Paciente Registrado'}
              </Text>
            </View>

            {/* Datos Inmutables / Lectura */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Datos de Identificación (No editables)</Text>
              
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Correo Electrónico:</Text>
                <Text style={styles.infoValue}>{email}</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Carnet de Identidad (CI):</Text>
                <Text style={styles.infoValue}>{identityCard || 'No registrado'}</Text>
              </View>
            </View>

            {/* Campos Editables Generales */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Información de Contacto y Datos Generales</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Número de Teléfono / Celular</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="call-outline" size={20} color="#94a3b8" style={styles.inputIcon} />
                  <TextInput 
                    style={styles.input}
                    placeholder="Ej: 71234567"
                    placeholderTextColor="#94a3b8"
                    keyboardType="phone-pad"
                    value={phoneNumber}
                    onChangeText={setPhoneNumber}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Dirección de Domicilio</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="location-outline" size={20} color="#94a3b8" style={styles.inputIcon} />
                  <TextInput 
                    style={styles.input}
                    placeholder="Ej: Av. Blanco Galindo Km 3"
                    placeholderTextColor="#94a3b8"
                    value={address}
                    onChangeText={setAddress}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Género</Text>
                <View style={[styles.inputContainer, { paddingHorizontal: 0, overflow: 'hidden' }]}>
                  <Picker
                    selectedValue={gender}
                    style={styles.picker}
                    onValueChange={(itemValue) => setGender(itemValue)}
                  >
                    <Picker.Item label="Masculino" value="Masculino" />
                    <Picker.Item label="Femenino" value="Femenino" />
                  </Picker>
                </View>
              </View>
            </View>

            {/* Campos Específicos para Paciente */}
            {userRole === 'patient' && (
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Antecedentes Clínicos del Paciente</Text>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Tipo de Sangre</Text>
                  <View style={[styles.inputContainer, { paddingHorizontal: 0, overflow: 'hidden' }]}>
                    <Picker
                      selectedValue={bloodType}
                      style={styles.picker}
                      onValueChange={(itemValue) => setBloodType(itemValue)}
                    >
                      <Picker.Item label="O+" value="O+" />
                      <Picker.Item label="O-" value="O-" />
                      <Picker.Item label="A+" value="A+" />
                      <Picker.Item label="A-" value="A-" />
                      <Picker.Item label="B+" value="B+" />
                      <Picker.Item label="B-" value="B-" />
                      <Picker.Item label="AB+" value="AB+" />
                      <Picker.Item label="AB-" value="AB-" />
                    </Picker>
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Alergias Conocidas</Text>
                  <View style={styles.inputContainer}>
                    <Ionicons name="alert-circle-outline" size={20} color="#94a3b8" style={styles.inputIcon} />
                    <TextInput 
                      style={styles.input}
                      placeholder="Ej: Penicilina, Polvo, Ninguna"
                      placeholderTextColor="#94a3b8"
                      value={allergies}
                      onChangeText={setAllergies}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Teléfono de Contacto de Emergencia</Text>
                  <View style={styles.inputContainer}>
                    <Ionicons name="people-outline" size={20} color="#94a3b8" style={styles.inputIcon} />
                    <TextInput 
                      style={styles.input}
                      placeholder="Ej: 70012345 (Familiar)"
                      placeholderTextColor="#94a3b8"
                      keyboardType="phone-pad"
                      value={emergencyContact}
                      onChangeText={setEmergencyContact}
                    />
                  </View>
                </View>
              </View>
            )}

            {/* Campos Específicos para Médico */}
            {userRole === 'doctor' && (
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Configuración de Horario de Atención</Text>
                
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Día de la semana</Text>
                  <View style={[styles.inputContainer, { paddingHorizontal: 0, overflow: 'hidden' }]}>
                    <Picker
                      selectedValue={selectedDay}
                      style={styles.picker}
                      onValueChange={(itemValue) => setSelectedDay(itemValue)}
                    >
                      <Picker.Item label="Lunes" value="Lunes" />
                      <Picker.Item label="Martes" value="Martes" />
                      <Picker.Item label="Miércoles" value="Miércoles" />
                      <Picker.Item label="Jueves" value="Jueves" />
                      <Picker.Item label="Viernes" value="Viernes" />
                      <Picker.Item label="Sábado" value="Sábado" />
                    </Picker>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.label}>Hora Inicio</Text>
                    <View style={styles.inputContainer}>
                      <TextInput 
                        style={styles.input}
                        placeholder="08:00"
                        placeholderTextColor="#94a3b8"
                        value={startTime}
                        onChangeText={setStartTime}
                      />
                    </View>
                  </View>

                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.label}>Hora Fin</Text>
                    <View style={styles.inputContainer}>
                      <TextInput 
                        style={styles.input}
                        placeholder="16:00"
                        placeholderTextColor="#94a3b8"
                        value={endTime}
                        onChangeText={setEndTime}
                      />
                    </View>
                  </View>
                </View>
              </View>
            )}

            {/* Botón de Guardado */}
            <TouchableOpacity 
              style={[styles.saveBtn, { backgroundColor: userRole === 'doctor' ? '#2563eb' : '#059669' }]}
              onPress={handleSaveProfile}
              disabled={saving}
              activeOpacity={0.8}
            >
              {saving ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={22} color="#ffffff" />
                  <Text style={styles.saveBtnText}>Guardar Cambios del Perfil</Text>
                </>
              )}
            </TouchableOpacity>

          </ScrollView>
        )}
      </KeyboardAvoidingView>

      <CustomModal 
        visible={modalConfig.visible}
        title={modalConfig.title}
        message={modalConfig.message}
        type={modalConfig.type}
        onConfirm={modalConfig.onConfirm}
        confirmText={modalConfig.confirmText}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: Platform.OS === 'android' ? 40 : 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backBtn: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loaderText: {
    marginTop: 16,
    color: '#64748b',
    fontSize: 15,
    fontWeight: '500',
  },
  scrollContent: {
    padding: 20,
    maxWidth: 650,
    width: '100%',
    alignSelf: 'center',
    paddingBottom: 40,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 24,
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  userName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
  },
  userRoleTag: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
    marginTop: 4,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  sectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  infoLabel: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '700',
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    fontSize: 15,
    color: '#0f172a',
  },
  picker: {
    width: '100%',
    height: 50,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  }
});

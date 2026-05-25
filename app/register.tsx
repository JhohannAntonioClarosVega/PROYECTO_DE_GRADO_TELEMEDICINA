import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { Picker } from '@react-native-picker/picker';
import * as DocumentPicker from 'expo-document-picker';

export default function RegisterScreen() {
  const { role } = useLocalSearchParams();
  const isDoctor = role === 'doctor';

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Common Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [identityCard, setIdentityCard] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [address, setAddress] = useState('');
  const [gender, setGender] = useState('Masculino');

  // Doctor Specific Fields
  const [specialties, setSpecialties] = useState<any[]>([]);
  const [selectedSpecialty, setSelectedSpecialty] = useState('');
  const [document, setDocument] = useState<DocumentPicker.DocumentPickerAsset | null>(null);

  useEffect(() => {
    if (isDoctor) {
      fetchSpecialties();
    }
  }, [isDoctor]);

  const fetchSpecialties = async () => {
    try {
      const { data, error } = await supabase.from('specialties').select('id, name');
      if (error) throw error;
      if (data && data.length > 0) {
        setSpecialties(data);
        setSelectedSpecialty(data[0].id);
      }
    } catch (err) {
      console.error('Error fetching specialties:', err);
    }
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setDocument(result.assets[0]);
      }
    } catch (err) {
      console.error('Error picking document', err);
    }
  };

  const handleRegister = async () => {
    if (!email || !password || !fullName || !identityCard || !phoneNumber || !address) {
      setErrorMsg('Por favor completa todos los campos comunes.');
      return;
    }

    if (isDoctor && (!selectedSpecialty || !document)) {
      setErrorMsg('Por favor selecciona una especialidad y adjunta tu título.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      // 1. Crear el usuario en Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) throw authError;

      const userId = authData.user?.id;
      if (!userId) throw new Error('No se pudo crear el usuario.');

      // 2. Insertar o Actualizar en Profiles (Upsert es más seguro si hay triggers en la base de datos)
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: userId,
        full_name: fullName,
        identity_card: identityCard,
        phone_number: phoneNumber,
        role: isDoctor ? 'doctor' : 'patient',
        address: address,
        gender: gender,
        email: email
      });

      if (profileError) {
        console.error("Error en profiles:", profileError);
        if (profileError.code === '23505' || profileError.message.includes('profiles_identity_card_key')) {
          throw new Error('El Carnet de Identidad (CI) ya está registrado en el sistema. Por favor verifica tus datos o inicia sesión.');
        }
        throw new Error('Error al guardar el perfil: ' + profileError.message);
      }

      // 3. Insertar datos específicos según el rol
      if (isDoctor) {
        // Subir documento
        let documentUrl = '';
        if (document) {
          const fileExt = document.name.split('.').pop();
          const fileName = `${userId}-${Date.now()}.${fileExt}`;
          
          // Nota: Si es web, document.file existe. Si es React Native, usamos uri.
          // Para que funcione en web y móvil usando fetch y blobs:
          const response = await fetch(document.uri);
          const blob = await response.blob();
          
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('doctor_documents')
            .upload(fileName, blob, {
              contentType: document.mimeType || 'application/octet-stream',
            });

          if (uploadError) throw uploadError;

          const { data: publicUrlData } = supabase.storage
            .from('doctor_documents')
            .getPublicUrl(fileName);
            
          documentUrl = publicUrlData.publicUrl;
        }

        const { error: doctorError } = await supabase.from('doctors').insert({
          id: userId,
          specialty_id: selectedSpecialty,
          title_document_url: documentUrl,
          license_number: 'PENDING-' + identityCard,
          is_active: false // Requiere aprobación manual
        });

        if (doctorError) throw doctorError;

        setSuccessMsg('Tu cuenta médica ha sido creada. Un administrador revisará tu solicitud.');

      } else {
        const { error: patientError } = await supabase.from('patients').upsert({
          id: userId
        });

        if (patientError) {
          console.error("Error en patients:", patientError);
          throw new Error('Error al guardar datos de paciente: ' + patientError.message);
        }

        setSuccessMsg('Tu cuenta de paciente ha sido creada correctamente.');
      }

    } catch (error: any) {
      setErrorMsg(error.message || 'Error al registrar la cuenta.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={28} color="#64748b" />
        </TouchableOpacity>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View style={[styles.iconCircle, { backgroundColor: isDoctor ? '#eff6ff' : '#ecfdf5' }]}>
              <Ionicons name={isDoctor ? "medkit" : "person-add"} size={40} color={isDoctor ? "#2563eb" : "#059669"} />
            </View>
            <Text style={styles.title}>{isDoctor ? 'Registro Médico' : 'Registro de Paciente'}</Text>
            <Text style={styles.subtitle}>Crea tu cuenta llenando los siguientes datos</Text>
          </View>

          <View style={styles.form}>
            {successMsg ? (
              <View style={styles.successContainer}>
                <Ionicons name="checkmark-circle" size={80} color="#059669" />
                <Text style={styles.successTitle}>¡Registro Exitoso!</Text>
                <Text style={styles.successText}>{successMsg}</Text>
                <TouchableOpacity 
                  style={[styles.registerBtn, { backgroundColor: isDoctor ? '#2563eb' : '#059669', width: '100%', marginTop: 30 }]}
                  onPress={() => router.replace(`/login?role=${isDoctor ? 'doctor' : 'patient'}`)}
                >
                  <Text style={styles.registerBtnText}>Ir a Iniciar Sesión</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {errorMsg ? (
                  <View style={styles.errorBox}>
                    <Ionicons name="warning" size={18} color="#ef4444" />
                    <Text style={styles.errorText}>{errorMsg}</Text>
                  </View>
                ) : null}

            <Text style={styles.sectionTitle}>Datos de Cuenta</Text>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Correo Electrónico</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="mail-outline" size={20} color="#94a3b8" style={styles.inputIcon} />
                <TextInput 
                  style={styles.input}
                  placeholder="ejemplo@correo.com"
                  placeholderTextColor="#94a3b8"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Contraseña</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color="#94a3b8" style={styles.inputIcon} />
                <TextInput 
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor="#94a3b8"
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                />
              </View>
            </View>

            <Text style={styles.sectionTitle}>Datos Personales</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Nombres y Apellidos</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="person-outline" size={20} color="#94a3b8" style={styles.inputIcon} />
                <TextInput 
                  style={styles.input}
                  placeholder="Ej: Juan Pérez"
                  placeholderTextColor="#94a3b8"
                  value={fullName}
                  onChangeText={setFullName}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Carnet de Identidad (CI)</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="card-outline" size={20} color="#94a3b8" style={styles.inputIcon} />
                <TextInput 
                  style={styles.input}
                  placeholder="Ej: 1234567"
                  placeholderTextColor="#94a3b8"
                  value={identityCard}
                  onChangeText={setIdentityCard}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Número de Teléfono</Text>
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
              <Text style={styles.label}>Dirección</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="location-outline" size={20} color="#94a3b8" style={styles.inputIcon} />
                <TextInput 
                  style={styles.input}
                  placeholder="Ej: Av. Blanco Galindo Km 2"
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

            {isDoctor && (
              <>
                <Text style={styles.sectionTitle}>Datos Profesionales</Text>
                
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Especialidad</Text>
                  <View style={[styles.inputContainer, { paddingHorizontal: 0, overflow: 'hidden' }]}>
                    <Picker
                      selectedValue={selectedSpecialty}
                      style={styles.picker}
                      onValueChange={(itemValue) => setSelectedSpecialty(itemValue)}
                    >
                      <Picker.Item label="Seleccione una especialidad..." value="" />
                      {specialties.map(spec => (
                        <Picker.Item key={spec.id} label={spec.name} value={spec.id} />
                      ))}
                    </Picker>
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Título Profesional (PDF o Imagen)</Text>
                  <TouchableOpacity style={styles.uploadBtn} onPress={pickDocument}>
                    <Ionicons name="cloud-upload-outline" size={24} color="#64748b" />
                    <Text style={styles.uploadBtnText}>
                      {document ? document.name : 'Subir Documento'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}



            <TouchableOpacity 
              style={[styles.registerBtn, { backgroundColor: isDoctor ? '#2563eb' : '#059669' }]}
              onPress={handleRegister}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.registerBtnText}>Completar Registro</Text>
              )}
            </TouchableOpacity>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  keyboardView: {
    flex: 1,
  },
  backBtn: {
    padding: 16,
    paddingTop: Platform.OS === 'android' ? 40 : 16,
  },
  scrollContent: {
    padding: 24,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
    paddingBottom: 60,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center'
  },
  form: {
    width: '100%',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 16,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingBottom: 8,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errorText: {
    color: '#ef4444',
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    paddingVertical: Platform.OS === 'ios' ? 16 : 12,
    fontSize: 16,
    color: '#0f172a',
  },
  picker: {
    width: '100%',
    height: Platform.OS === 'ios' ? 50 : 50,
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#94a3b8',
    borderRadius: 12,
    padding: 16,
  },
  uploadBtnText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#475569',
    fontWeight: '500',
  },
  registerBtn: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  registerBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  successContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    marginTop: 20,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 16,
    marginBottom: 8,
  },
  successText: {
    fontSize: 16,
    color: '#475569',
    textAlign: 'center',
    marginBottom: 10,
  }
});

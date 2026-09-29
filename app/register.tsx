import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity,
  KeyboardAvoidingView, 
  Platform, 
  ActivityIndicator, 
  ScrollView 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
      const cleanEmail = email.trim().toLowerCase();

      // 0a. Verificar disponibilidad de correo en profiles
      const { data: existingByEmail, error: checkEmailError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', cleanEmail)
        .maybeSingle();

      if (existingByEmail) {
        throw new Error('El correo electrónico ya está registrado. Por favor inicia sesión.');
      }

      // 0b. Verificar CI
      const { data: existingByCI, error: checkCIError } = await supabase
        .from('profiles')
        .select('id')
        .eq('identity_card', identityCard.trim())
        .maybeSingle();

      if (existingByCI) {
        throw new Error('El Carnet de Identidad (CI) ya está registrado en el sistema.');
      }

      // 1. Crear el usuario en Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
      });

      if (authError) throw authError;

      const userId = authData.user?.id;
      if (!userId) throw new Error('No se pudo crear el usuario.');

      // 2. Insertar o Actualizar en Profiles
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: userId,
        full_name: fullName,
        identity_card: identityCard.trim(),
        phone_number: phoneNumber,
        role: isDoctor ? 'doctor' : 'patient',
        address: address,
        gender: gender,
        email: cleanEmail
      });

      if (profileError) {
        await supabase.auth.signOut();
        throw new Error('Error al guardar el perfil. La operación fue cancelada.');
      }

      // 3. Insertar datos específicos según el rol
      if (isDoctor) {
        let documentUrl = '';
        if (document) {
          const fileExt = document.name.split('.').pop();
          const fileName = `${userId}-${Date.now()}.${fileExt}`;
          
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
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <View className="absolute top-12 left-6 w-10 h-10 rounded-full bg-white border border-slate-100 z-20" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 }}>
          <TouchableOpacity 
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }} 
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={24} color="#000000" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60, maxWidth: 480, width: '100%', alignSelf: 'center', marginTop: Platform.OS === 'ios' ? 80 : 100 }} showsVerticalScrollIndicator={false}>
          
          <View className="mb-6 items-center">
            <View className={`w-16 h-16 rounded-[18px] items-center justify-center mb-4 border border-slate-100 bg-white`} style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 }}>
              <Ionicons name={isDoctor ? "medkit" : "person-add"} size={30} color={isDoctor ? "#007AFF" : "#000000"} />
            </View>
            <Text className="text-[26px] font-bold text-slate-900 mb-1">{isDoctor ? 'Registro Médico' : 'Crear Cuenta'}</Text>
            <Text className="text-[14px] text-slate-500 text-center">Completa tus datos para empezar</Text>
          </View>

            <View className="w-full">
            {successMsg ? (
              <View className="items-center justify-center p-8 bg-white rounded-[32px] mt-4 border border-slate-100" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 }}>
                <View className="w-16 h-16 rounded-full bg-emerald-50 items-center justify-center mb-4">
                  <Ionicons name="checkmark" size={32} color="#10b981" />
                </View>
                <Text className="text-[22px] font-bold text-slate-900 mb-2">¡Todo listo!</Text>
                <Text className="text-[14px] text-slate-500 text-center mb-6 leading-5">{successMsg}</Text>
                <View 
                  className="w-full rounded-[16px]"
                  style={{ backgroundColor: isDoctor ? '#007AFF' : '#000000', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 }}
                >
                  <TouchableOpacity 
                    style={{ paddingVertical: 16, alignItems: 'center' }}
                    onPress={() => router.replace(`/login?role=${isDoctor ? 'doctor' : 'patient'}`)}
                  >
                    <Text className="text-white text-[16px] font-semibold">Ir a Iniciar Sesión</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View className="bg-white rounded-[32px] p-6 sm:p-8 border border-slate-100" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 }}>
                {errorMsg ? (
                  <View className="flex-row items-center bg-red-50 p-4 rounded-[16px] mb-6 border border-red-100">
                    <Ionicons name="warning" size={18} color="#ef4444" />
                    <Text className="text-red-600 ml-2 text-[13px] font-medium flex-1">{errorMsg}</Text>
                  </View>
                ) : null}

                <Text className="text-[14px] font-semibold text-slate-400 uppercase tracking-wider mb-4 ml-1">Cuenta</Text>
                
                <View className="space-y-4 mb-8">
                  <View className="border border-slate-200 rounded-[16px] px-4 py-1 h-[56px] justify-center" style={{ backgroundColor: 'rgba(248, 250, 252, 0.5)' }}>
                    <TextInput 
                      className="text-[16px] text-slate-900 h-full"
                      placeholder="Correo Electrónico"
                      placeholderTextColor="#94a3b8"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      value={email}
                      onChangeText={setEmail}
                    />
                  </View>
                  <View className="border border-slate-200 rounded-[16px] px-4 py-1 h-[56px] justify-center mt-4" style={{ backgroundColor: 'rgba(248, 250, 252, 0.5)' }}>
                    <TextInput 
                      className="text-[16px] text-slate-900 h-full"
                      placeholder="Contraseña"
                      placeholderTextColor="#94a3b8"
                      secureTextEntry
                      value={password}
                      onChangeText={setPassword}
                    />
                  </View>
                </View>

                <Text className="text-[14px] font-semibold text-slate-400 uppercase tracking-wider mb-4 ml-1">Información Personal</Text>
                
                <View className="space-y-4 mb-8">
                  <View className="border border-slate-200 rounded-[16px] px-4 py-1 h-[56px] justify-center" style={{ backgroundColor: 'rgba(248, 250, 252, 0.5)' }}>
                    <TextInput 
                      className="text-[16px] text-slate-900 h-full"
                      placeholder="Nombre Completo"
                      placeholderTextColor="#94a3b8"
                      value={fullName}
                      onChangeText={setFullName}
                    />
                  </View>
                  <View className="border border-slate-200 rounded-[16px] px-4 py-1 h-[56px] justify-center mt-4" style={{ backgroundColor: 'rgba(248, 250, 252, 0.5)' }}>
                    <TextInput 
                      className="text-[16px] text-slate-900 h-full"
                      placeholder="Carnet de Identidad"
                      placeholderTextColor="#94a3b8"
                      value={identityCard}
                      onChangeText={setIdentityCard}
                    />
                  </View>
                  <View className="border border-slate-200 rounded-[16px] px-4 py-1 h-[56px] justify-center mt-4" style={{ backgroundColor: 'rgba(248, 250, 252, 0.5)' }}>
                    <TextInput 
                      className="text-[16px] text-slate-900 h-full"
                      placeholder="Teléfono"
                      placeholderTextColor="#94a3b8"
                      keyboardType="phone-pad"
                      value={phoneNumber}
                      onChangeText={setPhoneNumber}
                    />
                  </View>
                  <View className="border border-slate-200 rounded-[16px] px-4 py-1 h-[56px] justify-center mt-4" style={{ backgroundColor: 'rgba(248, 250, 252, 0.5)' }}>
                    <TextInput 
                      className="text-[16px] text-slate-900 h-full"
                      placeholder="Dirección"
                      placeholderTextColor="#94a3b8"
                      value={address}
                      onChangeText={setAddress}
                    />
                  </View>
                  <View className="border border-slate-200 rounded-[16px] h-[56px] justify-center overflow-hidden mt-4" style={{ backgroundColor: 'rgba(248, 250, 252, 0.5)' }}>
                    <Picker
                      selectedValue={gender}
                      style={{ height: '100%', width: '100%', color: '#0f172a' }}
                      onValueChange={(itemValue) => setGender(itemValue)}
                    >
                      <Picker.Item label="Género: Masculino" value="Masculino" />
                      <Picker.Item label="Género: Femenino" value="Femenino" />
                    </Picker>
                  </View>
                </View>

                {isDoctor && (
                  <>
                    <Text className="text-[14px] font-semibold text-slate-400 uppercase tracking-wider mb-4 ml-1">Perfil Profesional</Text>
                    
                    <View className="space-y-4 mb-8">
                      <View className="border border-slate-200 rounded-[16px] h-[56px] justify-center overflow-hidden" style={{ backgroundColor: 'rgba(248, 250, 252, 0.5)' }}>
                        <Picker
                          selectedValue={selectedSpecialty}
                          style={{ height: '100%', width: '100%', color: '#0f172a' }}
                          onValueChange={(itemValue) => setSelectedSpecialty(itemValue)}
                        >
                          <Picker.Item label="Selecciona Especialidad..." value="" />
                          {specialties.map(spec => (
                            <Picker.Item key={spec.id} label={spec.name} value={spec.id} />
                          ))}
                        </Picker>
                      </View>

                      <View className="border border-slate-200 rounded-[16px] mt-4" style={{ backgroundColor: 'rgba(248, 250, 252, 0.5)' }}>
                        <TouchableOpacity 
                          style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16 }} 
                          onPress={pickDocument}
                        >
                          <View className="w-10 h-10 rounded-full items-center justify-center mr-3" style={{ backgroundColor: 'rgba(226, 232, 240, 0.5)' }}>
                            <Ionicons name="document-text" size={20} color="#64748b" />
                          </View>
                          <Text className="text-[15px] text-slate-600 flex-1" numberOfLines={1}>
                            {document ? document.name : 'Adjuntar Título (PDF)'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </>
                )}

                <View 
                  className={`mt-2 rounded-[16px]`}
                  style={[{ backgroundColor: isDoctor ? '#007AFF' : '#000000', height: 56, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 }, loading ? { opacity: 0.7 } : {}]}
                >
                  <TouchableOpacity 
                    style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
                    onPress={handleRegister}
                    disabled={loading}
                    activeOpacity={0.8}
                  >
                    {loading ? (
                      <ActivityIndicator color="#ffffff" />
                    ) : (
                      <Text className="text-white text-[16px] font-semibold tracking-wide">Crear Cuenta</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

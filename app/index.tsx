import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity,
  KeyboardAvoidingView, 
  Platform, 
  ActivityIndicator,
  ScrollView,
  Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';

type UserRole = 'patient' | 'doctor' | 'admin';

interface RoleConfig {
  key: UserRole;
  tabLabel: string;
  btnLabel: string;
  accentColor: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const ROLES_CONFIG: Record<UserRole, RoleConfig> = {
  patient: {
    key: 'patient',
    tabLabel: 'Paciente',
    btnLabel: 'Iniciar sesión como Paciente',
    accentColor: '#000000', // Estilo Apple oscuro
    icon: 'person',
  },
  doctor: {
    key: 'doctor',
    tabLabel: 'Médico',
    btnLabel: 'Iniciar sesión como Médico',
    accentColor: '#007AFF', // Azul iOS
    icon: 'medkit',
  },
  admin: {
    key: 'admin',
    tabLabel: 'Admin',
    btnLabel: 'Iniciar sesión (Admin)',
    accentColor: '#333333',
    icon: 'shield-checkmark',
  }
};

export default function SplitTelemedicinaLogin() {
  const params = useLocalSearchParams();

  const initialRole: UserRole = 
    params.role === 'admin' ? 'admin' : 
    params.role === 'doctor' ? 'doctor' : 'patient';

  const [currentRole, setCurrentRole] = useState<UserRole>(initialRole);
  const activeRole = ROLES_CONFIG[currentRole];

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [rejectionModalVisible, setRejectionModalVisible] = useState(false);
  const [rejectionReasonText, setRejectionReasonText] = useState('');

  const handleLogin = async () => {
    if (!email || !password) {
      setErrorMsg('Por favor ingresa tu correo y contraseña.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const cleanEmail = email.trim().toLowerCase();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) {
        throw new Error('Credenciales inválidas. Verifica tus datos de acceso.');
      }

      if (!data.user) {
        throw new Error('No se pudo verificar la sesión.');
      }

      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single();

      if (profileErr || !profile) {
        throw new Error('Error al obtener perfil.');
      }

      if (profile.role === 'doctor') {
        const { data: docData, error: docErr } = await supabase
          .from('doctors')
          .select('is_active, rejection_reason')
          .eq('id', data.user.id)
          .single();

        if (docErr) {
          await supabase.auth.signOut();
          throw new Error('Error al verificar cuenta médica.');
        }

        if (docData?.rejection_reason) {
          await supabase.auth.signOut();
          setRejectionReasonText(docData.rejection_reason);
          setRejectionModalVisible(true);
          return;
        }

        if (!docData?.is_active) {
          await supabase.auth.signOut();
          throw new Error('Cuenta médica pendiente de validación.');
        }

        router.replace('/(doctor)/dashboard' as any);
      } else if (profile.role === 'admin') {
        router.replace('/(admin)/dashboard' as any);
      } else {
        router.replace('/(patient)/menu' as any);
      }
    } catch (error: any) {
      setErrorMsg(error.message || 'Error al iniciar sesión.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }} keyboardShouldPersistTaps="handled">
          
          {/* Tarjeta Principal (Estilo Apple: Centrada, Limpia, Blanca) */}
          <View className="w-full max-w-[420px] bg-white rounded-[32px] p-8 sm:p-10 border border-slate-100" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }}>
            
            {/* Header Icon & Title */}
            <View className="items-center mb-8">
              <View className="w-[72px] h-[72px] rounded-[20px] bg-slate-50 items-center justify-center mb-5 border border-slate-100" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 }}>
                <Ionicons name="medical" size={32} color={activeRole.accentColor} />
              </View>
              <Text className="text-[24px] font-bold text-slate-900 tracking-tight text-center">Telemedicina</Text>
              <Text className="text-[14px] text-slate-500 mt-1 text-center">Inicia sesión para continuar</Text>
            </View>

            {/* Selector de Rol (Segmented Control estilo iOS) */}
            <View className="flex-row rounded-[12px] p-1 mb-8 gap-1" style={{ backgroundColor: 'rgba(241, 245, 249, 0.8)' }}>
              {(['patient', 'doctor', 'admin'] as UserRole[]).map((r) => {
                const info = ROLES_CONFIG[r];
                const isSelected = currentRole === r;
                return (
                  <View key={r} className={`flex-1 rounded-[10px] ${isSelected ? 'bg-white' : ''}`} style={isSelected ? { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 } : {}}>
                    <TouchableOpacity
                      style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 10 }}
                      onPress={() => {
                        setCurrentRole(r);
                        setErrorMsg('');
                      }}
                      activeOpacity={0.7}
                    >
                      <Text className={`text-[13px] ${isSelected ? 'font-semibold text-slate-900' : 'font-medium text-slate-500'}`}>
                        {info.tabLabel}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>

            {/* Mensaje de Error */}
            {errorMsg ? (
              <View className="flex-row items-center bg-red-50 p-4 rounded-[16px] mb-6 border border-red-100">
                <Ionicons name="warning" size={18} color="#ef4444" />
                <Text className="text-red-600 text-[13px] font-medium ml-2 flex-1">{errorMsg}</Text>
              </View>
            ) : null}

            {/* Inputs Minimalistas */}
            <View className="space-y-4 mb-8">
              <View className="border border-slate-200 rounded-[16px] px-4 py-1 h-[56px] justify-center" style={{ backgroundColor: 'rgba(248, 250, 252, 0.5)' }}>
                <TextInput
                  className="text-[16px] text-slate-900 h-full"
                  placeholder="Correo electrónico"
                  placeholderTextColor="#94a3b8"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                />
              </View>

              <View className="border border-slate-200 rounded-[16px] px-4 py-1 h-[56px] flex-row items-center mt-4" style={{ backgroundColor: 'rgba(248, 250, 252, 0.5)' }}>
                <TextInput
                  className="flex-1 text-[16px] text-slate-900 h-full"
                  placeholder="Contraseña"
                  placeholderTextColor="#94a3b8"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ padding: 8 }}>
                  <Ionicons name={showPassword ? "eye-off" : "eye"} size={20} color="#94a3b8" />
                </TouchableOpacity>
              </View>
            </View>

            <View className="mt-2 rounded-[16px]" style={[{ backgroundColor: activeRole.accentColor, height: 56, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 }, loading ? { opacity: 0.7 } : {}]}>
              <TouchableOpacity
                style={{ flex: 1, justifyContent: 'center', alignItems: 'center', flexDirection: 'row' }}
                onPress={handleLogin}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text className="text-white text-[16px] font-semibold tracking-wide">{activeRole.btnLabel}</Text>
                )}
              </TouchableOpacity>
            </View>

            {currentRole !== 'admin' && (
              <View className="mt-6 items-center py-2">
                <TouchableOpacity onPress={() => router.push(`/register?role=${currentRole}`)}>
                  <Text className="text-[14px] text-slate-500">
                    ¿No tienes una cuenta? <Text className="font-semibold text-slate-900">Regístrate</Text>
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modal Dedicado para Solicitud Médica Rechazada */}
      {rejectionModalVisible && (
        <View className="absolute top-0 left-0 right-0 bottom-0 justify-center items-center p-6 z-50" style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)' }}>
          <View className="w-full max-w-[360px] bg-white rounded-[24px] p-6 items-center" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 }}>
            <View className="w-16 h-16 rounded-full bg-red-50 items-center justify-center mb-4">
              <Ionicons name="close" size={32} color="#ef4444" />
            </View>
            <Text className="text-[20px] font-bold text-slate-900 mb-2">Solicitud Rechazada</Text>
            <Text className="text-[14px] text-slate-500 text-center mb-6 leading-5">
              Tu registro médico no fue aprobado por la administración.
            </Text>
            <View className="w-full bg-slate-50 rounded-[12px] p-4 mb-6 border border-slate-100">
              <Text className="text-[12px] font-semibold text-slate-400 mb-1">MOTIVO</Text>
              <Text className="text-[14px] text-slate-700">{rejectionReasonText}</Text>
            </View>
            <View className="w-full bg-slate-900 rounded-[14px]">
              <TouchableOpacity
                style={{ paddingVertical: 16, alignItems: 'center' }}
                onPress={() => {
                  setRejectionModalVisible(false);
                  setRejectionReasonText('');
                }}
              >
                <Text className="text-white text-[15px] font-semibold">Entendido</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

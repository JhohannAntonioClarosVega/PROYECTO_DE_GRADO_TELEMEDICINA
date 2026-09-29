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
    <SafeAreaView className="flex-1 bg-slate-50/50">
      <View className="flex-row px-6 pt-5 pb-6 bg-white/80 border-b border-slate-100 justify-between items-center z-10" style={{ backdropFilter: 'blur(10px)' }}>
        <View>
          <Text className="text-[28px] font-extrabold text-slate-900 tracking-tight">Hola, {patientName}</Text>
          <Text className="text-[14px] text-slate-500 font-medium mt-1">Bienvenido a tu clínica digital</Text>
        </View>
        <TouchableOpacity className="bg-red-50/80 flex-row items-center px-4 py-2.5 rounded-2xl gap-2 border border-red-100" onPress={() => setLogoutModalVisible(true)}>
          <Ionicons name="log-out-outline" size={20} color="#ef4444" />
          <Text className="text-red-500 font-bold text-[14px]">Salir</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        <Text className="text-[20px] font-extrabold text-slate-900 mb-6">¿Qué necesitas hoy?</Text>
        
        <View className="flex-row flex-wrap justify-between gap-4">
          <TouchableOpacity 
            className="w-[47%] bg-emerald-50 rounded-[28px] p-5 items-center border border-emerald-100/50 shadow-sm shadow-emerald-100" 
            activeOpacity={0.8}
            onPress={() => router.push('/(patient)/chatbot')}
          >
            <View className="w-14 h-14 rounded-full bg-emerald-500 justify-center items-center mb-4 shadow-sm shadow-emerald-300">
              <Ionicons name="hardware-chip" size={26} color="#ffffff" />
            </View>
            <Text className="text-[16px] font-extrabold text-slate-800 text-center mb-1">Triaje IA</Text>
            <Text className="text-[12px] text-slate-500 text-center leading-4 font-medium">Evalúa tus síntomas de inmediato</Text>
          </TouchableOpacity>

          {activeTriageStatus && (
            <TouchableOpacity 
              className={`w-[47%] rounded-[28px] p-5 items-center border shadow-sm ${activeTriageStatus === 'in_progress' ? 'bg-green-50 border-green-100 shadow-green-100' : 'bg-blue-50 border-blue-100 shadow-blue-100'}`} 
              activeOpacity={0.8}
              onPress={() => router.push('/(patient)/waiting-room')}
            >
              <View className={`w-14 h-14 rounded-full justify-center items-center mb-4 shadow-sm ${activeTriageStatus === 'in_progress' ? 'bg-green-500 shadow-green-300' : 'bg-blue-500 shadow-blue-300'}`}>
                <Ionicons name={activeTriageStatus === 'in_progress' ? "videocam" : "time"} size={26} color="#ffffff" />
              </View>
              <Text className="text-[16px] font-extrabold text-slate-800 text-center mb-1">Sala de Espera</Text>
              <Text className="text-[12px] text-slate-500 text-center leading-4 font-medium">
                {activeTriageStatus === 'in_progress' ? 'El médico te espera' : 'Únete a la consulta'}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity 
            className="w-[47%] bg-violet-50 rounded-[28px] p-5 items-center border border-violet-100/50 shadow-sm shadow-violet-100" 
            activeOpacity={0.8}
            onPress={() => router.push('/(patient)/profile')}
          >
            <View className="w-14 h-14 rounded-full bg-violet-500 justify-center items-center mb-4 shadow-sm shadow-violet-300">
              <Ionicons name="person" size={26} color="#ffffff" />
            </View>
            <Text className="text-[16px] font-extrabold text-slate-800 text-center mb-1">Mi Perfil</Text>
            <Text className="text-[12px] text-slate-500 text-center leading-4 font-medium">Tus datos personales</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            className="w-[47%] bg-amber-50 rounded-[28px] p-5 items-center border border-amber-100/50 shadow-sm shadow-amber-100" 
            activeOpacity={0.8}
            onPress={() => router.push('/(patient)/history')}
          >
            <View className="w-14 h-14 rounded-full bg-amber-500 justify-center items-center mb-4 shadow-sm shadow-amber-300">
              <Ionicons name="document-text" size={26} color="#ffffff" />
            </View>
            <Text className="text-[16px] font-extrabold text-slate-800 text-center mb-1">Historial</Text>
            <Text className="text-[12px] text-slate-500 text-center leading-4 font-medium">Consultas y recetas médicas</Text>
          </TouchableOpacity>
        </View>
        
        <View className="mt-8 bg-white/80 rounded-[24px] p-5 flex-row items-center border border-slate-100 shadow-sm" style={{ backdropFilter: 'blur(8px)' }}>
          <View className="w-12 h-12 bg-emerald-50 rounded-full justify-center items-center">
            <Ionicons name="shield-checkmark" size={24} color="#10b981" />
          </View>
          <View className="flex-1 ml-4">
            <Text className="text-[15px] font-extrabold text-slate-800 mb-1">Telemedicina Segura</Text>
            <Text className="text-[13px] text-slate-500 leading-5">Tus datos médicos están protegidos y encriptados bajo protocolos internacionales.</Text>
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


import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

export default function TriageEvaluation({ onBack, triage }: { onBack?: () => void; triage?: any }) {
  // Usamos los datos reales si existen, o datos de respaldo si venimos sin parámetros
  const triageData = triage ? {
    patient: {
      full_name: triage.patients?.profiles?.full_name || "Desconocido",
      identity_card: triage.patients?.profiles?.identity_card || "No registrado",
      blood_type: triage.patients?.blood_type || "No especificado",
      allergies: triage.patients?.allergies || "No reportadas",
      emergency_contact: triage.patients?.emergency_contact || "No reportado"
    },
    symptoms: triage.reported_symptoms || "Sin síntomas reportados",
    ai_analysis: {
      urgency_level: triage.urgency_level || "Medium",
      raw_analysis: triage.ai_raw_analysis || "Sin análisis.",
      recommendation: triage.ai_recommendation || "Sin recomendación."
    }
  } : {
    patient: {
      full_name: "Juan Perez",
      identity_card: "12345678",
      blood_type: "O+",
      allergies: "Penicilina",
      emergency_contact: "70012345"
    },
    symptoms: "Datos de prueba...",
    ai_analysis: {
      urgency_level: "Critical",
      raw_analysis: "Análisis de prueba...",
      recommendation: "Recomendación de prueba..."
    }
  };

  const isCritical = triageData.ai_analysis.urgency_level === 'Critical';

  return (
    <SafeAreaView className="flex-1 bg-slate-50/50">
      <View className="flex-row items-center px-4 pt-4 pb-4 bg-white/80 border-b border-slate-100 z-10" style={{ backdropFilter: 'blur(10px)' }}>
        <TouchableOpacity className="w-10 h-10 rounded-full bg-slate-100 items-center justify-center mr-3" onPress={onBack}>
          <Ionicons name="arrow-back" size={20} color="#334155" />
        </TouchableOpacity>
        <Text className="text-[20px] font-extrabold text-slate-900 tracking-tight">Evaluación IA</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        {/* Nivel de Urgencia Principal */}
        <View className={`rounded-[28px] p-6 flex-row items-center mb-6 shadow-sm ${isCritical ? 'bg-red-500 shadow-red-200' : 'bg-amber-500 shadow-amber-200'}`}>
          <View className="w-12 h-12 rounded-full bg-white/20 items-center justify-center">
            <Ionicons name="warning" size={24} color="#ffffff" />
          </View>
          <View className="ml-4 flex-1">
            <Text className="text-white text-[16px] font-extrabold tracking-wide">
              {isCritical ? 'NIVEL CRÍTICO (Prioridad 1)' : `NIVEL ${triageData.ai_analysis.urgency_level.toUpperCase()}`}
            </Text>
            <Text className="text-white/80 text-[13px] mt-1 font-medium leading-5">
              {isCritical ? 'Riesgo de vida potencial - Atención Inmediata' : 'Requiere evaluación médica pronta'}
            </Text>
          </View>
        </View>

        {/* Perfil del Paciente */}
        <View className="bg-white rounded-[28px] p-6 mb-6 border border-slate-100 shadow-sm">
          <View className="flex-row items-center border-b border-slate-100 pb-4 mb-4">
            <View className="w-10 h-10 rounded-full bg-blue-50 items-center justify-center">
              <Ionicons name="person" size={20} color="#0066CC" />
            </View>
            <Text className="text-[17px] font-extrabold text-slate-800 ml-3">Ficha Clínica</Text>
          </View>
          <View className="flex-row flex-wrap gap-y-5">
            <View className="w-[50%] pr-2">
              <Text className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mb-1">Paciente</Text>
              <Text className="text-[15px] text-slate-900 font-bold">{triageData.patient.full_name}</Text>
            </View>
            <View className="w-[50%] pl-2">
              <Text className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mb-1">Carnet (CI)</Text>
              <Text className="text-[15px] text-slate-900 font-bold">{triageData.patient.identity_card}</Text>
            </View>
            <View className="w-[50%] pr-2">
              <Text className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mb-1">Tipo de Sangre</Text>
              <View className="self-start px-2.5 py-1 bg-red-50 rounded-lg">
                <Text className="text-[14px] text-red-600 font-extrabold">{triageData.patient.blood_type}</Text>
              </View>
            </View>
            <View className="w-[50%] pl-2">
              <Text className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mb-1">Alergias</Text>
              <Text className="text-[15px] text-slate-900 font-bold">{triageData.patient.allergies}</Text>
            </View>
          </View>
        </View>

        {/* Análisis de la Inteligencia Artificial */}
        <View className="bg-white rounded-[28px] p-6 border border-slate-100 shadow-sm mb-6">
          <View className="flex-row items-center border-b border-slate-100 pb-4 mb-5">
            <View className="w-10 h-10 rounded-full bg-violet-50 items-center justify-center">
              <Ionicons name="sparkles" size={20} color="#8b5cf6" />
            </View>
            <Text className="text-[17px] font-extrabold text-slate-800 ml-3">Reporte Analítico</Text>
          </View>
          
          <View className="mb-6">
            <Text className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mb-2">Síntomas Reportados</Text>
            <View className="bg-slate-50 p-4 rounded-2xl">
              <Text className="text-[15px] text-slate-700 leading-6 italic">"{triageData.symptoms}"</Text>
            </View>
          </View>

          <View className="mb-6">
            <Text className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mb-2">Razonamiento Clínico</Text>
            <Text className="text-[15px] text-slate-700 leading-6">{triageData.ai_analysis.raw_analysis}</Text>
          </View>

          <View>
            <Text className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mb-2">Recomendación Médica</Text>
            <View className="bg-emerald-50 p-5 rounded-2xl border border-emerald-100 flex-row">
              <Ionicons name="bulb" size={20} color="#10b981" />
              <Text className="flex-1 ml-3 text-[15px] text-emerald-800 font-semibold leading-6">
                {triageData.ai_analysis.recommendation}
              </Text>
            </View>
          </View>
        </View>

        {/* Botones de Acción */}
        <View className="flex-row gap-4 mt-2">
          <TouchableOpacity 
            className="flex-1 bg-red-50 py-4 rounded-[20px] flex-row justify-center items-center border border-red-100" 
            activeOpacity={0.8}
          >
            <Ionicons name="alert-circle" size={20} color="#dc2626" />
            <Text className="text-red-600 font-extrabold text-[15px] ml-2">Derivar a Urgencias</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            className="flex-1 bg-blue-600 py-4 rounded-[20px] flex-row justify-center items-center shadow-sm shadow-blue-200" 
            activeOpacity={0.8}
            onPress={() => router.push({
              pathname: '/videocall' as any,
              params: {
                role: 'doctor',
                patientId: triage?.patient_id || '95432c20-caed-43ca-8a01-4255e7a9dc1c',
                patientName: triageData.patient.full_name,
                triageId: triage?.id || `room_eval_${triage?.patient_id || 'general'}`,
                doctorName: 'Dr. Marco Antonio'
              }
            })}
          >
            <Ionicons name="videocam" size={20} color="#ffffff" />
            <Text className="text-white font-extrabold text-[15px] ml-2">Atender Ahora</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}


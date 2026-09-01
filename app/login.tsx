import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';

export default function LoginScreen() {
  const { role } = useLocalSearchParams();
  const isAdmin = role === 'admin';
  const isDoctor = role === 'doctor';

  const themeColor = isAdmin ? '#4f46e5' : isDoctor ? '#2563eb' : '#059669';
  const themeBg = isAdmin ? '#eef2ff' : isDoctor ? '#eff6ff' : '#ecfdf5';
  const themeIcon = isAdmin ? 'shield-checkmark' : isDoctor ? 'medkit' : 'body';
  const screenTitle = isAdmin ? 'Acceso Administrador' : isDoctor ? 'Acceso Médico' : 'Acceso Paciente';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Estado para el modal de rechazo médico (Ajuste 2)
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
        // Traducimos los errores comunes
        if (error.message.includes('Invalid login credentials')) {
          throw new Error('Correo o contraseña incorrectos.');
        }
        throw error;
      }

      if (!data.user) {
        throw new Error('No se pudo verificar la sesión del usuario.');
      }

      // 1. Consultar el rol real en la base de datos (profiles.role) - RF2 / Fig 2.7
      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single();

      if (profileErr || !profile) {
        throw new Error('Error al obtener la información de perfil.');
      }

      // 2. Lógica condicional de acceso según el rol real
      if (profile.role === 'doctor') {
        // Verificar si el médico está activo / aprobado por un admin
        const { data: docData, error: docErr } = await supabase
          .from('doctors')
          .select('is_active, rejection_reason')
          .eq('id', data.user.id)
          .single();

        if (docErr) {
          // Error real de BD — distinto de "no aprobado"
          await supabase.auth.signOut();
          throw new Error('Error al verificar el estado de tu cuenta médica. Intenta de nuevo.');
        }

        if (docData?.rejection_reason) {
          // Médico fue rechazado activamente: desautenticar y mostrar modal dedicado (Ajuste 2)
          await supabase.auth.signOut();
          setRejectionReasonText(docData.rejection_reason);
          setRejectionModalVisible(true);
          return;
        }

        if (!docData?.is_active) {
          // Médico existe pero aún no ha sido revisado
          await supabase.auth.signOut();
          throw new Error('Tu cuenta médica está pendiente de aprobación por un administrador.');
        }

        router.replace('/dashboard');
      } else if (profile.role === 'admin') {
        router.replace('/admin-dashboard');
      } else {
        // Rol 'patient' o predeterminado
        router.replace('/patient-menu');
      }
    } catch (error: any) {
      setErrorMsg(error.message || 'Error al iniciar sesión.');
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

        <View style={styles.content}>
          <View style={styles.header}>
            <View style={[styles.iconCircle, { backgroundColor: themeBg }]}>
              <Ionicons name={themeIcon as any} size={40} color={themeColor} />
            </View>
            <Text style={styles.title}>{screenTitle}</Text>
            <Text style={styles.subtitle}>Inicia sesión para continuar al sistema</Text>
          </View>

          <View style={styles.form}>
            {errorMsg ? (
              <View style={styles.errorBox}>
                <Ionicons name="warning" size={18} color="#ef4444" />
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            ) : null}

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

            <TouchableOpacity 
              style={[styles.loginBtn, { backgroundColor: themeColor }]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.loginBtnText}>Ingresar al Sistema</Text>
              )}
            </TouchableOpacity>

            {!isAdmin && (
              <View style={styles.registerContainer}>
                <Text style={styles.registerText}>¿No tienes cuenta? </Text>
                <TouchableOpacity onPress={() => router.push(`/register?role=${isDoctor ? 'doctor' : 'patient'}`)}>
                  <Text style={[styles.registerLink, { color: themeColor }]}>Regístrate aquí</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Modal dedicado para solicitud médica rechazada (Ajuste 2) */}
      {rejectionModalVisible && (
        <View style={styles.modalOverlay}>
          <View style={styles.rejectionModalBox}>
            <View style={styles.rejectionModalIconContainer}>
              <Ionicons name="close-circle" size={54} color="#ef4444" />
            </View>
            <Text style={styles.rejectionModalTitle}>Solicitud Rechazada</Text>
            <Text style={styles.rejectionModalSubtitle}>
              Tu solicitud de registro médico ha sido revisada y rechazada por la administración.
            </Text>

            <View style={styles.rejectionReasonCard}>
              <Text style={styles.rejectionReasonLabel}>MOTIVO REGISTRADO:</Text>
              <Text style={styles.rejectionReasonMessage}>
                "{rejectionReasonText}"
              </Text>
            </View>

            <Text style={styles.rejectionContactText}>
              Si consideras que se trata de un error o deseas regularizar tu documentación, por favor contacta al Administrador del G.A.M. Cochabamba.
            </Text>

            <TouchableOpacity
              style={styles.rejectionCloseBtn}
              onPress={() => {
                setRejectionModalVisible(false);
                setRejectionReasonText('');
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.rejectionCloseBtnText}>Entendido</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
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
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    maxWidth: 400,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
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
  },
  form: {
    width: '100%',
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
  loginBtn: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  loginBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  registerText: {
    color: '#64748b',
    fontSize: 15,
  },
  registerLink: {
    fontSize: 15,
    fontWeight: '700',
  },
  // Modal de rechazo dedicado (Ajuste 2)
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 999,
  },
  rejectionModalBox: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  rejectionModalIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#fef2f2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  rejectionModalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 8,
    textAlign: 'center',
  },
  rejectionModalSubtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  rejectionReasonCard: {
    width: '100%',
    backgroundColor: '#fff1f2',
    borderWidth: 1,
    borderColor: '#fecdd3',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  rejectionReasonLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#e11d48',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  rejectionReasonMessage: {
    fontSize: 14,
    color: '#881337',
    fontWeight: '600',
    lineHeight: 20,
  },
  rejectionContactText: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  rejectionCloseBtn: {
    width: '100%',
    backgroundColor: '#0f172a',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectionCloseBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});

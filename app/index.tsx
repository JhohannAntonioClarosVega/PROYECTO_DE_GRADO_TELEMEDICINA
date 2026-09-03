import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  SafeAreaView, 
  KeyboardAvoidingView, 
  Platform, 
  ActivityIndicator,
  useWindowDimensions,
  ScrollView
} from 'react-native';
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
    tabLabel: 'Pacientes',
    btnLabel: 'Ingresar como Paciente',
    accentColor: '#059669', // Verde médico
    icon: 'person',
  },
  doctor: {
    key: 'doctor',
    tabLabel: 'Médicos',
    btnLabel: 'Ingresar al Portal Médico',
    accentColor: '#0284c7', // Azul médico
    icon: 'medkit',
  },
  admin: {
    key: 'admin',
    tabLabel: 'Administración',
    btnLabel: 'Ingresar a Gestión',
    accentColor: '#0f172a', // Oscuro
    icon: 'shield-checkmark',
  }
};

export default function SplitTelemedicinaLogin() {
  const params = useLocalSearchParams();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;

  const initialRole: UserRole = 
    params.role === 'admin' ? 'admin' : 
    params.role === 'doctor' ? 'doctor' : 'patient';

  const [currentRole, setCurrentRole] = useState<UserRole>(initialRole);
  const activeRole = ROLES_CONFIG[currentRole];

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focusedInput, setFocusedInput] = useState<'email' | 'password' | null>(null);
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

        router.replace('/(doctor)/dashboard');
      } else if (profile.role === 'admin') {
        router.replace('/(admin)/dashboard');
      } else {
        router.replace('/(patient)/menu');
      }
    } catch (error: any) {
      setErrorMsg(error.message || 'Error al iniciar sesión.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView 
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          
          <View style={[styles.cardContainer, isDesktop && styles.cardContainerDesktop]}>
            
            {/* MITAD 1: LOGO E IDENTIDAD MÉDICA */}
            <View style={[styles.brandSide, isDesktop ? styles.brandSideDesktop : styles.brandSideMobile]}>
              <View style={styles.brandIconWrapper}>
                <Ionicons name="medical" size={isDesktop ? 100 : 70} color="#ffffff" />
              </View>
              <Text style={styles.brandTitle}>Telemedicina IA</Text>
              <Text style={styles.brandSubtitle}>Plataforma de Atención Clínica Digital</Text>
              
              {isDesktop && (
                <View style={styles.brandFeatures}>
                  <View style={styles.featureRow}>
                    <Ionicons name="checkmark-circle" size={20} color="#38bdf8" />
                    <Text style={styles.featureText}>Triaje Inteligente Bilingüe</Text>
                  </View>
                  <View style={styles.featureRow}>
                    <Ionicons name="checkmark-circle" size={20} color="#38bdf8" />
                    <Text style={styles.featureText}>Videoconsultas Médicas</Text>
                  </View>
                  <View style={styles.featureRow}>
                    <Ionicons name="checkmark-circle" size={20} color="#38bdf8" />
                    <Text style={styles.featureText}>Historial Clínico Seguro</Text>
                  </View>
                </View>
              )}
            </View>

            {/* MITAD 2: FORMULARIO DE DATOS */}
            <View style={[styles.formSide, isDesktop && styles.formSideDesktop]}>
              <View style={styles.formContent}>
                
                <Text style={styles.formTitle}>Bienvenido</Text>
                <Text style={styles.formSubtitle}>Ingresa tus credenciales para acceder</Text>

                {/* Selector de Rol */}
                <View style={styles.roleTabsWrapper}>
                  {(['patient', 'doctor', 'admin'] as UserRole[]).map((r) => {
                    const info = ROLES_CONFIG[r];
                    const isSelected = currentRole === r;
                    return (
                      <TouchableOpacity
                        key={r}
                        style={[
                          styles.roleTab,
                          isSelected && { backgroundColor: '#ffffff', shadowColor: '#000', shadowOffset: {width:0, height:1}, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 }
                        ]}
                        onPress={() => {
                          setCurrentRole(r);
                          setErrorMsg('');
                        }}
                        activeOpacity={0.7}
                      >
                        <Ionicons 
                          name={info.icon} 
                          size={16} 
                          color={isSelected ? info.accentColor : '#94a3b8'} 
                        />
                        <Text style={[
                          styles.roleTabText,
                          isSelected ? { color: info.accentColor, fontWeight: '700' } : { color: '#64748b', fontWeight: '500' }
                        ]}>
                          {info.tabLabel}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Mensaje de Error */}
                {errorMsg ? (
                  <View style={styles.errorBox}>
                    <Ionicons name="alert-circle" size={18} color="#ef4444" />
                    <Text style={styles.errorText}>{errorMsg}</Text>
                  </View>
                ) : null}

                {/* Inputs de Correo y Contraseña */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Correo electrónico</Text>
                  <View style={[
                    styles.inputContainer,
                    focusedInput === 'email' && { borderColor: activeRole.accentColor, borderWidth: 1.5, backgroundColor: '#ffffff' }
                  ]}>
                    <Ionicons name="mail-outline" size={20} color="#94a3b8" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="ejemplo@correo.com"
                      placeholderTextColor="#94a3b8"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      value={email}
                      onChangeText={setEmail}
                      onFocus={() => setFocusedInput('email')}
                      onBlur={() => setFocusedInput(null)}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Contraseña</Text>
                  <View style={[
                    styles.inputContainer,
                    focusedInput === 'password' && { borderColor: activeRole.accentColor, borderWidth: 1.5, backgroundColor: '#ffffff' }
                  ]}>
                    <Ionicons name="lock-closed-outline" size={20} color="#94a3b8" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="••••••••"
                      placeholderTextColor="#94a3b8"
                      secureTextEntry={!showPassword}
                      value={password}
                      onChangeText={setPassword}
                      onFocus={() => setFocusedInput('password')}
                      onBlur={() => setFocusedInput(null)}
                    />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon} hitSlop={{top:10, bottom:10, left:10, right:10}}>
                      <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#94a3b8" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Botón de Acceso */}
                <TouchableOpacity
                  style={[styles.submitBtn, { backgroundColor: activeRole.accentColor }, loading && { opacity: 0.7 }]}
                  onPress={handleLogin}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  {loading ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={styles.submitBtnText}>{activeRole.btnLabel}</Text>
                  )}
                </TouchableOpacity>

                {/* Enlace de Registro */}
                {currentRole !== 'admin' && (
                  <TouchableOpacity 
                    style={styles.registerLinkContainer}
                    onPress={() => router.push(`/register?role=${currentRole}`)}
                  >
                    <Text style={styles.registerText}>
                      ¿No tienes una cuenta? <Text style={[styles.registerTextBold, { color: activeRole.accentColor }]}>Regístrate aquí</Text>
                    </Text>
                  </TouchableOpacity>
                )}

              </View>
            </View>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modal Dedicado para Solicitud Médica Rechazada */}
      {rejectionModalVisible && (
        <View style={styles.modalOverlay}>
          <View style={styles.rejectionBox}>
            <View style={styles.rejectionIconWrap}>
              <Ionicons name="close-circle" size={56} color="#ef4444" />
            </View>
            <Text style={styles.rejectionTitle}>Solicitud Rechazada</Text>
            <Text style={styles.rejectionSub}>
              Tu registro médico no fue aprobado por la administración.
            </Text>
            <View style={styles.rejectionReasonNote}>
              <Text style={styles.rejectionReasonHead}>MOTIVO:</Text>
              <Text style={styles.rejectionReasonBody}>{rejectionReasonText}</Text>
            </View>
            <TouchableOpacity
              style={styles.rejectionBtn}
              onPress={() => {
                setRejectionModalVisible(false);
                setRejectionReasonText('');
              }}
            >
              <Text style={styles.rejectionBtnText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f1f5f9', // Fondo gris muy claro para resaltar la tarjeta blanca
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  cardContainer: {
    width: '100%',
    maxWidth: 450,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 8,
  },
  cardContainerDesktop: {
    flexDirection: 'row',
    maxWidth: 960, // Ancho de la tarjeta partida en dos en escritorio
    minHeight: 600,
  },
  // LADO DE LA MARCA (MITAD 1)
  brandSide: {
    backgroundColor: '#0f172a', // Azul oscuro profundo médico
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  brandSideMobile: {
    paddingVertical: 40,
  },
  brandSideDesktop: {
    flex: 1,
    padding: 48,
    alignItems: 'flex-start',
  },
  brandIconWrapper: {
    width: 120,
    height: 120,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.5,
    marginBottom: 8,
    textAlign: 'center',
  },
  brandSubtitle: {
    fontSize: 15,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 22,
  },
  brandFeatures: {
    marginTop: 40,
    gap: 16,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureText: {
    color: '#e2e8f0',
    fontSize: 15,
    fontWeight: '500',
  },
  // LADO DEL FORMULARIO (MITAD 2)
  formSide: {
    backgroundColor: '#ffffff',
    padding: 24,
  },
  formSideDesktop: {
    flex: 1.1,
    padding: 48,
    justifyContent: 'center',
  },
  formContent: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  formTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },
  formSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 24,
  },
  roleTabsWrapper: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
    gap: 2,
  },
  roleTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  roleTabText: {
    fontSize: 13,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    padding: 14,
    borderRadius: 12,
    marginBottom: 20,
    gap: 8,
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
    lineHeight: 18,
  },
  inputGroup: {
    marginBottom: 18,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
    marginLeft: 2,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc', // Gris muy suave
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    height: 52,
    paddingHorizontal: 16,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 15,
    color: '#0f172a',
  },
  eyeIcon: {
    padding: 6,
  },
  submitBtn: {
    height: 54,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  registerLinkContainer: {
    marginTop: 24,
    alignItems: 'center',
  },
  registerText: {
    fontSize: 14,
    color: '#64748b',
  },
  registerTextBold: {
    fontWeight: '700',
  },
  // Modal de Rechazo
  modalOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 999,
  },
  rejectionBox: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
  },
  rejectionIconWrap: {
    marginBottom: 20,
  },
  rejectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 8,
  },
  rejectionSub: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  rejectionReasonNote: {
    width: '100%',
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  rejectionReasonHead: {
    fontSize: 11,
    fontWeight: '800',
    color: '#b91c1c',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  rejectionReasonBody: {
    fontSize: 14,
    color: '#7f1d1d',
    lineHeight: 20,
    fontWeight: '500',
  },
  rejectionBtn: {
    width: '100%',
    backgroundColor: '#0f172a',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  rejectionBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});

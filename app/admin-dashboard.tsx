import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, Platform, ActivityIndicator, Linking, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { Picker } from '@react-native-picker/picker';
import CustomModal from '@/components/CustomModal';

interface DoctorPending {
  id: string;
  license_number: string;
  is_active: boolean;
  title_document_url: string | null;
  specialty_id: string;
  profiles: {
    full_name: string;
    identity_card: string;
    email: string;
    phone_number: string;
  } | null;
  specialties: {
    id: string;
    name: string;
  } | null;
}

export default function AdminDashboardScreen() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingDoctors, setPendingDoctors] = useState<DoctorPending[]>([]);
  const [allSpecialties, setAllSpecialties] = useState<any[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedSpecialtiesMap, setSelectedSpecialtiesMap] = useState<Record<string, string>>({});

  const [modalConfig, setModalConfig] = useState({
    visible: false,
    title: '',
    message: '',
    type: 'alert' as 'alert' | 'confirm',
    confirmText: 'Aceptar',
    onConfirm: () => {},
  });

  const closeModal = () => setModalConfig(prev => ({ ...prev, visible: false }));

  const checkAdminAndFetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      // 1. Verificar si el usuario es Admin
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profile?.role !== 'admin') {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      setIsAdmin(true);

      // 2. Cargar Especialidades disponibles
      const { data: specData } = await supabase
        .from('specialties')
        .select('id, name');

      if (specData) setAllSpecialties(specData);

      // 3. Cargar Médicos pendientes de aprobación (is_active = false)
      const { data: docsData, error: docsErr } = await supabase
        .from('doctors')
        .select(`
          *,
          profiles (
            full_name,
            identity_card,
            email,
            phone_number
          ),
          specialties (
            id,
            name
          )
        `)
        .eq('is_active', false);

      if (docsErr) throw docsErr;

      if (docsData) {
        setPendingDoctors(docsData as DoctorPending[]);
        // Inicializar mapa de especialidades seleccionadas
        const initialMap: Record<string, string> = {};
        docsData.forEach((d: any) => {
          initialMap[d.id] = d.specialty_id || (specData && specData[0]?.id) || '';
        });
        setSelectedSpecialtiesMap(initialMap);
      }
    } catch (err: any) {
      console.error('Error en admin dashboard:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    checkAdminAndFetchData();
  }, [checkAdminAndFetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    checkAdminAndFetchData();
  };

  const handleApproveDoctor = async (doctorId: string) => {
    setProcessingId(doctorId);
    try {
      const chosenSpecialty = selectedSpecialtiesMap[doctorId];
      
      const { error } = await supabase
        .from('doctors')
        .update({
          is_active: true,
          specialty_id: chosenSpecialty
        })
        .eq('id', doctorId);

      if (error) throw error;

      setModalConfig({
        visible: true,
        title: 'Médico Aprobado',
        message: 'La cuenta médica ha sido activada exitosamente y ahora puede atender consultas.',
        type: 'alert',
        confirmText: 'Genial',
        onConfirm: () => {
          closeModal();
          checkAdminAndFetchData();
        }
      });
    } catch (err: any) {
      console.error('Error aprobando médico:', err);
      setModalConfig({
        visible: true,
        title: 'Error al Aprobar',
        message: err.message || 'No se pudo actualizar el estado del médico.',
        type: 'alert',
        confirmText: 'Entendido',
        onConfirm: closeModal
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleOpenDocument = (url: string | null) => {
    if (!url) {
      setModalConfig({
        visible: true,
        title: 'Sin documento',
        message: 'Este médico no ha adjuntado una URL de documento de título.',
        type: 'alert',
        confirmText: 'Entendido',
        onConfirm: closeModal
      });
      return;
    }
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      Linking.openURL(url).catch(err => console.error('Error al abrir URL:', err));
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Verificando permisos de administrador...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isAdmin === false) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#0f172a" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Panel de Administración</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.centerContainer}>
          <Ionicons name="shield-checkmark" size={70} color="#ef4444" />
          <Text style={styles.deniedTitle}>Acceso Restringido</Text>
          <Text style={styles.deniedDesc}>
            Esta sección es exclusiva para el rol Administrador del G.A.M. Cochabamba.
          </Text>
          <TouchableOpacity style={styles.returnBtn} onPress={() => router.replace('/')}>
            <Text style={styles.returnBtnText}>Volver al Inicio</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const renderDoctorCard = ({ item }: { item: DoctorPending }) => {
    const name = item.profiles?.full_name || 'Médico Sin Nombre';
    const ci = item.profiles?.identity_card || 'No registrado';
    const email = item.profiles?.email || '—';
    const currentSpecialtyId = selectedSpecialtiesMap[item.id] || item.specialty_id;

    return (
      <View style={styles.doctorCard}>
        <View style={styles.cardHeader}>
          <View style={styles.avatar}>
            <Ionicons name="medkit" size={24} color="#2563eb" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.doctorName}>{name}</Text>
            <Text style={styles.doctorSub}>CI: {ci} | {email}</Text>
          </View>
          <View style={styles.pendingBadge}>
            <Text style={styles.pendingBadgeText}>PENDIENTE</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.infoGrid}>
          <View style={styles.infoCol}>
            <Text style={styles.infoLabel}>Matrícula / Licencia</Text>
            <Text style={styles.infoValue}>{item.license_number || 'Pendiente'}</Text>
          </View>

          <View style={styles.infoCol}>
            <Text style={styles.infoLabel}>Documento de Título</Text>
            <TouchableOpacity 
              style={styles.docBtn}
              onPress={() => handleOpenDocument(item.title_document_url)}
            >
              <Ionicons name="document-text-outline" size={16} color="#2563eb" />
              <Text style={styles.docBtnText}>Ver Título PDF</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Asignación de Especialidad */}
        <View style={styles.specialtySection}>
          <Text style={styles.infoLabel}>Especialidad Médica Asignada</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={currentSpecialtyId}
              style={styles.picker}
              onValueChange={(val) => {
                setSelectedSpecialtiesMap(prev => ({ ...prev, [item.id]: val }));
              }}
            >
              {allSpecialties.map(spec => (
                <Picker.Item key={spec.id} label={spec.name} value={spec.id} />
              ))}
            </Picker>
          </View>
        </View>

        {/* Acciones */}
        <TouchableOpacity 
          style={styles.approveBtn}
          onPress={() => handleApproveDoctor(item.id)}
          disabled={processingId === item.id}
          activeOpacity={0.8}
        >
          {processingId === item.id ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={20} color="#ffffff" />
              <Text style={styles.approveBtnText}>Aprobar e Habilitar Médico</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#0f172a" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Aprobación de Personal Médico</Text>
          <Text style={styles.headerSubtitle}>Administración G.A.M. Cochabamba</Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh} disabled={loading}>
          <Ionicons name="refresh" size={22} color="#64748b" />
        </TouchableOpacity>
      </View>

      {pendingDoctors.length === 0 ? (
        <View style={styles.centerContainer}>
          <View style={styles.emptyIconBg}>
            <Ionicons name="checkmark-done-circle" size={50} color="#10b981" />
          </View>
          <Text style={styles.emptyTitle}>¡Todo al Día!</Text>
          <Text style={styles.emptySub}>No hay solicitudes de médicos pendientes de aprobación.</Text>
        </View>
      ) : (
        <FlatList
          data={pendingDoctors}
          keyExtractor={item => item.id}
          renderItem={renderDoctorCard}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        />
      )}

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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingTop: Platform.OS === 'android' ? 40 : 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backBtn: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  refreshBtn: {
    padding: 8,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 16,
    color: '#64748b',
    fontSize: 15,
    fontWeight: '500',
  },
  deniedTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 16,
  },
  deniedDesc: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  returnBtn: {
    marginTop: 24,
    backgroundColor: '#2563eb',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  returnBtnText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  emptyIconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#d1fae5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
  },
  emptySub: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 6,
  },
  listContainer: {
    padding: 16,
    paddingBottom: 40,
    maxWidth: 700,
    width: '100%',
    alignSelf: 'center',
  },
  doctorCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  doctorName: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
  },
  doctorSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  pendingBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  pendingBadgeText: {
    color: '#b45309',
    fontSize: 10,
    fontWeight: '800',
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 14,
  },
  infoGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  infoCol: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  docBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  docBtnText: {
    color: '#2563eb',
    fontSize: 13,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  specialtySection: {
    marginBottom: 16,
  },
  pickerContainer: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    marginTop: 4,
    overflow: 'hidden',
  },
  picker: {
    width: '100%',
    height: 50,
  },
  approveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#059669',
    padding: 14,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  approveBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  }
});

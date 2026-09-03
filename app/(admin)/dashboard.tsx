import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, Platform, ActivityIndicator, Linking, RefreshControl, TextInput, Modal } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { Picker } from '@react-native-picker/picker';
import CustomModal from '@/components/CustomModal';
import { WebView } from 'react-native-webview';

interface DoctorItem {
  id: string;
  license_number: string;
  is_active: boolean;
  rejection_reason?: string | null;
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
  const [currentTab, setCurrentTab] = useState<'pending' | 'active' | 'rejected'>('pending');
  const [pendingDoctors, setPendingDoctors] = useState<DoctorItem[]>([]);
  const [activeDoctors, setActiveDoctors] = useState<DoctorItem[]>([]);
  const [rejectedDoctors, setRejectedDoctors] = useState<DoctorItem[]>([]);
  const [allSpecialties, setAllSpecialties] = useState<any[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedSpecialtiesMap, setSelectedSpecialtiesMap] = useState<Record<string, string>>({});

  // Estado para el flujo de rechazo (Bug 2)
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectingDoctorId, setRejectingDoctorId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Estado para gestión de especialidades
  const [specialtiesModalVisible, setSpecialtiesModalVisible] = useState(false);
  const [newSpecialtyName, setNewSpecialtyName] = useState('');
  const [isAddingSpecialty, setIsAddingSpecialty] = useState(false);
  const [editingSpecialtyId, setEditingSpecialtyId] = useState<string | null>(null);
  const [editingSpecialtyName, setEditingSpecialtyName] = useState('');

  const [modalConfig, setModalConfig] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type: 'alert' | 'confirm';
    confirmText: string;
    onConfirm?: () => void;
    onCancel?: () => void;
  }>({
    visible: false,
    title: '',
    message: '',
    type: 'alert',
    confirmText: 'Aceptar',
  });

  const closeModal = () => setModalConfig(prev => ({ ...prev, visible: false }));

  // Estado para visor de documentos
  const [docViewerVisible, setDocViewerVisible] = useState(false);
  const [docViewerUrl, setDocViewerUrl] = useState<string | null>(null);

  // Helper para distinguir errores de red vs lógica de base de datos (Problema 4)
  const handleErrorModal = (err: any, defaultTitle: string) => {
    console.error(`${defaultTitle}:`, err);
    const errMsg = (err?.message || '').toLowerCase();
    const isNetworkError = 
      errMsg.includes('fetch') || 
      errMsg.includes('network') || 
      errMsg.includes('failed to fetch') ||
      errMsg.includes('timeout') ||
      errMsg.includes('connection') ||
      err?.name === 'TypeError';

    let userMessage = err?.message || 'Ocurrió un error inesperado al procesar la solicitud.';

    if (isNetworkError) {
      userMessage = 'Error de conexión. Por favor verifica tu conexión a internet e intenta nuevamente.';
    } else if (err?.code) {
      if (err.code === '23503') {
        userMessage = 'La especialidad médica seleccionada no es válida o no existe en la base de datos.';
      } else if (err.code === '42501') {
        userMessage = 'No tienes permisos de administrador suficientes para realizar esta operación.';
      } else if (err.code === '23505') {
        userMessage = 'Conflicto de clave duplicada en la base de datos.';
      }
    }

    setModalConfig({
      visible: true,
      title: defaultTitle,
      message: userMessage,
      type: 'alert',
      confirmText: 'Entendido',
      onConfirm: closeModal
    });
  };

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
        if (profile?.role === 'doctor') {
          router.replace('/(doctor)/dashboard');
          return;
        }
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      setIsAdmin(true);

      // 2. Cargar Especialidades disponibles
      const { data: specData, error: specErr } = await supabase
        .from('specialties')
        .select('id, name')
        .order('name');

      if (specErr) throw specErr;
      if (specData) setAllSpecialties(specData);

      // 3. Cargar Médicos pendientes de aprobación (is_active = false Y rejection_reason IS NULL)
      const { data: pendingData, error: pendingErr } = await supabase
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
        .eq('is_active', false)
        .is('rejection_reason', null);

      if (pendingErr) throw pendingErr;

      // 4. Cargar Médicos activos (is_active = true) para reasignación de especialidades
      const { data: activeData, error: activeErr } = await supabase
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
        .eq('is_active', true);

      if (activeErr) throw activeErr;

      // 5. Cargar Médicos rechazados (is_active = false Y rejection_reason IS NOT NULL)
      const { data: rejectedData, error: rejectedErr } = await supabase
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
        .eq('is_active', false)
        .not('rejection_reason', 'is', null);

      if (rejectedErr) throw rejectedErr;

      const initialMap: Record<string, string> = {};

      if (pendingData) {
        setPendingDoctors(pendingData as DoctorItem[]);
        pendingData.forEach((d: any) => {
          initialMap[d.id] = d.specialty_id || (specData && specData[0]?.id) || '';
        });
      }

      if (activeData) {
        setActiveDoctors(activeData as DoctorItem[]);
        activeData.forEach((d: any) => {
          initialMap[d.id] = d.specialty_id || (specData && specData[0]?.id) || '';
        });
      }

      if (rejectedData) {
        setRejectedDoctors(rejectedData as DoctorItem[]);
        rejectedData.forEach((d: any) => {
          initialMap[d.id] = d.specialty_id || (specData && specData[0]?.id) || '';
        });
      }

      setSelectedSpecialtiesMap(initialMap);

    } catch (err: any) {
      handleErrorModal(err, 'Error al Cargar Datos');
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

  // 1. Aprobar e Habilitar Médico Inicial (RF3 / Fig 2.8)
  const handleApproveDoctor = async (doctorId: string) => {
    setProcessingId(doctorId);
    try {
      const chosenSpecialty = selectedSpecialtiesMap[doctorId];

      if (!chosenSpecialty) {
        throw new Error('Por favor selecciona una especialidad antes de aprobar.');
      }

      const { error } = await supabase
        .from('doctors')
        .update({
          is_active: true,
          specialty_id: chosenSpecialty,
          rejection_reason: null // Limpia cualquier rechazo previo al aprobar
        })
        .eq('id', doctorId)
        .select(); // fuerza retorno para detectar si RLS silenció el UPDATE

      if (error) throw error;

      // Re-fetch inmediato (no esperar al modal) para que la tarjeta desaparezca de Pendientes/Rechazados
      await checkAdminAndFetchData();

      setModalConfig({
        visible: true,
        title: 'Médico Aprobado ✅',
        message: 'La cuenta médica ha sido activada exitosamente y la especialidad ha sido asignada. El médico ya puede iniciar sesión.',
        type: 'alert',
        confirmText: 'Genial',
        onConfirm: closeModal,
      });
    } catch (err: any) {
      handleErrorModal(err, 'Error al Aprobar Médico');
    } finally {
      setProcessingId(null);
    }
  };

  // 2. Reasignar Especialidad a Médico ya Activo (Problema 3 / RF3)
  const handleUpdateDoctorSpecialty = async (doctorId: string) => {
    setProcessingId(doctorId);
    try {
      const chosenSpecialty = selectedSpecialtiesMap[doctorId];
      if (!chosenSpecialty) {
        throw new Error('Por favor selecciona una especialidad válida.');
      }

      const { error } = await supabase
        .from('doctors')
        .update({
          specialty_id: chosenSpecialty
        })
        .eq('id', doctorId);

      if (error) throw error;

      setModalConfig({
        visible: true,
        title: 'Especialidad Actualizada',
        message: 'La especialidad del médico ha sido actualizada correctamente en el sistema.',
        type: 'alert',
        confirmText: 'Aceptar',
        onConfirm: () => {
          closeModal();
          checkAdminAndFetchData();
        }
      });
    } catch (err: any) {
      handleErrorModal(err, 'Error al Actualizar Especialidad');
    } finally {
      setProcessingId(null);
    }
  };

  // 3. Rechazar solicitud de médico (Bug 2)
  const openRejectModal = (doctorId: string) => {
    setRejectingDoctorId(doctorId);
    setRejectReason('');
    setRejectModalVisible(true);
  };

  const handleRejectDoctor = async () => {
    if (!rejectingDoctorId) return;
    if (!rejectReason.trim()) {
      setModalConfig({
        visible: true,
        title: 'Motivo requerido',
        message: 'Por favor ingresa un motivo de rechazo antes de continuar.',
        type: 'alert',
        confirmText: 'Entendido',
        onConfirm: closeModal,
      });
      return;
    }

    setRejectModalVisible(false);
    setProcessingId(rejectingDoctorId);
    try {
      // Marcar como rechazado con motivo (no se elimina la cuenta — trazabilidad académica)
      const { error } = await supabase
        .from('doctors')
        .update({
          is_active: false,
          rejection_reason: rejectReason.trim(),
        })
        .eq('id', rejectingDoctorId);

      if (error) throw error;

      // Re-fetch inmediato
      await checkAdminAndFetchData();

      setModalConfig({
        visible: true,
        title: 'Solicitud Rechazada',
        message: `La solicitud fue rechazada. Motivo registrado: "${rejectReason.trim()}". El médico verá este mensaje al intentar iniciar sesión.`,
        type: 'alert',
        confirmText: 'Aceptar',
        onConfirm: closeModal,
      });
    } catch (err: any) {
      handleErrorModal(err, 'Error al Rechazar Solicitud');
    } finally {
      setProcessingId(null);
      setRejectingDoctorId(null);
      setRejectReason('');
    }
  };

  // 4. Cerrar sesión (Bug 3)
  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      router.replace('/');
    } catch (err) {
      console.error('Error al cerrar sesión:', err);
      router.replace('/');
    }
  };

  const handleAddSpecialty = async () => {
    if (!newSpecialtyName.trim()) return;
    setIsAddingSpecialty(true);
    try {
      const { data, error } = await supabase
        .from('specialties')
        .insert([{ name: newSpecialtyName.trim() }])
        .select();

      if (error) throw error;
      
      setNewSpecialtyName('');
      await checkAdminAndFetchData(); // Refrescar lista
      
      setModalConfig({
        visible: true,
        title: 'Éxito',
        message: 'Especialidad añadida correctamente.',
        type: 'alert',
        confirmText: 'Aceptar',
        onConfirm: closeModal
      });
    } catch (err: any) {
      handleErrorModal(err, 'Error al añadir especialidad');
    } finally {
      setIsAddingSpecialty(false);
    }
  };

  const handleDeleteSpecialty = async (id: string) => {
    try {
      const { error } = await supabase.from('specialties').delete().eq('id', id);
      if (error) throw error;
      await checkAdminAndFetchData();
    } catch (err: any) {
      handleErrorModal(err, 'No se puede eliminar porque hay médicos asignados a esta especialidad.');
    }
  };

  const handleUpdateSpecialty = async () => {
    if (!editingSpecialtyId || !editingSpecialtyName.trim()) return;
    try {
      const { error } = await supabase.from('specialties').update({ name: editingSpecialtyName.trim() }).eq('id', editingSpecialtyId);
      if (error) throw error;
      setEditingSpecialtyId(null);
      setEditingSpecialtyName('');
      await checkAdminAndFetchData();
    } catch (err: any) {
      handleErrorModal(err, 'Error al actualizar especialidad');
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
        onConfirm: closeModal,
        onCancel: closeModal
      });
      return;
    }
    
    // En lugar de sacarlos de la app, mostrarlo en nuestro propio Modal
    setDocViewerUrl(url);
    setDocViewerVisible(true);
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

  const renderDoctorCard = ({ item }: { item: DoctorItem }) => {
    const name = item.profiles?.full_name || 'Médico Sin Nombre';
    const ci = item.profiles?.identity_card || 'No registrado';
    const email = item.profiles?.email || '—';
    const currentSpecialtyId = selectedSpecialtiesMap[item.id] || item.specialty_id;
    const isPending = !item.is_active && !item.rejection_reason;
    const isRejected = !item.is_active && !!item.rejection_reason;
    const isActive = item.is_active;

    return (
      <View style={styles.doctorCard}>
        <View style={styles.cardHeader}>
          <View style={[
            styles.avatar, 
            { backgroundColor: isActive ? '#ecfdf5' : isPending ? '#eff6ff' : '#fef2f2' }
          ]}>
            <Ionicons 
              name={isActive ? 'shield-checkmark' : isPending ? 'time' : 'close-circle'} 
              size={24} 
              color={isActive ? '#059669' : isPending ? '#2563eb' : '#ef4444'} 
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.doctorName}>{name}</Text>
            <Text style={styles.doctorSub}>CI: {ci} | {email}</Text>
          </View>
          <View style={
            isActive ? styles.activeBadge : isPending ? styles.pendingBadge : styles.rejectedBadge
          }>
            <Text style={
              isActive ? styles.activeBadgeText : isPending ? styles.pendingBadgeText : styles.rejectedBadgeText
            }>
              {isActive ? 'ACTIVO' : isPending ? 'PENDIENTE' : 'RECHAZADO'}
            </Text>
          </View>
        </View>

        {isRejected && (
          <View style={styles.rejectionNoticeBox}>
            <Ionicons name="information-circle" size={18} color="#ef4444" style={{ marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.rejectionNoticeTitle}>Motivo del Rechazo:</Text>
              <Text style={styles.rejectionNoticeText}>{item.rejection_reason}</Text>
            </View>
          </View>
        )}

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
              <Text style={styles.docBtnText}>Ver Documento</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Asignación o Reasignación de Especialidad */}
        <View style={styles.specialtySection}>
          <Text style={styles.infoLabel}>
            {isActive ? 'Especialidad Médica Asignada' : 'Especialidad a Asignar'}
          </Text>
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

        {/* Acciones según el estado del médico */}
        {isPending && (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.rejectBtn}
              onPress={() => openRejectModal(item.id)}
              disabled={processingId === item.id}
              activeOpacity={0.8}
            >
              {processingId === item.id ? (
                <ActivityIndicator color="#ef4444" size="small" />
              ) : (
                <>
                  <Ionicons name="close-circle-outline" size={18} color="#ef4444" />
                  <Text style={styles.rejectBtnText}>Rechazar</Text>
                </>
              )}
            </TouchableOpacity>
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
                  <Text style={styles.approveBtnText}>Aprobar</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {isActive && (
          <TouchableOpacity 
            style={styles.updateBtn}
            onPress={() => handleUpdateDoctorSpecialty(item.id)}
            disabled={processingId === item.id}
            activeOpacity={0.8}
          >
            {processingId === item.id ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <Ionicons name="save-outline" size={20} color="#ffffff" />
                <Text style={styles.updateBtnText}>Guardar Especialidad</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {isRejected && (
          <TouchableOpacity 
            style={styles.reconsiderBtn}
            onPress={() => handleApproveDoctor(item.id)}
            disabled={processingId === item.id}
            activeOpacity={0.8}
          >
            {processingId === item.id ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <Ionicons name="refresh-circle-outline" size={20} color="#ffffff" />
                <Text style={styles.reconsiderBtnText}>Reconsiderar y Habilitar Médico</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const displayedList = currentTab === 'pending' 
    ? pendingDoctors 
    : currentTab === 'active' 
    ? activeDoctors 
    : rejectedDoctors;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#0f172a" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Gestión de Personal Médico</Text>
          <Text style={styles.headerSubtitle}>Administración G.A.M. Cochabamba</Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh} disabled={loading}>
          <Ionicons name="refresh" size={22} color="#64748b" />
        </TouchableOpacity>
      </View>

      {/* Pestañas para Pendientes, Activos y Rechazados */}
      <View style={styles.tabBar}>
        <TouchableOpacity 
          style={[styles.tabBtn, currentTab === 'pending' && styles.tabBtnActive]}
          onPress={() => setCurrentTab('pending')}
          activeOpacity={0.8}
        >
          <Ionicons 
            name="time-outline" 
            size={16} 
            color={currentTab === 'pending' ? '#2563eb' : '#64748b'} 
          />
          <Text style={[styles.tabBtnText, currentTab === 'pending' && styles.tabBtnTextActive]}>
            Pendientes ({pendingDoctors.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tabBtn, currentTab === 'active' && styles.tabBtnActive]}
          onPress={() => setCurrentTab('active')}
          activeOpacity={0.8}
        >
          <Ionicons 
            name="shield-checkmark-outline" 
            size={16} 
            color={currentTab === 'active' ? '#2563eb' : '#64748b'} 
          />
          <Text style={[styles.tabBtnText, currentTab === 'active' && styles.tabBtnTextActive]}>
            Activos ({activeDoctors.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tabBtn, currentTab === 'rejected' && styles.tabBtnActive]}
          onPress={() => setCurrentTab('rejected')}
          activeOpacity={0.8}
        >
          <Ionicons 
            name="close-circle-outline" 
            size={16} 
            color={currentTab === 'rejected' ? '#ef4444' : '#64748b'} 
          />
          <Text style={[
            styles.tabBtnText, 
            currentTab === 'rejected' && [styles.tabBtnTextActive, { color: '#ef4444' }]
          ]}>
            Rechazados ({rejectedDoctors.length})
          </Text>
        </TouchableOpacity>
      </View>

      {displayedList.length === 0 ? (
        <View style={styles.centerContainer}>
          <View style={[
            styles.emptyIconBg,
            currentTab === 'rejected' && { backgroundColor: '#fef2f2' }
          ]}>
            <Ionicons 
              name={currentTab === 'rejected' ? 'checkmark-circle-outline' : 'checkmark-done-circle'} 
              size={50} 
              color={currentTab === 'rejected' ? '#ef4444' : '#10b981'} 
            />
          </View>
          <Text style={styles.emptyTitle}>
            {currentTab === 'pending' 
              ? '¡Todo al Día!' 
              : currentTab === 'active' 
              ? 'Sin Médicos Activos' 
              : 'Sin Solicitudes Rechazadas'}
          </Text>
          <Text style={styles.emptySub}>
            {currentTab === 'pending' 
              ? 'No hay solicitudes de médicos pendientes de aprobación.'
              : currentTab === 'active'
              ? 'Aún no hay médicos habilitados en el sistema.'
              : 'No existen registros de médicos rechazados.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={displayedList}
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
        onConfirm={modalConfig.onConfirm || closeModal}
        onCancel={modalConfig.onCancel || closeModal}
        confirmText={modalConfig.confirmText}
      />

      {/* Modal de rechazo con input de motivo — Bug 2 */}
      {rejectModalVisible && (
        <View style={styles.rejectOverlay}>
          <View style={styles.rejectModal}>
            <View style={styles.rejectModalHeader}>
              <Ionicons name="close-circle" size={32} color="#ef4444" />
              <Text style={styles.rejectModalTitle}>Rechazar Solicitud</Text>
            </View>
            <Text style={styles.rejectModalDesc}>
              Ingresa el motivo del rechazo. Este mensaje será visible para el médico al intentar iniciar sesión.
            </Text>
            <TextInput
              style={styles.rejectInput}
              placeholder="Ej: Documento ilegible, título no válido..."
              placeholderTextColor="#94a3b8"
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
              numberOfLines={3}
              maxLength={300}
            />
            <Text style={styles.rejectCharCount}>{rejectReason.length}/300</Text>
            <View style={styles.rejectBtnRow}>
              <TouchableOpacity
                style={styles.rejectCancelBtn}
                onPress={() => { setRejectModalVisible(false); setRejectReason(''); }}
              >
                <Text style={styles.rejectCancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.rejectConfirmBtn}
                onPress={handleRejectDoctor}
                disabled={!rejectReason.trim()}
              >
                <Ionicons name="close-circle-outline" size={18} color="#ffffff" />
                <Text style={styles.rejectConfirmBtnText}>Confirmar Rechazo</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Modal para visualizar el documento */}
      <Modal
        visible={docViewerVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setDocViewerVisible(false)}
      >
        <View style={styles.viewerModalContainer}>
          <View style={styles.viewerHeader}>
            <Text style={styles.viewerTitle}>Visor de Documentos</Text>
            <TouchableOpacity 
              onPress={() => setDocViewerVisible(false)} 
              style={styles.viewerCloseBtn}
            >
              <Ionicons name="close" size={24} color="#334155" />
            </TouchableOpacity>
          </View>
          <View style={styles.viewerContent}>
            {docViewerUrl && (
              Platform.OS === 'web' ? (
                <iframe src={docViewerUrl} style={{ width: '100%', height: '100%', border: 'none' }} />
              ) : (
                <WebView 
                  source={{ uri: docViewerUrl }} 
                  style={{ flex: 1 }}
                  startInLoadingState={true}
                  renderLoading={() => (
                    <ActivityIndicator 
                      color="#3b82f6" 
                      size="large" 
                      style={{ position: 'absolute', top: '50%', left: '50%', transform: [{ translateX: -18 }, { translateY: -18 }] }} 
                    />
                  )}
                />
              )
            )}
          </View>
        </View>
      </Modal>

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
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    gap: 12,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    gap: 8,
  },
  tabBtnActive: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  tabBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  tabBtnTextActive: {
    color: '#2563eb',
    fontWeight: '800',
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
  activeBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  activeBadgeText: {
    color: '#15803d',
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

  updateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563eb',
    padding: 14,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  updateBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  // Bug 3 — logout en header
  logoutBtn: {
    padding: 8,
    marginLeft: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderRadius: 8,
  },
  // Bug 2 — fila de acciones (rechazar + aprobar)
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  rejectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fef2f2',
    padding: 14,
    borderRadius: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  rejectBtnText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '800',
  },
  approveBtn: {
    flex: 2,
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
  },
  // Modal de rechazo con input
  rejectOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 999,
  },
  rejectModal: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 480,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
  },
  rejectModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  rejectModalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
  },
  rejectModalDesc: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
    marginBottom: 16,
  },
  rejectInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: '#0f172a',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  rejectCharCount: {
    fontSize: 11,
    color: '#94a3b8',
    textAlign: 'right',
    marginTop: 4,
    marginBottom: 16,
  },
  rejectBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  rejectCancelBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
  },
  rejectCancelBtnText: {
    fontWeight: '700',
    color: '#64748b',
    fontSize: 15,
  },
  rejectConfirmBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#ef4444',
  },
  rejectConfirmBtnText: {
    fontWeight: '800',
    color: '#ffffff',
    fontSize: 15,
  },
  // Estilos para médicos rechazados
  rejectedBadge: {
    backgroundColor: '#fef2f2',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  rejectedBadgeText: {
    color: '#dc2626',
    fontSize: 10,
    fontWeight: '800',
  },
  rejectionNoticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#fff1f2',
    borderWidth: 1,
    borderColor: '#fecdd3',
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
  },
  rejectionNoticeTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#e11d48',
    marginBottom: 2,
  },
  rejectionNoticeText: {
    fontSize: 13,
    color: '#9f1239',
    lineHeight: 18,
  },
  reconsiderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#d97706',
    padding: 14,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#d97706',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  reconsiderBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  // Estilos del visor de documentos
  viewerModalContainer: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    marginTop: Platform.OS === 'ios' ? 40 : 0,
  },
  viewerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  viewerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  viewerCloseBtn: {
    padding: 8,
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
  },
  viewerContent: {
    flex: 1,
    backgroundColor: '#e2e8f0',
  },
});

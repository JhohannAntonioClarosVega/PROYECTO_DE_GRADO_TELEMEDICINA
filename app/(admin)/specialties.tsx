import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, SafeAreaView, Platform, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import CustomModal from '@/components/CustomModal';
import { useAdminLoad } from '@/hooks/use-admin-load';

interface Specialty {
  id: string;
  name: string;
}

export default function SpecialtiesScreen() {
  const [loading, setLoading] = useState(true);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [hasSnapshot, setHasSnapshot] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { runLatest, captureLifetime, isMounted } = useAdminLoad();
  const addDraftVersion = useRef(0);
  const editDraftVersion = useRef(0);
  const modalVersion = useRef(0);
  const operations = useRef(new Map<string, symbol>());
  const latestOperation = useRef<symbol | null>(null);

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

  const closeModal = useCallback(() => {
    if (!isMounted()) return;
    modalVersion.current += 1;
    setModalConfig(prev => ({ ...prev, visible: false }));
  }, [isMounted]);

  const showModal = useCallback((config: typeof modalConfig) => {
    const alive = captureLifetime();
    if (!alive()) return;
    const version = ++modalVersion.current;
    const valid = () => alive() && version === modalVersion.current;
    setModalConfig({
      ...config,
      onConfirm: () => { if (valid()) return (config.onConfirm || closeModal)(); },
      onCancel: () => { if (valid()) return (config.onCancel || closeModal)(); },
    });
  }, [captureLifetime, closeModal]);

  const handleErrorModal = useCallback((err: unknown, customTitle: string) => {
    let msg = 'Ocurrió un error inesperado.';
    if (err instanceof Error) msg = err.message;
    else if (typeof err === 'string') msg = err;
    else if (typeof err === 'object' && err !== null && 'message' in err && typeof err.message === 'string') msg = err.message;

    showModal({
      visible: true,
      title: customTitle,
      message: msg,
      type: 'alert',
      confirmText: 'Entendido',
      onConfirm: closeModal,
      onCancel: closeModal
    });
  }, [closeModal, showModal]);

  const fetchSpecialties = useCallback(() => {
    if (!isMounted()) return Promise.resolve(false);
    setLoading(true);
    setLoadError(null);
    return runLatest(async ({ isCurrent, signal }) => {
      const { data, error } = await supabase.from('specialties').select('id, name').order('name').abortSignal(signal);
      if (!isCurrent()) return;
      if (error) throw error;
      setSpecialties(data || []);
      setHasSnapshot(true);
    }, {
      onError: (err: unknown) => {
        setLoadError('No se pudieron actualizar las especialidades. Intenta nuevamente.');
        handleErrorModal(err, 'Error de Carga');
      },
      onSettled: () => setLoading(false),
    });
  }, [runLatest, isMounted, handleErrorModal]);

  useEffect(() => {
    const alive = captureLifetime();
    void Promise.resolve().then(() => { if (alive()) return fetchSpecialties(); });
  }, [fetchSpecialties, captureLifetime]);

  const reloadSpecialties = () => {
    return fetchSpecialties();
  };

  const beginOperation = (key: string) => {
    const alive = captureLifetime();
    if (!alive() || operations.current.has(key)) return null;
    const token = Symbol(key);
    operations.current.set(key, token);
    latestOperation.current = token;
    return {
      alive,
      latest: () => alive() && latestOperation.current === token,
      finish: () => {
        if (operations.current.get(key) === token) operations.current.delete(key);
      },
    };
  };

  const changeNewName = (value: string) => {
    if (!isMounted()) return;
    addDraftVersion.current += 1;
    latestOperation.current = null;
    setNewSpecialtyName(value);
  };

  const startEditing = (item: Specialty) => {
    if (!isMounted()) return;
    editDraftVersion.current += 1;
    latestOperation.current = null;
    setEditingSpecialtyId(item.id);
    setEditingSpecialtyName(item.name);
  };

  const changeEditName = (value: string) => {
    if (!isMounted()) return;
    editDraftVersion.current += 1;
    latestOperation.current = null;
    setEditingSpecialtyName(value);
  };

  const cancelEditing = () => {
    if (!isMounted()) return;
    editDraftVersion.current += 1;
    latestOperation.current = null;
    setEditingSpecialtyId(null);
  };

  const handleAddSpecialty = async () => {
    if (!newSpecialtyName.trim()) return;
    const operation = beginOperation('add');
    if (!operation) return;
    let draftVersion = addDraftVersion.current;
    setIsAddingSpecialty(true);
    try {
      const { error } = await supabase
        .from('specialties')
        .insert([{ name: newSpecialtyName.trim() }]);

      if (error) throw error;
      if (!operation.alive()) return;

      if (addDraftVersion.current === draftVersion) {
        draftVersion = ++addDraftVersion.current;
        setNewSpecialtyName('');
      }
      const refreshed = await reloadSpecialties();
      if (!operation.latest() || addDraftVersion.current !== draftVersion || !refreshed) return;

      showModal({
        visible: true,
        title: 'Éxito',
        message: 'Especialidad añadida correctamente.',
        type: 'alert',
        confirmText: 'Aceptar',
        onConfirm: closeModal,
        onCancel: closeModal
      });
    } catch (err: unknown) {
      if (operation.latest()) handleErrorModal(err, 'Error al añadir especialidad');
      else console.warn('Resultado de una creación anterior pendiente de revisión:', err);
    } finally {
      operation.finish();
      if (operation.alive()) setIsAddingSpecialty(false);
    }
  };

  const confirmDeleteSpecialty = (id: string, name: string) => {
    if (!isMounted()) return;
    latestOperation.current = null;
    showModal({
      visible: true,
      title: 'Eliminar Especialidad',
      message: `¿Estás seguro de que deseas eliminar "${name}"? Esta acción no se puede deshacer.`,
      type: 'confirm',
      confirmText: 'Sí, eliminar',
      onCancel: closeModal,
      onConfirm: async () => {
        const operation = beginOperation('delete:' + id);
        if (!operation) return;
        closeModal();
        try {
          const { error } = await supabase.from('specialties').delete().eq('id', id);
          if (error) throw error;
          if (!operation.alive()) return;
          await reloadSpecialties();
        } catch (err: unknown) {
          if (operation.latest()) handleErrorModal(err, 'No se puede eliminar porque hay médicos asignados a esta especialidad.');
          else console.warn('Resultado de una eliminación anterior pendiente de revisión:', err);
        } finally {
          operation.finish();
        }
      }
    });
  };

  const handleUpdateSpecialty = async () => {
    if (!editingSpecialtyId || !editingSpecialtyName.trim()) return;
    const operation = beginOperation('edit:' + editingSpecialtyId);
    if (!operation) return;
    const draftVersion = editDraftVersion.current;
    try {
      const { error } = await supabase.from('specialties').update({ name: editingSpecialtyName.trim() }).eq('id', editingSpecialtyId);
      if (error) throw error;
      if (!operation.alive()) return;
      if (editDraftVersion.current === draftVersion) {
        editDraftVersion.current += 1;
        setEditingSpecialtyId(null);
        setEditingSpecialtyName('');
      }
      await reloadSpecialties();
    } catch (err: unknown) {
      if (operation.latest()) handleErrorModal(err, 'Error al actualizar especialidad');
      else console.warn('Resultado de una edición anterior pendiente de revisión:', err);
    } finally {
      operation.finish();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <CustomModal
        visible={modalConfig.visible}
        title={modalConfig.title}
        message={modalConfig.message}
        type={modalConfig.type}
        onConfirm={modalConfig.onConfirm || closeModal}
        onCancel={modalConfig.onCancel || closeModal}
        confirmText={modalConfig.confirmText}
      />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#0f172a" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Gestión de Especialidades</Text>
          <Text style={styles.headerSubtitle}>Administración G.A.M. Cochabamba</Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={reloadSpecialties} disabled={loading}>
          <Ionicons name="refresh" size={22} color="#64748b" />
        </TouchableOpacity>
      </View>

      <View style={styles.addSection}>
        <Text style={styles.sectionTitle}>Agregar Nueva Especialidad</Text>
        <View style={styles.addInputRow}>
          <TextInput
            style={styles.input}
            placeholder="Ej: Neurología, Pediatría..."
            placeholderTextColor="#94a3b8"
            value={newSpecialtyName}
            onChangeText={changeNewName}
          />
          <TouchableOpacity
            style={[styles.addBtn, (!newSpecialtyName.trim() || isAddingSpecialty) && { opacity: 0.5 }]}
            onPress={handleAddSpecialty}
            disabled={!newSpecialtyName.trim() || isAddingSpecialty}
          >
            {isAddingSpecialty ? (
               <ActivityIndicator color="#ffffff" size="small" />
            ) : (
               <Ionicons name="add" size={24} color="#ffffff" />
            )}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.listContainer}>
        <Text style={styles.sectionTitle}>Especialidades Registradas</Text>

        {loadError && (
          <View>
            <Text accessibilityRole="alert" style={styles.emptyText}>{loadError}</Text>
            <TouchableOpacity onPress={reloadSpecialties} style={styles.refreshBtn}>
              <Text>Reintentar</Text>
            </TouchableOpacity>
          </View>
        )}

        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#2563eb" />
          </View>
        ) : !hasSnapshot ? null : specialties.length === 0 ? (
          <View style={styles.centerContainer}>
            <Ionicons name="medkit-outline" size={48} color="#cbd5e1" />
            <Text style={styles.emptyText}>No hay especialidades registradas.</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.flatListContent}>
            {specialties.map((item) => (
              <View key={item.id} style={styles.specialtyCard}>
                {editingSpecialtyId === item.id ? (
                  <View style={styles.editRow}>
                    <TextInput
                      style={styles.editInput}
                      value={editingSpecialtyName}
                      onChangeText={changeEditName}
                      autoFocus
                    />
                    <TouchableOpacity onPress={handleUpdateSpecialty} style={styles.iconBtnSave}>
                      <Ionicons name="checkmark" size={20} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={cancelEditing} style={styles.iconBtnCancel}>
                      <Ionicons name="close" size={20} color="#fff" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <>
                    <View style={styles.specialtyInfo}>
                      <Ionicons name="medkit" size={20} color="#4f46e5" style={{ marginRight: 12 }} />
                      <Text style={styles.specialtyName}>{item.name}</Text>
                    </View>
                    <View style={styles.actionsRow}>
                      <TouchableOpacity
                        style={styles.actionBtnEdit}
                        onPress={() => startEditing(item)}
                      >
                        <Ionicons name="pencil" size={18} color="#3b82f6" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.actionBtnDelete}
                        onPress={() => confirmDeleteSpecialty(item.id, item.name)}
                      >
                        <Ionicons name="trash" size={18} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            ))}
          </ScrollView>
        )}
      </View>
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
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '500',
  },
  refreshBtn: {
    padding: 8,
  },
  addSection: {
    backgroundColor: '#ffffff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  addInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#0f172a',
  },
  addBtn: {
    backgroundColor: '#4f46e5',
    width: 48,
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  listContainer: {
    flex: 1,
    padding: 20,
  },
  flatListContent: {
    paddingBottom: 40,
  },
  centerContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    marginTop: 12,
    color: '#64748b',
    fontSize: 15,
  },
  specialtyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  specialtyInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  specialtyName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  actionsRow: {
    flexDirection: 'row',
  },
  actionBtnEdit: {
    padding: 8,
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    marginRight: 8,
  },
  actionBtnDelete: {
    padding: 8,
    backgroundColor: '#fef2f2',
    borderRadius: 8,
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  editInput: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#3b82f6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    color: '#0f172a',
  },
  iconBtnSave: {
    padding: 10,
    backgroundColor: '#10b981',
    borderRadius: 8,
    marginLeft: 8,
  },
  iconBtnCancel: {
    padding: 10,
    backgroundColor: '#94a3b8',
    borderRadius: 8,
    marginLeft: 8,
  }
});

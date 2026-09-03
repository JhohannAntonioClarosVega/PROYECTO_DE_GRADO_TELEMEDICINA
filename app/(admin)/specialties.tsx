import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ScrollView, TextInput, TouchableOpacity, SafeAreaView, Platform, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import CustomModal from '@/components/CustomModal';

interface Specialty {
  id: string;
  name: string;
}

export default function SpecialtiesScreen() {
  const [loading, setLoading] = useState(true);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  
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

  const handleErrorModal = (err: any, customTitle: string) => {
    let msg = 'Ocurrió un error inesperado.';
    if (err instanceof Error) msg = err.message;
    else if (typeof err === 'string') msg = err;
    else if (err?.message) msg = err.message;

    setModalConfig({
      visible: true,
      title: customTitle,
      message: msg,
      type: 'alert',
      confirmText: 'Entendido',
      onConfirm: closeModal,
      onCancel: closeModal
    });
  };

  const fetchSpecialties = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('specialties')
        .select('id, name')
        .order('name');
      
      if (error) throw error;
      setSpecialties(data || []);
    } catch (err: any) {
      handleErrorModal(err, 'Error de Carga');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSpecialties();
  }, []);

  const handleAddSpecialty = async () => {
    if (!newSpecialtyName.trim()) return;
    setIsAddingSpecialty(true);
    try {
      const { error } = await supabase
        .from('specialties')
        .insert([{ name: newSpecialtyName.trim() }]);

      if (error) throw error;
      
      setNewSpecialtyName('');
      await fetchSpecialties();
      
      setModalConfig({
        visible: true,
        title: 'Éxito',
        message: 'Especialidad añadida correctamente.',
        type: 'alert',
        confirmText: 'Aceptar',
        onConfirm: closeModal,
        onCancel: closeModal
      });
    } catch (err: any) {
      handleErrorModal(err, 'Error al añadir especialidad');
    } finally {
      setIsAddingSpecialty(false);
    }
  };

  const confirmDeleteSpecialty = (id: string, name: string) => {
    setModalConfig({
      visible: true,
      title: 'Eliminar Especialidad',
      message: `¿Estás seguro de que deseas eliminar "${name}"? Esta acción no se puede deshacer.`,
      type: 'confirm',
      confirmText: 'Sí, eliminar',
      onCancel: closeModal,
      onConfirm: async () => {
        closeModal();
        try {
          const { error } = await supabase.from('specialties').delete().eq('id', id);
          if (error) throw error;
          await fetchSpecialties();
        } catch (err: any) {
          handleErrorModal(err, 'No se puede eliminar porque hay médicos asignados a esta especialidad.');
        }
      }
    });
  };

  const handleUpdateSpecialty = async () => {
    if (!editingSpecialtyId || !editingSpecialtyName.trim()) return;
    try {
      const { error } = await supabase.from('specialties').update({ name: editingSpecialtyName.trim() }).eq('id', editingSpecialtyId);
      if (error) throw error;
      setEditingSpecialtyId(null);
      setEditingSpecialtyName('');
      await fetchSpecialties();
    } catch (err: any) {
      handleErrorModal(err, 'Error al actualizar especialidad');
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
        <TouchableOpacity style={styles.refreshBtn} onPress={fetchSpecialties} disabled={loading}>
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
            onChangeText={setNewSpecialtyName}
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
        
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#2563eb" />
          </View>
        ) : specialties.length === 0 ? (
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
                      onChangeText={setEditingSpecialtyName} 
                      autoFocus 
                    />
                    <TouchableOpacity onPress={handleUpdateSpecialty} style={styles.iconBtnSave}>
                      <Ionicons name="checkmark" size={20} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setEditingSpecialtyId(null)} style={styles.iconBtnCancel}>
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
                        onPress={() => { setEditingSpecialtyId(item.id); setEditingSpecialtyName(item.name); }}
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

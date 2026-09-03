import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { DrawerContentScrollView, DrawerItemList } from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import CustomModal from '@/components/CustomModal';

export default function CustomDrawer(props: any) {
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [userName, setUserName] = useState('Usuario');
  const [userEmail, setUserEmail] = useState('');
  const [userRole, setUserRole] = useState('Telemedicina GAMC');
  const [roleColor, setRoleColor] = useState('#2563eb');
  const [roleBg, setRoleBg] = useState('#eff6ff');

  useEffect(() => {
    let isMounted = true;

    const loadProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user && isMounted) {
          setUserEmail(user.email || '');
          
          const { data } = await supabase
            .from('profiles')
            .select('full_name, role')
            .eq('id', user.id)
            .maybeSingle();

          if (data && isMounted) {
            if (data.full_name) setUserName(data.full_name);
            
            if (data.role === 'doctor') {
              setUserRole('Médico Especialista');
              setRoleColor('#2563eb');
              setRoleBg('#eff6ff');
            } else if (data.role === 'admin') {
              setUserRole('Administrador GAMC');
              setRoleColor('#4f46e5');
              setRoleBg('#eef2ff');
            } else {
              setUserRole('Paciente');
              setRoleColor('#059669');
              setRoleBg('#ecfdf5');
            }
          }
        }
      } catch (err) {
        console.warn('Error cargando perfil en drawer:', err);
      }
    };

    loadProfile();
    return () => { isMounted = false; };
  }, []);

  const doLogout = async () => {
    setShowLogoutModal(false);
    try {
      await supabase.auth.signOut();
      router.replace('/');
    } catch (err) {
      console.error('Error al cerrar sesión:', err);
    }
  };

  return (
    <View style={styles.container}>
      {/* ScrollView con fondo blanco garantizado */}
      <DrawerContentScrollView 
        {...props} 
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Cabecera de Perfil */}
        <View style={styles.header}>
          <View style={[styles.avatarCircle, { backgroundColor: roleBg, borderColor: roleColor }]}>
            <Ionicons name="person" size={32} color={roleColor} />
          </View>
          
          <Text style={styles.userName} numberOfLines={1}>{userName}</Text>
          
          <View style={[styles.roleBadge, { backgroundColor: roleBg, borderColor: roleColor }]}>
            <Text style={[styles.roleBadgeText, { color: roleColor }]}>{userRole}</Text>
          </View>

          {userEmail ? (
            <Text style={styles.userEmail} numberOfLines={1}>{userEmail}</Text>
          ) : null}
        </View>

        {/* Separador sutil */}
        <View style={styles.divider} />

        {/* Lista de navegación */}
        <View style={styles.drawerList}>
          <DrawerItemList {...props} />
        </View>
      </DrawerContentScrollView>

      {/* Pie con Botón de Cerrar Sesión (Fondo blanco garantizado, sin fondo negro) */}
      <View style={styles.footer}>
        <TouchableOpacity 
          style={styles.logoutBtn} 
          onPress={() => setShowLogoutModal(true)}
          activeOpacity={0.7}
        >
          <View style={styles.logoutIconBox}>
            <Ionicons name="log-out-outline" size={20} color="#ef4444" />
          </View>
          <Text style={styles.logoutText}>Cerrar Sesión</Text>
        </TouchableOpacity>
      </View>

      {/* Modal Personalizado de Confirmación de Cierre de Sesión */}
      <CustomModal
        visible={showLogoutModal}
        title="Cerrar Sesión"
        message="¿Estás seguro de que deseas salir del sistema de Telemedicina?"
        type="confirm"
        confirmText="Sí, salir"
        cancelText="Cancelar"
        onConfirm={doLogout}
        onCancel={() => setShowLogoutModal(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff', // Elimina totalmente cualquier fondo negro
  },
  scrollContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollContent: {
    flexGrow: 1,
    backgroundColor: '#ffffff',
    paddingTop: 10,
    paddingBottom: 20,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 18,
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  avatarCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    marginBottom: 10,
  },
  userName: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 4,
  },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 4,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  userEmail: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginHorizontal: 16,
    marginVertical: 6,
  },
  drawerList: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingTop: 6,
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    backgroundColor: '#ffffff',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#fef2f2',
  },
  logoutIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ef4444',
  },
});

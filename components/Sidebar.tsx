import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { supabase } from '@/lib/supabase';
import CustomModal from '@/components/CustomModal';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const menuItems: { icon: IconName; label: string; route: string }[] = [
  { icon: 'grid-outline', label: 'Dashboard', route: '/dashboard' },
  { icon: 'medkit-outline', label: 'Consultas Activas', route: '/consultas' },
  { icon: 'clipboard-outline', label: 'Mis Consultas', route: '/historial' },
  { icon: 'people-outline', label: 'Pacientes', route: '/pacientes' },
  { icon: 'settings-outline', label: 'Ajustes', route: '/ajustes' }
];

export default function Sidebar() {
  const pathname = usePathname();
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [doctorName, setDoctorName] = useState('Dr.');

  useEffect(() => {
    const fetchDoctorName = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', user.id)
            .single();
          if (data?.full_name) setDoctorName(data.full_name);
        }
      } catch (e) {}
    };
    fetchDoctorName();
  }, []);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      setLogoutModalVisible(false);
      router.replace('/');
    } catch (error) {
      console.error('Error cerrando sesión:', error);
      setLogoutModalVisible(false);
      router.replace('/');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Telemedicina IA</Text>
      </View>
      
      <View style={styles.nav}>
        {menuItems.map((item, index) => {
          const isActive = pathname === item.route;
          return (
            <TouchableOpacity 
              key={index} 
              style={[styles.menuItem, isActive && styles.menuItemActive]} 
              activeOpacity={0.7}
              onPress={() => router.push(item.route as any)}
            >
              <Ionicons 
                name={item.icon} 
                size={22} 
                color={isActive ? '#ffffff' : '#94a3b8'} 
                style={styles.icon} 
              />
              <Text style={[styles.label, isActive && styles.labelActive]}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.footer}>
        <View>
          <Text style={styles.footerText}>{doctorName}</Text>
          <Text style={styles.roleText}>Médico de Guardia</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={() => setLogoutModalVisible(true)} activeOpacity={0.7}>
          <Ionicons name="log-out-outline" size={20} color="#ef4444" />
        </TouchableOpacity>
      </View>

      <CustomModal
        visible={logoutModalVisible}
        title="Cerrar Sesión"
        message="¿Estás seguro de que deseas salir del sistema médico?"
        type="confirm"
        onConfirm={handleLogout}
        onCancel={() => setLogoutModalVisible(false)}
        confirmText="Salir"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 256, // Equivalente a w-64
    height: '100%',
    backgroundColor: '#0f172a', // bg-slate-900
    padding: 16,
    flexDirection: 'column',
    borderRightWidth: 1,
    borderRightColor: '#1e293b',
  },
  header: {
    marginBottom: 32,
    borderBottomWidth: 1,
    borderBottomColor: '#334155', // border-slate-700
    paddingBottom: 16,
    paddingTop: Platform.OS === 'android' ? 30 : 10,
  },
  headerText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  nav: {
    flex: 1,
    gap: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 10,
  },
  menuItemActive: {
    backgroundColor: '#1e293b', // hover:bg-slate-800
  },
  icon: {
    marginRight: 14,
  },
  label: {
    color: '#94a3b8',
    fontSize: 16,
    fontWeight: '500',
  },
  labelActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  footer: {
    marginTop: 'auto',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#334155',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#e2e8f0',
    fontWeight: '600',
  },
  roleText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  logoutBtn: {
    padding: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 8,
  }
});

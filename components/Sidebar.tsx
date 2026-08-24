import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { supabase } from '@/lib/supabase';
import CustomModal from '@/components/CustomModal';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export default function Sidebar() {
  const pathname = usePathname();
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [doctorName, setDoctorName] = useState('Usuario');
  const [userRole, setUserRole] = useState<string>('doctor');
  const [isOnline, setIsOnline] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setUserId(user.id);
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, role')
            .eq('id', user.id)
            .single();

          if (profile?.full_name) setDoctorName(profile.full_name);
          if (profile?.role) setUserRole(profile.role);

          // Si es médico, consultar su estado is_online
          if (profile?.role === 'doctor') {
            const { data: doctor } = await supabase
              .from('doctors')
              .select('is_online')
              .eq('id', user.id)
              .maybeSingle();

            if (doctor) {
              setIsOnline(!!doctor.is_online);
            }
          }
        }
      } catch (e) {
        console.warn('Error al cargar información del usuario en Sidebar:', e);
      }
    };
    fetchUserData();
  }, []);

  const toggleAvailability = async (value: boolean) => {
    if (!userId || updatingStatus) return;
    setIsOnline(value);
    setUpdatingStatus(true);
    try {
      const { error } = await supabase
        .from('doctors')
        .update({ is_online: value })
        .eq('id', userId);

      if (error) {
        console.error('Error al actualizar disponibilidad:', error);
        setIsOnline(!value); // Revertir en caso de fallo
      }
    } catch (err) {
      console.error('Exception al actualizar disponibilidad:', err);
      setIsOnline(!value);
    } finally {
      setUpdatingStatus(false);
    }
  };

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

  // Construir elementos del menú dinámicamente según el rol
  const menuItems: { icon: IconName; label: string; route: string }[] = [
    { icon: 'grid-outline', label: 'Dashboard', route: '/dashboard' },
    { icon: 'medkit-outline', label: 'Consultas Activas', route: '/consultas' },
    { icon: 'clipboard-outline', label: 'Mis Consultas', route: '/historial' },
    { icon: 'person-outline', label: 'Mi Perfil', route: '/profile' },
  ];

  if (userRole === 'admin') {
    menuItems.push({ icon: 'checkmark-done-circle-outline', label: 'Aprobar Médicos', route: '/admin-dashboard' });
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Telemedicina IA</Text>
        <Text style={styles.headerSubtitle}>G.A.M. Cochabamba</Text>
      </View>
      
      {/* Control de Disponibilidad Médica (RF8) */}
      {userRole === 'doctor' && (
        <View style={styles.availabilityCard}>
          <View style={styles.availabilityStatusRow}>
            <View style={[styles.statusDot, { backgroundColor: isOnline ? '#10b981' : '#64748b' }]} />
            <Text style={styles.availabilityText}>
              {isOnline ? 'En línea / Disponible' : 'Ocupado / Inactivo'}
            </Text>
          </View>
          <Switch
            trackColor={{ false: '#334155', true: '#10b981' }}
            thumbColor={isOnline ? '#ffffff' : '#94a3b8'}
            ios_backgroundColor="#334155"
            onValueChange={toggleAvailability}
            value={isOnline}
            disabled={updatingStatus}
          />
        </View>
      )}

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
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={styles.footerText} numberOfLines={1}>{doctorName}</Text>
          <Text style={styles.roleText}>{userRole === 'admin' ? 'Administrador' : 'Médico de Guardia'}</Text>
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
    width: 256,
    height: '100%',
    backgroundColor: '#0f172a',
    padding: 16,
    flexDirection: 'column',
    borderRightWidth: 1,
    borderRightColor: '#1e293b',
  },
  header: {
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    paddingBottom: 12,
    paddingTop: Platform.OS === 'android' ? 30 : 10,
  },
  headerText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#3b82f6',
    fontWeight: '600',
    marginTop: 2,
  },
  availabilityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1e293b',
    padding: 10,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  availabilityStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  availabilityText: {
    color: '#e2e8f0',
    fontSize: 12,
    fontWeight: '700',
  },
  nav: {
    flex: 1,
    gap: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
  },
  menuItemActive: {
    backgroundColor: '#1e293b',
  },
  icon: {
    marginRight: 12,
  },
  label: {
    color: '#94a3b8',
    fontSize: 15,
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
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  logoutBtn: {
    padding: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 8,
  }
});


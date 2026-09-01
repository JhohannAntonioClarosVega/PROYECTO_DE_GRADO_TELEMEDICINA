import { Slot, router, usePathname } from 'expo-router';
import { View, StyleSheet, useWindowDimensions, Platform, TouchableOpacity, Text, SafeAreaView, Alert } from 'react-native';
import Sidebar from '@/components/Sidebar';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import CustomModal from '@/components/CustomModal';
import { useState, useEffect } from 'react';

export default function DashboardLayout() {
  const { width } = useWindowDimensions();
  const pathname = usePathname();
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [userRole, setUserRole] = useState<string>('doctor');

  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();
          if (profile?.role) {
            setUserRole(profile.role);
          }
        }
      } catch (err) {
        console.warn('Error cargando rol en DashboardLayout:', err);
      }
    };
    fetchUserRole();
  }, []);

  // Si la pantalla es ancha (Web, Tablet), mostramos el Sidebar.
  const isLargeScreen = width >= 768;

  const mobileNavItems = [
    { icon: 'grid', outlineIcon: 'grid-outline', label: 'Inicio', route: '/dashboard' },
    { icon: 'medkit', outlineIcon: 'medkit-outline', label: 'Consultas', route: '/consultas' },
    { icon: 'clipboard', outlineIcon: 'clipboard-outline', label: 'Historial', route: '/historial' },
    ...(userRole === 'admin'
      ? [{ icon: 'shield-checkmark', outlineIcon: 'shield-checkmark-outline', label: 'Admin', route: '/admin-dashboard' }]
      : [{ icon: 'settings', outlineIcon: 'settings-outline', label: 'Ajustes', route: '/ajustes' }]),
  ];

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
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Sidebar para pantallas grandes (Tablets / Web) */}
        {isLargeScreen && (
          <View style={styles.sidebarContainer}>
            <Sidebar />
          </View>
        )}
        
        {/* Contenido Principal */}
        <View style={styles.mainContent}>
          {!isLargeScreen && (
            <TouchableOpacity style={styles.mobileLogoutBtn} onPress={() => setLogoutModalVisible(true)} activeOpacity={0.8}>
              <Ionicons name="log-out-outline" size={22} color="#ef4444" />
            </TouchableOpacity>
          )}
          <Slot />
        </View>

        {/* Barra de Navegación Inferior SOLO para Celulares */}
        {!isLargeScreen && (
          <View style={styles.bottomNav}>
            {mobileNavItems.map((item, index) => {
              const isActive = pathname === item.route;
              return (
                <TouchableOpacity 
                  key={index} 
                  style={styles.bottomNavItem}
                  onPress={() => router.push(item.route as any)}
                  activeOpacity={0.7}
                >
                  <Ionicons 
                    name={(isActive ? item.icon : item.outlineIcon) as any} 
                    size={24} 
                    color={isActive ? '#2563eb' : '#64748b'} 
                  />
                  <Text style={[styles.bottomNavText, isActive && styles.bottomNavTextActive]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0f172a', // Color de fondo detrás del notch (iOS)
  },
  container: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
  },
  sidebarContainer: {
    width: 256,
  },
  mainContent: {
    flex: 1,
    shadowColor: '#000',
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 5,
  },
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingBottom: Platform.OS === 'ios' ? 24 : 12, // Margen para el Home Indicator de iPhone
    paddingTop: 12,
    justifyContent: 'space-around',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 10,
  },
  bottomNavItem: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 64,
  },
  bottomNavText: {
    fontSize: 11,
    marginTop: 4,
    color: '#64748b',
    fontWeight: '500',
  },
  bottomNavTextActive: {
    color: '#2563eb',
    fontWeight: '700',
  },
  mobileLogoutBtn: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 40 : 20,
    right: 20,
    zIndex: 50,
    backgroundColor: '#fef2f2',
    padding: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#fecaca',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
  }
});

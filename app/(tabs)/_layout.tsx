import { Slot, router, usePathname } from 'expo-router';
import { View, StyleSheet, useWindowDimensions, Platform, TouchableOpacity, Text, SafeAreaView } from 'react-native';
import Sidebar from '@/components/Sidebar';
import { Ionicons } from '@expo/vector-icons';

export default function DashboardLayout() {
  const { width } = useWindowDimensions();
  const pathname = usePathname();
  
  // Si la pantalla es ancha (Web, Tablet), mostramos el Sidebar.
  const isLargeScreen = width >= 768;

  const mobileNavItems = [
    { icon: 'grid', outlineIcon: 'grid-outline', label: 'Inicio', route: '/dashboard' },
    { icon: 'medkit', outlineIcon: 'medkit-outline', label: 'Consultas', route: '/consultas' },
    { icon: 'people', outlineIcon: 'people-outline', label: 'Pacientes', route: '/pacientes' },
    { icon: 'settings', outlineIcon: 'settings-outline', label: 'Ajustes', route: '/ajustes' },
  ];

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
  }
});

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const menuItems: { icon: IconName; label: string; route: string }[] = [
  { icon: 'grid-outline', label: 'Dashboard', route: '/dashboard' },
  { icon: 'medkit-outline', label: 'Consultas Activas', route: '/consultas' },
  { icon: 'clipboard-outline', label: 'Historial Triaje', route: '/historial' },
  { icon: 'people-outline', label: 'Pacientes', route: '/pacientes' },
  { icon: 'settings-outline', label: 'Ajustes', route: '/ajustes' }
];

export default function Sidebar() {
  const pathname = usePathname();

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
        <Text style={styles.footerText}>Dr. Jhohann Claros</Text>
        <Text style={styles.roleText}>Médico de Guardia</Text>
      </View>
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
  }
});

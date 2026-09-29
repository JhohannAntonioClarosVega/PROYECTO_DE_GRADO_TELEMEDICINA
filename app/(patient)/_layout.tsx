import { Drawer } from 'expo-router/drawer';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useWindowDimensions, Platform } from 'react-native';
import CustomDrawer from '@/components/CustomDrawer';
import { usePathname } from 'expo-router';

export default function PatientLayout() {
  const { width } = useWindowDimensions();
  const pathname = usePathname();
  // Desktop breakpoint
  const isDesktop = width >= 768;

  if (isDesktop) {
    // Desktop: Sidebar limpio y minimalista
    return (
      <Drawer
        drawerContent={(props) => <CustomDrawer {...props} />}
        screenOptions={{
          drawerType: 'permanent',
          drawerStyle: {
            width: 280,
            backgroundColor: '#ffffff',
            borderRightWidth: 1,
            borderRightColor: '#f1f5f9',
          },
          headerShown: false,
          drawerActiveBackgroundColor: '#ecfdf5',
          drawerActiveTintColor: '#059669',
          drawerInactiveTintColor: '#64748b',
          drawerLabelStyle: { fontSize: 15, fontWeight: '600' },
          drawerItemStyle: { borderRadius: 12, marginHorizontal: 16, marginVertical: 4 },
        }}
      >
        <Drawer.Screen name="menu" options={{ title: 'Inicio', drawerIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} /> }} />
        <Drawer.Screen name="chatbot" options={{ title: 'Triaje IA', drawerIcon: ({ color, size }) => <Ionicons name="hardware-chip" size={size} color={color} /> }} />
        <Drawer.Screen name="waiting-room" options={{ title: 'Sala de Espera', drawerIcon: ({ color, size }) => <Ionicons name="time" size={size} color={color} /> }} />
        <Drawer.Screen name="history" options={{ title: 'Mi Historial', drawerIcon: ({ color, size }) => <Ionicons name="document-text" size={size} color={color} /> }} />
        <Drawer.Screen name="profile" options={{ title: 'Mi Perfil', drawerIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} /> }} />
        <Drawer.Screen name="payment" options={{ drawerItemStyle: { display: 'none' }, headerShown: false }} />
      </Drawer>
    );
  }

  // Mobile: Bottom Tabs con glassmorphism simulado
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          position: 'absolute',
          borderTopWidth: 0,
          elevation: 0,
          height: Platform.OS === 'ios' ? 88 : 68,
          paddingBottom: Platform.OS === 'ios' ? 28 : 12,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.05,
          shadowRadius: 12,
        },
        tabBarActiveTintColor: '#059669', // Verde salud
        tabBarInactiveTintColor: '#94a3b8',
        tabBarLabelStyle: { fontSize: 12, fontWeight: '500' }
      }}
    >
      <Tabs.Screen name="menu" options={{ title: 'Inicio', tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} /> }} />
      <Tabs.Screen name="chatbot" options={{ title: 'Triaje', tabBarStyle: { display: 'none' }, tabBarIcon: ({ color, size }) => <Ionicons name="hardware-chip" size={size} color={color} /> }} />
      <Tabs.Screen name="waiting-room" options={{ title: 'Espera', tabBarIcon: ({ color, size }) => <Ionicons name="time" size={size} color={color} /> }} />
      <Tabs.Screen name="history" options={{ title: 'Historial', tabBarIcon: ({ color, size }) => <Ionicons name="document-text" size={size} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Perfil', tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} /> }} />
      <Tabs.Screen name="payment" options={{ href: null, headerShown: false }} />
    </Tabs>
  );
}

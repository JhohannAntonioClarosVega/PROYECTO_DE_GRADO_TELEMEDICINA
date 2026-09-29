import { Drawer } from 'expo-router/drawer';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useWindowDimensions, Platform } from 'react-native';
import CustomDrawer from '@/components/CustomDrawer';
import { usePathname } from 'expo-router';

export default function DoctorLayout() {
  const { width } = useWindowDimensions();
  const pathname = usePathname();
  const isVideoCall = pathname === '/videocall';
  // Desktop breakpoint
  const isDesktop = width >= 768 && !isVideoCall;

  if (isVideoCall) {
    // Modo inmersivo para videollamada: Sin menús
    return (
      <Tabs screenOptions={{ headerShown: false, tabBarStyle: { display: 'none' } }}>
        <Tabs.Screen name="videocall" />
      </Tabs>
    );
  }

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
          drawerActiveBackgroundColor: '#f0fdf4',
          drawerActiveTintColor: '#16a34a',
          drawerInactiveTintColor: '#64748b',
          drawerLabelStyle: { fontSize: 15, fontWeight: '600' },
          drawerItemStyle: { borderRadius: 12, marginHorizontal: 16, marginVertical: 4 },
        }}
      >
        <Drawer.Screen name="dashboard" options={{ title: 'Pacientes', drawerIcon: ({ color, size }) => <Ionicons name="people" size={size} color={color} /> }} />
        <Drawer.Screen name="history" options={{ title: 'Historial', drawerIcon: ({ color, size }) => <Ionicons name="folder" size={size} color={color} /> }} />
        <Drawer.Screen name="patient-records" options={{ title: 'Expedientes', drawerIcon: ({ color, size }) => <Ionicons name="medical" size={size} color={color} /> }} />
        <Drawer.Screen name="profile" options={{ title: 'Perfil', drawerIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} /> }} />
        <Drawer.Screen name="videocall" options={{ drawerItemStyle: { display: 'none' }, headerShown: false }} />
        <Drawer.Screen name="medical-record" options={{ drawerItemStyle: { display: 'none' }, headerShown: false }} />
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
        tabBarActiveTintColor: '#0066CC', // Azul Apple
        tabBarInactiveTintColor: '#94a3b8',
        tabBarLabelStyle: { fontSize: 12, fontWeight: '500' }
      }}
    >
      <Tabs.Screen name="dashboard" options={{ title: 'Pacientes', tabBarIcon: ({ color, size }) => <Ionicons name="people" size={size} color={color} /> }} />
      <Tabs.Screen name="history" options={{ title: 'Historial', tabBarIcon: ({ color, size }) => <Ionicons name="folder" size={size} color={color} /> }} />
      <Tabs.Screen name="patient-records" options={{ title: 'Expedientes', tabBarIcon: ({ color, size }) => <Ionicons name="medical" size={size} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Perfil', tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} /> }} />
      <Tabs.Screen name="videocall" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="medical-record" options={{ href: null, headerShown: false }} />
    </Tabs>
  );
}

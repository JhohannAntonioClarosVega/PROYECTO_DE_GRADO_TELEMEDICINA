import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Drawer } from 'expo-router/drawer';
import { Ionicons } from '@expo/vector-icons';
import { useWindowDimensions } from 'react-native';
import CustomDrawer from '@/components/CustomDrawer';

export default function AdminLayout() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 960;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Drawer
        drawerContent={(props) => <CustomDrawer {...props} />}
        screenOptions={{
          drawerType: isDesktop ? 'permanent' : 'front',
          drawerStyle: {
            width: isDesktop ? 270 : 290,
            backgroundColor: '#ffffff',
            borderRightWidth: 1,
            borderRightColor: '#e2e8f0',
          },
          overlayColor: isDesktop ? 'transparent' : 'rgba(15, 23, 42, 0.5)',
          headerLeft: isDesktop ? () => null : undefined,
          drawerActiveBackgroundColor: '#f1f5f9',
          drawerActiveTintColor: '#0f172a',
          drawerInactiveTintColor: '#334155',
          headerStyle: { backgroundColor: '#0f172a' },
          headerTintColor: '#ffffff',
          drawerLabelStyle: { fontSize: 14, fontWeight: '700' },
          drawerItemStyle: { borderRadius: 12, marginHorizontal: 10, marginVertical: 3 },
        }}
      >
        <Drawer.Screen
          name="dashboard"
          options={{
            drawerLabel: 'Gestión de Personal',
            title: 'Panel de Administración',
            drawerIcon: ({ color, size }) => <Ionicons name="shield-checkmark" size={size} color={color} />,
          }}
        />
        <Drawer.Screen
          name="specialties"
          options={{
            drawerLabel: 'Especialidades',
            title: 'Gestión de Especialidades',
            drawerIcon: ({ color, size }) => <Ionicons name="medkit" size={size} color={color} />,
          }}
        />
        <Drawer.Screen
          name="reports"
          options={{
            drawerLabel: 'Reportes y Finanzas',
            title: 'Análisis Estadístico',
            drawerIcon: ({ color, size }) => <Ionicons name="stats-chart" size={size} color={color} />,
          }}
        />
      </Drawer>
    </GestureHandlerRootView>
  );
}

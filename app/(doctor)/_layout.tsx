import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Drawer } from 'expo-router/drawer';
import { Ionicons } from '@expo/vector-icons';
import { useWindowDimensions } from 'react-native';
import CustomDrawer from '@/components/CustomDrawer';

export default function DoctorLayout() {
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
          drawerActiveBackgroundColor: '#eff6ff',
          drawerActiveTintColor: '#2563eb',
          drawerInactiveTintColor: '#334155',
          headerStyle: { backgroundColor: '#2563eb' },
          headerTintColor: '#ffffff',
          drawerLabelStyle: { fontSize: 14, fontWeight: '700' },
          drawerItemStyle: { borderRadius: 12, marginHorizontal: 10, marginVertical: 3 },
        }}
      >
        <Drawer.Screen
          name="dashboard"
          options={{
            drawerLabel: 'Cola de Pacientes',
            title: 'Pacientes en Espera',
            drawerIcon: ({ color, size }) => <Ionicons name="people-circle" size={size} color={color} />,
          }}
        />
        <Drawer.Screen
          name="history"
          options={{
            drawerLabel: 'Mis Atenciones',
            title: 'Historial de Consultas',
            drawerIcon: ({ color, size }) => <Ionicons name="folder-open" size={size} color={color} />,
          }}
        />
        <Drawer.Screen
          name="patient-records"
          options={{
            drawerLabel: 'Expedientes Clínicos',
            title: 'Expedientes de Pacientes',
            drawerIcon: ({ color, size }) => <Ionicons name="medical" size={size} color={color} />,
          }}
        />
        <Drawer.Screen
          name="profile"
          options={{
            drawerLabel: 'Mi Perfil Médico',
            title: 'Mi Perfil',
            drawerIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
          }}
        />
        <Drawer.Screen
          name="videocall"
          options={{
            drawerItemStyle: { display: 'none' }, // Oculto del menú, se accede desde el dashboard
            title: 'Sala de Consultas',
            headerShown: false,
          }}
        />
        <Drawer.Screen
          name="medical-record"
          options={{
            drawerItemStyle: { display: 'none' }, // Oculto del menú, se accede desde la consulta
            title: 'Ficha Clínica',
          }}
        />
      </Drawer>
    </GestureHandlerRootView>
  );
}

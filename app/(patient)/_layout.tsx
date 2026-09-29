import { Drawer } from 'expo-router/drawer';
import { Ionicons } from '@expo/vector-icons';
import { useWindowDimensions } from 'react-native';
import CustomDrawer from '@/components/CustomDrawer';

export default function PatientLayout() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 960;

  return (
    <Drawer
      drawerContent={(props: any) => <CustomDrawer {...props} />}
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
          drawerActiveBackgroundColor: '#ecfdf5',
          drawerActiveTintColor: '#059669',
          drawerInactiveTintColor: '#334155',
          headerStyle: { backgroundColor: '#059669' },
          headerTintColor: '#ffffff',
          drawerLabelStyle: { fontSize: 14, fontWeight: '700' },
          drawerItemStyle: { borderRadius: 12, marginHorizontal: 10, marginVertical: 3 },
        }}
      >
        <Drawer.Screen
          name="menu"
          options={{
            drawerLabel: 'Inicio',
            title: 'Menú de Paciente',
            drawerIcon: ({ color, size }: any) => <Ionicons name="home" size={size} color={color} />,
          }}
        />
        <Drawer.Screen
          name="chatbot"
          options={{
            drawerLabel: 'Triaje Inteligente (IA)',
            title: 'Triaje Inteligente',
            drawerIcon: ({ color, size }: any) => <Ionicons name="hardware-chip" size={size} color={color} />,
          }}
        />
        <Drawer.Screen
          name="waiting-room"
          options={{
            drawerLabel: 'Sala de Espera Virtual',
            title: 'Sala de Espera',
            drawerIcon: ({ color, size }: any) => <Ionicons name="time" size={size} color={color} />,
          }}
        />
        <Drawer.Screen
          name="history"
          options={{
            drawerLabel: 'Mi Historial Clínico',
            title: 'Historial Clínico',
            drawerIcon: ({ color, size }: any) => <Ionicons name="document-text" size={size} color={color} />,
          }}
        />
        <Drawer.Screen
          name="profile"
          options={{
            drawerLabel: 'Mi Perfil',
            title: 'Mi Perfil',
            drawerIcon: ({ color, size }: any) => <Ionicons name="person" size={size} color={color} />,
          }}
        />
        {/* Ocultar pantalla de pago del menú lateral */}
        <Drawer.Screen
          name="payment"
          options={{
            drawerItemStyle: { display: 'none' },
            title: 'Confirmación de Consulta',
          }}
        />
      </Drawer>
  );
}

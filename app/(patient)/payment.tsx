import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';

export default function PaymentScreen() {
  const { triageId } = useLocalSearchParams();
  const [loading, setLoading] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  // Precio simulado de la consulta
  const consultationPrice = '50.00 Bs';

  const handleSimulatePayment = async () => {
    setLoading(true);
    
    // Simular el tiempo que toma el Webhook del banco en validar la transacción
    setTimeout(async () => {
      
      try {
        // En un caso real, un webhook actualizaría la BD. Aquí lo simulamos:
        if (triageId) {
           // Cambiar el estado del triaje para que entre formalmente a la cola
           await supabase
             .from('triages')
             .update({ status: 'waiting' })
             .eq('id', triageId);
        }
      } catch (err) {
        console.error("Error updating triage status mock:", err);
      }

      setLoading(false);
      setPaymentSuccess(true);
      
      // Redirigir automáticamente a la sala de espera después del éxito
      setTimeout(() => {
        router.replace({
          pathname: '/(patient)/waiting-room' as any,
          params: { triageId }
        });
      }, 2000);
      
    }, 2500);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#64748b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pago de Consulta</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        {paymentSuccess ? (
          <View style={styles.successContainer}>
            <View style={styles.successIconCircle}>
              <Ionicons name="checkmark" size={60} color="#ffffff" />
            </View>
            <Text style={styles.successTitle}>¡Pago Exitoso!</Text>
            <Text style={styles.successDesc}>
              Tu transferencia ha sido validada. Te estamos redirigiendo a la sala de espera virtual.
            </Text>
            <ActivityIndicator size="large" color="#10b981" style={{ marginTop: 20 }} />
          </View>
        ) : (
          <>
            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>Monto a pagar</Text>
              <Text style={styles.priceValue}>{consultationPrice}</Text>
              <View style={styles.divider} />
              <Text style={styles.infoDesc}>
                Escanea el código QR desde la aplicación de tu banco para proceder con la atención médica.
              </Text>
            </View>

            <View style={styles.qrContainer}>
              <View style={styles.qrPlaceholder}>
                <Ionicons name="qr-code-outline" size={150} color="#334155" />
                <View style={styles.qrScannerLine} />
              </View>
              <Text style={styles.qrHelpText}>Código QR Dinámico Generado</Text>
            </View>

            <View style={styles.actions}>
              <TouchableOpacity 
                style={[styles.payBtn, loading && styles.payBtnDisabled]} 
                onPress={handleSimulatePayment}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <>
                    <Ionicons name="wallet-outline" size={20} color="#ffffff" style={{ marginRight: 8 }} />
                    <Text style={styles.payBtnText}>Simular Pago Realizado</Text>
                  </>
                )}
              </TouchableOpacity>
              <Text style={styles.mockNotice}>
                (Esta es una simulación de Pasarela Bancaria para la defensa del proyecto)
              </Text>
            </View>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  backBtn: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  content: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
  },
  infoCard: {
    backgroundColor: '#ffffff',
    width: '100%',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    marginBottom: 30,
  },
  infoLabel: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
    marginBottom: 4,
  },
  priceValue: {
    fontSize: 36,
    fontWeight: '800',
    color: '#3b82f6',
  },
  divider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    width: '100%',
    marginVertical: 15,
  },
  infoDesc: {
    textAlign: 'center',
    color: '#475569',
    fontSize: 14,
    lineHeight: 20,
  },
  qrContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  qrPlaceholder: {
    width: 200,
    height: 200,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
    position: 'relative',
    overflow: 'hidden',
  },
  qrScannerLine: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#ef4444',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  qrHelpText: {
    marginTop: 12,
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '500',
  },
  actions: {
    width: '100%',
    alignItems: 'center',
    marginTop: 'auto',
  },
  payBtn: {
    backgroundColor: '#10b981',
    flexDirection: 'row',
    width: '100%',
    padding: 16,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  payBtnDisabled: {
    backgroundColor: '#6ee7b7',
    shadowOpacity: 0.1,
  },
  payBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  mockNotice: {
    marginTop: 12,
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  successIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 12,
  },
  successDesc: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
  }
});

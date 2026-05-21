import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'
import { Platform } from 'react-native'

// Polyfill básico para evitar el error de Supabase en SSR (Node.js 20) al renderizar para Web
if (Platform.OS === 'web' && typeof window === 'undefined') {
  if (typeof global.WebSocket === 'undefined') {
    ;(global as any).WebSocket = class WebSocket {
      constructor() {}
      send() {}
      close() {}
    }
  }
}

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!

// Memoria temporal en caso de que AsyncStorage falle en nativo
const memoryStorage: Record<string, string> = {};

// Adaptador personalizado robusto para evitar caídas si el módulo nativo falla
const CustomStorageAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
      return null;
    }
    try {
      return await AsyncStorage.getItem(key);
    } catch (e) {
      console.warn('AsyncStorage no está disponible o el módulo nativo es nulo. Usando memoria temporal:', e);
      return memoryStorage[key] || null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
      return;
    }
    try {
      await AsyncStorage.setItem(key, value);
    } catch (e) {
      console.warn('AsyncStorage no está disponible o el módulo nativo es nulo. Guardando en memoria temporal:', e);
      memoryStorage[key] = value;
    }
  },
  removeItem: async (key: string): Promise<void> => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
      return;
    }
    try {
      await AsyncStorage.removeItem(key);
    } catch (e) {
      console.warn('AsyncStorage no está disponible o el módulo nativo es nulo. Borrando de memoria temporal:', e);
      delete memoryStorage[key];
    }
  },
};


export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: CustomStorageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})

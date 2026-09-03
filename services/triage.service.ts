import { supabase } from '../lib/supabase';

export interface TriageInsert {
  patient_id: string;
  reported_symptoms: string;
  ai_raw_analysis: string;
  urgency_level: 'Critical' | 'Medium' | 'Low';
  ai_recommendation: string;
  detected_language: string;
  recommended_specialty?: string;
}

export const triageService = {
  /**
   * 1. Crear un nuevo triaje
   * Esta función la usará el Chatbot cuando el paciente termine de escribir sus síntomas.
   */
  async createTriage(data: TriageInsert) {
    const { data: result, error } = await supabase
      .from('triages')
      .insert([data])
      .select()
      .single();

    if (error) {
      console.error('Error guardando en Supabase:', error);
      throw error;
    }
    
    return result;
  },

  /**
   * 2. Obtener los triajes para el Dashboard del Médico
   * Trae los triajes y hace un "Join" automático con la tabla patients y profiles
   * para obtener el nombre del paciente.
   */
  async getActiveTriages() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const { data, error } = await supabase
      .from('triages')
      .select(`
        *,
        patients (
          id,
          blood_type,
          allergies,
          profiles (
            full_name,
            identity_card
          )
        )
      `)
      .gte('created_at', yesterday.toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error obteniendo triajes:', error);
      throw error;
    }
    
    return data;
  }
};

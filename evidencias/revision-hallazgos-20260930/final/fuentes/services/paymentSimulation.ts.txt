import { supabase } from '../lib/supabase';
// Paso de la simulación existente; no valida transacciones bancarias.
export async function markSimulatedPaymentWaiting(triageId: string | string[] | undefined) {
  if (typeof triageId !== 'string' || !triageId.trim()) {
    throw new Error('Identificador de triaje requerido');
  }
  const { error } = await supabase.from('triages').update({ status: 'waiting' }).eq('id', triageId);
  if (error) throw error;
}

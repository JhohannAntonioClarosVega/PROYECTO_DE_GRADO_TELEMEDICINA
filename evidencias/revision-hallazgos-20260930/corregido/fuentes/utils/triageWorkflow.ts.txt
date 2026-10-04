// Lógica extraída de las pantallas, conservando sus reglas actuales.
export const normalizeSymptomText = (text: string) => text.trim();
export function buildSymptomReport(main: string, time: string, medication: string) {
  return `Síntomas principales: ${main}\nTiempo/Intensidad: ${time}\nMedicamentos previos: ${medication}`;
}
export function filterTriagesBySpecialty<T extends { recommended_specialty?: string }>(data: T[], currentSpecialty: string | null, applyFilter: boolean): T[] {
  if (!applyFilter || !currentSpecialty || currentSpecialty === 'Medicina General') return data;
  const normalize = (s?: string) => s ? s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim() : '';
  return data.filter(t => {
    const doc = normalize(currentSpecialty);
    const ai = normalize(t.recommended_specialty);
    return ai === doc || ai.includes(doc) || doc.includes(ai) || (ai.length > 4 && ai.substring(0, 5) === doc.substring(0, 5));
  });
}

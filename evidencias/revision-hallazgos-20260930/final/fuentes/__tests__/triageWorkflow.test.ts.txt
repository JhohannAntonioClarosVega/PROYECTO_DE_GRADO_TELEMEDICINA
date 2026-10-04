import { normalizeSymptomText, buildSymptomReport, filterTriagesBySpecialty } from '../utils/triageWorkflow';
describe('Triaje - reglas locales, sin evaluación clínica', () => {
  it('PU-31 normaliza una entrada de solo espacios como vacía', () => {
    expect(normalizeSymptomText('   ')).toBe('');
  });
  it('PU-32 conserva el relato en Quechuañol al recortar bordes', () => {
    expect(normalizeSymptomText('  uma nanay  ')).toBe('uma nanay');
  });
  it('PU-33 arma el reporte con síntomas, tiempo y medicamentos', () => {
    expect(buildSymptomReport('uma nanay', 'dos horas', 'ninguno')).toBe('Síntomas principales: uma nanay\nTiempo/Intensidad: dos horas\nMedicamentos previos: ninguno');
  });
  const queue = [{ recommended_specialty: ' PEDIATRIA ' }, { recommended_specialty: 'Cardiología' }];
  it('PU-34 filtra por especialidad ignorando tildes y mayúsculas', () => {
    expect(filterTriagesBySpecialty(queue, 'Pediatría', true)).toEqual([queue[0]]);
  });
  it('PU-35 medicina general conserva la cola completa', () => {
    expect(filterTriagesBySpecialty(queue, 'Medicina General', true)).toEqual(queue);
  });
  it('PU-36 un filtro desactivado conserva la cola completa', () => {
    expect(filterTriagesBySpecialty(queue, 'Pediatría', false)).toEqual(queue);
  });
  it('PU-37 caracteriza la inclusión de un triaje sin especialidad', () => {
    expect(filterTriagesBySpecialty([{}], 'Pediatría', true)).toEqual([{}]);
  });
});

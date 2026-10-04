import { hasClinicalRecordFields, generatePrescriptionHtml } from '../utils/medicalRecord';
import { prepareTriageView } from '../utils/triagePresentation';
describe('Historial y recetas - validación y preparación local', () => {
  it('PU-52 rechaza un diagnóstico vacío', () => { expect(hasClinicalRecordFields('', 'Plan ficticio')).toBe(false); });
  it('PU-53 rechaza un tratamiento vacío', () => { expect(hasClinicalRecordFields('Diagnóstico ficticio', '')).toBe(false); });
  it('PU-54 acepta diagnóstico y tratamiento con contenido', () => { expect(hasClinicalRecordFields('Diagnóstico ficticio', 'Plan ficticio')).toBe(true); });
  it('PU-55 rechaza campos clínicos de solo espacios', () => { expect(hasClinicalRecordFields('   ', '   ')).toBe(false); });
  it.each([[' \t ', 'Plan ficticio'], ['Diagnóstico ficticio', '\n ']])('H-05 rechaza un campo clínico en blanco con el otro completo (%s)', (diagnosis, treatment) => {
    expect(hasClinicalRecordFields(diagnosis, treatment)).toBe(false);
  });
  it('H-05 acepta contenido clínico con espacios exteriores', () => {
    expect(hasClinicalRecordFields(' Diagnóstico ficticio ', ' Plan ficticio ')).toBe(true);
  });
  it('PU-56 prepara el prediagnóstico a partir del reporte recibido', () => {
    const result = prepareTriageView({ urgency_level: 'Low', ai_raw_analysis: 'Texto de prueba', patients: { profiles: { full_name: 'Paciente Ficticio' } } });
    expect(result.patient.full_name).toBe('Paciente Ficticio');
    expect(result.ai_analysis).toEqual({ urgency_level: 'Low', raw_analysis: 'Texto de prueba', recommendation: 'Sin recomendación.' });
  });
  it('PU-57 no inventa una urgencia para el reporte incompleto', () => {
    expect(prepareTriageView({}).ai_analysis.urgency_level).toBeNull();
    expect(prepareTriageView({}).patient.full_name).toBe('Desconocido');
  });
  it('PU-58 no presenta datos de demostración sin triaje', () => {
    expect(prepareTriageView().patient.full_name).toBe('Desconocido');
    expect(prepareTriageView().ai_analysis.urgency_level).toBeNull();
    expect(prepareTriageView().symptoms).toBe('Sin síntomas reportados');
  });
  it.each(['Critical', 'Medium', 'Low'])('H-06 conserva la urgencia %s cuando procede del reporte', (urgency_level) => {
    expect(prepareTriageView({ urgency_level }).ai_analysis.urgency_level).toBe(urgency_level);
  });
  it.each(['', 'Unknown', '   ', null])('H-06 no clasifica como evaluado un nivel inválido %s', (urgency_level) => {
    expect(prepareTriageView({ urgency_level }).ai_analysis.urgency_level).toBeNull();
  });
  const prescription = { patientName: 'Paciente Ficticio', doctorName: 'Médico Ficticio', diagnosis: 'Diagnóstico ficticio', treatment: 'Plan ficticio', pharmacyName: '' };
  it('PU-59 prepara el HTML de la receta sin farmacia opcional', () => {
    const html = generatePrescriptionHtml(prescription);
    for (const text of ['Paciente Ficticio', 'Médico Ficticio', 'Diagnóstico ficticio', 'Plan ficticio']) expect(html).toContain(text);
    expect(html).not.toContain('Farmacia Aliada Sugerida');
  });
  it('PU-60 incluye la farmacia en el HTML cuando está seleccionada', () => {
    const html = generatePrescriptionHtml({ ...prescription, pharmacyName: 'Farmacia Ficticia' });
    expect(html).toContain('Farmacia Aliada Sugerida');
    expect(html).toContain('Farmacia Ficticia');
  });
});

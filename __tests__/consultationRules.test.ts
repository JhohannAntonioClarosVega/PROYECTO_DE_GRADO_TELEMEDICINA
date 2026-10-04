import { isClosedTriage, isDoctorReadyForCall } from '../utils/consultationRules';
describe('Videoconsultas - decisiones locales de la sala de espera', () => {
  it.each([['PU-45', 'completed'], ['PU-46', 'resolved']])('%s reconoce el cierre con estado %s', (_id, status) => {
    expect(isClosedTriage(status)).toBe(true);
  });
  it('PU-47 un triaje en espera no está cerrado', () => { expect(isClosedTriage('waiting')).toBe(false); });
  it('PU-48 un triaje en progreso habilita la llamada sin cita', () => {
    expect(isDoctorReadyForCall('in_progress', null)).toBe(true);
  });
  it('PU-49 una cita programada habilita la llamada', () => {
    expect(isDoctorReadyForCall('waiting', { id: 'cita-ficticia', status: 'scheduled' })).toBe(true);
  });
  it('PU-50 sin cita ni atención en progreso no habilita la llamada', () => {
    expect(isDoctorReadyForCall('waiting', null)).toBe(false);
  });
  it('PU-51 una cita cancelada no habilita la llamada', () => {
    expect(isDoctorReadyForCall('waiting', { status: 'cancelled' })).toBe(false);
  });
  it.each(['cancelled', 'completed', 'unknown', undefined])('H-04 una cita con estado %s no habilita la llamada aunque el triaje siga en progreso', (status) => {
    expect(isDoctorReadyForCall('in_progress', { status })).toBe(false);
  });
  it.each(['completed', 'resolved'])('H-04 un triaje cerrado como %s no habilita una cita programada', (status) => {
    expect(isDoctorReadyForCall(status, { status: 'scheduled' })).toBe(false);
  });
  it('H-04 una cita sin estado no demuestra que el médico esté listo', () => {
    expect(isDoctorReadyForCall('waiting', { id: 'cita-ficticia' })).toBe(false);
  });
});

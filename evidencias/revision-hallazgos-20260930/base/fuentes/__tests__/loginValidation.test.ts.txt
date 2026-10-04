import { validateLoginFields } from '../utils/validation';

describe('Pruebas Unitarias - Validación de Campos Obligatorios del Inicio de Sesión', () => {
  // Caso 1: Correo y contraseña vacíos
  it('debe rechazar cuando el correo y la contraseña están vacíos', () => {
    const resultado = validateLoginFields('', '');

    expect(resultado.isValid).toBe(false);
    expect(resultado.error).toBeDefined();
    expect(resultado.error).toBe('Por favor ingresa tu correo y contraseña.');
  });

  // Caso 2: Correo completo y contraseña vacía
  it('debe rechazar cuando el correo está completo pero la contraseña está vacía', () => {
    const resultado = validateLoginFields('paciente@telemedicina.gob.bo', '');

    expect(resultado.isValid).toBe(false);
    expect(resultado.error).toBeDefined();
    expect(resultado.error).toBe('Por favor ingresa tu contraseña.');
  });

  // Caso 3: Correo vacío y contraseña completa
  it('debe rechazar cuando el correo está vacío pero la contraseña está completa', () => {
    const resultado = validateLoginFields('', 'Password123#');

    expect(resultado.isValid).toBe(false);
    expect(resultado.error).toBeDefined();
    expect(resultado.error).toBe('Por favor ingresa tu correo electrónico.');
  });

  // Caso 4: Correo compuesto únicamente por espacios en blanco
  it('debe rechazar y considerar vacío cuando el correo está compuesto solo por espacios', () => {
    const resultado = validateLoginFields('     ', 'Password123#');

    expect(resultado.isValid).toBe(false);
    expect(resultado.error).toBeDefined();
    expect(resultado.error).toBe('Por favor ingresa tu correo electrónico.');
  });

  // Caso 5: Correo y contraseña completos
  it('debe superar la validación de campos obligatorios cuando ambos campos están completos', () => {
    const resultado = validateLoginFields('medico@telemedicina.gob.bo', 'ClaveSegura2026!');

    expect(resultado.isValid).toBe(true);
    expect(resultado.error).toBeUndefined();
  });
});

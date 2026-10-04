export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Valida los campos obligatorios del formulario de inicio de sesión.
 * 
 * Reglas de negocio:
 * - El correo electrónico se considera vacío si no se proporciona o si solo contiene espacios en blanco.
 * - La contraseña se considera vacía si no se proporciona o si su longitud es cero (sin modificar espacios internos o bordes).
 * - No valida autenticidad contra la base de datos (función pura y aislada).
 * 
 * @param email Correo electrónico ingresado por el usuario
 * @param password Contraseña ingresada por el usuario
 * @returns ValidationResult indicando si es válido y el mensaje de error correspondiente
 */
export function validateLoginFields(
  email?: string | null,
  password?: string | null
): ValidationResult {
  const cleanEmail = email ? email.trim() : '';
  const rawPassword = password || '';

  if (!cleanEmail && !rawPassword) {
    return {
      isValid: false,
      error: 'Por favor ingresa tu correo y contraseña.',
    };
  }

  if (!cleanEmail) {
    return {
      isValid: false,
      error: 'Por favor ingresa tu correo electrónico.',
    };
  }

  if (!rawPassword) {
    return {
      isValid: false,
      error: 'Por favor ingresa tu contraseña.',
    };
  }

  return {
    isValid: true,
  };
}

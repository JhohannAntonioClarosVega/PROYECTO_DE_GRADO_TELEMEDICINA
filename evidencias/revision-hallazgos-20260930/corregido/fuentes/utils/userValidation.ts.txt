import type { ValidationResult } from './validation';

export interface RegistrationFields {
  email: string;
  password: string;
  fullName: string;
  identityCard: string;
  phoneNumber: string;
  address: string;
  isDoctor: boolean;
  selectedSpecialty: string;
  document: object | null;
}

// Los campos personales obligatorios deben contener algo más que espacios.
export function validateRegistrationFields(fields: RegistrationFields): ValidationResult {
  const { email, password, fullName, identityCard, phoneNumber, address,
    isDoctor, selectedSpecialty, document } = fields;
  if (!email.trim() || !password || !fullName.trim() || !identityCard.trim() || !phoneNumber.trim() || !address.trim()) {
    return { isValid: false, error: 'Por favor completa todos los campos comunes.' };
  }
  if (isDoctor && (!selectedSpecialty.trim() || !document)) {
    return { isValid: false, error: 'Por favor selecciona una especialidad y adjunta tu título.' };
  }
  return { isValid: true };
}

export function validatePatientProfileFields(phoneNumber: string, address: string): ValidationResult {
  if (!phoneNumber.trim() || !address.trim()) {
    return { isValid: false, error: 'Por favor completa el número de teléfono y la dirección.' };
  }
  return { isValid: true };
}

export function validateDoctorProfileFields(fullName: string, phoneNumber: string): ValidationResult {
  if (!fullName.trim() || !phoneNumber.trim()) {
    return { isValid: false, error: 'El nombre y el celular no pueden estar vacíos' };
  }
  return { isValid: true };
}

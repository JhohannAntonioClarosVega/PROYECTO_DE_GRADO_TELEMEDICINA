export const isClosedTriage = (status?: string) => status === 'completed' || status === 'resolved';
export function isDoctorReadyForCall(status: string | undefined, appointment: { status?: string; id?: string } | null | undefined) {
  if (isClosedTriage(status)) return false;
  // El panel médico crea una cita scheduled al iniciar la atención.
  // Una cita cancelada, finalizada o sin estado no acredita disponibilidad.
  if (appointment) return appointment.status === 'scheduled';
  return status === 'in_progress';
}

export function prepareTriageView(triage?: any) {
  const urgency = triage?.urgency_level;
  return {
    patient: {
      full_name: triage?.patients?.profiles?.full_name || "Desconocido",
      identity_card: triage?.patients?.profiles?.identity_card || "No registrado",
      blood_type: triage?.patients?.blood_type || "No especificado",
      allergies: triage?.patients?.allergies || "No reportadas",
      emergency_contact: triage?.patients?.emergency_contact || "No reportado"
    },
    symptoms: triage?.reported_symptoms || "Sin síntomas reportados",
    ai_analysis: {
      urgency_level: ['Critical', 'Medium', 'Low'].includes(urgency) ? urgency as string : null,
      raw_analysis: triage?.ai_raw_analysis || "Sin análisis.",
      recommendation: triage?.ai_recommendation || "Sin recomendación."
    }
  };

}

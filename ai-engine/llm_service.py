import os
import json
import urllib.request
import urllib.error
# pyrefly: ignore [missing-import]
from dotenv import load_dotenv

load_dotenv()

def detect_heuristic_specialty(raw_text: str) -> str:
    t = (raw_text or '').lower()
    if any(k in t for k in ['hijo', 'hija', 'niño', 'niña', 'bebe', 'bebé', 'wawa', 'nene', 'nena', 'guagua', 'pediatr']):
        return 'Pediatría'
    if any(k in t for k in ['corazon', 'corazón', 'pecho', 'taquicardia', 'cardio', 'sonqo']):
        return 'Cardiología'
    if any(k in t for k in ['fractura', 'hueso', 'golpe fuerte', 'esguince', 'trauma', 'luxacion', 'luxación']):
        return 'Traumatología'
    if any(k in t for k in ['piel', 'mancha', 'grano', 'erupcion', 'erupción', 'p\'aspa', 'picazon', 'picazón', 'dermat']):
        return 'Dermatología'
    if any(k in t for k in ['oido', 'oído', 'garganta', 'nariz', 'ch\'ujchu', 'amigdala', 'amígdala']):
        return 'Otorrinolaringología'
    if any(k in t for k in ['cabeza', 'mareo', 'convulsion', 'convulsión', 'uma nanay', 'neuro']):
        return 'Neurología'
    if any(k in t for k in ['embarazo', 'menstruacion', 'menstruación', 'utero', 'útero', 'parto', 'gineco']):
        return 'Ginecología'
    if any(k in t for k in ['estomago', 'estómago', 'barriga', 'diarrea', 'vomito', 'vómito', 'q\'echu', 'k\'icha', 'gastro']):
        return 'Gastroenterología'
    return 'Medicina General'

def analyze_symptoms_with_gemini(raw_symptoms: str, audio_base64: str = None) -> dict:
    api_key = os.getenv("GEMINI_API_KEY")
    
    prompt = f"""
    Eres un asistente médico experto en triaje clínico y traductor especializado en el dialecto "Quechuañol" (mezcla de Quechua y Español de Cochabamba, Bolivia).
    
    Tu tarea es procesar el siguiente reporte de síntomas descrito por un paciente, traducir cualquier término local o en quechua a terminología médica clínica estandarizada, y clasificar el nivel de urgencia médica.
    
    Algunos términos comunes en Quechuañol:
    - uma nanay: dolor de cabeza (cefalea)
    - wasa nanay: dolor de espalda (lumbalgia/dorsalgia)
    - kurku nanay: dolor de cuerpo (mialgia)
    - sonqo nanay: dolor de corazón / pecho
    - k'aja / fiebre: fiebre
    - ch'ujchu: tos
    - q'echu / k'icha: diarrea
    - akay: asfixia / falta de aire
    - yawar: sangre
    - p'aspa: sarpullido

    Reporte del paciente:
    "{raw_symptoms}"
    """

    if audio_base64:
        prompt += "\n\n(El paciente también adjuntó un mensaje de voz, el cual se anexa a esta petición. Transcribe mentalmente el audio y considera esos síntomas junto con el texto proporcionado)."
    
    prompt += """
    
    Debes analizar esto y devolver EXCLUSIVAMENTE un objeto JSON válido con la siguiente estructura (no agregues texto fuera del JSON, sin formato markdown ```json, solo el JSON):
    {{
        "detected_language": "El idioma o dialecto detectado (ej. Quechuañol (Bolivia) o Español)",
        "standardized_symptoms": "Los síntomas traducidos a terminología médica clínica y estandarizada (ej. Cefalea moderada, mialgia)",
        "urgency_level": "Clasifica la urgencia en uno de estos tres valores exactos: 'Critical' (Emergencia vital, falta de aire, sangrado grave, dolor en pecho), 'Medium' (Urgencia, dolor moderado a fuerte, fiebre alta), 'Low' (Consulta general, dolor leve, síntomas crónicos)",
        "ai_recommendation": "Una breve recomendación inicial para el paciente (ej. 'Requiere evaluación médica para manejo del dolor. Manténgase hidratado.')",
        "recommended_specialty": "DEBE SER EXACTAMENTE UNA de las siguientes opciones válidas: 'Medicina General', 'Pediatría', 'Traumatología', 'Cardiología', 'Dermatología', 'Otorrinolaringología', 'Neurología', 'Ginecología', 'Gastroenterología'. REGLA ESTRICTA Y ABSOLUTA: Si el reporte menciona la palabra 'hijo', 'hija', 'niño', 'niña', 'bebe', 'bebé' o 'wawa', DEBES ASIGNAR OBLIGATORIAMENTE 'Pediatría'. NO uses Medicina General para niños. Si menciona dolor de oído, garganta o nariz, asignar a 'Otorrinolaringología'. Si menciona golpes fuertes, fracturas o dolor de huesos, asignar a 'Traumatología'. Si menciona corazón o taquicardia, asignar a 'Cardiología'. Si menciona piel, manchas o granos, asignar a 'Dermatología'. Si menciona cabeza, mareos o convulsiones, asignar a 'Neurología'. Si es tema de la mujer o embarazo, asignar a 'Ginecología'. Si menciona estómago, dolor de barriga, vómitos o diarrea, asignar a 'Gastroenterología'. Si son síntomas comunes en adultos (resfrío, dolor leve) usa 'Medicina General'."
    }}
    """
    heuristic_specialty = detect_heuristic_specialty(raw_symptoms)

    fallback = {
        "detected_language": "Español",
        "standardized_symptoms": raw_symptoms,
        "urgency_level": "Medium",
        "ai_recommendation": f"Requiere evaluación médica con el especialista en {heuristic_specialty}.",
        "recommended_specialty": heuristic_specialty
    }

    if not api_key:
        print("Error: GEMINI_API_KEY no encontrada.")
        return fallback

    # Usamos HTTP directo (REST API) para evitar problemas con la librería obsoleta
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
    
    contents_parts = [{"text": prompt}]
    if audio_base64:
        contents_parts.append({
            "inlineData": {
                "mimeType": "audio/m4a",
                "data": audio_base64
            }
        })

    payload = json.dumps({
        "contents": [{"parts": contents_parts}]
    }).encode('utf-8')

    req = urllib.request.Request(url, data=payload, headers={'Content-Type': 'application/json'})

    try:
        with urllib.request.urlopen(req) as response:
            response_data = json.loads(response.read().decode('utf-8'))
            text_response = response_data['candidates'][0]['content']['parts'][0]['text'].strip()
            
            import re
            match = re.search(r'\{[\s\S]*\}', text_response)
            if match:
                result = json.loads(match.group(0))
                # Validar que si hay síntomas pediátricos o claros de especialista no se quede en General
                if result.get("recommended_specialty") in [None, "", "Medicina General"]:
                    if heuristic_specialty != "Medicina General":
                        result["recommended_specialty"] = heuristic_specialty
                return result
            else:
                raise ValueError("No se encontró JSON válido en la respuesta de Gemini")
            
    except Exception as e:
        error_msg = f"Error procesando con Gemini (API REST): {e}\nRaw response: {text_response if 'text_response' in locals() else 'None'}"
        print(error_msg)
        with open("d:/proyecto_grado/ai-engine/error_log.txt", "w", encoding="utf-8") as f:
            f.write(error_msg)
        return fallback

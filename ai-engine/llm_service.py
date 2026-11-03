import os
import json
import re
import requests
# pyrefly: ignore [missing-import]
from dotenv import load_dotenv

load_dotenv()

# Modelos en orden de preferencia y resiliencia ante alta demanda
CANDIDATE_MODELS = ["gemini-3.1-flash-lite", "gemini-3.5-flash", "gemini-flash-latest"]

def call_gemini_models(contents: list, generation_config: dict = None, timeout: int = 15) -> str:
    """Ejecuta una petición a Gemini probando modelos de respaldo si uno falla o está congestionado."""
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY no encontrada")

    payload = {"contents": contents}
    if generation_config:
        payload["generationConfig"] = generation_config

    last_error = None
    for model_name in CANDIDATE_MODELS:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
        try:
            r = requests.post(url, json=payload, timeout=timeout)
            if r.status_code == 200:
                data = r.json()
                return data['candidates'][0]['content']['parts'][0]['text'].strip()
            else:
                last_error = f"Model {model_name} HTTP {r.status_code}: {r.text[:200]}"
                print(f"[Gemini Warn] {last_error}")
        except Exception as e:
            last_error = f"Model {model_name} exception: {e}"
            print(f"[Gemini Warn] {last_error}")

    raise RuntimeError(f"Todos los modelos de Gemini fallaron: {last_error}")

def detect_heuristic_specialty(raw_text: str) -> str:
    t = (raw_text or '').lower()
    if any(k in t for k in ['hijo', 'hija', 'niño', 'niña', 'bebe', 'bebé', 'wawa', 'wawita', 'nene', 'nena', 'guagua', 'pediatr']):
        return 'Pediatría'
    if any(k in t for k in ['corazon', 'corazón', 'pecho', 'taquicardia', 'cardio', 'sonqo']):
        return 'Cardiología'
    if any(k in t for k in ['fractura', 'hueso', 'golpe fuerte', 'esguince', 'trauma', 'luxacion', 'luxación', 'caida', 'caída', 'rodilla', 'tobillo']):
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

def chat_with_gemini(messages: list[dict], finish_triage: bool = False, audio_base64: str = None) -> dict:
    """
    Conversación dinámica estilo asistente de WhatsApp con el paciente,
    proveyendo respuestas personalizadas empáticas en español y quechua,
    además de evaluar si el triaje clínico está listo para pasar al médico.
    """
    system_instruction = """
Eres el Asistente Médico Virtual de Triaje del Gobierno Autónomo Municipal de Cochabamba (Bolivia).
Tu objetivo es interactuar de forma empática, profesional, cálida y natural con los pacientes que buscan atención médica, al estilo de un asistente inteligente en WhatsApp (como Meta AI).

REGLAS DE INTERACCIÓN:
1. Responde SIEMPRE de forma personalizada y relevante a lo que el paciente acaba de expresar en su último mensaje. NUNCA uses respuestas genéricas ni plantillas predefinidas.
2. Si el paciente saluda o hace una pregunta general, responde amablemente y pregúntale cómo se siente hoy o cuál es su motivo de consulta.
3. Si el paciente describe síntomas:
   - Muestra empatía genuina por su malestar.
   - Si falta información clínica clave, haz 1 o 2 preguntas breves y puntuales de seguimiento (ejemplo: ¿hace cuántos días empezó?, ¿del 1 al 10 qué tan intenso es el dolor?, ¿ha tomado algún medicamento?, o si tiene síntomas de alarma).
   - Puedes dar breves consejos de primeros auxilios o tranquilidad (ej. reposar, hidratarse), recordando que pasará con un médico.
4. Conoce a profundidad los términos en Quechua y Quechuañol comunes en Cochabamba:
   - uma nanay: dolor de cabeza (cefalea)
   - wasa nanay: dolor de espalda (lumbalgia)
   - kurku nanay: dolor de cuerpo (mialgia)
   - sonqo nanay: dolor de corazón o pecho
   - k'aja / fiebre: fiebre
   - ch'ujchu: tos / escalofríos
   - q'echu / k'icha: diarrea
   - akay: asfixia / falta de aire
   - yawar: sangre
   - p'aspa: erupción / sarpullido
   - wawa / wawita: bebé / niño(a)
5. En cada respuesta DEBES generar:
   - "reply_text": Respuesta en Español clara, cálida y directa.
   - "reply_quechua": Versión o traducción natural en Quechua (con tono respetuoso y cercano de Cochabamba).
6. Triaje Clínico:
   - Si finish_triage es True O si el paciente ya ha detallado su síntoma principal, tiempo aproximado de evolución e intensidad:
     Marca "is_triage_ready": true y genera "triage_data".
     En "reply_text", indícale con calidez que ya has registrado toda su información para el triaje y que puede presionar el botón "Proceder al Pago" o "Pasar a Consulta" para ingresar a la sala de espera médica.
   - Si aún es el inicio o falta información, marca "is_triage_ready": false y "triage_data": null.
7. Estructura de "triage_data" (solo cuando is_triage_ready es true):
   {
     "detected_language": "Español" | "Quechuañol (Bolivia)" | "Quechua",
     "standardized_symptoms": "Transcripción/Motivo: <Lo que dijo el paciente>\\n\\nAnálisis Clínico: <Términos médicos estandarizados, evolución, intensidad>",
     "urgency_level": "Critical" | "Medium" | "Low",
     "ai_recommendation": "Recomendación médica inicial clara",
     "recommended_specialty": "Pediatría" | "Cardiología" | "Traumatología" | "Dermatología" | "Otorrinolaringología" | "Neurología" | "Ginecología" | "Gastroenterología" | "Medicina General"
   }
   REGLA ESTRICTA: Si el paciente menciona hijo, hija, niño, niña, wawa o bebé, recommended_specialty DEBE ser 'Pediatría'.

RESPONDE EXCLUSIVAMENTE CON EL OBJETO JSON VÁLIDO:
{
  "reply_text": "...",
  "reply_quechua": "...",
  "is_triage_ready": true/false,
  "triage_data": null o objeto
}
"""
    conversation_text = ""
    full_user_text = ""
    for m in messages:
        sender = "PACIENTE" if m.get("role") == "user" else "ASISTENTE"
        conversation_text += f"{sender}: {m.get('content', '')}\n"
        if m.get("role") == "user":
            full_user_text += " " + m.get("content", "")

    finish_instruction = "\nNOTA IMPORTANTE DEL SISTEMA: El paciente solicita finalizar el triaje médico. DEBES poner is_triage_ready=true y completar triage_data.\n" if finish_triage else ""

    prompt = f"{system_instruction}\n\n{finish_instruction}Historial de la conversación:\n{conversation_text}\nGenera la respuesta en JSON:"

    parts = [{"text": prompt}]
    if audio_base64:
        parts.append({
            "inlineData": {
                "mimeType": "audio/mp4",
                "data": audio_base64
            }
        })

    heuristic = detect_heuristic_specialty(full_user_text)

    try:
        raw_response = call_gemini_models(
            contents=[{"parts": parts}],
            generation_config={"responseMimeType": "application/json"},
            timeout=18
        )
        match = re.search(r'\{[\s\S]*\}', raw_response)
        if match:
            result = json.loads(match.group(0))
            if result.get("is_triage_ready") and result.get("triage_data"):
                td = result["triage_data"]
                if td.get("recommended_specialty") in [None, "", "Medicina General"] and heuristic != "Medicina General":
                    td["recommended_specialty"] = heuristic
            return result
        else:
            raise ValueError("No se encontró JSON en la respuesta de Gemini")
    except Exception as e:
        print(f"[chat_with_gemini Error] {e}")
        # Fallback empático
        return {
            "reply_text": "Te escucho con atención. Por favor cuéntame un poco más sobre desde cuándo tienes este malestar y qué tan fuerte lo sientes.",
            "reply_quechua": "Sumaqta uyarisayki. Ama hina kaspa willariway, ¿jayk'aqmanta pachataq chay nanay qallarirqan hinallataq mayna sinchitaq?",
            "is_triage_ready": finish_triage,
            "triage_data": {
                "detected_language": "Español",
                "standardized_symptoms": full_user_text.strip() or "Consulta médica general",
                "urgency_level": "Medium",
                "ai_recommendation": f"Requiere evaluación médica con {heuristic}.",
                "recommended_specialty": heuristic
            } if finish_triage else None
        }

def analyze_symptoms_with_gemini(raw_symptoms: str, audio_base64: str = None) -> dict:
    heuristic_specialty = detect_heuristic_specialty(raw_symptoms)
    fallback = {
        "detected_language": "Español",
        "standardized_symptoms": raw_symptoms,
        "urgency_level": "Medium",
        "ai_recommendation": f"Requiere evaluación médica con el especialista en {heuristic_specialty}.",
        "recommended_specialty": heuristic_specialty
    }

    prompt = f"""
    Eres un asistente médico experto en triaje clínico y traductor especializado en el dialecto "Quechuañol" (mezcla de Quechua y Español de Cochabamba, Bolivia).
    Procesa el siguiente reporte de síntomas y devuelve un JSON válido:
    Reporte del paciente: "{raw_symptoms}"
    
    Estructura JSON requerida:
    {{
        "detected_language": "Quechuañol (Bolivia) o Español",
        "standardized_symptoms": "Transcripción/Traducción: <lo que dijo el paciente>\\n\\nAnálisis Clínico: <síntomas estandarizados>",
        "urgency_level": "Critical" | "Medium" | "Low",
        "ai_recommendation": "Recomendación breve para el paciente",
        "recommended_specialty": "Pediatría" | "Cardiología" | "Traumatología" | "Dermatología" | "Otorrinolaringología" | "Neurología" | "Ginecología" | "Gastroenterología" | "Medicina General"
    }}
    REGLA ESTRICTA: Si menciona hijo, hija, niño, niña, bebé o wawa, DEBES ASIGNAR OBLIGATORIAMENTE 'Pediatría'.
    """

    parts = [{"text": prompt}]
    if audio_base64:
        parts.append({
            "inlineData": {
                "mimeType": "audio/mp4",
                "data": audio_base64
            }
        })

    try:
        raw_response = call_gemini_models(
            contents=[{"parts": parts}],
            generation_config={"responseMimeType": "application/json"},
            timeout=18
        )
        match = re.search(r'\{[\s\S]*\}', raw_response)
        if match:
            result = json.loads(match.group(0))
            if result.get("recommended_specialty") in [None, "", "Medicina General"] and heuristic_specialty != "Medicina General":
                result["recommended_specialty"] = heuristic_specialty
            return result
        return fallback
    except Exception as e:
        print(f"Error procesando analyze_symptoms_with_gemini: {e}")
        return fallback

def transcribe_audio_only(audio_base64: str) -> str:
    prompt = "Transcribe el siguiente audio exactamente como el usuario lo dijo. Si habla en quechua o dialecto boliviano, devuélvelo directamente traducido a español claro y fluido. Solo devuelve el texto plano de la transcripción, sin comillas ni explicaciones."
    parts = [
        {"text": prompt},
        {"inlineData": {"mimeType": "audio/mp4", "data": audio_base64}}
    ]
    try:
        return call_gemini_models(contents=[{"parts": parts}], timeout=15)
    except Exception as e:
        print(f"Error en transcribe_audio_only: {e}")
        return "[Error: No se pudo transcribir el audio adjunto]"

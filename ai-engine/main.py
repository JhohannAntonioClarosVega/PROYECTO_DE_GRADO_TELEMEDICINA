# pyrefly: ignore [missing-import]
from fastapi import FastAPI, HTTPException
# pyrefly: ignore [missing-import]
from fastapi.middleware.cors import CORSMiddleware
# pyrefly: ignore [missing-import]
from typing import Optional, List
# pyrefly: ignore [missing-import]
from pydantic import BaseModel
from llm_service import analyze_symptoms_with_gemini, transcribe_audio_only, chat_with_gemini

app = FastAPI(title="Motor IA de Triaje - Telemedicina Cochabamba")

# Configuración de CORS para permitir peticiones desde la app móvil/web
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class SymptomsRequest(BaseModel):
    patient_id: str
    reported_symptoms: str
    audio_base64: Optional[str] = None

class TranscribeRequest(BaseModel):
    audio_base64: str

class AnalyzeResponse(BaseModel):
    detected_language: str
    standardized_symptoms: str
    urgency_level: str
    ai_recommendation: str
    recommended_specialty: str

class ChatMessage(BaseModel):
    role: str # "user" | "assistant"
    content: str

class ChatRequest(BaseModel):
    patient_id: Optional[str] = None
    messages: List[ChatMessage]
    finish_triage: Optional[bool] = False
    audio_base64: Optional[str] = None

class ChatResponse(BaseModel):
    reply_text: str
    reply_quechua: Optional[str] = None
    is_triage_ready: bool
    triage_data: Optional[AnalyzeResponse] = None

@app.get("/")
def read_root():
    return {"status": "ok", "message": "Motor IA de Triaje Operativo"}

@app.post("/api/chat", response_model=ChatResponse)
def chat_assistant(request: ChatRequest):
    if not request.messages:
        raise HTTPException(status_code=400, detail="El historial de mensajes no puede estar vacío")
    
    dict_messages = [{"role": m.role, "content": m.content} for m in request.messages]
    
    res = chat_with_gemini(
        messages=dict_messages,
        finish_triage=request.finish_triage or False,
        audio_base64=request.audio_base64
    )
    
    triage_obj = None
    if res.get("is_triage_ready") and res.get("triage_data"):
        td = res["triage_data"]
        triage_obj = AnalyzeResponse(
            detected_language=td.get("detected_language", "Español"),
            standardized_symptoms=td.get("standardized_symptoms", ""),
            urgency_level=td.get("urgency_level", "Medium"),
            ai_recommendation=td.get("ai_recommendation", "Pendiente de evaluación médica"),
            recommended_specialty=td.get("recommended_specialty", "Medicina General")
        )

    return ChatResponse(
        reply_text=res.get("reply_text", "Entendido. ¿Tienes algún otro síntoma?"),
        reply_quechua=res.get("reply_quechua"),
        is_triage_ready=res.get("is_triage_ready", False),
        triage_data=triage_obj
    )

@app.post("/api/analyze-symptoms", response_model=AnalyzeResponse)
def analyze_symptoms(request: SymptomsRequest):
    if not request.reported_symptoms:
        raise HTTPException(status_code=400, detail="Los síntomas no pueden estar vacíos")
    
    # Procesar usando el modelo de lenguaje (Gemini)
    analysis_result = analyze_symptoms_with_gemini(request.reported_symptoms, request.audio_base64)
    
    return AnalyzeResponse(
        detected_language=analysis_result.get("detected_language", "Español"),
        standardized_symptoms=analysis_result.get("standardized_symptoms", request.reported_symptoms),
        urgency_level=analysis_result.get("urgency_level", "Medium"),
        ai_recommendation=analysis_result.get("ai_recommendation", "Pendiente de evaluación médica"),
        recommended_specialty=analysis_result.get("recommended_specialty", "Medicina General")
    )

@app.post("/api/transcribe")
def transcribe_audio(request: TranscribeRequest):
    try:
        if not request.audio_base64:
            raise HTTPException(status_code=400, detail="No se proporcionó audio")
        text = transcribe_audio_only(request.audio_base64)
        return {"transcription": text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Para ejecutar: uvicorn main:app --reload --host 0.0.0.0 --port 8000

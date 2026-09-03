# pyrefly: ignore [missing-import]
from fastapi import FastAPI, HTTPException
# pyrefly: ignore [missing-import]
from fastapi.middleware.cors import CORSMiddleware
# pyrefly: ignore [missing-import]
from typing import Optional
# pyrefly: ignore [missing-import]
from pydantic import BaseModel
from llm_service import analyze_symptoms_with_gemini

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

class AnalyzeResponse(BaseModel):
    detected_language: str
    standardized_symptoms: str
    urgency_level: str
    ai_recommendation: str
    recommended_specialty: str

@app.get("/")
def read_root():
    return {"status": "ok", "message": "Motor IA de Triaje Operativo"}

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

# Para ejecutar: uvicorn main:app --reload --host 0.0.0.0 --port 8000

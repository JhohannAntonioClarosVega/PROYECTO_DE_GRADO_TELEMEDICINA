import sys
sys.path.append('d:/proyecto_grado/ai-engine')
from llm_service import analyze_symptoms_with_gemini
res = analyze_symptoms_with_gemini('mi hijo estaba con tos y fiebre')
print("AI RESULT:", res)

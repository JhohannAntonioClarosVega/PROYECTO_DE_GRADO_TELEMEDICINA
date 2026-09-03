import sys
import os

# Add ai-engine to path so we can import llm_service
sys.path.append(os.path.abspath('ai-engine'))

from llm_service import analyze_symptoms_with_gemini

res = analyze_symptoms_with_gemini("Mi hijo de 5 años tiene mucho dolor de estomago y fiebre")
print("RESULTADO:", res)

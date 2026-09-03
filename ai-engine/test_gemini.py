import os
# pyrefly: ignore [missing-import]
from dotenv import load_dotenv
# pyrefly: ignore [missing-import]
import google.generativeai as genai

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")
print(f"Key loaded: '{api_key}'")
genai.configure(api_key=api_key)
model = genai.GenerativeModel('gemini-2.5-flash')
try:
    response = model.generate_content("Hola")
    print(response.text)
except Exception as e:
    print("Error:", e)

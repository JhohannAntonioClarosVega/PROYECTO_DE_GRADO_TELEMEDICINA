import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()
url = os.environ.get("EXPO_PUBLIC_SUPABASE_URL")
key = os.environ.get("EXPO_PUBLIC_SUPABASE_ANON_KEY")
supabase: Client = create_client(url, key)

try:
    print("--- 1. Fetching appointments columns ---")
    # Intentamos insertar un row vacío para ver qué error de constraint nos da
    res = supabase.table('appointments').select('*').limit(1).execute()
    print("Rows:", res.data)
except Exception as e:
    print("Error:", e)

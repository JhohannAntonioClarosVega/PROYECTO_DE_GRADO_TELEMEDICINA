import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()
url = os.environ.get("EXPO_PUBLIC_SUPABASE_URL")
key = os.environ.get("EXPO_PUBLIC_SUPABASE_ANON_KEY")
supabase: Client = create_client(url, key)

try:
    print("--- 1. Fetching last Triage ---")
    res = supabase.table('triages').select('*').order('created_at', desc=True).limit(1).execute()
    print(res.data)

    print("\n--- 2. Fetching Doctors ---")
    res2 = supabase.table('doctors').select('id, user_id, specialties(name)').limit(3).execute()
    print(res2.data)
except Exception as e:
    print("Error:", e)

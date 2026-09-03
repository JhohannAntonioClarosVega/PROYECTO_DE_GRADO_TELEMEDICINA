import os
from supabase import create_client, Client
# pyrefly: ignore [missing-import]
from dotenv import load_dotenv

load_dotenv()
url = os.environ.get("EXPO_PUBLIC_SUPABASE_URL")
key = os.environ.get("EXPO_PUBLIC_SUPABASE_ANON_KEY")
supabase: Client = create_client(url, key)

# Intentar insertar y luego eliminar
try:
    res_insert = supabase.table('specialties').insert({'name': 'TestSpecialtyXYZ'}).execute()
    print("Insert:", res_insert)

    if res_insert.data:
        new_id = res_insert.data[0]['id']
        res_delete = supabase.table('specialties').delete().eq('id', new_id).execute()
        print("Delete:", res_delete)
except Exception as e:
    print("Error:", e)

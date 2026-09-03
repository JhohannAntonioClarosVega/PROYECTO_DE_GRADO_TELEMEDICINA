const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

async function test() {
  console.log("--- Specialties ---");
  const { data: spec } = await supabase.from('specialties').select('*');
  console.log(spec);

  console.log("\n--- Last 3 Triages ---");
  const { data: triages } = await supabase.from('triages').select('*').order('created_at', { ascending: false }).limit(3);
  console.log(triages);
}

test();

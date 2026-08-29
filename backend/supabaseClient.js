require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;

if (!url || !key) {
  console.warn(
    "[calculoco] Atenção: SUPABASE_URL ou SUPABASE_SERVICE_KEY não configurados no .env"
  );
}

const supabase = createClient(url, key, {
  auth: { persistSession: false },
});

module.exports = supabase;

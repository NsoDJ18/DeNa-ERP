import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey || url.includes('TU-PROYECTO')) {
  console.warn(
    '[DENA ERP] Faltan las credenciales de Supabase. ' +
    'Copia .env.example a .env y completa VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.'
  );
}

// Cliente único de Supabase para toda la app. Todas las consultas pasan por acá,
// lo que asegura que Row Level Security siempre esté activo (la sesión del
// usuario autenticado viaja automáticamente en cada consulta).
export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

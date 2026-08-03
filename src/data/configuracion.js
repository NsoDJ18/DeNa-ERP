import { supabase } from '../lib/supabase.js';
import { empresaActivaId } from '../auth/session.js';

const TMAX_DEFAULT = { ingreso: 60, diseno: 180, fabricacion: 240, calidad: 60, listo: 4320 };

/** Trae los tiempos máximos por estación configurados para la empresa activa. */
export async function obtenerTiemposMax() {
  const { data, error } = await supabase
    .from('configuracion')
    .select('tiempos_max')
    .eq('empresa_id', empresaActivaId())
    .maybeSingle();
  if (error) throw error;
  return { ...TMAX_DEFAULT, ...(data?.tiempos_max || {}) };
}

/** Guarda los tiempos máximos por estación (crea la fila de configuración si no existía). */
export async function guardarTiemposMax(tiemposMax) {
  const { error } = await supabase
    .from('configuracion')
    .upsert({ empresa_id: empresaActivaId(), tiempos_max: tiemposMax });
  if (error) throw error;
}

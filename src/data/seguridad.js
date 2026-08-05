import { supabase } from '../lib/supabase.js';
import { empresaActivaId } from '../auth/session.js';

/** Busca un pedido por folio exacto, dentro de la empresa activa. */
export async function buscarOrdenPorFolio(folio) {
  const { data, error } = await supabase
    .from('ordenes').select('*').eq('empresa_id', empresaActivaId()).ilike('folio', folio.trim()).maybeSingle();
  if (error) throw error;
  return data;
}

/** Aplica la nota de crédito validando la contraseña REAL del administrador
 *  (no un PIN compartido) — la verificación ocurre en el servidor, este
 *  navegador nunca sabe si el correo/clave son correctos hasta que la
 *  función responde. Solo funciona si esa cuenta es admin, no encargado. */
export async function aplicarNotaCreditoVerificada({ email, password, ordenId, nuevoPrecio, motivo, metodoDevolucion }) {
  const { data, error } = await supabase.functions.invoke('autorizar-nc-admin', {
    body: { email, password, ordenId, nuevoPrecio, motivo, metodoDevolucion },
  });
  if (error) {
    const detalle = await error.context?.json?.().catch(() => null);
    throw new Error(detalle?.error || error.message);
  }
  return data;
}

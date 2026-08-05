import { supabase } from '../lib/supabase.js';
import { empresaActivaId } from '../auth/session.js';
import { aplicarNotaCredito } from './ordenes.js';

export async function crearSolicitudNC({ ordenId, precioActual, precioSolicitado, motivo, solicitadoPor }) {
  const { data, error } = await supabase.from('solicitudes_nc').insert({
    empresa_id: empresaActivaId(), orden_id: ordenId, precio_actual: precioActual,
    precio_solicitado: precioSolicitado, motivo, solicitado_por: solicitadoPor,
  }).select().single();
  if (error) throw error;
  return data;
}

export async function listarSolicitudesPendientes() {
  const { data, error } = await supabase
    .from('solicitudes_nc')
    .select('*, ordenes ( folio, cliente )')
    .eq('empresa_id', empresaActivaId())
    .eq('estado', 'pendiente')
    .order('fecha_solicitud');
  if (error) throw error;
  return data;
}

/** Aprueba la solicitud: aplica la nota de crédito de verdad (baja precio,
 *  cancela la orden, registra devolución si corresponde) y marca la
 *  solicitud como aprobada. Falla solo si quien llama no es encargado/admin
 *  (candado real en la base de datos, no acá). */
export async function aprobarSolicitudNC(solicitud, revisadoPor, metodoDevolucion) {
  await aplicarNotaCredito(solicitud.orden_id, solicitud.precio_solicitado, solicitud.motivo, metodoDevolucion);
  const { error } = await supabase.from('solicitudes_nc').update({
    estado: 'aprobada', revisado_por: revisadoPor, fecha_revision: new Date().toISOString(),
  }).eq('id', solicitud.id);
  if (error) throw error;
}

export async function rechazarSolicitudNC(solicitudId, revisadoPor, motivoRechazo) {
  const { error } = await supabase.from('solicitudes_nc').update({
    estado: 'rechazada', revisado_por: revisadoPor, fecha_revision: new Date().toISOString(), motivo_rechazo: motivoRechazo,
  }).eq('id', solicitudId);
  if (error) throw error;
}

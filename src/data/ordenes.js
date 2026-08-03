import { supabase } from '../lib/supabase.js';
import { empresaActivaId } from '../auth/session.js';

// ============================================================
// ÓRDENES DE TRABAJO
// ============================================================
// Este archivo es el PATRÓN a seguir para el resto de los módulos
// (productos.js, ventas.js, turnos.js, etc.) en la fase de migración:
// toda consulta filtra por empresa_id, y Row Level Security en Supabase
// además rechaza cualquier fila que no pertenezca al usuario autenticado
// como doble candado.

/** Lista las órdenes activas (no archivadas) de la empresa activa, más recientes primero. */
export async function listarOrdenes({ incluirArchivadas = false } = {}) {
  let query = supabase
    .from('ordenes')
    .select('*')
    .eq('empresa_id', empresaActivaId())
    .order('folio_num', { ascending: false });

  if (!incluirArchivadas) query = query.eq('archivado', false);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

/** Siguiente número de folio disponible para la empresa activa. */
export async function siguienteFolioNum() {
  const { data, error } = await supabase
    .from('ordenes')
    .select('folio_num')
    .eq('empresa_id', empresaActivaId())
    .order('folio_num', { ascending: false })
    .limit(1);
  if (error) throw error;
  return (data[0]?.folio_num || 0) + 1;
}

/** Crea una nueva orden de trabajo (equivalente a "Recepción" en el prototipo). */
export async function crearOrden(datosOrden) {
  // metodoPago NO es una columna de la tabla "ordenes" — solo se usa para
  // construir el primer registro dentro de "pagos". Si se manda tal cual,
  // Supabase rechaza el insert completo (columna inexistente) y la orden
  // nunca se crea, sin ningún aviso visible más allá de la consola.
  const { metodoPago, ...datosColumnas } = datosOrden;

  const folioNum = await siguienteFolioNum();
  const folio = 'OT-' + String(folioNum).padStart(4, '0');
  const ahora = new Date().toISOString();

  const nuevaOrden = {
    empresa_id: empresaActivaId(),
    folio,
    folio_num: folioNum,
    estado: 'ingreso',
    timestamps: { ingreso: ahora },
    notas: [],
    fotos: [],
    pagos: datosColumnas.abono > 0
      ? [{ monto: datosColumnas.abono, metodo: metodoPago || 'No especificado', fecha: ahora }]
      : [],
    historial: [{ texto: `Orden creada por ${datosColumnas.responsable || '—'}.`, fecha: ahora }],
    ...datosColumnas,
  };

  const { data, error } = await supabase.from('ordenes').insert(nuevaOrden).select().single();
  if (error) throw error;
  return data;
}

/** Cambia el estado de una orden (ingreso → diseño → fabricación → calidad → listo → entregado/cancelado). */
export async function cambiarEstadoOrden(ordenId, nuevoEstado) {
  const { data: actual, error: errLectura } = await supabase
    .from('ordenes').select('timestamps, historial').eq('id', ordenId).single();
  if (errLectura) throw errLectura;

  const ahora = new Date().toISOString();
  const timestamps = { ...actual.timestamps, [nuevoEstado]: ahora };
  const historial = [...(actual.historial || []), { texto: `Cambió a estado: ${nuevoEstado}.`, fecha: ahora }];

  const { data, error } = await supabase
    .from('ordenes')
    .update({ estado: nuevoEstado, timestamps, historial })
    .eq('id', ordenId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Elimina (archiva) una orden cancelada — no borra el dato, solo la saca de la vista activa. */
export async function archivarOrden(ordenId) {
  const { data, error } = await supabase
    .from('ordenes')
    .update({ archivado: true, archivado_en: new Date().toISOString() })
    .eq('id', ordenId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Trae una sola orden por su id (para el modal de detalle). */
export async function obtenerOrden(ordenId) {
  const { data, error } = await supabase.from('ordenes').select('*').eq('id', ordenId).single();
  if (error) throw error;
  return data;
}

/** Agrega una nota interna al historial de notas de la orden. */
export async function agregarNota(ordenId, texto) {
  const { data: actual, error: errLectura } = await supabase
    .from('ordenes').select('notas').eq('id', ordenId).single();
  if (errLectura) throw errLectura;

  const notas = [...(actual.notas || []), { texto, fecha: new Date().toISOString() }];
  const { data, error } = await supabase.from('ordenes').update({ notas }).eq('id', ordenId).select().single();
  if (error) throw error;
  return data;
}

/** Suscripción en tiempo real: llama a `callback` cada vez que cambian las órdenes de la empresa activa. */
export function suscribirseAOrdenes(callback) {
  // nombre único por suscripción — reusar el mismo nombre en dos pantallas a
  // la vez hace que Supabase reclame el canal ya suscrito y falle al agregar
  // el segundo listener ("cannot add postgres_changes callbacks after subscribe()")
  const nombreCanal = `ordenes-cambios-${crypto.randomUUID()}`;
  const canal = supabase
    .channel(nombreCanal)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'ordenes', filter: `empresa_id=eq.${empresaActivaId()}` },
      callback
    )
    .subscribe();
  return () => supabase.removeChannel(canal);
}

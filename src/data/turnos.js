import { supabase } from '../lib/supabase.js';
import { empresaActivaId } from '../auth/session.js';
import { localDateStr, todayStr } from '../lib/util.js';

const METODOS_BASE = ['Efectivo', 'Débito', 'Transferencia', 'Crédito', 'Otro'];
export { METODOS_BASE };

/** Suma los pagos de órdenes + ventas de mostrador, agrupados por método.
 *  fechaFiltro: 'YYYY-MM-DD' para un solo día, o null para todo el historial. */
export async function pagosPorMetodo(fechaFiltro) {
  const mapa = {};
  let total = 0;

  const { data: ordenes, error: errOrdenes } = await supabase
    .from('ordenes').select('pagos').eq('empresa_id', empresaActivaId());
  if (errOrdenes) throw errOrdenes;
  ordenes.forEach((o) => {
    (o.pagos || []).forEach((p) => {
      if (fechaFiltro && localDateStr(p.fecha) !== fechaFiltro) return;
      const k = p.metodo || 'No especificado';
      mapa[k] = (mapa[k] || 0) + (p.monto || 0);
      total += p.monto || 0;
    });
  });

  const { data: ventas, error: errVentas } = await supabase
    .from('ventas').select('metodo_pago, total, fecha').eq('empresa_id', empresaActivaId());
  if (errVentas) throw errVentas;
  ventas.forEach((v) => {
    if (fechaFiltro && localDateStr(v.fecha) !== fechaFiltro) return;
    const k = v.metodo_pago || 'No especificado';
    mapa[k] = (mapa[k] || 0) + (v.total || 0);
    total += v.total || 0;
  });

  return { porMetodo: mapa, total };
}

/** Igual que pagosPorMetodo, pero solo cuenta pagos desde una hora exacta en
 *  adelante — para calcular el efectivo esperado del turno en curso sin
 *  arrastrar las ventas de un turno anterior del mismo día. */
export async function pagosPorMetodoDesde(horaDesdeIso) {
  const desdeMs = horaDesdeIso ? new Date(horaDesdeIso).getTime() : -Infinity;
  const mapa = {};
  let total = 0;

  const { data: ordenes, error: errOrdenes } = await supabase
    .from('ordenes').select('pagos').eq('empresa_id', empresaActivaId());
  if (errOrdenes) throw errOrdenes;
  ordenes.forEach((o) => {
    (o.pagos || []).forEach((p) => {
      const t = new Date(p.fecha).getTime();
      if (isNaN(t) || t < desdeMs) return;
      const k = p.metodo || 'No especificado';
      mapa[k] = (mapa[k] || 0) + (p.monto || 0);
      total += p.monto || 0;
    });
  });

  const { data: ventas, error: errVentas } = await supabase
    .from('ventas').select('metodo_pago, total, fecha').eq('empresa_id', empresaActivaId());
  if (errVentas) throw errVentas;
  ventas.forEach((v) => {
    const t = new Date(v.fecha).getTime();
    if (isNaN(t) || t < desdeMs) return;
    const k = v.metodo_pago || 'No especificado';
    mapa[k] = (mapa[k] || 0) + (v.total || 0);
    total += v.total || 0;
  });

  return { porMetodo: mapa, total };
}

export async function cargarTurnosDelDia(fecha) {
  const { data, error } = await supabase
    .from('turnos').select('*').eq('empresa_id', empresaActivaId()).eq('fecha', fecha).order('hora');
  if (error) throw error;
  return data;
}

/** El turno está "en curso" solo si el último evento del día fue una apertura
 *  (si el último fue un cierre, no hay turno abierto ahora, aunque haya
 *  aperturas anteriores en el mismo día). */
export function turnoAbiertoVigente(turnos) {
  if (!turnos.length) return null;
  const ultimo = turnos[turnos.length - 1];
  return ultimo.tipo === 'apertura' ? ultimo : null;
}

export async function abrirTurno({ fecha, responsable, fondoInicial }) {
  const { data, error } = await supabase.from('turnos').insert({
    empresa_id: empresaActivaId(), fecha, hora: new Date().toISOString(),
    responsable, tipo: 'apertura', fondo_inicial: fondoInicial,
  }).select().single();
  if (error) throw error;
  return data;
}

export async function registrarCierreTurno({ fecha, responsable, detalle, folioTBK, justificacion }) {
  const diferenciaTotal = detalle.filter((d) => d.contado !== null).reduce((s, d) => s + d.diferencia, 0);
  const { data, error } = await supabase.from('turnos').insert({
    empresa_id: empresaActivaId(), fecha, hora: new Date().toISOString(),
    responsable, tipo: 'cierre', detalle, folio_tbk: folioTBK,
    justificacion, diferencia_total: diferenciaTotal,
  }).select().single();
  if (error) throw error;
  return data;
}

/** Ajuste o cierre forzado hecho por un administrador (queda marcado como tal). */
export async function registrarAjusteAdmin({ fecha, detalle, justificacion, esForzado }) {
  const diferenciaTotal = detalle.reduce((s, d) => s + (d.diferencia || 0), 0);
  const { data, error } = await supabase.from('turnos').insert({
    empresa_id: empresaActivaId(), fecha, hora: new Date().toISOString(),
    responsable: 'Admin', tipo: 'cierre', detalle,
    justificacion: `[${esForzado ? 'Cierre forzado' : 'Ajuste manual'} por administración] ${justificacion}`,
    diferencia_total: diferenciaTotal, ajuste_admin: true,
  }).select().single();
  if (error) throw error;
  return data;
}

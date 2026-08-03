import { supabase } from '../lib/supabase.js';
import { empresaActivaId } from '../auth/session.js';

export async function listarClientes() {
  const { data, error } = await supabase
    .from('clientes').select('*').eq('empresa_id', empresaActivaId()).order('monto_total', { ascending: false });
  if (error) throw error;
  return data;
}

/** Crea o actualiza el registro del cliente cada vez que compra (para detectar clientes frecuentes). */
export async function upsertClientePorVenta(nombre, telefono, monto) {
  if (!nombre) return;
  const { data: existente } = await supabase
    .from('clientes').select('*').eq('empresa_id', empresaActivaId()).ilike('nombre', nombre).maybeSingle();

  if (existente) {
    await supabase.from('clientes').update({
      compras_totales: (existente.compras_totales || 0) + 1,
      monto_total: (existente.monto_total || 0) + monto,
      ultima_compra: new Date().toISOString(),
      telefono: telefono || existente.telefono,
    }).eq('id', existente.id);
  } else {
    await supabase.from('clientes').insert({
      empresa_id: empresaActivaId(), nombre, telefono: telefono || '',
      compras_totales: 1, monto_total: monto, ultima_compra: new Date().toISOString(),
    });
  }
}

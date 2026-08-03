import { supabase } from '../lib/supabase.js';
import { empresaActivaId } from '../auth/session.js';

export async function listarProductos({ soloActivos = true } = {}) {
  let query = supabase.from('productos').select('*').eq('empresa_id', empresaActivaId()).order('nombre');
  if (soloActivos) query = query.eq('activo', true);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function crearProducto(datos) {
  if (datos.sku) {
    const { data: existente } = await supabase
      .from('productos').select('id').eq('empresa_id', empresaActivaId())
      .eq('activo', true).ilike('sku', datos.sku).maybeSingle();
    if (existente) throw new Error('Ese SKU ya está en uso.');
  }
  const { data, error } = await supabase
    .from('productos')
    .insert({ empresa_id: empresaActivaId(), activo: true, ...datos })
    .select().single();
  if (error) throw error;
  return data;
}

export async function ajustarStock(productoId, delta) {
  const { data: actual, error: errLectura } = await supabase
    .from('productos').select('stock').eq('id', productoId).single();
  if (errLectura) throw errLectura;
  const nuevoStock = Math.max(0, (actual.stock || 0) + delta);
  const { data, error } = await supabase
    .from('productos').update({ stock: nuevoStock }).eq('id', productoId).select().single();
  if (error) throw error;
  return data;
}

/** "Elimina" el producto (lo desactiva) — no borra el historial de ventas que lo referencian. */
export async function eliminarProducto(productoId) {
  const { error } = await supabase.from('productos').update({ activo: false }).eq('id', productoId);
  if (error) throw error;
}

export function suscribirseAProductos(callback) {
  const nombreCanal = `productos-cambios-${crypto.randomUUID()}`;
  const canal = supabase
    .channel(nombreCanal)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'productos', filter: `empresa_id=eq.${empresaActivaId()}` },
      callback
    )
    .subscribe();
  return () => supabase.removeChannel(canal);
}

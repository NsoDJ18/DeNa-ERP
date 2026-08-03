import { supabase } from '../lib/supabase.js';
import { empresaActivaId } from '../auth/session.js';
import { ajustarStock } from './productos.js';
import { upsertClientePorVenta } from './clientes.js';
import { todayStr } from '../lib/util.js';

export async function listarVentasDeHoy() {
  const hoy = todayStr();
  const { data, error } = await supabase
    .from('ventas').select('*').eq('empresa_id', empresaActivaId())
    .gte('fecha', hoy + 'T00:00:00').order('fecha', { ascending: false });
  if (error) throw error;
  return data;
}

/** Registra una venta de mostrador: descuenta stock de los productos con
 *  productoId y actualiza el registro del cliente si se indicó uno. */
export async function registrarVenta({ items, metodoPago, responsable, clienteNombre, clienteTelefono }) {
  const total = items.reduce((s, it) => s + it.subtotal, 0);
  const { data: venta, error } = await supabase.from('ventas').insert({
    empresa_id: empresaActivaId(), fecha: new Date().toISOString(),
    items, total, metodo_pago: metodoPago, responsable,
    cliente_nombre: clienteNombre || null, cliente_telefono: clienteTelefono || null,
  }).select().single();
  if (error) throw error;

  for (const it of items) {
    if (it.productoId) await ajustarStock(it.productoId, -it.cantidad);
  }
  if (clienteNombre) await upsertClientePorVenta(clienteNombre, clienteTelefono, total);

  return venta;
}

export function kpisDelDia(ventas) {
  const totalHoy = ventas.reduce((s, v) => s + (v.total || 0), 0);
  const ticketProm = ventas.length ? totalHoy / ventas.length : 0;
  const conteoProd = {};
  ventas.forEach((v) => (v.items || []).forEach((it) => { conteoProd[it.nombre] = (conteoProd[it.nombre] || 0) + it.cantidad; }));
  const productos = Object.keys(conteoProd).sort((a, b) => conteoProd[b] - conteoProd[a]);
  const masVendido = productos.length ? `${productos[0]} (${conteoProd[productos[0]]})` : '—';
  return { cantidad: ventas.length, totalHoy, ticketProm, masVendido };
}

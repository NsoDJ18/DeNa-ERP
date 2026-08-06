import { supabase } from '../lib/supabase.js';
import { empresaActivaId } from '../auth/session.js';

export async function listarEmpleados() {
  const { data, error } = await supabase
    .from('empleados')
    .select('*')
    .eq('empresa_id', empresaActivaId())
    .order('nombre');
  if (error) throw error;
  return data;
}

export async function agregarEmpleado(nombre) {
  const { data, error } = await supabase
    .from('empleados')
    .insert({ empresa_id: empresaActivaId(), nombre })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Agrega un nombre a las sugerencias SOLO si no existe todavía — pensado
 *  para llamarse solo, en segundo plano, cada vez que alguien escribe un
 *  nombre nuevo en un campo "responsable"/"vendedor(a)". Así el
 *  autocompletado se llena solo con el uso normal, sin necesitar el panel
 *  de Empleados (que en Bronce está reservado a soporte). No falla la
 *  pantalla si esto no funciona — es una mejora silenciosa, no crítica. */
export async function sugerirEmpleado(nombre) {
  if (!nombre || !nombre.trim()) return;
  try {
    const actuales = await listarEmpleados();
    const yaExiste = actuales.some((e) => e.nombre.toLowerCase() === nombre.trim().toLowerCase());
    if (!yaExiste) await agregarEmpleado(nombre.trim());
  } catch (e) {
    console.error('No se pudo sugerir el nombre para autocompletado:', e);
  }
}

export async function eliminarEmpleado(empleadoId) {
  const { error } = await supabase.from('empleados').delete().eq('id', empleadoId);
  if (error) throw error;
}

/** Rellena un <datalist> con los nombres de los trabajadores, para autocompletar campos "responsable". */
export async function llenarDatalistEmpleados(datalistEl) {
  const empleados = await listarEmpleados();
  datalistEl.innerHTML = empleados.map((e) => `<option value="${escapeHtml(e.nombre)}">`).join('');
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

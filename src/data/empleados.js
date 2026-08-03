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

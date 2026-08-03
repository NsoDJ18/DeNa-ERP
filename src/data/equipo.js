import { supabase } from '../lib/supabase.js';
import { empresaActivaId } from '../auth/session.js';

/** Lista a todo el equipo vinculado a la empresa activa (requiere ser admin, por RLS). */
export async function listarEquipo() {
  const { data, error } = await supabase
    .from('usuarios_empresas')
    .select('usuario_id, rol, nombre_mostrar, creado_en')
    .eq('empresa_id', empresaActivaId())
    .order('creado_en');
  if (error) throw error;
  return data;
}

export async function cambiarRolMiembro(usuarioId, nuevoRol) {
  const { error } = await supabase
    .from('usuarios_empresas')
    .update({ rol: nuevoRol })
    .eq('usuario_id', usuarioId)
    .eq('empresa_id', empresaActivaId());
  if (error) throw error;
}

export async function actualizarNombreMiembro(usuarioId, nombreMostrar) {
  const { error } = await supabase
    .from('usuarios_empresas')
    .update({ nombre_mostrar: nombreMostrar })
    .eq('usuario_id', usuarioId)
    .eq('empresa_id', empresaActivaId());
  if (error) throw error;
}

/** Vincula a alguien que ya se registró (por correo) a la empresa activa, con un rol. */
export async function invitarMiembro(email, rol, nombreMostrar) {
  const { data, error } = await supabase.functions.invoke('invitar-miembro', {
    body: { email, rol, nombreMostrar },
  });
  if (error) {
    // el cuerpo del error de la función (si lo hay) trae el mensaje real
    const detalle = await error.context?.json?.().catch(() => null);
    throw new Error(detalle?.error || error.message);
  }
  return data;
}

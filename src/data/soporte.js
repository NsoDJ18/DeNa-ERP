import { supabase } from '../lib/supabase.js';
import { empresaActivaId } from '../auth/session.js';

/** Cambia el plan de la empresa activa. Solo funciona si quien llama es
 *  soporte TI — hay un candado real en la base de datos que lo exige,
 *  esto no es solo una restricción de interfaz. */
export async function cambiarPlanEmpresa(nuevoPlan) {
  const { error } = await supabase
    .from('empresas').update({ plan: nuevoPlan }).eq('id', empresaActivaId());
  if (error) throw error;
}

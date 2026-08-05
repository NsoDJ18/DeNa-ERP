// supabase/functions/autorizar-nc-admin/index.ts
//
// Reemplaza el PIN compartido: para aplicar una nota de crédito desde
// Punto de venta, el ADMINISTRADOR (no encargado, solo admin) debe escribir
// su propio correo y contraseña ahí mismo. Esta función los valida contra
// Supabase Auth de verdad — si son correctos, confirma que esa cuenta es
// admin de la empresa dueña del pedido, y recién ahí aplica la nota de
// crédito. Nada de esto queda expuesto al navegador: el navegador solo
// manda correo/clave y recibe "sí" o "no".

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { CORS_HEADERS, jsonResponse } from '../_compartido/http.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  try {
    const { email, password, ordenId, nuevoPrecio, motivo, metodoDevolucion } = await req.json();
    if (!email || !password || !ordenId || nuevoPrecio === undefined || !motivo) {
      return jsonResponse({ error: 'Faltan datos obligatorios.' }, 400);
    }

    // 1) ¿La contraseña es correcta? Cliente aparte (anon), no toca la
    //    sesión del navegador que está llamando.
    const supabaseVerificacion = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!
    );
    const { data: authData, error: authError } = await supabaseVerificacion.auth.signInWithPassword({ email, password });
    if (authError || !authData.user) {
      return jsonResponse({ error: 'Correo o contraseña incorrectos.' }, 401);
    }
    const adminUserId = authData.user.id;

    // 2) Con permisos elevados: confirma que esa cuenta es ADMIN (no
    //    encargado, no trabajador) de la empresa dueña de este pedido.
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    const { data: orden, error: errOrden } = await supabaseAdmin
      .from('ordenes').select('empresa_id').eq('id', ordenId).single();
    if (errOrden || !orden) return jsonResponse({ error: 'Pedido no encontrado.' }, 404);

    const { data: membresia } = await supabaseAdmin
      .from('usuarios_empresas')
      .select('rol, nombre_mostrar')
      .eq('usuario_id', adminUserId)
      .eq('empresa_id', orden.empresa_id)
      .maybeSingle();

    if (!membresia || membresia.rol !== 'admin') {
      return jsonResponse({ error: 'Esa cuenta no tiene permisos de administrador en esta empresa.' }, 403);
    }

    // 3) Recién acá se aplica — usando la función que SOLO el servidor puede llamar.
    const { data, error } = await supabaseAdmin.rpc('aplicar_nota_credito_verificada', {
      p_orden_id: ordenId,
      p_nuevo_precio: nuevoPrecio,
      p_motivo: motivo,
      p_autorizado_por: membresia.nombre_mostrar || email,
      p_metodo_devolucion: metodoDevolucion || 'Efectivo',
    });
    if (error) return jsonResponse({ error: error.message }, 500);

    return jsonResponse({ ok: true, ...data });
  } catch (e) {
    console.error(e);
    return jsonResponse({ error: 'Error interno al autorizar la nota de crédito.' }, 500);
  }
});

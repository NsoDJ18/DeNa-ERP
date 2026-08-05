// supabase/functions/invitar-miembro/index.ts
//
// Permite que un admin vincule a alguien que YA se registró (con su propio
// correo, desde el login normal) a su empresa, con un rol asignado — sin
// tener que entrar a Supabase directamente. Respeta el límite de usuarios
// de cada plan (mantener sincronizado con src/planes.js si cambian los números).
//
// El front-end llama a esta función con su propio token de sesión (Authorization:
// Bearer <token del admin>). La función usa la service_role key SOLO del lado
// del servidor para: (1) confirmar que quien llama es admin, (2) buscar el
// usuario por correo, (3) crear el vínculo.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { CORS_HEADERS, jsonResponse } from '../_compartido/http.ts';

// Debe coincidir con src/planes.js — si cambian los límites ahí, cámbialos acá también.
const LIMITE_USUARIOS: Record<string, number | null> = { bronce: 3, plata: 11, oro: null };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  try {
    const { email, rol, nombreMostrar } = await req.json();
    if (!email || !rol) return jsonResponse({ error: 'Faltan datos: email y rol son obligatorios.' }, 400);
    if (!['admin', 'encargado', 'trabajador'].includes(rol)) {
      return jsonResponse({ error: 'Rol inválido.' }, 400);
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return jsonResponse({ error: 'Falta la sesión del administrador.' }, 401);

    // Cliente "como el usuario que llama" — sirve para confirmar quién es.
    const supabaseComoUsuario = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: errUsuario } = await supabaseComoUsuario.auth.getUser();
    if (errUsuario || !user) return jsonResponse({ error: 'Sesión inválida.' }, 401);

    // Cliente con permisos elevados — solo para las operaciones que lo requieren.
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Confirma que quien llama es admin de AL MENOS una empresa, y usa esa.
    const { data: miembresia, error: errMiembresia } = await supabaseAdmin
      .from('usuarios_empresas')
      .select('empresa_id')
      .eq('usuario_id', user.id)
      .eq('rol', 'admin')
      .limit(1)
      .maybeSingle();
    if (errMiembresia || !miembresia) {
      return jsonResponse({ error: 'Solo un administrador puede invitar miembros.' }, 403);
    }
    const empresaId = miembresia.empresa_id;

    // ¿Quien invita es soporte TI? Si lo es, no aplica el límite de usuarios
    // (necesita poder entrar a cualquier empresa de prueba sin tope).
    const { data: esTI } = await supabaseAdmin
      .from('ti_super_admins').select('email').eq('email', user.email ?? '').maybeSingle();

    if (!esTI) {
      const { data: empresa } = await supabaseAdmin.from('empresas').select('plan').eq('id', empresaId).single();
      const limite = LIMITE_USUARIOS[empresa?.plan ?? 'bronce'];
      if (limite !== null) {
        const { count } = await supabaseAdmin
          .from('usuarios_empresas').select('*', { count: 'exact', head: true }).eq('empresa_id', empresaId);
        if ((count ?? 0) >= limite) {
          return jsonResponse({
            error: `Tu plan (${empresa?.plan}) permite hasta ${limite} usuarios. Sube de plan para agregar más.`,
          }, 403);
        }
      }
    }

    // Busca al usuario objetivo por correo (debe haberse registrado antes).
    const { data: listado, error: errListado } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    if (errListado) throw errListado;
    const usuarioObjetivo = listado.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (!usuarioObjetivo) {
      return jsonResponse({
        error: 'No encontramos una cuenta con ese correo. Pide a la persona que se registre primero desde la pantalla de login (¿Primera vez? Crea tu cuenta), y vuelve a intentarlo.',
      }, 404);
    }

    const { error: errUpsert } = await supabaseAdmin.from('usuarios_empresas').upsert({
      usuario_id: usuarioObjetivo.id,
      empresa_id: empresaId,
      rol,
      nombre_mostrar: nombreMostrar || usuarioObjetivo.email,
    });
    if (errUpsert) throw errUpsert;

    return jsonResponse({ ok: true, mensaje: `${email} vinculado como ${rol}.` });
  } catch (e) {
    console.error(e);
    return jsonResponse({ error: 'Error interno al invitar al miembro.' }, 500);
  }
});

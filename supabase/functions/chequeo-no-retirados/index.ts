// supabase/functions/chequeo-no-retirados/index.ts
//
// Reemplaza la lógica que en el prototipo HTML corría en el navegador
// (rccCheckNoRetirados). Se ejecuta sola cada cierto tiempo (ver
// supabase/functions/README.md para programar el cron), revisa TODAS las
// empresas, y pasa a "no_retirado" cualquier pedido que lleve más del
// tiempo máximo configurado en Estación 05 sin cerrarse.
//
// No necesita variables de entorno propias — usa las automáticas de Supabase.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { CORS_HEADERS, jsonResponse } from '../_compartido/http.ts';

const TMAX_DEFAULT = 4320; // minutos, igual que el prototipo (3 días)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const { data: pendientes, error } = await supabase
      .from('ordenes')
      .select('id, empresa_id, timestamps')
      .eq('estado', 'listo');
    if (error) throw error;

    if (!pendientes?.length) return jsonResponse({ revisados: 0, marcados: 0 });

    // trae el tiempo máximo configurado por cada empresa involucrada, de una sola vez
    const empresaIds = [...new Set(pendientes.map((o) => o.empresa_id))];
    const { data: configs } = await supabase
      .from('configuracion')
      .select('empresa_id, tiempos_max')
      .in('empresa_id', empresaIds);
    const tmaxPorEmpresa = new Map(
      (configs || []).map((c) => [c.empresa_id, c.tiempos_max?.listo ?? TMAX_DEFAULT])
    );

    const ahora = Date.now();
    let marcados = 0;

    for (const orden of pendientes) {
      const entradaListo = orden.timestamps?.listo;
      if (!entradaListo) continue;
      const minutos = (ahora - new Date(entradaListo).getTime()) / 60000;
      const limite = tmaxPorEmpresa.get(orden.empresa_id) ?? TMAX_DEFAULT;

      if (minutos > limite) {
        await supabase
          .from('ordenes')
          .update({
            estado: 'no_retirado',
            timestamps: { ...orden.timestamps, no_retirado: new Date().toISOString() },
          })
          .eq('id', orden.id);
        marcados++;
      }
    }

    return jsonResponse({ revisados: pendientes.length, marcados });
  } catch (e) {
    console.error(e);
    return jsonResponse({ error: 'Error interno en el chequeo de no retirados.' }, 500);
  }
});

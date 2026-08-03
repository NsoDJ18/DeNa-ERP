// supabase/functions/confirmar-transaccion-webpay/index.ts
//
// Transbank redirige al cliente de vuelta a tu returnUrl con un parámetro
// token_ws por POST. Esa página del frontend debe llamar a esta función
// para "confirmar" (commit) la transacción y saber si el pago fue exitoso.
//
// Mismas variables de entorno que crear-transaccion-webpay.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { CORS_HEADERS, jsonResponse } from '../_compartido/http.ts';

const TBK_BASE_URL = Deno.env.get('TBK_ENVIRONMENT') === 'produccion'
  ? 'https://webpay3g.transbank.cl'
  : 'https://webpay3gint.transbank.cl';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  try {
    const { token, ordenId, metodoPago } = await req.json();
    if (!token || !ordenId) {
      return jsonResponse({ error: 'Faltan datos: token y ordenId son obligatorios.' }, 400);
    }

    const resp = await fetch(
      `${TBK_BASE_URL}/rswebpaytransaction/api/webpay/v1.2/transactions/${token}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Tbk-Api-Key-Id': Deno.env.get('TBK_COMMERCE_CODE')!,
          'Tbk-Api-Key-Secret': Deno.env.get('TBK_API_KEY')!,
        },
      }
    );

    if (!resp.ok) {
      const detalle = await resp.text();
      console.error('Transbank rechazó la confirmación:', detalle);
      return jsonResponse({ error: 'No se pudo confirmar la transacción.', detalle }, 502);
    }

    const resultado = await resp.json();
    // response_code === 0 y status === 'AUTHORIZED' = pago aprobado
    const aprobado = resultado.response_code === 0 && resultado.status === 'AUTHORIZED';

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    if (aprobado) {
      const { data: orden } = await supabase.from('ordenes').select('pagos, abono').eq('id', ordenId).single();
      const nuevoPago = {
        monto: resultado.amount,
        metodo: metodoPago || (resultado.payment_type_code === 'VD' ? 'Débito' : 'Crédito'),
        fecha: new Date().toISOString(),
        folioTBK: String(resultado.authorization_code),
      };
      await supabase.from('ordenes').update({
        pagos: [...(orden?.pagos || []), nuevoPago],
        abono: (orden?.abono || 0) + resultado.amount,
        pago_pendiente_token: null,
      }).eq('id', ordenId);
    }

    return jsonResponse({ aprobado, detalle: resultado });
  } catch (e) {
    console.error(e);
    return jsonResponse({ error: 'Error interno al confirmar la transacción.' }, 500);
  }
});

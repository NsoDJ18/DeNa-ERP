// supabase/functions/confirmar-transaccion-webpay/index.ts
//
// El frontend vuelve del banco solo con "token_ws" (no sabe el ID interno
// del pedido) — esta función lo busca sola por ese token, confirma
// ("commit") la transacción con Transbank, y si el pago fue aprobado,
// registra el pago en el pedido. Devuelve los datos del pedido para que
// el frontend muestre folio/cliente sin tener que consultarlo aparte.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { CORS_HEADERS, jsonResponse } from '../_compartido/http.ts';

const TBK_BASE_URL = Deno.env.get('TBK_ENVIRONMENT') === 'produccion'
  ? 'https://webpay3g.transbank.cl'
  : 'https://webpay3gint.transbank.cl';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  try {
    const { token } = await req.json();
    if (!token) return jsonResponse({ error: 'Falta el token.' }, 400);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: orden, error: errOrden } = await supabase
      .from('ordenes').select('*').eq('pago_pendiente_token', token).maybeSingle();
    if (errOrden || !orden) {
      return jsonResponse({ error: 'No encontramos un pedido esperando este pago (¿ya se confirmó antes?).' }, 404);
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
      return jsonResponse({ error: 'No se pudo confirmar la transacción con Transbank.', detalle }, 502);
    }

    const resultado = await resp.json();
    // response_code === 0 y status === 'AUTHORIZED' = pago aprobado
    const aprobado = resultado.response_code === 0 && resultado.status === 'AUTHORIZED';

    if (aprobado) {
      const metodoPago = resultado.payment_type_code === 'VD' ? 'Débito' : 'Crédito';
      const nuevoAbono = (orden.abono || 0) + resultado.amount;
      const nuevoPago = {
        monto: resultado.amount, metodo: metodoPago, fecha: new Date().toISOString(),
        folioTBK: String(resultado.authorization_code),
      };
      const saldoRestante = (orden.precio || 0) - nuevoAbono;

      await supabase.from('ordenes').update({
        pagos: [...(orden.pagos || []), nuevoPago],
        abono: nuevoAbono,
        pago_pendiente_token: null,
        // si con este pago quedó todo cubierto y el pedido ya estaba
        // "listo", lo cerramos directo — igual que la entrega con pago manual
        ...(saldoRestante <= 0 && orden.estado === 'listo'
          ? { estado: 'entregado', timestamps: { ...orden.timestamps, entregado: new Date().toISOString() } }
          : {}),
      }).eq('id', orden.id);
    }

    return jsonResponse({
      aprobado, detalle: resultado,
      orden: { folio: orden.folio, cliente: orden.cliente },
    });
  } catch (e) {
    console.error(e);
    return jsonResponse({ error: 'Error interno al confirmar la transacción.' }, 500);
  }
});

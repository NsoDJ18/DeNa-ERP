// supabase/functions/crear-transaccion-webpay/index.ts
//
// Crea una transacción de pago con Webpay Plus (Transbank) para una orden,
// y devuelve el token + la URL base a la que el FRONTEND debe redirigir al
// cliente (con un formulario POST, no pegando el token en la URL — así lo
// exige Transbank).
//
// Variables de entorno necesarias (configurar con `supabase secrets set`):
//   TBK_COMMERCE_CODE  → código de comercio (usa el de integración para probar)
//   TBK_API_KEY        → llave secreta de la API
//   TBK_ENVIRONMENT     → "integracion" o "produccion"
//
// Credenciales de INTEGRACIÓN (pruebas, sin contrato con Transbank) según
// la documentación oficial de Transbank Developers — verifícalas en
// https://www.transbankdevelopers.cl/documentacion/como_empezar antes de
// usarlas, por si Transbank las actualizó:
//   TBK_COMMERCE_CODE = 597055555532
//   TBK_API_KEY        = 579B532A7440BB0C9079DED94D31EA1615BACEB56610332264630D42D0A36B1C
//
// Tarjeta de prueba para pagar en el ambiente de integración:
//   VISA 4051885600446623 · CVV 123 · cualquier fecha de vencimiento futura
//   RUT 11.111.111-1 · clave 123 (formulario de autenticación del banco)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { CORS_HEADERS, jsonResponse } from '../_compartido/http.ts';

const TBK_BASE_URL = Deno.env.get('TBK_ENVIRONMENT') === 'produccion'
  ? 'https://webpay3g.transbank.cl'
  : 'https://webpay3gint.transbank.cl';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  try {
    const { ordenId, monto } = await req.json();
    if (!ordenId || !monto) {
      return jsonResponse({ error: 'Faltan datos: ordenId y monto son obligatorios.' }, 400);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // El regreso siempre pasa por recibir-pago-webpay (una función nuestra,
    // no el sitio estático directo) — Transbank vuelve con un POST, y un
    // sitio estático no puede leer el cuerpo de un POST. Esa función
    // recibe el POST y redirige al sitio real con el token como parámetro
    // GET, que el frontend sí puede leer.
    const returnUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/recibir-pago-webpay`;

    // buyOrder y sessionId deben ser únicos y de máx. 26 caracteres para Transbank
    const buyOrder = `OT-${ordenId}`.slice(0, 26);
    const sessionId = crypto.randomUUID().slice(0, 26);

    const resp = await fetch(`${TBK_BASE_URL}/rswebpaytransaction/api/webpay/v1.2/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Tbk-Api-Key-Id': Deno.env.get('TBK_COMMERCE_CODE')!,
        'Tbk-Api-Key-Secret': Deno.env.get('TBK_API_KEY')!,
      },
      body: JSON.stringify({
        buy_order: buyOrder,
        session_id: sessionId,
        amount: Math.round(monto),
        return_url: returnUrl,
      }),
    });

    if (!resp.ok) {
      const detalle = await resp.text();
      console.error('Transbank rechazó la creación de la transacción:', detalle);
      return jsonResponse({ error: 'Transbank no pudo crear la transacción.', detalle }, 502);
    }

    const { token, url } = await resp.json();

    // Guardamos el token pendiente en la orden para poder conciliar cuando Transbank confirme.
    await supabase
      .from('ordenes')
      .update({ pago_pendiente_token: token })
      .eq('id', ordenId);

    // El frontend arma un <form method="POST" action="url"> con token_ws=token
    // y lo envía — NUNCA se pega el token en la URL como texto, Transbank
    // rechaza eso.
    return jsonResponse({ token, url });
  } catch (e) {
    console.error(e);
    return jsonResponse({ error: 'Error interno al crear la transacción.' }, 500);
  }
});

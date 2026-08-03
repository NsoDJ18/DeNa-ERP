// supabase/functions/notificar-whatsapp/index.ts
//
// Se activa automáticamente vía Database Webhook cuando cambia una fila de
// "ordenes" (ver instrucciones de conexión en supabase/functions/README.md).
// Envía un WhatsApp al cliente usando la API oficial de WhatsApp Business
// (Meta Cloud API) cuando el pedido pasa a "listo" o "no_retirado".
//
// Variables de entorno necesarias:
//   WHATSAPP_TOKEN      → token de acceso permanente de tu app de Meta
//   WHATSAPP_PHONE_ID   → ID del número de teléfono de WhatsApp Business
//
// Importante: fuera de una ventana de 24 h desde el último mensaje del
// cliente, Meta EXIGE usar una "plantilla" (template) pre-aprobada, no
// texto libre. Este código usa una plantilla llamada "pedido_listo" como
// ejemplo — debes crearla y aprobarla en Meta Business Manager antes de
// que esto funcione en producción. Mientras la apruebas, puedes probar
// con mensajes de texto libre solo si el cliente te escribió en las
// últimas 24 h.

import { CORS_HEADERS, jsonResponse } from '../_compartido/http.ts';

const MENSAJES_POR_ESTADO: Record<string, (folio: string, cliente: string) => string> = {
  listo: (folio, cliente) =>
    `Hola ${cliente} 👋, tu pedido ${folio} ya está *listo para retirar*. ¡Te esperamos!`,
  no_retirado: (folio, cliente) =>
    `Hola ${cliente}, tu pedido ${folio} sigue esperando que lo retires. ¿Necesitas coordinar un horario?`,
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  try {
    // Formato que envía un Database Webhook de Supabase al disparar por UPDATE:
    // { type: "UPDATE", table: "ordenes", record: {...fila nueva...}, old_record: {...fila anterior...} }
    const payload = await req.json();
    const orden = payload.record;
    const anterior = payload.old_record;

    if (!orden || orden.estado === anterior?.estado) {
      // no cambió el estado (puede ser otro campo) → no hay nada que avisar
      return jsonResponse({ enviado: false, motivo: 'estado sin cambios' });
    }

    const generarMensaje = MENSAJES_POR_ESTADO[orden.estado];
    if (!generarMensaje || !orden.telefono) {
      return jsonResponse({ enviado: false, motivo: 'estado sin plantilla o sin teléfono' });
    }

    const telefono = normalizarTelefonoChile(orden.telefono);
    const texto = generarMensaje(orden.folio, orden.cliente);

    const resp = await fetch(
      `https://graph.facebook.com/v20.0/${Deno.env.get('WHATSAPP_PHONE_ID')}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${Deno.env.get('WHATSAPP_TOKEN')}`,
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: telefono,
          type: 'text',
          text: { body: texto },
        }),
      }
    );

    if (!resp.ok) {
      const detalle = await resp.text();
      console.error('WhatsApp rechazó el envío:', detalle);
      return jsonResponse({ enviado: false, error: detalle }, 502);
    }

    return jsonResponse({ enviado: true });
  } catch (e) {
    console.error(e);
    return jsonResponse({ error: 'Error interno al notificar por WhatsApp.' }, 500);
  }
});

/** Normaliza a formato E.164 asumiendo Chile (+56) si no viene con código de país. */
function normalizarTelefonoChile(telefono: string): string {
  const soloDigitos = telefono.replace(/\D/g, '');
  if (soloDigitos.startsWith('56')) return soloDigitos;
  if (soloDigitos.startsWith('9') && soloDigitos.length === 9) return `56${soloDigitos}`;
  return soloDigitos;
}

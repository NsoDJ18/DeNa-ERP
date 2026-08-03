# Edge Functions — despliegue y conexión

Cuatro funciones, cada una resuelve una de las "acciones" que pediste:

| Función | Qué hace | Se activa |
|---|---|---|
| `crear-transaccion-webpay` | Inicia un cobro real con tarjeta (Transbank) | La llama tu app cuando el cliente hace clic en "Pagar" |
| `confirmar-transaccion-webpay` | Confirma el pago y lo registra en la orden | La llama tu app cuando Transbank redirige de vuelta |
| `notificar-whatsapp` | Avisa al cliente por WhatsApp | Sola, cuando un pedido cambia de estado (Database Webhook) |
| `chequeo-no-retirados` | Marca pedidos vencidos en Estación 05 | Sola, cada 15-30 min (Cron Job) |

## 1. Instalar la CLI de Supabase y conectar el proyecto

```bash
npm install -g supabase
supabase login
supabase link --project-ref TU-PROJECT-REF
```

(`TU-PROJECT-REF` está en la URL de tu proyecto: `https://TU-PROJECT-REF.supabase.co`)

## 2. Configurar los secretos (nunca van en el código ni en git)

```bash
# Transbank — empieza con las credenciales de INTEGRACIÓN (pruebas):
supabase secrets set TBK_COMMERCE_CODE=597055555532
supabase secrets set TBK_API_KEY=579B532A7440BB0C9079DED94D31EA1615BACEB56610332264630D42D0A36B1C
supabase secrets set TBK_ENVIRONMENT=integracion

# WhatsApp Business (Meta) — ver paso 5 para obtener estos valores:
supabase secrets set WHATSAPP_TOKEN=tu-token-de-meta
supabase secrets set WHATSAPP_PHONE_ID=tu-id-de-numero
```

`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` los agrega Supabase automáticamente
a todas las funciones — no hace falta configurarlos a mano. La *service role
key* puede saltarse Row Level Security, por eso solo se usa dentro de estas
funciones de servidor, nunca en el frontend.

## 3. Desplegar las cuatro funciones

```bash
supabase functions deploy crear-transaccion-webpay
supabase functions deploy confirmar-transaccion-webpay
supabase functions deploy notificar-whatsapp
supabase functions deploy chequeo-no-retirados
```

Cada una queda disponible en:
`https://TU-PROJECT-REF.supabase.co/functions/v1/nombre-funcion`

## 4. Conectar `notificar-whatsapp` a los cambios de pedidos

En el Dashboard de Supabase: **Database → Webhooks → Create a new hook**

- **Table**: `ordenes`
- **Events**: `Update`
- **Type**: `Supabase Edge Functions`
- **Edge Function**: `notificar-whatsapp`

Listo — cada vez que cambie el estado de un pedido, Supabase llama sola a
la función, sin que tu app tenga que hacer nada extra.

## 5. Conectar `chequeo-no-retirados` a un horario (Cron)

En el Dashboard: **Database → Cron Jobs → Create a new cron job**

- **Name**: `chequeo-no-retirados`
- **Schedule**: `*/15 * * * *` (cada 15 minutos)
- **Type**: `Edge Function`
- **Edge Function**: `chequeo-no-retirados`

## 6. Conseguir las credenciales de WhatsApp Business (Meta)

1. Crea una cuenta en [business.facebook.com](https://business.facebook.com) si no tienes.
2. Ve a [developers.facebook.com](https://developers.facebook.com) → "Mis apps" → "Crear app" → tipo "Negocio".
3. Agrega el producto **WhatsApp** a la app.
4. En la configuración de WhatsApp encontrarás el **Phone Number ID** (así se
   llama `WHATSAPP_PHONE_ID`) y puedes generar un **token de acceso**.
   El token de prueba dura 24 h — para uno permanente, sigue la guía de Meta
   para "system user token" (se genera una sola vez y no expira).
5. **Importante**: para escribirle primero a un cliente (fuera de una
   conversación abierta hace menos de 24 h), Meta exige usar una *plantilla*
   pre-aprobada, no texto libre. Crea una plantilla llamada `pedido_listo`
   en Meta Business Manager → WhatsApp Manager → Plantillas de mensajes, y
   espera la aprobación (usualmente unas horas) antes de depender de esto
   en producción.

## 7. Probar el pago con Transbank (ambiente de integración)

Con las credenciales de integración ya configuradas (paso 2), cualquier
pago de prueba se hace con:

- Tarjeta: **4051885600446623**, CVV **123**, cualquier fecha futura
- RUT del formulario bancario: **11.111.111-1**, clave **123**

Cuando tengas el negocio real dado de alta con Transbank (te dan un código
de comercio de **producción**, distinto al de integración), cambias:

```bash
supabase secrets set TBK_COMMERCE_CODE=tu-codigo-real
supabase secrets set TBK_API_KEY=tu-llave-real
supabase secrets set TBK_ENVIRONMENT=produccion
```

y vuelves a desplegar las dos funciones de Webpay.

## Nota de seguridad

Ninguna de estas funciones expone tus llaves secretas al navegador — el
frontend solo llama a la *URL* de la función (que sí es pública), y la
función es la que usa los secretos del lado del servidor. Verifica siempre
las credenciales de integración de Transbank contra la documentación
oficial (transbankdevelopers.cl) antes de depender de ellas: Transbank las
actualiza de vez en cuando y no puedo garantizar que sigan vigentes después
de la fecha de esta guía.

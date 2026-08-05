# Estado real del proyecto — repaso completo

*Última actualización: después de nota de crédito con flujo de solicitud.*

## ✅ Las 9 pantallas de trabajo — migradas y funcionando

| Pantalla | Estado | Notas |
|---|---|---|
| Recepción | ✅ Completa | Formulario, ticket, PDF, etiqueta. **Falta**: fotos de referencia (ver abajo) |
| Estado | ✅ Completa | Búsqueda, semáforo, detalle, notas, avanzar/cancelar, entrega con pago, nota de crédito (directa y por solicitud) |
| Torre de control | ✅ Completa | Kanban, entrega con pago |
| Hoy | ✅ Completa | Atrasados, vencen pronto, recibidos hoy, entregados hoy |
| Bodega | ✅ Completa | CRUD, alertas de stock, CSV import, precios protegidos por rol |
| Ventas | ✅ Completa | Apertura/cierre de turno, cuadratura por método, folio TBK |
| Punto de venta | ✅ Completa | Carrito, descuenta stock, clientes frecuentes, KPIs, vendedor autocompletado |
| Monitor | ✅ Completa | Pista en vivo, buscador de clientes, pantalla completa/externa |
| Administración | ✅ Completa | Resumen+alarma saldo, Solicitudes NC, Equipo+invitar, Empleados, Configuración |

**El "Selector de terminal" del HTML original no se migró tal cual** — se
reemplazó por navegación automática según el rol real de la cuenta, que es
más seguro (ver conversación anterior).

## ✅ Arquitectura e infraestructura

- Autenticación real (Supabase Auth) + multi-empresa con RLS
- 3 planes (Bronce/Plata/Oro) con funciones filtradas por plan — `src/planes.js`
- 3 roles (trabajador/encargado/admin) con autorización real en base de datos
  (triggers), no solo en la interfaz
- PWA instalable, con ícono y fondo de marca
- Tiempo real en las pantallas que lo necesitan, sin errores de navegación
- Nota de crédito con devolución que cuadra la caja

## ⚠️ Construido pero SIN CONECTAR — esto es lo que realmente falta

Estas piezas existen como código (Edge Functions) pero **no hay ningún botón
en la aplicación que las use todavía**. No son bugs, es trabajo que no
alcanzamos a enchufar:

1. **Pago con tarjeta (Transbank Webpay)** — las funciones
   `crear-transaccion-webpay` y `confirmar-transaccion-webpay` existen y
   están desplegables, pero **ningún botón de la app las llama**. Falta
   agregar "Pagar con tarjeta" en Recepción/Estado que abra el flujo de pago.
2. **Notificación por WhatsApp** — la función `notificar-whatsapp` existe,
   pero requiere: (a) que la despliegues, (b) que conectes el Database
   Webhook en Supabase (documentado en `supabase/functions/README.md`), y
   (c) tener la cuenta de WhatsApp Business de Meta aprobada. Nada de esto
   se puede hacer desde el código, son pasos tuyos en paneles externos.
3. **Chequeo automático de "no retirados"** — la función
   `chequeo-no-retirados` existe, pero necesita el Cron Job configurado en
   el dashboard de Supabase para correr sola.

## ⬜ Pendiente real (no empezado)

- **Fotos de referencia en Recepción** — requiere activar Supabase Storage
  (un bucket nuevo) y agregar el input de archivos + subida. No es difícil,
  pero es una pieza nueva que no hemos tocado.
- **Filtro por estado/tipo en la tabla de Administración** — hoy solo hay
  buscador de texto libre, falta el dropdown de filtro como tenía el HTML original.
- **Todas las Edge Functions deben desplegarse** — código listo no es lo
  mismo que código funcionando en producción. Ver `supabase/functions/README.md`
  para los comandos exactos (`supabase functions deploy ...`).

## Migraciones SQL — checklist de lo que debe estar corrido

Si en algún momento perdiste la cuenta de cuáles ya ejecutaste, estos son
TODOS los `.sql` que deberían estar aplicados en tu proyecto de Supabase
(además del `schema.sql` inicial):

```
migracion_empleados.sql
migracion_pagos_tbk.sql
migracion_planes.sql
migracion_rol_encargado.sql
migracion_autorizacion_precios.sql
migracion_nota_credito.sql
migracion_solicitudes_nc.sql
```

**Tip**: si tienes dudas de si alguno ya corrió, no pasa nada por volver a
correrlo — todos están escritos para ser seguros de ejecutar más de una vez
(usan `if not exists` o similar).

## 🆕 Ronda: planes reorganizados, PIN instantáneo, nombre de app

### ✅ Resuelto
- **`planes.js` reorganizado** — mapa de archivos actualizado (ya no dice
  "pendiente de migrar" en pantallas que ya están listas), agregada la
  función `nombre_app` a Plata y Oro.
- **PIN de autorización instantánea** — en Punto de Venta, cualquier
  trabajador puede buscar un pedido por folio y pedir una nota de crédito;
  un encargado/admin la valida ahí mismo con un PIN (configurado en
  Administración → Configuración), sin pasar por la cola de Solicitudes.
  El candado real vive en la base de datos (función `aplicar_nota_credito_con_pin`),
  el PIN nunca se expone al navegador — solo se valida server-side.
- **Nombre de la app personalizable** (Plata/Oro) — "DENA ERP" en el menú
  se puede reemplazar por el nombre del negocio, desde Administración → Configuración.
- **Filtro por estado y tipo** en la tabla de Administración → Resumen.

### Dos formas de nota de crédito ahora conviven, a propósito
- **Cola de solicitudes** (Estado → trabajador solicita → Admin revisa
  cuando puede) — pensada para pedidos, sin apuro.
- **PIN instantáneo** (Punto de Venta → buscar folio → validar en el
  momento) — pensada para el mostrador, con el cliente esperando.
Ambas terminan en la misma función de nota de crédito, así que el
historial y la cuadratura de caja quedan iguales sin importar cuál se usó.

### ⬜ Sigue pendiente (próxima ronda, ya acordado)
- Conectar el botón de pago con tarjeta (Transbank) a la interfaz
- Fotos de referencia en Recepción (Supabase Storage)
- Nota de crédito para ventas de mostrador (hoy el PIN solo aplica a
  pedidos/órdenes, no a una venta ya registrada en Punto de Venta)
- Desplegar las Edge Functions + configurar el Cron Job de no retirados

## 🆕 Corrección de seguridad: PIN reemplazado por verificación real

El PIN compartido tenía un problema de fondo: cualquiera que lo supiera
(incluido el propio trabajador) podía usarlo, sin importar si realmente
era encargado o admin. Se reemplazó por completo:

- **Ya no hay PIN configurable.** Se quitó el campo de Administración → Configuración.
- **Solo el ADMINISTRADOR puede autorizar** (ya no encargado de turno).
- La autorización desde Punto de Venta ahora pide **correo y contraseña
  reales** del administrador, verificados de verdad contra Supabase Auth
  en el servidor — nunca se compara nada en el navegador.
- Nueva función de base de datos `aplicar_nota_credito_verificada`, que
  **solo el servidor puede invocar** (revocado el permiso para cualquier
  usuario normal) — así ni la Edge Function puede saltarse el candado.

**Nueva migración**: `migracion_nc_verificada_admin.sql` (reemplaza en la
práctica a `migracion_pin_autorizacion.sql` — puedes correr ambas sin
problema, la del PIN simplemente queda sin uso).

**Debes desplegar la nueva Edge Function** cuando estés en tu laptop:
```
supabase functions deploy autorizar-nc-admin
```

# Backlog de migración — HTML original → dena-erp-web

Estado actual: **8 de 10 pantallas migradas y validadas con build real**.

## ✅ Migradas y funcionando
- Recepción — formulario completo, genera la orden en Supabase
- Estado — búsqueda, semáforo de plazos, modal de detalle, tiempo real
- Torre de control — tablero de 5 estaciones, alertas por tiempo máximo
- Bodega — productos, SKU, stock, alertas de mínimo
- Ventas — abrir/cerrar turno, verificación por método de pago, folio TBK
- Punto de venta — carrito, descuenta stock de Bodega, clientes frecuentes, KPIs
- Administración — KPIs, Excel, empleados, configuración, protegida por rol
- Monitor — pista de producción en vivo, buscador para clientes, pantalla completa/externa

## 🆕 Sistema de diferenciación por plan
- ✅ `src/planes.js` — un solo archivo donde defines qué funciones tiene
      Bronce / Plata / Oro.
- ✅ Menú y router filtrados según plan Y rol (`admin`/`trabajador`)
- ⬜ Falta: pantalla para cambiar el plan de una empresa sin entrar a
      Supabase directamente — por ahora se cambia a mano en Table Editor

## Selector de terminal — REEMPLAZADO por algo mejor ✅
En el HTML original, cualquiera podía elegir "Terminal de administración"
escribiendo una clave — candado de frontend, no seguridad real. En la
versión migrada, el menú se arma solo según el rol real de la cuenta
(guardado en la base de datos) — no se puede saltar escribiendo la URL.

## Login de Administración — RESUELTO ✅
Un solo login de Supabase con roles. No se migra el segundo usuario/clave
del HTML original.

## ⬜ Pendiente
- **Hoy** — vista de pedidos de hoy/vencidos/entregados hoy (no migrada)
- **Recepción**: fotos de referencia (requiere Supabase Storage), ticket
  visual, descargar PDF, imprimir etiqueta
- **Administración**: filtro por estado/tipo en la tabla (hoy solo hay
  buscador de texto)
- Nota de arquitectura: Bodega y Ventas y caja ya NO están anidadas dentro
  de Administración como en el HTML original — viven como pantallas propias
  en el menú principal. Es más simple y ya están filtradas por plan igual.

## 🆕 Feedback de esta ronda

### ✅ Resuelto
- **Pago antes de entregar** (era una regresión de la migración — ya existía
  en el HTML original y se nos quedó fuera). Ahora Estado, Torre y cualquier
  cierre a "entregado" exige registrar el saldo pendiente antes de cerrar,
  y ese pago entra automático a la cuadratura de caja del turno abierto.
- **Rol "Encargado de turno"** — nueva jerarquía intermedia entre trabajador
  y administrador. Se asigna desde Administración → Equipo.
- **Autorización real para cambiar precios en Bodega** — no es solo un botón
  escondido: hay un trigger en la base de datos que rechaza el cambio si
  quien lo intenta no es encargado o admin, así no se puede saltar desde
  fuera de la app.
- **Alarma de saldo por cobrar** en Administración → Resumen: lista los
  pedidos con saldo pendiente, no solo un número suelto.

### ⬜ Pendiente (quedó fuera de esta ronda por tiempo)
- **Vista "Hoy"** — sigue siendo la única pantalla del backlog original sin migrar.
- **Nota de crédito formal** — hoy la autorización de precios cubre Bodega;
  falta un flujo específico de "nota de crédito" para modificar el valor
  de un pedido ya facturado (Recepción/Estado), con el mismo candado de
  encargado/admin.
- **Invitar nuevos miembros del equipo sin usar Supabase directamente** —
  hoy cambiar el ROL de alguien ya vinculado se hace desde la app, pero
  vincular a alguien nuevo por primera vez todavía requiere Table Editor.
  Se puede resolver con una Edge Function que busque por correo.

## 🎉 Ronda final — backlog completo

- ✅ **Vista "Hoy"** — Atrasados, Vencen hoy/mañana, Recibidos hoy, Entregados hoy.
- ✅ **Nota de crédito real** — reducir el precio de un pedido ya facturado
  requiere ser encargado o admin, con motivo obligatorio y candado en la
  base de datos (trigger), no solo en la interfaz.
- ✅ **Invitar miembros del equipo desde la app** (Administración → Equipo)
  — ya no hace falta entrar a Supabase para vincular a alguien nuevo, solo
  su correo (debe haberse registrado antes) y el rol que le corresponde.

**Con esto, las 10 pantallas del backlog original están migradas y
funcionando.** Antes de dar por cerrado el demo: correr las migraciones SQL
pendientes (revisa la carpeta `supabase/`, quedaron varias en esta última
ronda) y pasar por el `CHECKLIST-PRUEBAS.md`.

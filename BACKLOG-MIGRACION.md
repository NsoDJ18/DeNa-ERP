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

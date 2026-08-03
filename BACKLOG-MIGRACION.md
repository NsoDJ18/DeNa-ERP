# Backlog de migración — HTML original → dena-erp-web

Última actualización: bug de creación de órdenes corregido + sistema de
planes agregado.

## 🆕 Sistema de diferenciación por plan
- ✅ `src/planes.js` — un solo archivo donde defines qué funciones tiene
      Bronce / Plata / Oro. Edítalo ahí, nada más.
- ✅ El menú de navegación se filtra solo según el plan de la empresa
- ✅ El router también bloquea el acceso por URL directa, no solo el botón
- ⬜ Falta: una pantalla para que TÚ (como dueño de DENA ERP) cambies el
      plan de una empresa sin entrar a Supabase directamente — por ahora
      se cambia a mano en Table Editor → empresas → columna "plan"

## Selector de terminal
- ⬜ Pantalla "¿Qué terminal quieres abrir?" (trabajador vs. admin)
- ⬜ Filtrar el menú de navegación según el rol (`activa.rol`, ya disponible)
- ⬜ Botón "Cambiar terminal"

## Recepción
- ✅ Formulario completo, crea la orden en Supabase
- ⬜ Fotos de referencia (requiere Supabase Storage, no solo la tabla)
- ⬜ Ticket / comprobante visual tras generar
- ⬜ Descargar PDF del comprobante (para WhatsApp)
- ⬜ Imprimir etiqueta

## Estado
- ✅ Búsqueda, semáforo de plazos, modal de detalle, avanzar/cancelar/entregar
- ✅ Tiempo real

## Hoy
- ⬜ Vista completa (pedidos de hoy, vencidos, entregados hoy) — no migrada aún

## Torre de control
- ✅ Tablero de 5 estaciones, tiempo real, alertas por tiempo máximo
- ⬜ Banda de "No retirados" arriba del tablero (Monitor ya la tiene de referencia)

## Ventas (cuadratura de caja)
- ⬜ Abrir turno / Cerrar turno
- ⬜ Verificación por método de pago (Efectivo/Débito/Transferencia/Crédito/Otro)
- ⬜ Folio de cierre TBK
- ⬜ Historial de aperturas/cierres del día

## Punto de venta
- ⬜ Carrito de productos de mostrador
- ⬜ Registro de cliente frecuente (con autocompletado)
- ⬜ KPIs del turno (ventas, ticket promedio, más vendido, cliente frecuente)

## Monitor (según Imagen 1)
- ⬜ Vista completa: pista de producción con marcadores por pedido
- ⬜ Banda "No retirados" arriba
- ⬜ Buscador "Busca tu pedido por folio o tu nombre..." (autoservicio del cliente)
- ⬜ Botones "Ventana externa" y "Pantalla completa"
- ⬜ Reloj en vivo

## Administración (según Imágenes 2 y 3)
- ⬜ Login con usuario/clave (hoy solo existe el login de Supabase Auth normal —
      falta decidir: ¿mantenemos un segundo candado tipo el original, o alcanza
      con que sea admin real de Supabase? **Pendiente de decisión, ver abajo.**)
- ⬜ Sub-navegación: Resumen | Bodega | Ventas y caja | Empleados | Configuración
- ⬜ KPIs (total pedidos, en proceso, cerrados con éxito, cancelados, no
      retirados, ingresos totales, saldo por cobrar, ticket promedio)
- ⬜ Exportar a Excel (rango de fechas + "semestre actual")
- ⬜ Tabla completa de pedidos con filtros (buscar, estado, tipo)
- ⬜ Bodega (productos, SKU, stock, alertas de mínimo)
- ⬜ Empleados (lista + autocompletado en toda la app)
- ⬜ Configuración (tiempos máximos por estación, nombre de sucursal, credenciales)
- ⬜ Registro de servicios cancelados (archivar/restaurar)
- ⬜ Respaldo de ventas semestral (exportar/restaurar JSON)

## Decisión sobre el login de Administración — RESUELTO ✅

Se usa el login único de Supabase con roles (`admin` / `trabajador`).
No se migra el segundo usuario/clave del HTML original — es redundante
y menos seguro que lo que ya existe.

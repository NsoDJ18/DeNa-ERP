// ============================================================
// CONFIGURACIÓN DE PLANES — edita SOLO este archivo para cambiar
// qué funciones incluye cada plan. No hace falta tocar nada más:
// el menú de navegación y el resto de la app leen de acá.
// ============================================================
//
// MAPA función → archivo donde vive esa pantalla (para editar su
// comportamiento, no solo si aparece o no):
//
//   recepcion            → src/views/recepcion.js
//   estado               → src/views/estado.js
//   torre                → src/views/torre.js
//   hoy                  → src/views/hoy.js            (pendiente de migrar)
//   bodega               → src/views/bodega.js         (pendiente de migrar)
//   ventas               → src/views/ventas.js         (pendiente de migrar)
//   punto_venta          → src/views/puntoVenta.js     (pendiente de migrar)
//   admin_resumen        → src/views/admin/resumen.js  (pendiente de migrar)
//   monitor              → src/views/monitor.js        (pendiente de migrar)
//   admin_avanzado       → src/views/admin/avanzado.js (pendiente de migrar)
//
// Cada pantalla es un archivo independiente y desconectado de las demás
// (mismo patrón que recepcion.js/torre.js/estado.js ya migrados): se puede
// editar, reescribir o incluso borrar una sin afectar el resto de la app.
// La única conexión entre todas es este archivo (qué plan la ve) y
// src/main.js (el botón del menú + la ruta).

export const PLANES = {
  bronce: {
    etiqueta: 'Bronce',
    precioMensual: 35900,
    funciones: [
      'recepcion',   // registro de pedidos por etapas
      'estado',      // seguimiento por pedido
      'torre',       // tablero de producción
      'hoy',
    ],
    limiteUsuarios: 1,
  },
  plata: {
    etiqueta: 'Plata',
    precioMensual: 64900,
    funciones: [
      'recepcion', 'estado', 'torre', 'hoy',
      'bodega',        // control de stock con alertas
      'ventas',        // pagos, cobros, cuadratura de caja
      'punto_venta',   // ventas de mostrador
      'admin_resumen', // KPIs y reportes de producción e ingresos
    ],
    limiteUsuarios: 3,
  },
  oro: {
    etiqueta: 'Oro',
    precioMensual: 104900,
    funciones: [
      'recepcion', 'estado', 'torre', 'hoy',
      'bodega', 'ventas', 'punto_venta', 'admin_resumen',
      'monitor',          // pantalla de producción para TV / clientes
      'admin_avanzado',   // reportes avanzados, alarmas
      'marca_propia',     // color y logo del negocio en la app
      'soporte_prioritario',
    ],
    limiteUsuarios: null, // sin límite
  },
};

/** ¿La empresa con este plan tiene acceso a esta función?
 *  Si el plan no es reconocido (vacío, mal escrito, dato viejo sin migrar),
 *  se usa Bronce como piso de seguridad — así nunca se le esconden TODOS
 *  los botones a un cliente por un dato de plan mal configurado. */
export function tieneFuncion(plan, funcion) {
  const config = PLANES[plan] || PLANES['bronce'];
  return config.funciones.includes(funcion);
}

/** Lista legible de funciones habilitadas, para mostrar en Configuración. */
export function funcionesDelPlan(plan) {
  return PLANES[plan]?.funciones || [];
}

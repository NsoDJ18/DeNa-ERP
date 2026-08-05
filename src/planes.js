// ============================================================
// CONFIGURACIÓN DE PLANES — edita SOLO este archivo para cambiar
// qué funciones incluye cada plan. No hace falta tocar nada más:
// el menú de navegación y el resto de la app leen de acá.
// ============================================================
//
// MAPA función → dónde vive (todas ya migradas y funcionando):
//
//   recepcion       → src/views/recepcion.js       (crear pedidos, ticket, PDF, etiqueta)
//   estado          → src/views/estado.js          (buscar, avanzar, entregar, nota de crédito)
//   torre           → src/views/torre.js           (tablero de producción, 5 estaciones)
//   hoy             → src/views/hoy.js             (atrasados / vencen / recibidos / entregados hoy)
//   bodega          → src/views/bodega.js          (inventario, CSV, precios protegidos)
//   ventas          → src/views/ventas.js          (turnos, cuadratura de caja)
//   punto_venta     → src/views/puntoVenta.js       (mostrador, clientes frecuentes, NC con PIN)
//   monitor         → src/views/monitor.js         (pantalla TV / autoservicio cliente)
//   admin_resumen   → src/views/admin.js           (KPIs, Excel, Solicitudes NC, Equipo, Empleados, Configuración — un solo panel, todas las sub-pestañas comparten esta función)
//   nombre_app      → src/main.js                  ("DENA ERP" en el menú se reemplaza por el nombre configurado en Administración → Configuración)
//   marca_propia    → (pendiente de construir)     (logo y color propios, blanco total, ver backlog)
//
// Cada pantalla es un archivo independiente: se puede editar, reescribir o
// borrar una sin afectar el resto. La única conexión entre todas es este
// archivo (qué plan la ve) y src/main.js (el botón del menú + la ruta).

export const PLANES = {
  bronce: {
    etiqueta: 'Bronce',
    precioMensual: 35900,
    descripcion: 'Lo esencial para ordenar tu producción',
    funciones: [
      'recepcion',
      'estado',
      'torre',
      'hoy',
    ],
    limiteUsuarios: 1,
  },
  plata: {
    etiqueta: 'Plata',
    precioMensual: 64900,
    descripcion: 'Gestión administrativa completa',
    funciones: [
      'recepcion', 'estado', 'torre', 'hoy',
      'bodega',          // control de stock con alertas
      'ventas',          // cuadratura de caja por turno
      'punto_venta',     // ventas de mostrador + nota de crédito con PIN
      'admin_resumen',   // KPIs, Excel, Solicitudes NC, Equipo, Empleados, Configuración
      'nombre_app',       // cambiar "DENA ERP" por el nombre del negocio
    ],
    limiteUsuarios: 3,
  },
  oro: {
    etiqueta: 'Oro',
    precioMensual: 104900,
    descripcion: 'Control total, en tiempo real',
    funciones: [
      'recepcion', 'estado', 'torre', 'hoy',
      'bodega', 'ventas', 'punto_venta', 'admin_resumen', 'nombre_app',
      'monitor',              // pantalla de producción para TV / autoservicio del cliente
      'marca_propia',         // logo y color propios (pendiente de construir)
      'soporte_prioritario',  // no es una pantalla, es un compromiso comercial
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

/** Todas las funciones que existen en algún plan (para armar comparativas). */
export function todasLasFunciones() {
  return [...new Set(Object.values(PLANES).flatMap((p) => p.funciones))];
}

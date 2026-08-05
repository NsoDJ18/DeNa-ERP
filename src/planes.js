// ============================================================
// CONFIGURACIÓN DE PLANES — edita SOLO este archivo para cambiar
// qué funciones incluye cada plan. No hace falta tocar nada más:
// el menú de navegación y el resto de la app leen de acá.
// ============================================================
//
// MAPA función → dónde vive:
//
//   recepcion            → src/views/recepcion.js
//   estado               → src/views/estado.js          (Plata+)
//   torre                → src/views/torre.js            (Plata+)
//   hoy                  → src/views/hoy.js              (Plata+)
//   bodega               → src/views/bodega.js
//   ventas               → src/views/ventas.js
//   punto_venta          → src/views/puntoVenta.js
//   monitor              → src/views/monitor.js          (TODOS los planes — es el enganche comercial)
//   admin_resumen        → src/views/admin.js            (Resumen + Solicitudes NC + lista de Equipo + tiempos máximos)
//   admin_gestion_equipo → src/views/admin.js            (Plata+: editar jerarquía + pestaña Empleados)
//   admin_sucursal       → src/views/admin.js            (Plata+: nombre del local/sucursal)
//   nombre_app           → src/views/soporte.js         (SOLO soporte TI — ya no es autogestionable por el cliente)
//   marca_propia         → (pendiente de construir)      (Oro: logo y color propios)
//   soporte_prioritario  → (no es pantalla, es compromiso comercial tuyo)
//
// El correo de soporte/pruebas con acceso a TODO sin importar el plan
// vive en la tabla `ti_super_admins` de Supabase — no acá. Para
// cambiarlo, edita esa tabla directo en Supabase, no este archivo.

export const PLANES = {
  bronce: {
    etiqueta: 'Bronce',
    precioMensual: 35900,
    descripcion: 'Lo esencial para operar el mostrador y la producción',
    funciones: [
      'recepcion',
      'bodega',
      'ventas',
      'punto_venta',
      'monitor',
      'admin_resumen',
    ],
    limiteUsuarios: 3, // 1 admin + 2 trabajadores
  },
  plata: {
    etiqueta: 'Plata',
    precioMensual: 64900,
    descripcion: 'Gestión administrativa completa',
    funciones: [
      'recepcion', 'bodega', 'ventas', 'punto_venta', 'monitor', 'admin_resumen',
      'estado', 'torre', 'hoy',
      'admin_gestion_equipo',
      'admin_sucursal',
    ],
    limiteUsuarios: 11, // 1 admin + 10 trabajadores
  },
  oro: {
    etiqueta: 'Oro',
    precioMensual: 104900,
    descripcion: 'Acceso completo, sin restricciones',
    funciones: [
      'recepcion', 'bodega', 'ventas', 'punto_venta', 'monitor', 'admin_resumen',
      'estado', 'torre', 'hoy', 'admin_gestion_equipo', 'admin_sucursal',
      'marca_propia',
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

/** Todas las funciones que existen en algún plan (para armar comparativas). */
export function todasLasFunciones() {
  return [...new Set(Object.values(PLANES).flatMap((p) => p.funciones))];
}

/** Límite de usuarios del plan (null = sin límite). */
export function limiteUsuarios(plan) {
  return PLANES[plan]?.limiteUsuarios ?? PLANES['bronce'].limiteUsuarios;
}

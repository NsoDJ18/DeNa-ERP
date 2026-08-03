import { listarOrdenes, cambiarEstadoOrden, suscribirseAOrdenes } from '../data/ordenes.js';
import { obtenerTiemposMax } from '../data/configuracion.js';
import { escapeHtml, toast } from '../lib/util.js';

const ESTACIONES = [
  { key: 'ingreso', label: 'Ingreso de OT', corta: 'Estación 01' },
  { key: 'diseno', label: 'En diseño', corta: 'Estación 02' },
  { key: 'fabricacion', label: 'Grabado / Fabricación', corta: 'Estación 03' },
  { key: 'calidad', label: 'Control de calidad', corta: 'Estación 04' },
  { key: 'listo', label: 'Listo para entrega', corta: 'Estación 05' },
];
const INDICE = Object.fromEntries(ESTACIONES.map((e, i) => [e.key, i]));

export async function renderTorre(contenedor) {
  contenedor.innerHTML = `
    <div class="encabezado-vista">
      <h2>Torre de control</h2>
      <p class="subtitulo">Flujo de producción en las 5 estaciones — se actualiza solo</p>
    </div>
    <div id="torre-noretirados"></div>
    <div class="kanban" id="torre-kanban"></div>
  `;

  await pintar();

  // tiempo real: si alguien más mueve un pedido, se refresca sola.
  // Devolvemos la función de limpieza: el router la llama solo al salir de esta pantalla.
  const cancelarSuscripcion = suscribirseAOrdenes(() => pintar());
  return cancelarSuscripcion;

  async function pintar() {
    if (!document.getElementById('torre-kanban')) return; // ya no estamos en esta pantalla
    const [ordenes, tmax] = await Promise.all([listarOrdenes(), obtenerTiemposMax()]);

    const noRetirados = ordenes.filter((o) => o.estado === 'no_retirado');
    document.getElementById('torre-noretirados').innerHTML = noRetirados.length
      ? `<div class="banda-alerta rojo">
          <h4>⚠️ Pedidos no retirados (${noRetirados.length})</h4>
          ${noRetirados.map((o) => `<div class="fila-resultado"><span class="mono">${o.folio}</span> ${escapeHtml(o.cliente)}</div>`).join('')}
        </div>`
      : '';

    const kanban = document.getElementById('torre-kanban');
    kanban.innerHTML = ESTACIONES.map((est) => {
      const items = ordenes.filter((o) => o.estado === est.key);
      return `
        <div class="carril">
          <div class="carril-cabecera">
            <div><div class="carril-num">${est.corta}</div><div class="carril-titulo">${est.label}</div></div>
            <span class="carril-contador">${items.length}</span>
          </div>
          <div class="carril-tarjetas">
            ${items.length ? items.map((o) => tarjeta(o, est, tmax[est.key])).join('') : '<div class="carril-vacio">Sin pedidos aquí</div>'}
          </div>
        </div>`;
    }).join('');

    kanban.querySelectorAll('[data-avanzar]').forEach((btn) => {
      btn.onclick = () => avanzar(btn.dataset.avanzar, btn.dataset.siguiente);
    });
    kanban.querySelectorAll('[data-entregar]').forEach((btn) => {
      btn.onclick = () => cerrarEntregado(btn.dataset.entregar);
    });
  }

  function tarjeta(o, est, maxMin) {
    let tiempoHtml = '';
    if (o.timestamps?.[est.key]) {
      const mins = Math.floor((Date.now() - new Date(o.timestamps[est.key]).getTime()) / 60000);
      const limite = maxMin || 999999;
      const clase = mins > limite ? 'alerta' : mins > limite * 0.7 ? 'aviso' : '';
      tiempoHtml = `<div class="carril-tiempo ${clase}">⏱ ${mins} min${clase === 'alerta' ? ' — supera el máximo' : ''}</div>`;
    }
    const idx = INDICE[o.estado];
    const siguiente = idx < ESTACIONES.length - 1 ? ESTACIONES[idx + 1].key : null;
    return `
      <div class="mini-tarjeta">
        <div class="mono" style="color:var(--gold);font-weight:700;">${o.folio}</div>
        <div style="font-weight:600;margin:2px 0 3px;">${escapeHtml(o.cliente)}</div>
        <div style="font-size:12px;color:var(--ink-soft);">${escapeHtml(o.tipo)}</div>
        ${tiempoHtml}
        <div class="mini-tarjeta-acciones">
          ${siguiente ? `<button data-avanzar="${o.id}" data-siguiente="${siguiente}">Avanzar</button>` : ''}
          ${est.key === 'listo' ? `<button data-entregar="${o.id}" class="primario">Entregado</button>` : ''}
        </div>
      </div>`;
  }

  async function avanzar(ordenId, siguienteEstado) {
    try {
      await cambiarEstadoOrden(ordenId, siguienteEstado);
      toast('Pedido movido a ' + (ESTACIONES.find((e) => e.key === siguienteEstado)?.label || siguienteEstado));
      await pintar();
    } catch (e) {
      console.error(e);
      toast('No se pudo mover el pedido');
    }
  }

  async function cerrarEntregado(ordenId) {
    try {
      await cambiarEstadoOrden(ordenId, 'entregado');
      toast('Pedido cerrado como entregado');
      await pintar();
    } catch (e) {
      console.error(e);
      toast('No se pudo cerrar el pedido');
    }
  }
}

import { listarOrdenes, suscribirseAOrdenes } from '../data/ordenes.js';
import { obtenerTiemposMax } from '../data/configuracion.js';
import { escapeHtml } from '../lib/util.js';

const ESTACIONES = [
  { key: 'ingreso', label: 'Ingreso de OT', icono: '📥' },
  { key: 'diseno', label: 'En diseño', icono: '🎨' },
  { key: 'fabricacion', label: 'Grabado / Fabricación', icono: '🔧' },
  { key: 'calidad', label: 'Control de calidad', icono: '🔍' },
  { key: 'listo', label: 'Listo para entrega', icono: '✅' },
];
const INDICE = Object.fromEntries(ESTACIONES.map((e, i) => [e.key, i]));
const FRASE_CLIENTE = {
  ingreso: 'Recibimos tu pedido y ya está en la fila de trabajo.',
  diseno: 'Estamos diseñando tu pedido.',
  fabricacion: 'Tu pedido se está fabricando ahora mismo.',
  calidad: 'Estamos revisando la calidad antes de avisarte.',
  listo: '¡Tu pedido está listo! Puedes venir a retirarlo 🎉',
  no_retirado: 'Tu pedido está listo hace tiempo — ¡ven a buscarlo!',
};

let intervaloReloj = null;
let intervaloRefresco = null;

export async function renderMonitor(contenedor) {
  contenedor.innerHTML = `
    <div class="monitor-top no-print">
      <div class="monitor-marca">
        <div><div class="monitor-titulo">Producción en vivo</div><div id="mon-reloj" class="monitor-reloj"></div></div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="boton boton-ghost" id="btn-ventana-externa" style="width:auto;padding:8px 16px;">🗗 Ventana externa</button>
        <button class="boton boton-ghost" id="btn-pantalla-completa" style="width:auto;padding:8px 16px;">Pantalla completa</button>
      </div>
    </div>

    <div id="mon-noretirados"></div>

    <div class="monitor-buscador">
      <input type="text" id="mon-buscar" placeholder="🔍 Busca tu pedido por folio o tu nombre...">
      <span class="monitor-buscador-hint">Escribe tu folio (ej: OT-0012) o tu nombre para ver solo tu pedido</span>
    </div>

    <div class="monitor-track-header" id="mon-header"></div>
    <div id="mon-body"></div>
  `;

  document.getElementById('btn-pantalla-completa').onclick = () => {
    const el = document.documentElement;
    if (!document.fullscreenElement) el.requestFullscreen?.().catch(() => {});
    else document.exitFullscreen?.();
  };
  document.getElementById('btn-ventana-externa').onclick = () => {
    const base = location.href.split('#')[0];
    const win = window.open(base + '#monitor', '_blank', 'width=1280,height=800');
    if (!win) alert('El navegador bloqueó la ventana nueva. Permite ventanas emergentes para este sitio.');
  };
  document.getElementById('mon-buscar').oninput = pintar;

  document.getElementById('mon-header').innerHTML = `
    <div class="monitor-track-spacer"></div>
    <div class="monitor-track-estaciones">${ESTACIONES.map((e) => `<span>${e.icono} ${e.label}</span>`).join('')}</div>
  `;

  await pintar();
  const cancelarSuscripcion = suscribirseAOrdenes(() => pintar());

  intervaloReloj = setInterval(actualizarReloj, 1000);
  actualizarReloj();
  intervaloRefresco = setInterval(pintar, 8000);

  return () => {
    cancelarSuscripcion();
    clearInterval(intervaloReloj);
    clearInterval(intervaloRefresco);
  };

  function actualizarReloj() {
    const el = document.getElementById('mon-reloj');
    if (el) el.textContent = new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  async function pintar() {
    if (!document.getElementById('mon-body')) return; // ya no estamos en esta pantalla
    const [ordenes, tmax] = await Promise.all([listarOrdenes(), obtenerTiemposMax()]);

    const noRetirados = ordenes.filter((o) => o.estado === 'no_retirado');
    document.getElementById('mon-noretirados').innerHTML = noRetirados.length
      ? `<div class="banda-alerta rojo"><h4>⚠️ No retirados (${noRetirados.length})</h4>
          ${noRetirados.map((o) => `<div class="fila-resultado"><span class="mono">${o.folio}</span> ${escapeHtml(o.cliente)}</div>`).join('')}
        </div>` : '';

    let activos = ordenes.filter((o) => ['ingreso', 'diseno', 'fabricacion', 'calidad', 'listo', 'no_retirado'].includes(o.estado))
      .sort((a, b) => porcentaje(b.estado) - porcentaje(a.estado) || (b.folio_num || 0) - (a.folio_num || 0));

    const query = (document.getElementById('mon-buscar').value || '').trim().toLowerCase();
    const buscando = query.length >= 2;
    if (buscando) activos = activos.filter((o) => o.folio.toLowerCase().includes(query) || (o.cliente || '').toLowerCase().includes(query));

    const body = document.getElementById('mon-body');
    if (!activos.length) {
      body.innerHTML = `<div class="monitor-vacio">${buscando ? 'No encontramos un pedido con ese folio o nombre en producción.' : 'No hay pedidos en producción en este momento.'}</div>`;
      return;
    }

    body.innerHTML = activos.map((o) => {
      const pct = porcentaje(o.estado);
      const mins = o.timestamps?.[o.estado] ? Math.floor((Date.now() - new Date(o.timestamps[o.estado]).getTime()) / 60000) : null;
      const limite = tmax[o.estado] || 999999;
      const alerta = o.estado === 'no_retirado' || (mins !== null && mins > limite * 0.8);
      const inicial = (o.cliente || '?').trim().charAt(0).toUpperCase();
      const frase = FRASE_CLIENTE[o.estado] || '';
      return `
        <div class="monitor-fila">
          <div class="monitor-fila-info">
            <div class="mono" style="color:var(--gold);font-weight:600;">${o.folio}</div>
            <div style="font-family:'Fraunces',serif;font-size:16px;color:var(--navy);">${escapeHtml(o.cliente)}</div>
            <div style="font-size:12px;color:var(--ink-soft);">${buscando ? frase : escapeHtml(o.tipo)}</div>
          </div>
          <div class="monitor-track">
            <div class="monitor-track-linea"></div>
            ${ESTACIONES.map((e, i) => `<div class="monitor-checkpoint" style="left:${(i / (ESTACIONES.length - 1)) * 100}%;"></div>`).join('')}
            <div class="monitor-marcador ${alerta ? 'alerta' : ''}" style="left:${Math.min(pct, 100)}%;">
              ${mins !== null ? `<span class="monitor-marcador-tiempo">${mins} min</span>` : ''}
              <div class="monitor-marcador-punto" style="background:${o.estado === 'no_retirado' ? '#C2564F' : '#D4AF37'};">${inicial}</div>
            </div>
          </div>
        </div>`;
    }).join('');
  }
}

function porcentaje(estado) {
  if (estado === 'no_retirado') return 100;
  const idx = INDICE[estado] ?? 0;
  return (idx / (ESTACIONES.length - 1)) * 100;
}

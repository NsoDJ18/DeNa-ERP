import { listarOrdenes, suscribirseAOrdenes } from '../data/ordenes.js';
import { abrirDetalle, badge } from './estado.js';
import { escapeHtml, fdate, localDateStr, todayStr } from '../lib/util.js';

export async function renderHoy(contenedor) {
  contenedor.innerHTML = `
    <div class="encabezado-vista">
      <h2>Hoy</h2>
      <p class="subtitulo">Foto rápida del día — sin tener que revisar pedido por pedido</p>
    </div>
    <div class="grid-hoy">
      <div class="panel-hoy">
        <h3>🔴 Atrasados</h3>
        <div id="hoy-atrasados"></div>
      </div>
      <div class="panel-hoy">
        <h3>🟡 Vencen hoy o mañana</h3>
        <div id="hoy-vencen"></div>
      </div>
      <div class="panel-hoy">
        <h3>📥 Recibidos hoy</h3>
        <div id="hoy-recibidos"></div>
      </div>
      <div class="panel-hoy">
        <h3>✅ Entregados hoy</h3>
        <div id="hoy-entregados"></div>
      </div>
    </div>
  `;

  await pintar();
  return suscribirseAOrdenes(() => pintar());

  async function pintar() {
    if (!document.getElementById('hoy-atrasados')) return; // ya no estamos en esta pantalla
    const ordenes = await listarOrdenes();
    const hoy = todayStr();
    const manana = localDateStr(new Date(Date.now() + 86400000));
    const activos = (estado) => ['ingreso', 'diseno', 'fabricacion', 'calidad', 'listo', 'no_retirado'].includes(estado);

    const atrasados = ordenes.filter((o) => activos(o.estado) && o.fecha_entrega < hoy);
    const vencenPronto = ordenes.filter((o) => activos(o.estado) && (o.fecha_entrega === hoy || o.fecha_entrega === manana));
    const recibidosHoy = ordenes.filter((o) => localDateStr(o.fecha_recepcion) === hoy);
    const entregadosHoy = ordenes.filter((o) => o.estado === 'entregado' && localDateStr(o.timestamps?.entregado) === hoy);

    pintarPanel('hoy-atrasados', atrasados, 'Sin pedidos atrasados 🎉');
    pintarPanel('hoy-vencen', vencenPronto, 'Nada vence en las próximas 48 h.');
    pintarPanel('hoy-recibidos', recibidosHoy, 'Aún no se recibe ningún pedido hoy.');
    pintarPanel('hoy-entregados', entregadosHoy, 'Todavía no hay entregas hoy.');
  }

  function pintarPanel(idContenedor, lista, mensajeVacio) {
    const el = document.getElementById(idContenedor);
    el.innerHTML = lista.length
      ? lista.map((o) => `
        <div class="fila-clickable" data-id="${o.id}">
          <div>
            <span class="mono" style="color:var(--gold);font-weight:700;">${o.folio}</span>
            <div style="font-weight:600;">${escapeHtml(o.cliente)}</div>
            <div style="font-size:12px;color:var(--ink-soft);">${escapeHtml(o.tipo)} · Entrega ${fdate(o.fecha_entrega)}</div>
          </div>
          ${badge(o.estado)}
        </div>`).join('')
      : `<div class="vacio" style="padding:20px 10px;">${mensajeVacio}</div>`;
    el.querySelectorAll('[data-id]').forEach((fila) => { fila.onclick = () => abrirDetalle(fila.dataset.id); });
  }
}

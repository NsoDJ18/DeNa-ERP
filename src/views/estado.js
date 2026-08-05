import { listarOrdenes, obtenerOrden, cambiarEstadoOrden, agregarNota, aplicarNotaCredito, suscribirseAOrdenes } from '../data/ordenes.js';
import { crearSolicitudNC } from '../data/notasCredito.js';
import { confirmarEntrega } from '../lib/entrega.js';
import { puedeAutorizar } from '../auth/session.js';
import { escapeHtml, fdate, fdatetime, todayStr, toast } from '../lib/util.js';
import { abrirModal, cerrarModal } from '../lib/modal.js';

const ESTACIONES = [
  { key: 'ingreso', label: 'Ingreso de OT' },
  { key: 'diseno', label: 'En diseño' },
  { key: 'fabricacion', label: 'Grabado / Fabricación' },
  { key: 'calidad', label: 'Control de calidad' },
  { key: 'listo', label: 'Listo para entrega' },
];
const INDICE = Object.fromEntries(ESTACIONES.map((e, i) => [e.key, i]));

let ordenesCache = [];
let filtroSemaforo = '';

export async function renderEstado(contenedor) {
  contenedor.innerHTML = `
    <div class="encabezado-vista">
      <h2>Estado</h2>
      <p class="subtitulo">Busca por folio, nombre, RUT o teléfono del cliente</p>
    </div>
    <div class="campo"><input type="text" id="estado-buscar" placeholder="Ej: OT-0004, Javiera, +569..."></div>
    <div class="filtros-semaforo" id="filtros-sem">
      <button data-sem="" class="activo">Todos</button>
      <button data-sem="verde">🟢 A tiempo</button>
      <button data-sem="amarillo">🟡 Atrasado</button>
      <button data-sem="rojo">🔴 Fuera de plazo</button>
    </div>
    <div id="estado-resultados"></div>
  `;

  document.getElementById('estado-buscar').oninput = pintar;
  document.querySelectorAll('#filtros-sem button').forEach((b) => {
    b.onclick = () => {
      filtroSemaforo = b.dataset.sem;
      document.querySelectorAll('#filtros-sem button').forEach((x) => x.classList.toggle('activo', x === b));
      pintar();
    };
  });

  await pintar();
  const cancelarSuscripcion = suscribirseAOrdenes(() => pintar());
  return cancelarSuscripcion;

  async function pintar() {
    if (!document.getElementById('estado-resultados')) return; // ya no estamos en esta pantalla
    ordenesCache = await listarOrdenes();
    const q = document.getElementById('estado-buscar').value.trim().toLowerCase();
    let lista = ordenesCache;

    if (q) {
      lista = lista.filter((o) =>
        o.folio.toLowerCase().includes(q) ||
        (o.cliente || '').toLowerCase().includes(q) ||
        (o.telefono || '').toLowerCase().includes(q) ||
        (o.rut_cliente || '').toLowerCase().includes(q)
      );
    } else {
      lista = lista.filter((o) => o.estado !== 'entregado');
    }
    if (filtroSemaforo) lista = lista.filter((o) => semaforo(o) === filtroSemaforo);
    lista = lista.slice(0, 50);

    const wrap = document.getElementById('estado-resultados');
    if (!lista.length) {
      wrap.innerHTML = `<div class="vacio"><b>Sin resultados</b>Prueba con otro folio, nombre o cambia el filtro.</div>`;
      return;
    }
    wrap.innerHTML = lista.map((o) => {
      const s = semaforo(o);
      return `
        <div class="fila-clickable" data-id="${o.id}">
          <div>
            <span class="mono" style="color:var(--gold);font-weight:700;">${o.folio}</span>
            <div style="font-weight:600;">${escapeHtml(o.cliente)}</div>
            <div style="font-size:12px;color:var(--ink-soft);">${escapeHtml(o.tipo)} · Entrega ${fdate(o.fecha_entrega)}</div>
          </div>
          <div style="display:flex;gap:8px;align-items:center;">
            ${s ? `<span class="semaforo ${s}">${etiquetaSemaforo(s)}</span>` : ''}
            ${badge(o.estado)}
          </div>
        </div>`;
    }).join('');

    wrap.querySelectorAll('[data-id]').forEach((fila) => {
      fila.onclick = () => abrirDetalle(fila.dataset.id);
    });
  }
}

function semaforo(o) {
  if (o.estado === 'entregado' || o.estado === 'cancelado') return null;
  if (o.estado === 'no_retirado') return 'rojo';
  const hoy = todayStr();
  const diffDias = Math.floor((new Date(hoy) - new Date(o.fecha_entrega)) / 86400000);
  if (diffDias <= 0) return 'verde';
  if (diffDias <= 2) return 'amarillo';
  return 'rojo';
}
function etiquetaSemaforo(s) {
  return s === 'verde' ? '🟢 A tiempo' : s === 'amarillo' ? '🟡 Atrasado' : '🔴 Fuera de plazo';
}
export function badge(estado) {
  const mapa = {
    ingreso: ['Ingreso de OT', '#8890A0'], diseno: ['En diseño', '#C9A24F'],
    fabricacion: ['Fabricación', '#D68A4E'], calidad: ['Control de calidad', '#5D7DA8'],
    listo: ['Listo para entrega', '#345C42'], entregado: ['Entregado', '#345C42'],
    cancelado: ['Cancelado', '#9B2C2C'], no_retirado: ['No retirado', '#9B2C2C'],
  };
  const [texto, color] = mapa[estado] || [estado, '#8890A0'];
  return `<span class="etiqueta-estado" style="color:${color};background:${color}1A;">${texto}</span>`;
}

export async function abrirDetalle(ordenId) {
  const o = await obtenerOrden(ordenId);
  pintarDetalle(o);
}

function pintarDetalle(o) {
  const saldo = (o.precio || 0) - (o.abono || 0);
  const idx = INDICE[o.estado];
  const puedeAvanzar = idx !== undefined && idx < ESTACIONES.length - 1;
  const puedeEntregar = o.estado === 'listo' || o.estado === 'no_retirado';
  const notas = (o.notas || []).slice().reverse();

  let stepperHtml;
  if (o.estado === 'cancelado') {
    stepperHtml = `<div class="estado-cerrado rojo">Este pedido fue cancelado</div>`;
  } else if (o.estado === 'entregado') {
    stepperHtml = `<div class="estado-cerrado verde">Pedido entregado con éxito</div>`;
  } else if (o.estado === 'no_retirado') {
    stepperHtml = `<div class="estado-cerrado rojo">Pedido no retirado a tiempo</div>`;
  } else {
    stepperHtml = `<div class="stepper">${ESTACIONES.map((e, i) => `
      <div class="paso ${i < idx ? 'hecho' : ''} ${i === idx ? 'actual' : ''}">
        <div class="linea"></div>
        <div class="circulo">${i < idx ? '✓' : i + 1}</div>
        <div class="etiqueta">${e.label}</div>
      </div>`).join('')}</div>`;
  }

  abrirModal(`
    <div class="mono" style="color:var(--gold);font-weight:700;">${o.folio}</div>
    <h3 style="margin:4px 0 0;font-size:20px;color:var(--navy);">${escapeHtml(o.cliente)}</h3>
    ${stepperHtml}
    <div class="grid-2" style="margin:16px 0;">
      <div><span class="mini-label">Tipo</span><div>${escapeHtml(o.tipo)}</div></div>
      <div><span class="mini-label">Cantidad</span><div>${o.cantidad}</div></div>
      <div><span class="mini-label">RUT</span><div>${escapeHtml(o.rut_cliente) || '—'}</div></div>
      <div><span class="mini-label">Teléfono</span><div>${escapeHtml(o.telefono) || '—'}</div></div>
      <div><span class="mini-label">Recepción</span><div>${fdatetime(o.fecha_recepcion)}</div></div>
      <div><span class="mini-label">Entrega estimada</span><div>${fdate(o.fecha_entrega)}</div></div>
      <div><span class="mini-label">Total / Abono</span><div>$${(o.precio||0).toLocaleString('es-CL')} / $${(o.abono||0).toLocaleString('es-CL')}</div></div>
      <div><span class="mini-label">Saldo pendiente</span><div>$${saldo.toLocaleString('es-CL')}</div></div>
    </div>
    <div style="margin-bottom:16px;"><span class="mini-label">Descripción</span><div>${escapeHtml(o.descripcion)}</div></div>

    ${o.estado !== 'cancelado' ? (puedeAutorizar() ? `
    <div class="campo" id="nc-wrap" style="background:var(--bg-soft);border-radius:10px;padding:12px;">
      <label style="margin-bottom:8px;">🧾 Nota de crédito (encargado/admin)</label>
      <div class="grid-2">
        <div class="campo"><label>Nuevo precio total</label><input type="number" id="nc-precio" min="0" value="${o.precio || 0}"></div>
        <div class="campo"><label>Motivo *</label><input type="text" id="nc-motivo" placeholder="Ej: producto con defecto"></div>
      </div>
      <div class="campo"><label>Si hay que devolver plata, ¿en qué método?</label>
        <select id="nc-metodo-devolucion"><option>Efectivo</option><option>Transferencia</option><option>Débito</option><option>Crédito</option><option>Otro</option></select>
      </div>
      <p style="font-size:11.5px;color:var(--ink-soft);margin:0 0 8px;">Al aplicarla, el pedido se cierra como cancelado automáticamente.</p>
      <button class="boton boton-ghost" id="btn-nota-credito" style="width:auto;padding:8px 16px;">Aplicar nota de crédito</button>
    </div>` : `
    <div class="campo" id="nc-wrap" style="background:var(--bg-soft);border-radius:10px;padding:12px;">
      <label style="margin-bottom:8px;">🧾 Solicitar nota de crédito</label>
      <p style="font-size:11.5px;color:var(--ink-soft);margin:0 0 8px;">Queda pendiente hasta que un encargado de turno o administrador la autorice.</p>
      <div class="grid-2">
        <div class="campo"><label>Precio que propones</label><input type="number" id="nc-precio" min="0" value="${o.precio || 0}"></div>
        <div class="campo"><label>Motivo *</label><input type="text" id="nc-motivo" placeholder="Ej: producto con defecto"></div>
      </div>
      <div class="campo"><label>Tu nombre *</label><input type="text" id="nc-solicitante" placeholder="Quién solicita"></div>
      <button class="boton boton-ghost" id="btn-solicitar-nc" style="width:auto;padding:8px 16px;">Solicitar autorización</button>
    </div>`) : ''}

    <div class="campo"><label>Agregar nota interna</label><textarea id="detalle-nota" placeholder="Ej: cliente confirmó color..."></textarea></div>
    ${notas.length ? `<div style="margin-bottom:14px;">${notas.map((n) => `<div style="font-size:12.5px;color:var(--ink-soft);padding:6px 0;border-bottom:1px dotted var(--line);"><b style="color:var(--ink);">${fdate(n.fecha)}:</b> ${escapeHtml(n.texto)}</div>`).join('')}</div>` : ''}

    <div class="pie-formulario" style="justify-content:space-between;">
      <div>${o.estado !== 'cancelado' && o.estado !== 'entregado' ? `<button class="boton boton-ghost" id="btn-cancelar">Cancelar orden</button>` : ''}</div>
      <div style="display:flex;gap:8px;">
        <button class="boton boton-ghost" id="btn-nota">Guardar nota</button>
        ${puedeAvanzar ? `<button class="boton boton-oro" id="btn-avanzar">Avanzar a: ${ESTACIONES[idx + 1].label}</button>` : ''}
        ${puedeEntregar ? `<button class="boton boton-oro" id="btn-entregar">Cerrar como entregado</button>` : ''}
      </div>
    </div>
  `);

  document.getElementById('btn-nota').onclick = async () => {
    const texto = document.getElementById('detalle-nota').value.trim();
    if (!texto) return;
    await agregarNota(o.id, texto);
    toast('Nota guardada');
    const actualizado = await obtenerOrden(o.id);
    pintarDetalle(actualizado);
  };
  const btnNotaCredito = document.getElementById('btn-nota-credito');
  if (btnNotaCredito) btnNotaCredito.onclick = async (ev) => {
    const nuevoPrecio = Number(document.getElementById('nc-precio').value);
    const motivo = document.getElementById('nc-motivo').value.trim();
    const metodoDevolucion = document.getElementById('nc-metodo-devolucion').value;
    if (isNaN(nuevoPrecio) || nuevoPrecio < 0) { toast('Precio inválido'); return; }
    if (nuevoPrecio > (o.precio || 0)) { toast('Una nota de crédito solo puede bajar el precio, no subirlo'); return; }
    if (!motivo) { toast('Escribe el motivo de la nota de crédito'); return; }
    if (!confirm('Esto va a cerrar el pedido como cancelado. ¿Continuar?')) return;
    ev.target.disabled = true;
    try {
      await aplicarNotaCredito(o.id, nuevoPrecio, motivo, metodoDevolucion);
      toast('Nota de crédito aplicada, pedido cancelado');
      cerrarModal();
    } catch (e) {
      console.error(e);
      toast('No se pudo aplicar la nota de crédito: ' + (e.message || ''));
    } finally {
      ev.target.disabled = false;
    }
  };
  const btnSolicitarNC = document.getElementById('btn-solicitar-nc');
  if (btnSolicitarNC) btnSolicitarNC.onclick = async (ev) => {
    const precioSolicitado = Number(document.getElementById('nc-precio').value);
    const motivo = document.getElementById('nc-motivo').value.trim();
    const solicitadoPor = document.getElementById('nc-solicitante').value.trim();
    if (isNaN(precioSolicitado) || precioSolicitado < 0) { toast('Precio inválido'); return; }
    if (precioSolicitado > (o.precio || 0)) { toast('Una nota de crédito solo puede bajar el precio, no subirlo'); return; }
    if (!motivo || !solicitadoPor) { toast('Completa el motivo y tu nombre'); return; }
    ev.target.disabled = true;
    try {
      await crearSolicitudNC({ ordenId: o.id, precioActual: o.precio, precioSolicitado, motivo, solicitadoPor });
      toast('Solicitud enviada — queda pendiente de autorización');
      cerrarModal();
    } catch (e) {
      console.error(e);
      toast('No se pudo enviar la solicitud');
    } finally {
      ev.target.disabled = false;
    }
  };
  const btnCancelar = document.getElementById('btn-cancelar');
  if (btnCancelar) btnCancelar.onclick = () => cambiar('cancelado');
  const btnAvanzar = document.getElementById('btn-avanzar');
  if (btnAvanzar) btnAvanzar.onclick = () => cambiar(ESTACIONES[idx + 1].key);
  const btnEntregar = document.getElementById('btn-entregar');
  if (btnEntregar) btnEntregar.onclick = () => confirmarEntrega(o, async () => {
    const actualizado = await obtenerOrden(o.id);
    pintarDetalle(actualizado);
  });

  async function cambiar(nuevoEstado) {
    try {
      await cambiarEstadoOrden(o.id, nuevoEstado);
      toast('Estado actualizado');
      const actualizado = await obtenerOrden(o.id);
      pintarDetalle(actualizado);
    } catch (e) {
      console.error(e);
      toast('No se pudo actualizar el estado');
    }
  }
}

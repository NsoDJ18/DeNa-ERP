import { crearOrden, listarOrdenes, suscribirseAOrdenes } from '../data/ordenes.js';
import { llenarDatalistEmpleados, sugerirEmpleado } from '../data/empleados.js';
import { abrirDetalle, badge } from './estado.js';
import { toast, fdate, money, escapeHtml } from '../lib/util.js';

const TIPOS_TRABAJO = [
  'Tazas personalizadas', 'Impresión DTF UV', 'Impresión digital', 'Tarjetas de presentación',
  'Volantes / Flyers', 'Grabado en madera', 'Llaveros y cintas', 'Retrato personalizado',
  'Invitaciones y tarjetas', 'Lámparas personalizadas', 'Otro',
];
const METODOS_PAGO = ['Efectivo', 'Transferencia', 'Débito', 'Crédito', 'Otro'];

export async function renderRecepcion(contenedor) {
  const entregaSugerida = new Date();
  entregaSugerida.setDate(entregaSugerida.getDate() + 3);

  contenedor.innerHTML = `
    <div class="encabezado-vista">
      <h2>Recepción</h2>
      <p class="subtitulo">Completa los datos para generar la orden de trabajo</p>
    </div>

    <div id="recepcion-form-wrap" class="tarjeta">
      <div class="grid-2">
        <div class="campo"><label>RUT del cliente</label><input type="text" id="f-rut" placeholder="12.345.678-9"></div>
        <div class="campo"><label>Nombre del cliente *</label><input type="text" id="f-cliente" placeholder="Ej: Javiera Muñoz"></div>
      </div>
      <div class="grid-2">
        <div class="campo"><label>Teléfono</label><input type="text" id="f-telefono" placeholder="+56 9 ..."></div>
        <div class="campo"><label>Tipo de trabajo *</label>
          <select id="f-tipo">
            <option value="">Selecciona...</option>
            ${TIPOS_TRABAJO.map((t) => `<option>${t}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="grid-2">
        <div class="campo"><label>Cantidad *</label><input type="number" id="f-cantidad" min="1" value="1"></div>
        <div class="campo"><label>Fecha de entrega estimada *</label><input type="date" id="f-entrega" value="${entregaSugerida.toISOString().slice(0, 10)}"></div>
      </div>
      <div class="campo"><label>Descripción del pedido *</label><textarea id="f-descripcion" placeholder="Detalle de la personalización: texto, color, medidas, referencia..."></textarea></div>
      <div class="campo"><label>Recibido por *</label><input type="text" id="f-responsable" list="lista-empleados" placeholder="Tu nombre"></div>
      <datalist id="lista-empleados"></datalist>
      <div class="grid-2">
        <div class="campo"><label>Precio total ($) *</label><input type="number" id="f-precio" min="0" placeholder="0"></div>
        <div class="campo"><label>Abono / anticipo ($)</label><input type="number" id="f-abono" min="0" placeholder="0"></div>
      </div>
      <div class="campo"><label>Método de pago del abono</label>
        <select id="f-metodo-pago">
          <option value="">— No aplica / sin abono —</option>
          ${METODOS_PAGO.map((m) => `<option>${m}</option>`).join('')}
        </select>
      </div>
      <div class="error" id="recepcion-error"></div>
      <div class="pie-formulario">
        <button class="boton boton-ghost" id="btn-limpiar">Limpiar</button>
        <button class="boton boton-oro" id="btn-generar">Generar orden de trabajo</button>
      </div>
    </div>

    <div id="recepcion-confirmacion" style="display:none;"></div>

    <div style="margin-top:26px;">
      <h3 style="font-size:15px;margin-bottom:4px;">Pedidos en curso</h3>
      <p class="subtitulo" style="margin-bottom:12px;">Toca un pedido para ver el detalle y avanzarlo a la siguiente etapa.</p>
      <div id="recepcion-pedidos-lista"></div>
    </div>
  `;

  llenarDatalistEmpleados(document.getElementById('lista-empleados')).catch(console.error);

  await pintarPedidosEnCurso();
  const cancelarSuscripcion = suscribirseAOrdenes(() => pintarPedidosEnCurso());

  async function pintarPedidosEnCurso() {
    const listaEl = document.getElementById('recepcion-pedidos-lista');
    if (!listaEl) return; // ya no estamos en esta pantalla
    const ordenes = (await listarOrdenes()).filter((o) => o.estado !== 'entregado' && o.estado !== 'cancelado');
    listaEl.innerHTML = ordenes.length
      ? ordenes.slice(0, 30).map((o) => `
        <div class="fila-clickable" data-id="${o.id}">
          <div>
            <span class="mono" style="color:var(--gold);font-weight:700;">${o.folio}</span>
            <div style="font-weight:600;">${escapeHtml(o.cliente)}</div>
            <div style="font-size:12px;color:var(--ink-soft);">${escapeHtml(o.tipo)} · Entrega ${fdate(o.fecha_entrega)}</div>
          </div>
          ${badge(o.estado)}
        </div>`).join('')
      : `<div class="vacio" style="padding:20px;">Sin pedidos en curso por ahora.</div>`;
    listaEl.querySelectorAll('[data-id]').forEach((fila) => { fila.onclick = () => abrirDetalle(fila.dataset.id); });
  }

  document.getElementById('btn-limpiar').onclick = () => renderRecepcion(contenedor);

  document.getElementById('btn-generar').onclick = async (ev) => {
    const errBox = document.getElementById('recepcion-error');
    errBox.classList.remove('visible');

    const datos = {
      rut_cliente: val('f-rut'),
      cliente: val('f-cliente'),
      telefono: val('f-telefono'),
      tipo: val('f-tipo'),
      cantidad: Number(val('f-cantidad')) || 1,
      descripcion: val('f-descripcion'),
      fecha_entrega: val('f-entrega'),
      responsable: val('f-responsable'),
      precio: Number(val('f-precio')) || 0,
      abono: Number(val('f-abono')) || 0,
      metodoPago: val('f-metodo-pago'),
    };

    if (!datos.cliente || !datos.tipo || !datos.descripcion || !datos.fecha_entrega || !datos.responsable || !val('f-precio')) {
      errBox.textContent = 'Completa todos los campos obligatorios (*) antes de generar la orden.';
      errBox.classList.add('visible');
      return;
    }

    ev.target.disabled = true;
    ev.target.textContent = 'Generando…';
    try {
      const orden = await crearOrden(datos);
      sugerirEmpleado(datos.responsable);
      mostrarConfirmacion(orden);
      toast(`Orden ${orden.folio} generada y guardada`);
    } catch (e) {
      console.error(e);
      errBox.textContent = 'No se pudo guardar el pedido: ' + e.message;
      errBox.classList.add('visible');
    } finally {
      ev.target.disabled = false;
      ev.target.textContent = 'Generar orden de trabajo';
    }
  };

  function val(id) {
    return document.getElementById(id).value.trim ? document.getElementById(id).value.trim() : document.getElementById(id).value;
  }

  function mostrarConfirmacion(orden) {
    document.getElementById('recepcion-form-wrap').style.display = 'none';
    const wrap = document.getElementById('recepcion-confirmacion');
    wrap.style.display = 'block';
    const saldo = (orden.precio || 0) - (orden.abono || 0);
    wrap.innerHTML = `
      <div class="ticket">
        <div class="ticket-top"><div class="ticket-etiqueta">Orden de trabajo</div><div class="ticket-folio">${orden.folio}</div></div>
        <div class="ticket-perforado"></div>
        <div class="ticket-cuerpo">
          <div class="ticket-fila"><span>Cliente</span><span>${escapeHtml(orden.cliente)}</span></div>
          ${orden.rut_cliente ? `<div class="ticket-fila"><span>RUT</span><span>${escapeHtml(orden.rut_cliente)}</span></div>` : ''}
          ${orden.telefono ? `<div class="ticket-fila"><span>Teléfono</span><span>${escapeHtml(orden.telefono)}</span></div>` : ''}
          <div class="ticket-fila"><span>Tipo de trabajo</span><span>${escapeHtml(orden.tipo)}</span></div>
          <div class="ticket-fila"><span>Cantidad</span><span>${orden.cantidad}</span></div>
          <div class="ticket-fila"><span>Entrega estimada</span><span>${fdate(orden.fecha_entrega)}</span></div>
          <div class="ticket-fila"><span>Recibido por</span><span>${escapeHtml(orden.responsable)}</span></div>
          <div class="ticket-fila"><span>Total</span><span>${money(orden.precio)}</span></div>
          <div class="ticket-fila"><span>Abono</span><span>${money(orden.abono)}</span></div>
          <div class="ticket-fila"><span>Saldo</span><span>${money(saldo)}</span></div>
          <div style="margin-top:10px;font-size:12px;color:var(--ink-soft);">${escapeHtml(orden.descripcion)}</div>
        </div>
      </div>
      <div style="text-align:center;margin-top:16px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">
        <button class="boton boton-ghost" id="btn-pdf" style="width:auto;padding:9px 18px;">Descargar PDF (WhatsApp)</button>
        <button class="boton boton-ghost" id="btn-etiqueta" style="width:auto;padding:9px 18px;">🏷️ Imprimir etiqueta</button>
        <button class="boton boton-oro" id="btn-otro" style="width:auto;padding:9px 18px;">Registrar otro pedido</button>
      </div>
    `;

    document.getElementById('btn-pdf').onclick = async () => {
      const boton = document.getElementById('btn-pdf');
      boton.disabled = true; boton.textContent = 'Generando…';
      try {
        const { jsPDF } = await import('jspdf'); // se descarga solo al usarlo
        const doc = new jsPDF({ unit: 'pt', format: 'a5' });
        let y = 40;
        doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(15, 27, 54);
        doc.text('DENA ERP', 40, y); y += 18;
        doc.setFontSize(9); doc.setTextColor(120, 105, 98);
        doc.text('Comprobante de recepción', 40, y); y += 26;
        doc.setDrawColor(228, 211, 198); doc.line(40, y, doc.internal.pageSize.getWidth() - 40, y); y += 22;
        doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(30, 20, 18);
        doc.text('Orden de trabajo ' + orden.folio, 40, y); y += 22;
        doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5);
        const filas = [
          ['Cliente', orden.cliente], ['RUT', orden.rut_cliente || '—'], ['Teléfono', orden.telefono || '—'],
          ['Tipo de trabajo', orden.tipo], ['Cantidad', String(orden.cantidad)],
          ['Fecha de entrega estimada', fdate(orden.fecha_entrega)], ['Recibido por', orden.responsable],
          ['Total', money(orden.precio)], ['Abono', money(orden.abono)], ['Saldo pendiente', money(saldo)],
        ];
        filas.forEach(([k, v]) => {
          doc.setTextColor(120, 105, 98); doc.text(k + ':', 40, y);
          doc.setTextColor(30, 20, 18); doc.text(String(v), 210, y);
          y += 18;
        });
        y += 6;
        doc.setTextColor(120, 105, 98); doc.text('Descripción:', 40, y); y += 16;
        doc.setTextColor(30, 20, 18);
        const desc = doc.splitTextToSize(orden.descripcion || '', doc.internal.pageSize.getWidth() - 80);
        doc.text(desc, 40, y);
        doc.save(orden.folio + '_dena_erp.pdf');
        toast('PDF descargado, listo para enviar por WhatsApp');
      } catch (e) {
        console.error(e);
        toast('No se pudo generar el PDF');
      } finally {
        boton.disabled = false; boton.textContent = 'Descargar PDF (WhatsApp)';
      }
    };

    document.getElementById('btn-etiqueta').onclick = () => {
      document.getElementById('etiqueta-imprimible').innerHTML = `
        <div style="width:260px;padding:10px;font-family:Arial,sans-serif;color:#111;border:1px dashed #999;">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;">DENA ERP</div>
          <div style="font-size:26px;font-weight:900;margin:4px 0;">${orden.folio}</div>
          <div style="font-size:13px;font-weight:700;">${escapeHtml(orden.cliente)}</div>
          <div style="font-size:11px;margin-top:3px;">${escapeHtml(orden.tipo)}${orden.cantidad > 1 ? ' × ' + orden.cantidad : ''}</div>
          <div style="font-size:11px;margin-top:3px;">Entrega: ${fdate(orden.fecha_entrega)}</div>
        </div>`;
      document.body.classList.add('modo-etiqueta');
      setTimeout(() => {
        window.print();
        setTimeout(() => document.body.classList.remove('modo-etiqueta'), 300);
      }, 60);
    };
    document.getElementById('btn-otro').onclick = () => renderRecepcion(contenedor);
  }

  return cancelarSuscripcion;
}

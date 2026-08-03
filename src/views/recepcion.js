import { crearOrden } from '../data/ordenes.js';
import { llenarDatalistEmpleados } from '../data/empleados.js';
import { toast } from '../lib/util.js';

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
  `;

  llenarDatalistEmpleados(document.getElementById('lista-empleados')).catch(console.error);

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
    wrap.innerHTML = `
      <div class="tarjeta" style="max-width:420px;margin:0 auto;text-align:center;">
        <div style="font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--ink-soft);">Orden de trabajo</div>
        <div style="font-family:'Fraunces',serif;font-size:28px;color:var(--navy);margin:6px 0 18px;">${orden.folio}</div>
        <p style="text-align:left;font-size:14px;color:var(--ink-soft);">
          Cliente: <b style="color:var(--ink);">${orden.cliente}</b><br>
          Tipo: ${orden.tipo}<br>
          Entrega estimada: ${orden.fecha_entrega}
        </p>
        <button class="boton boton-oro" id="btn-otro">Registrar otro pedido</button>
      </div>
    `;
    document.getElementById('btn-otro').onclick = () => renderRecepcion(contenedor);
  }
}

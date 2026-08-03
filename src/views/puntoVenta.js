import { listarProductos } from '../data/productos.js';
import { listarClientes } from '../data/clientes.js';
import { listarVentasDeHoy, registrarVenta, kpisDelDia } from '../data/ventasMostrador.js';
import { listarAbonosDelDia } from '../data/ordenes.js';
import { cargarTurnosDelDia, turnoAbiertoVigente } from '../data/turnos.js';
import { escapeHtml, money, todayStr, toast } from '../lib/util.js';

let carrito = [];

export async function renderPuntoVenta(contenedor) {
  carrito = [];
  contenedor.innerHTML = `
    <div class="encabezado-vista">
      <h2>Punto de venta</h2>
      <p class="subtitulo">Para productos de mostrador que no son un pedido personalizado</p>
    </div>

    <div id="pv-turno-info"></div>

    <div class="grid-2" style="align-items:start;">
      <div class="tarjeta">
        <h3 style="margin-top:0;">Agregar producto</h3>
        <div class="campo"><label>Producto de bodega (opcional)</label><select id="pv-producto"></select></div>
        <div class="campo"><label>Nombre a mostrar</label><input type="text" id="pv-nombre" placeholder="Ej: Llavero acrílico"></div>
        <div class="grid-2">
          <div class="campo"><label>Cantidad</label><input type="number" id="pv-cantidad" min="1" value="1"></div>
          <div class="campo"><label>Precio unitario ($)</label><input type="number" id="pv-precio" min="0"></div>
        </div>
        <button class="boton boton-ghost" id="btn-agregar-item" style="width:auto;padding:9px 18px;">Agregar al carrito</button>
      </div>

      <div class="tarjeta">
        <h3 style="margin-top:0;">Carrito</h3>
        <div id="pv-carrito"></div>
        <div style="text-align:right;font-family:'Fraunces',serif;font-size:20px;font-weight:600;color:var(--gold);margin:12px 0;" id="pv-total">Total: $0</div>
        <div class="grid-2">
          <div class="campo"><label>Método de pago</label>
            <select id="pv-metodo"><option>Efectivo</option><option>Transferencia</option><option>Débito</option><option>Crédito</option><option>Otro</option></select>
          </div>
          <div class="campo"><label>Vendedor(a)</label><input type="text" id="pv-responsable" placeholder="Tu nombre"></div>
        </div>
        <div class="grid-2">
          <div class="campo"><label>Cliente (opcional)</label><input type="text" id="pv-cliente-nombre" list="pv-lista-clientes" placeholder="Nombre del cliente"></div>
          <div class="campo"><label>Teléfono (opcional)</label><input type="text" id="pv-cliente-tel" placeholder="+56 9 ..."></div>
        </div>
        <datalist id="pv-lista-clientes"></datalist>
        <button class="boton boton-oro" id="btn-registrar-venta" style="width:100%;">Registrar venta</button>
      </div>
    </div>

    <div class="stats" id="pv-kpis" style="margin-top:22px;"></div>

    <div style="margin-top:10px;">
      <h3 style="font-size:15px;margin-bottom:10px;">Movimientos de caja de hoy</h3>
      <p class="subtitulo" style="margin-bottom:10px;">Ventas de mostrador + abonos recibidos en pedidos de Recepción.</p>
      <div class="tabla-wrap">
        <table class="tabla">
          <thead><tr><th>Hora</th><th>Origen</th><th>Detalle</th><th>Total</th><th>Método</th><th>Responsable</th></tr></thead>
          <tbody id="pv-historial"></tbody>
        </table>
      </div>
    </div>
  `;

  const [productos, clientes] = await Promise.all([listarProductos(), listarClientes()]);

  const turnos = await cargarTurnosDelDia(todayStr());
  const turnoVigente = turnoAbiertoVigente(turnos);
  const turnoInfoEl = document.getElementById('pv-turno-info');
  if (turnoVigente) {
    turnoInfoEl.innerHTML = `<div class="banda-alerta rojo" style="background:#E3EDE6;border-color:#C9DFCF;">
      <h4 style="color:#2E5C42;">🟢 Turno abierto: ${escapeHtml(turnoVigente.responsable)}</h4>
    </div>`;
    document.getElementById('pv-responsable').value = turnoVigente.responsable;
  } else {
    turnoInfoEl.innerHTML = `<div class="banda-alerta rojo" style="background:#F6EBD6;border-color:#E9D4A0;">
      <h4 style="color:#8A6A22;">🟡 No hay un turno abierto</h4>
      <p style="margin:0;color:#8A6A22;font-size:13px;">Abre uno en "Ventas" antes de vender, para que la caja cuadre bien al cerrar.</p>
    </div>`;
  }

  const selectProducto = document.getElementById('pv-producto');
  selectProducto.innerHTML = '<option value="">— Otro / producto sin bodega —</option>' +
    productos.map((p) => `<option value="${p.id}">${p.sku ? '[' + escapeHtml(p.sku) + '] ' : ''}${escapeHtml(p.nombre)} — ${money(p.precio_venta)} (stock: ${p.stock})</option>`).join('');
  selectProducto.onchange = () => {
    const p = productos.find((x) => x.id === selectProducto.value);
    if (p) {
      document.getElementById('pv-nombre').value = p.nombre;
      document.getElementById('pv-precio').value = p.precio_venta;
    }
  };

  document.getElementById('pv-lista-clientes').innerHTML = clientes.map((c) => `<option value="${escapeHtml(c.nombre)}">`).join('');

  document.getElementById('btn-agregar-item').onclick = () => {
    const productoId = selectProducto.value;
    const nombre = document.getElementById('pv-nombre').value.trim();
    const cantidad = Number(document.getElementById('pv-cantidad').value) || 0;
    const precioUnitario = Number(document.getElementById('pv-precio').value);

    if (!nombre) { toast('Escribe o elige un producto'); return; }
    if (cantidad <= 0) { toast('La cantidad debe ser mayor a 0'); return; }
    if (isNaN(precioUnitario) || precioUnitario < 0) { toast('Ingresa un precio válido'); return; }
    if (productoId) {
      const p = productos.find((x) => x.id === productoId);
      if (p && cantidad > p.stock) { toast(`Solo quedan ${p.stock} unidades de "${p.nombre}"`); return; }
    }

    carrito.push({ productoId: productoId || null, nombre, cantidad, precioUnitario, subtotal: cantidad * precioUnitario });
    selectProducto.value = '';
    document.getElementById('pv-nombre').value = '';
    document.getElementById('pv-cantidad').value = 1;
    document.getElementById('pv-precio').value = '';
    pintarCarrito();
  };

  document.getElementById('btn-registrar-venta').onclick = async (ev) => {
    if (!carrito.length) { toast('Agrega al menos un producto al carrito'); return; }
    const metodoPago = document.getElementById('pv-metodo').value;
    const responsable = document.getElementById('pv-responsable').value.trim();
    const clienteNombre = document.getElementById('pv-cliente-nombre').value.trim();
    const clienteTelefono = document.getElementById('pv-cliente-tel').value.trim();
    if (!responsable) { toast('Escribe el nombre de quien vende'); return; }

    ev.target.disabled = true;
    try {
      const total = carrito.reduce((s, it) => s + it.subtotal, 0);
      const venta = await registrarVenta({ items: carrito, metodoPago, responsable, clienteNombre, clienteTelefono });
      toast(`Venta registrada por ${money(total)}`);
      carrito = [];
      pintarCarrito();
      document.getElementById('pv-responsable').value = '';
      document.getElementById('pv-cliente-nombre').value = '';
      document.getElementById('pv-cliente-tel').value = '';
      await pintarHistorialYKpis();
    } catch (e) {
      console.error(e);
      toast('No se pudo registrar la venta');
    } finally {
      ev.target.disabled = false;
    }
  };

  pintarCarrito();
  await pintarHistorialYKpis();

  function pintarCarrito() {
    const wrap = document.getElementById('pv-carrito');
    wrap.innerHTML = carrito.length
      ? carrito.map((it, i) => `
        <div class="fila-clickable" style="cursor:default;">
          <div><div style="font-weight:600;">${escapeHtml(it.nombre)}</div><div style="font-size:12px;color:var(--ink-soft);">${it.cantidad} × ${money(it.precioUnitario)} = ${money(it.subtotal)}</div></div>
          <button class="mini-boton" data-quitar="${i}">Quitar</button>
        </div>`).join('')
      : `<div class="vacio" style="padding:16px;">Aún no has agregado productos.</div>`;
    wrap.querySelectorAll('[data-quitar]').forEach((btn) => {
      btn.onclick = () => { carrito.splice(Number(btn.dataset.quitar), 1); pintarCarrito(); };
    });
    const total = carrito.reduce((s, it) => s + it.subtotal, 0);
    document.getElementById('pv-total').textContent = 'Total: ' + money(total);
  }

  async function pintarHistorialYKpis() {
    const [ventasHoy, abonosHoy] = await Promise.all([listarVentasDeHoy(), listarAbonosDelDia(todayStr())]);
    const kpis = kpisDelDia(ventasHoy);
    document.getElementById('pv-kpis').innerHTML = `
      <div class="stat"><div class="stat-etiqueta">Ventas de mostrador hoy</div><div class="stat-valor">${kpis.cantidad}</div></div>
      <div class="stat"><div class="stat-etiqueta">Total vendido hoy</div><div class="stat-valor">${money(kpis.totalHoy)}</div></div>
      <div class="stat"><div class="stat-etiqueta">Ticket promedio</div><div class="stat-valor">${money(kpis.ticketProm)}</div></div>
      <div class="stat"><div class="stat-etiqueta" style="font-size:15px;">Más vendido hoy</div><div class="stat-valor" style="font-size:15px;">${escapeHtml(kpis.masVendido)}</div></div>
    `;

    const movimientos = [
      ...ventasHoy.map((v) => ({
        fecha: v.fecha, origen: '🛍️ Mostrador',
        detalle: v.items.map((it) => it.cantidad + '× ' + it.nombre).join(', '),
        total: v.total, metodo: v.metodo_pago, responsable: v.responsable,
      })),
      ...abonosHoy.map((a) => ({
        fecha: a.fecha, origen: '🧾 Abono pedido',
        detalle: `${a.folio} — ${a.cliente}`,
        total: a.monto, metodo: a.metodo, responsable: '—',
      })),
    ].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    document.getElementById('pv-historial').innerHTML = movimientos.length
      ? movimientos.map((m) => `<tr>
          <td>${new Date(m.fecha).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}</td>
          <td>${m.origen}</td>
          <td>${escapeHtml(m.detalle)}</td>
          <td>${money(m.total)}</td><td>${escapeHtml(m.metodo)}</td><td>${escapeHtml(m.responsable)}</td>
        </tr>`).join('')
      : `<tr><td colspan="6"><div class="vacio">Sin movimientos de caja todavía hoy.</div></td></tr>`;
  }
}

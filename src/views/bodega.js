import { listarProductos, crearProducto, ajustarStock, editarPrecioVenta, eliminarProducto, suscribirseAProductos } from '../data/productos.js';
import { escapeHtml, money, toast } from '../lib/util.js';

export async function renderBodega(contenedor, activa) {
  const puedeAutorizarCambios = activa?.rol === 'admin' || activa?.rol === 'encargado';
  contenedor.innerHTML = `
    <div class="encabezado-vista">
      <h2>Bodega</h2>
      <p class="subtitulo">Productos de mostrador — el stock baja solo cuando se registra una venta en Punto de venta</p>
    </div>

    <div id="bodega-alerta"></div>

    <div class="tarjeta" style="margin-bottom:22px;">
      <div class="grid-2">
        <div class="campo"><label>Nombre del producto *</label><input type="text" id="p-nombre" placeholder="Ej: Llavero acrílico"></div>
        <div class="campo"><label>Código SKU</label><input type="text" id="p-sku" placeholder="Ej: LLA-001"></div>
      </div>
      <div class="grid-2">
        <div class="campo"><label>Categoría</label><input type="text" id="p-categoria" placeholder="Ej: Llaveros"></div>
        <div class="campo"><label>Stock inicial</label><input type="number" id="p-stock" min="0" value="0"></div>
      </div>
      <div class="grid-2">
        <div class="campo"><label>Stock mínimo (alerta)</label><input type="number" id="p-stock-min" min="0" value="3"></div>
        <div class="campo"><label>Precio costo ($)</label><input type="number" id="p-costo" min="0" placeholder="0"></div>
      </div>
      <div class="campo" style="max-width:calc(50% - 7px);"><label>Precio venta ($) *</label><input type="number" id="p-venta" min="0" placeholder="0"></div>
      <div class="error" id="bodega-error"></div>
      <div class="pie-formulario" style="justify-content:flex-start;">
        <button class="boton boton-oro" id="btn-agregar-producto" style="width:auto;padding:11px 24px;">Agregar producto a bodega</button>
      </div>
    </div>

    <div class="tarjeta" style="margin-bottom:22px;">
      <h3 style="margin-top:0;">Importar productos desde un archivo CSV</h3>
      <p class="subtitulo" style="margin-bottom:12px;">Sirve para traer tu inventario desde Excel, Bsale, Defontana u otro sistema — exporta a CSV desde ahí y súbelo acá. Columnas esperadas: <b>sku, nombre, categoria, stock, stock_minimo, precio_costo, precio_venta</b> (solo "nombre" y "precio_venta" son obligatorias).</p>
      <input type="file" id="csv-archivo" accept=".csv">
      <div id="csv-resultado" style="margin-top:10px;"></div>
    </div>

    <div class="tabla-wrap">
      <table class="tabla">
        <thead><tr><th>SKU</th><th>Producto</th><th>Categoría</th><th>Stock</th><th>Costo</th><th>Venta</th><th>Ajustar</th><th></th></tr></thead>
        <tbody id="bodega-tbody"></tbody>
      </table>
    </div>
  `;

  document.getElementById('btn-agregar-producto').onclick = async (ev) => {
    const errBox = document.getElementById('bodega-error');
    errBox.classList.remove('visible');
    const nombre = document.getElementById('p-nombre').value.trim();
    const venta = document.getElementById('p-venta').value;
    if (!nombre || venta === '') {
      errBox.textContent = 'Completa al menos el nombre y el precio de venta.';
      errBox.classList.add('visible');
      return;
    }
    ev.target.disabled = true;
    try {
      await crearProducto({
        nombre,
        sku: document.getElementById('p-sku').value.trim(),
        categoria: document.getElementById('p-categoria').value.trim(),
        stock: Number(document.getElementById('p-stock').value) || 0,
        stock_minimo: Number(document.getElementById('p-stock-min').value) || 0,
        precio_costo: Number(document.getElementById('p-costo').value) || 0,
        precio_venta: Number(venta) || 0,
      });
      toast('Producto agregado a bodega');
      ['p-nombre', 'p-sku', 'p-categoria', 'p-costo', 'p-venta'].forEach((id) => (document.getElementById(id).value = ''));
      document.getElementById('p-stock').value = 0;
      document.getElementById('p-stock-min').value = 3;
      await pintar();
    } catch (e) {
      console.error(e);
      errBox.textContent = e.message || 'No se pudo guardar el producto.';
      errBox.classList.add('visible');
    } finally {
      ev.target.disabled = false;
    }
  };

  await pintar();
  const cancelarSuscripcion = suscribirseAProductos(() => pintar());

  document.getElementById('csv-archivo').onchange = async (ev) => {
    const archivo = ev.target.files?.[0];
    if (!archivo) return;
    const resultadoEl = document.getElementById('csv-resultado');
    resultadoEl.innerHTML = '<span style="color:var(--ink-soft);font-size:13px;">Leyendo archivo…</span>';
    try {
      const texto = await archivo.text();
      const filas = parsearCSV(texto);
      if (!filas.length) throw new Error('El archivo está vacío o no tiene el formato esperado.');

      let creados = 0, omitidos = 0;
      for (const fila of filas) {
        const nombre = (fila.nombre || '').trim();
        const precioVenta = Number(fila.precio_venta);
        if (!nombre || isNaN(precioVenta)) { omitidos++; continue; }
        try {
          await crearProducto({
            nombre,
            sku: (fila.sku || '').trim(),
            categoria: (fila.categoria || '').trim(),
            stock: Number(fila.stock) || 0,
            stock_minimo: Number(fila.stock_minimo) || 0,
            precio_costo: Number(fila.precio_costo) || 0,
            precio_venta: precioVenta,
          });
          creados++;
        } catch (e) { omitidos++; }
      }
      resultadoEl.innerHTML = `<span style="color:#2E5C42;font-size:13px;font-weight:600;">✓ ${creados} productos importados${omitidos ? `, ${omitidos} omitidos (SKU repetido o datos incompletos)` : ''}.</span>`;
      ev.target.value = '';
      await pintar();
    } catch (e) {
      console.error(e);
      resultadoEl.innerHTML = `<span style="color:#9B2C2C;font-size:13px;">No se pudo importar: ${e.message}</span>`;
    }
  };

  return cancelarSuscripcion;

  /** Parser de CSV simple: primera fila = encabezados, admite comas dentro de comillas. */
  function parsearCSV(texto) {
    const lineas = texto.split(/\r?\n/).filter((l) => l.trim());
    if (lineas.length < 2) return [];
    const partirLinea = (linea) => {
      const partes = [];
      let actual = '', dentroComillas = false;
      for (let i = 0; i < linea.length; i++) {
        const c = linea[i];
        if (c === '"') dentroComillas = !dentroComillas;
        else if (c === ',' && !dentroComillas) { partes.push(actual); actual = ''; }
        else actual += c;
      }
      partes.push(actual);
      return partes.map((p) => p.trim());
    };
    const encabezados = partirLinea(lineas[0]).map((h) => h.toLowerCase().replace(/\s+/g, '_'));
    return lineas.slice(1).map((linea) => {
      const valores = partirLinea(linea);
      const fila = {};
      encabezados.forEach((h, i) => { fila[h] = valores[i] || ''; });
      return fila;
    });
  }

  async function pintar() {
    const alertaEl = document.getElementById('bodega-alerta');
    const tbodyEl = document.getElementById('bodega-tbody');
    if (!alertaEl || !tbodyEl) return; // ya no estamos en esta pantalla (llegó un evento tarde de tiempo real)
    const productos = await listarProductos();
    const bajos = productos.filter((p) => p.stock <= p.stock_minimo);

    alertaEl.innerHTML = bajos.length
      ? `<div class="banda-alerta rojo" style="background:#F6EBD6;border-color:#E9D4A0;">
          <h4 style="color:#8A6A22;">🟡 ${bajos.length} producto${bajos.length === 1 ? '' : 's'} con stock bajo</h4>
          <p style="margin:0;color:#8A6A22;font-size:13px;">${bajos.map((p) => escapeHtml(p.nombre)).join(', ')}</p>
        </div>`
      : '';

    const tbody = tbodyEl;
    tbody.innerHTML = productos.length
      ? productos.map((p) => `
        <tr>
          <td class="mono">${escapeHtml(p.sku) || '—'}</td>
          <td>${escapeHtml(p.nombre)}</td>
          <td>${escapeHtml(p.categoria) || '—'}</td>
          <td style="${p.stock <= p.stock_minimo ? 'color:#8A6A22;font-weight:700;' : ''}">${p.stock}</td>
          <td>${money(p.precio_costo)}</td>
          <td>
            ${money(p.precio_venta)}
            ${puedeAutorizarCambios ? `<button class="mini-boton" data-editar-precio="${p.id}" data-precio-actual="${p.precio_venta}" style="margin-left:6px;">✏️</button>` : ''}
          </td>
          <td>
            <div style="display:flex;gap:5px;">
              <button class="mini-boton" data-ajustar="${p.id}" data-delta="-1">−1</button>
              <button class="mini-boton" data-ajustar="${p.id}" data-delta="1">+1</button>
            </div>
          </td>
          <td>${puedeAutorizarCambios
            ? `<button class="mini-boton" data-eliminar="${p.id}">Eliminar</button>`
            : `<span style="font-size:11px;color:var(--ink-soft);" title="Solo un encargado de turno o administrador puede eliminar productos">🔒</span>`}</td>
        </tr>`).join('')
      : `<tr><td colspan="8"><div class="vacio"><b>Bodega vacía</b>Agrega tu primer producto arriba.</div></td></tr>`;

    tbody.querySelectorAll('[data-ajustar]').forEach((btn) => {
      btn.onclick = async () => {
        try { await ajustarStock(btn.dataset.ajustar, Number(btn.dataset.delta)); await pintar(); }
        catch (e) { console.error(e); toast('No se pudo ajustar el stock'); }
      };
    });
    tbody.querySelectorAll('[data-editar-precio]').forEach((btn) => {
      btn.onclick = async () => {
        const nuevo = prompt('Nuevo precio de venta:', btn.dataset.precioActual);
        if (nuevo === null) return;
        const num = Number(nuevo);
        if (isNaN(num) || num < 0) { toast('Precio inválido'); return; }
        try { await editarPrecioVenta(btn.dataset.editarPrecio, num); toast('Precio actualizado'); await pintar(); }
        catch (e) { console.error(e); toast('No se pudo actualizar el precio'); }
      };
    });
    tbody.querySelectorAll('[data-eliminar]').forEach((btn) => {
      btn.onclick = async () => {
        if (!confirm('¿Quitar este producto de bodega? Ya no aparecerá en Punto de venta.')) return;
        try { await eliminarProducto(btn.dataset.eliminar); toast('Producto eliminado'); await pintar(); }
        catch (e) { console.error(e); toast('No se pudo eliminar el producto'); }
      };
    });
  }
}

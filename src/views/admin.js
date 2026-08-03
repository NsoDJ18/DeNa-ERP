import { listarOrdenes, archivarOrden, restaurarOrden } from '../data/ordenes.js';
import { abrirDetalle, badge } from './estado.js';
import { listarEmpleados, agregarEmpleado, eliminarEmpleado } from '../data/empleados.js';
import { listarEquipo, cambiarRolMiembro, invitarMiembro } from '../data/equipo.js';
import { obtenerTiemposMax, guardarTiemposMax, guardarSucursal } from '../data/configuracion.js';
import { escapeHtml, money, fdate, fdatetime, localDateStr, toast } from '../lib/util.js';

let seccionActual = 'resumen';

export async function renderAdmin(contenedor, activa) {
  if (activa.rol !== 'admin') {
    contenedor.innerHTML = `<div class="tarjeta" style="max-width:420px;margin:40px auto;text-align:center;">
      <h3 style="color:var(--navy);">Solo administradores</h3>
      <p style="color:var(--ink-soft);font-size:13px;">Tu cuenta no tiene permisos de administración en esta empresa.</p>
    </div>`;
    return;
  }

  contenedor.innerHTML = `
    <div class="encabezado-vista"><h2>Administración</h2><p class="subtitulo">Todos los pedidos del taller</p></div>
    <div class="botones-sub" id="admin-subnav">
      <button data-sec="resumen" class="activo">📊 Resumen</button>
      <button data-sec="equipo">🧑‍💼 Equipo</button>
      <button data-sec="empleados">👥 Empleados</button>
      <button data-sec="configuracion">⚙️ Configuración</button>
    </div>
    <div id="admin-contenido"></div>
  `;

  document.querySelectorAll('#admin-subnav button').forEach((b) => {
    b.onclick = () => { seccionActual = b.dataset.sec; document.querySelectorAll('#admin-subnav button').forEach((x) => x.classList.toggle('activo', x === b)); pintarSeccion(); };
  });

  await pintarSeccion();

  async function pintarSeccion() {
    const cont = document.getElementById('admin-contenido');
    if (seccionActual === 'resumen') return pintarResumen(cont);
    if (seccionActual === 'equipo') return pintarEquipo(cont);
    if (seccionActual === 'empleados') return pintarEmpleados(cont);
    if (seccionActual === 'configuracion') return pintarConfiguracion(cont, activa);
  }
}

// ============================================================
// RESUMEN: KPIs + tabla + Excel + registro de cancelados
// ============================================================
async function pintarResumen(cont) {
  const ordenes = await listarOrdenes({ incluirArchivadas: true });
  const activas = ordenes.filter((o) => !o.archivado);
  const archivadas = ordenes.filter((o) => o.archivado);

  const total = activas.length;
  const enProceso = activas.filter((o) => ['ingreso', 'diseno', 'fabricacion', 'calidad', 'listo'].includes(o.estado)).length;
  const entregados = activas.filter((o) => o.estado === 'entregado').length;
  const cancelados = activas.filter((o) => o.estado === 'cancelado').length;
  const noRetirados = activas.filter((o) => o.estado === 'no_retirado').length;
  const facturables = activas.filter((o) => o.estado !== 'cancelado');
  const ingresos = facturables.reduce((s, o) => s + (o.precio || 0), 0);
  const saldo = facturables.reduce((s, o) => s + ((o.precio || 0) - (o.abono || 0)), 0);
  const ticketProm = facturables.length ? ingresos / facturables.length : 0;
  const conSaldo = facturables.filter((o) => (o.precio || 0) - (o.abono || 0) > 0);

  cont.innerHTML = `
    ${conSaldo.length ? `
    <div class="banda-alerta rojo" style="background:#F6EBD6;border-color:#E9D4A0;">
      <h4 style="color:#8A6A22;">🟡 ${conSaldo.length} pedido${conSaldo.length === 1 ? '' : 's'} con saldo por cobrar (${money(saldo)} en total)</h4>
      ${conSaldo.map((o) => `<div class="fila-resultado" style="color:#8A6A22;"><span class="mono">${o.folio}</span> ${escapeHtml(o.cliente)} — debe ${money((o.precio || 0) - (o.abono || 0))}</div>`).join('')}
    </div>` : ''}

    <div class="stats">
      <div class="stat"><div class="stat-etiqueta">Total pedidos</div><div class="stat-valor">${total}</div></div>
      <div class="stat"><div class="stat-etiqueta">En proceso</div><div class="stat-valor">${enProceso}</div></div>
      <div class="stat"><div class="stat-etiqueta">Cerrados con éxito</div><div class="stat-valor">${entregados}</div></div>
      <div class="stat"><div class="stat-etiqueta">Cancelados</div><div class="stat-valor">${cancelados}</div></div>
      <div class="stat"><div class="stat-etiqueta">No retirados</div><div class="stat-valor">${noRetirados}</div></div>
      <div class="stat"><div class="stat-etiqueta">Ingresos totales</div><div class="stat-valor">${money(ingresos)}</div></div>
      <div class="stat"><div class="stat-etiqueta">Saldo por cobrar</div><div class="stat-valor">${money(saldo)}</div></div>
      <div class="stat"><div class="stat-etiqueta">Ticket promedio</div><div class="stat-valor">${money(ticketProm)}</div></div>
    </div>

    <div class="tarjeta" style="display:flex;gap:14px;align-items:flex-end;flex-wrap:wrap;margin-bottom:18px;">
      <div class="campo" style="margin-bottom:0;"><label>Desde</label><input type="date" id="ex-desde"></div>
      <div class="campo" style="margin-bottom:0;"><label>Hasta</label><input type="date" id="ex-hasta"></div>
      <button class="boton boton-oro" id="btn-excel" style="width:auto;padding:10px 20px;">Exportar a Excel</button>
    </div>

    <div class="campo"><input type="text" id="ad-buscar" placeholder="Buscar cliente, RUT o folio..."></div>
    <div class="tabla-wrap" style="margin-bottom:24px;">
      <table class="tabla">
        <thead><tr><th>Folio</th><th>Cliente</th><th>RUT</th><th>Tipo</th><th>Entrega</th><th>Estado</th><th>Total</th><th>Saldo</th></tr></thead>
        <tbody id="ad-tbody"></tbody>
      </table>
    </div>

    <h3 style="font-size:15px;">Registro de servicios cancelados</h3>
    <p class="subtitulo" style="margin-bottom:10px;">Pedidos que eliminaste de la lista activa — se pueden restaurar.</p>
    <div class="tabla-wrap">
      <table class="tabla">
        <thead><tr><th>Folio</th><th>Cliente</th><th>Tipo</th><th>Total</th><th>Eliminado el</th><th></th></tr></thead>
        <tbody id="ad-cancelados-tbody"></tbody>
      </table>
    </div>
  `;

  const pintarTabla = () => {
    const q = document.getElementById('ad-buscar').value.trim().toLowerCase();
    const lista = q
      ? activas.filter((o) => o.folio.toLowerCase().includes(q) || (o.cliente || '').toLowerCase().includes(q) || (o.rut_cliente || '').toLowerCase().includes(q))
      : activas;
    document.getElementById('ad-tbody').innerHTML = lista.length
      ? lista.map((o) => `
        <tr class="fila-clickable" data-id="${o.id}">
          <td class="mono" style="color:var(--gold);font-weight:700;">${o.folio}</td>
          <td>${escapeHtml(o.cliente)}</td><td>${escapeHtml(o.rut_cliente) || '—'}</td>
          <td>${escapeHtml(o.tipo)}</td><td>${fdate(o.fecha_entrega)}</td>
          <td>${badge(o.estado)}</td><td>${money(o.precio)}</td><td>${money((o.precio || 0) - (o.abono || 0))}</td>
        </tr>`).join('')
      : `<tr><td colspan="8"><div class="vacio">No hay pedidos que coincidan.</div></td></tr>`;
    document.querySelectorAll('#ad-tbody [data-id]').forEach((fila) => { fila.onclick = () => abrirDetalle(fila.dataset.id); });
  };
  document.getElementById('ad-buscar').oninput = pintarTabla;
  pintarTabla();

  document.getElementById('ad-cancelados-tbody').innerHTML = archivadas.length
    ? archivadas.map((o) => `
      <tr><td class="mono">${o.folio}</td><td>${escapeHtml(o.cliente)}</td><td>${escapeHtml(o.tipo)}</td>
        <td>${money(o.precio)}</td><td>${fdatetime(o.archivado_en)}</td>
        <td><button class="mini-boton" data-restaurar="${o.id}">Restaurar</button></td></tr>`).join('')
    : `<tr><td colspan="6"><div class="vacio">Registro vacío.</div></td></tr>`;
  document.querySelectorAll('[data-restaurar]').forEach((btn) => {
    btn.onclick = async () => { await restaurarOrden(btn.dataset.restaurar); toast('Orden restaurada'); pintarResumen(cont); };
  });

  document.getElementById('btn-excel').onclick = async () => {
    const desde = document.getElementById('ex-desde').value;
    const hasta = document.getElementById('ex-hasta').value;
    let filtradas = activas;
    if (desde) filtradas = filtradas.filter((o) => localDateStr(o.fecha_recepcion) >= desde);
    if (hasta) filtradas = filtradas.filter((o) => localDateStr(o.fecha_recepcion) <= hasta);
    if (!filtradas.length) { toast('No hay pedidos en ese rango de fechas'); return; }

    const filas = filtradas.map((o) => ({
      Folio: o.folio, RUT: o.rut_cliente || '', Cliente: o.cliente, Teléfono: o.telefono || '',
      Tipo: o.tipo, Cantidad: o.cantidad, Descripción: o.descripcion,
      'Fecha recepción': fdatetime(o.fecha_recepcion), 'Fecha entrega': o.fecha_entrega,
      'Recibido por': o.responsable, Estado: o.estado,
      'Precio total': o.precio, Abono: o.abono, Saldo: (o.precio || 0) - (o.abono || 0),
    }));
    const boton = document.getElementById('btn-excel');
    boton.disabled = true; boton.textContent = 'Generando…';
    try {
      const XLSX = await import('xlsx'); // se descarga solo al exportar, no al abrir la app
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filas), 'Pedidos');
      XLSX.writeFile(wb, `dena_erp_pedidos_${desde || 'inicio'}_a_${hasta || 'hoy'}.xlsx`);
      toast('Excel exportado');
    } catch (e) {
      console.error(e);
      toast('No se pudo generar el Excel');
    } finally {
      boton.disabled = false; boton.textContent = 'Exportar a Excel';
    }
  };
}

// ============================================================
// EMPLEADOS
// ============================================================
// ============================================================
// EQUIPO: jerarquías (admin / encargado de turno / trabajador)
// ============================================================
async function pintarEquipo(cont) {
  cont.innerHTML = `
    <div class="tarjeta" style="max-width:560px;margin-bottom:22px;">
      <h3 style="margin-top:0;">Vincular a alguien nuevo</h3>
      <p class="subtitulo" style="margin-bottom:14px;">
        La persona debe registrarse primero por su cuenta desde la pantalla de login
        (correo propio). Una vez que lo haga, la vinculas acá por su correo.
      </p>
      <div class="campo"><label>Correo con el que se registró</label><input type="email" id="inv-email" placeholder="persona@correo.com"></div>
      <div class="grid-2">
        <div class="campo"><label>Nombre a mostrar</label><input type="text" id="inv-nombre" placeholder="Ej: Camila Fuentes"></div>
        <div class="campo"><label>Jerarquía</label>
          <select id="inv-rol">
            <option value="trabajador">Trabajador</option>
            <option value="encargado">Encargado de turno</option>
            <option value="admin">Administrador</option>
          </select>
        </div>
      </div>
      <div class="error" id="inv-error"></div>
      <button class="boton boton-oro" id="btn-invitar" style="width:auto;padding:9px 20px;">Vincular a mi empresa</button>
    </div>

    <div class="tarjeta" style="max-width:560px;">
      <h3 style="margin-top:0;">Jerarquía del equipo</h3>
      <p class="subtitulo" style="margin-bottom:14px;">
        <b>Trabajador</b>: uso normal del sistema. <b>Encargado de turno</b>: además puede
        cambiar precios y anular productos en Bodega, y aplicar notas de crédito.
        <b>Administrador</b>: acceso total.
      </p>
      <div id="equipo-lista"></div>
    </div>
  `;
  await pintarLista();

  document.getElementById('btn-invitar').onclick = async (ev) => {
    const errBox = document.getElementById('inv-error');
    errBox.classList.remove('visible');
    const email = document.getElementById('inv-email').value.trim();
    const nombre = document.getElementById('inv-nombre').value.trim();
    const rol = document.getElementById('inv-rol').value;
    if (!email || !nombre) { errBox.textContent = 'Completa el correo y el nombre a mostrar.'; errBox.classList.add('visible'); return; }

    ev.target.disabled = true; ev.target.textContent = 'Vinculando…';
    try {
      await invitarMiembro(email, rol, nombre);
      toast(`${nombre} vinculado como ${rol}`);
      document.getElementById('inv-email').value = '';
      document.getElementById('inv-nombre').value = '';
      await pintarLista();
    } catch (e) {
      console.error(e);
      errBox.textContent = e.message || 'No se pudo vincular a esa persona.';
      errBox.classList.add('visible');
    } finally {
      ev.target.disabled = false; ev.target.textContent = 'Vincular a mi empresa';
    }
  };

  async function pintarLista() {
    const equipo = await listarEquipo();
    document.getElementById('equipo-lista').innerHTML = equipo.length
      ? equipo.map((m) => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px dotted var(--line);gap:10px;">
          <span style="font-size:13.5px;">${escapeHtml(m.nombre_mostrar) || '(sin nombre configurado)'}</span>
          <select data-rol-de="${m.usuario_id}" style="font-family:inherit;font-size:12.5px;padding:6px 8px;border-radius:7px;border:1px solid var(--line);">
            <option value="trabajador" ${m.rol === 'trabajador' ? 'selected' : ''}>Trabajador</option>
            <option value="encargado" ${m.rol === 'encargado' ? 'selected' : ''}>Encargado de turno</option>
            <option value="admin" ${m.rol === 'admin' ? 'selected' : ''}>Administrador</option>
          </select>
        </div>`).join('')
      : `<div class="vacio" style="padding:14px;">Aún no hay nadie más vinculado a esta empresa.</div>`;

    document.querySelectorAll('[data-rol-de]').forEach((sel) => {
      sel.onchange = async () => {
        try { await cambiarRolMiembro(sel.dataset.rolDe, sel.value); toast('Jerarquía actualizada'); }
        catch (e) { console.error(e); toast('No se pudo cambiar el rol'); await pintarLista(); }
      };
    });
  }
}

async function pintarEmpleados(cont) {
  cont.innerHTML = `
    <div class="tarjeta" style="max-width:480px;">
      <h3 style="margin-top:0;">Trabajadores</h3>
      <p class="subtitulo" style="margin-bottom:14px;">Estos nombres sugieren autocompletado en Recepción, Ventas y Punto de venta.</p>
      <div id="emp-lista" style="margin-bottom:14px;"></div>
      <div class="campo"><label>Nombre del trabajador</label><input type="text" id="emp-nombre" placeholder="Ej: Camila Fuentes"></div>
      <button class="boton boton-ghost" id="btn-agregar-empleado">Agregar trabajador</button>
    </div>
  `;
  await pintarLista();

  document.getElementById('btn-agregar-empleado').onclick = async () => {
    const input = document.getElementById('emp-nombre');
    const nombre = input.value.trim();
    if (!nombre) { toast('Escribe un nombre'); return; }
    try { await agregarEmpleado(nombre); input.value = ''; toast('Trabajador agregado'); await pintarLista(); }
    catch (e) { console.error(e); toast('No se pudo agregar'); }
  };

  async function pintarLista() {
    const empleados = await listarEmpleados();
    document.getElementById('emp-lista').innerHTML = empleados.length
      ? empleados.map((e) => `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px dotted var(--line);font-size:13px;">
          <span>${escapeHtml(e.nombre)}</span><button class="mini-boton" data-eliminar-emp="${e.id}">Eliminar</button></div>`).join('')
      : `<div class="vacio" style="padding:14px;">Aún no agregas trabajadores.</div>`;
    document.querySelectorAll('[data-eliminar-emp]').forEach((btn) => {
      btn.onclick = async () => { await eliminarEmpleado(btn.dataset.eliminarEmp); toast('Trabajador eliminado'); await pintarLista(); };
    });
  }
}

// ============================================================
// CONFIGURACIÓN
// ============================================================
async function pintarConfiguracion(cont, activa) {
  const tmax = await obtenerTiemposMax();
  cont.innerHTML = `
    <div class="tarjeta" style="max-width:480px;margin-bottom:22px;">
      <h3 style="margin-top:0;">⏱️ Tiempos máximos por estación (minutos)</h3>
      <p class="subtitulo" style="margin-bottom:14px;">En Estación 05, al superarse pasa a "No retirados".</p>
      <div class="grid-2">
        <div class="campo"><label>01 · Ingreso</label><input type="number" id="tm-ingreso" value="${tmax.ingreso}"></div>
        <div class="campo"><label>02 · Diseño</label><input type="number" id="tm-diseno" value="${tmax.diseno}"></div>
      </div>
      <div class="grid-2">
        <div class="campo"><label>03 · Fabricación</label><input type="number" id="tm-fabricacion" value="${tmax.fabricacion}"></div>
        <div class="campo"><label>04 · Calidad</label><input type="number" id="tm-calidad" value="${tmax.calidad}"></div>
      </div>
      <div class="campo" style="max-width:calc(50% - 7px);"><label>05 · Listo (→ No retirados)</label><input type="number" id="tm-listo" value="${tmax.listo}"></div>
      <button class="boton boton-ghost" id="btn-guardar-tmax">Guardar tiempos</button>
    </div>

    <div class="tarjeta" style="max-width:480px;">
      <h3 style="margin-top:0;">Nombre del local / sucursal</h3>
      <div class="campo"><label>Texto bajo el logo</label><input type="text" id="cfg-sucursal" value="${escapeHtml(activa.sucursal || '')}"></div>
      <button class="boton boton-ghost" id="btn-guardar-sucursal">Guardar</button>
    </div>
  `;

  document.getElementById('btn-guardar-tmax').onclick = async () => {
    try {
      await guardarTiemposMax({
        ingreso: Number(document.getElementById('tm-ingreso').value) || 60,
        diseno: Number(document.getElementById('tm-diseno').value) || 180,
        fabricacion: Number(document.getElementById('tm-fabricacion').value) || 240,
        calidad: Number(document.getElementById('tm-calidad').value) || 60,
        listo: Math.min(4320, Number(document.getElementById('tm-listo').value) || 4320),
      });
      toast('Tiempos actualizados');
    } catch (e) { console.error(e); toast('No se pudo guardar'); }
  };

  document.getElementById('btn-guardar-sucursal').onclick = async () => {
    const texto = document.getElementById('cfg-sucursal').value.trim();
    try { await guardarSucursal(texto); activa.sucursal = texto; toast('Nombre de local actualizado'); }
    catch (e) { console.error(e); toast('No se pudo guardar'); }
  };
}

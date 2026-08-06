import {
  pagosPorMetodo, pagosPorMetodoDesde, cargarTurnosDelDia, turnoAbiertoVigente,
  abrirTurno, registrarCierreTurno, METODOS_BASE,
} from '../data/turnos.js';
import { escapeHtml, money, todayStr, toast } from '../lib/util.js';
import { sugerirEmpleado } from '../data/empleados.js';

export async function renderVentas(contenedor) {
  contenedor.innerHTML = `
    <div class="encabezado-vista">
      <h2>Ventas</h2>
      <p class="subtitulo">Revisa la caja del día y registra tu cierre de turno</p>
    </div>

    <div class="campo" style="max-width:220px;"><label>Fecha en curso o a revisar</label><input type="date" id="v-fecha" value="${todayStr()}"></div>
    <div class="stats" id="v-stats"></div>

    <div class="tarjeta" style="margin-bottom:22px;">
      <h3 style="margin-top:0;">Ventas por método de pago (día completo)</h3>
      <div class="tabla-wrap"><table class="tabla"><thead><tr><th>Método</th><th>Monto</th></tr></thead><tbody id="v-metodos-tbody"></tbody></table></div>
    </div>

    <div id="v-sinturno"></div>

    <div class="tarjeta" style="margin-bottom:22px;">
      <h3 style="margin-top:0;">Abrir turno</h3>
      <p class="subtitulo">Registra con cuánto efectivo empiezas la caja.</p>
      <div class="grid-2">
        <div class="campo"><label>Responsable</label><input type="text" id="a-responsable" placeholder="Tu nombre"></div>
        <div class="campo"><label>Fondo inicial de caja ($)</label><input type="number" id="a-fondo" min="0" placeholder="0"></div>
      </div>
      <div class="pie-formulario"><button class="boton boton-ghost" id="btn-abrir">Abrir turno</button></div>
    </div>

    <div class="tarjeta" id="cerrar-turno-tarjeta" style="margin-bottom:22px;">
      <h3 style="margin-top:0;">Cerrar turno</h3>
      <p class="subtitulo">Verifica cada medio de pago por separado. El efectivo es obligatorio contarlo.</p>
      <div class="campo"><label>Responsable del cierre</label><input type="text" id="c-responsable" placeholder="Tu nombre"></div>
      <div id="c-metodos"></div>
      <div class="grid-2" style="margin:14px 0;">
        <div><span class="mini-label">Fondo inicial vigente</span><div id="c-fondo">$0</div></div>
        <div><span class="mini-label">Diferencia total</span><div id="c-diferencia">$0</div></div>
      </div>
      <div class="campo"><label>Folio de cierre TBK (si hubo ventas con tarjeta)</label><input type="text" id="c-folio-tbk" placeholder="Ej: 000123"></div>
      <div class="campo" id="c-justificacion-wrap" style="display:none;"><label>Justificación de la diferencia *</label><textarea id="c-justificacion"></textarea></div>
      <div class="pie-formulario"><button class="boton boton-oro" id="btn-cerrar">Cerrar turno</button></div>
    </div>

    <div class="tabla-wrap">
      <table class="tabla">
        <thead><tr><th>Hora</th><th>Tipo</th><th>Responsable</th><th>Detalle</th><th>Folio TBK</th><th>Justificación</th></tr></thead>
        <tbody id="v-turnos-tbody"></tbody>
      </table>
    </div>
  `;

  document.getElementById('v-fecha').onchange = pintar;
  document.getElementById('btn-abrir').onclick = accionAbrir;
  document.getElementById('btn-cerrar').onclick = accionCerrar;

  await pintar();

  async function pintar() {
    const fecha = document.getElementById('v-fecha').value || todayStr();
    const { porMetodo, total } = await pagosPorMetodo(fecha);
    const turnos = await cargarTurnosDelDia(fecha);
    const vigente = turnoAbiertoVigente(turnos);
    const ultimaApertura = [...turnos].reverse().find((t) => t.tipo === 'apertura');
    const fondoInicial = ultimaApertura ? ultimaApertura.fondo_inicial : 0;
    const horaDesde = ultimaApertura ? ultimaApertura.hora : fecha + 'T00:00:00';
    const { porMetodo: porMetodoTurno } = await pagosPorMetodoDesde(horaDesde);
    const efectivoEsperado = (fondoInicial || 0) + (porMetodoTurno['Efectivo'] || 0);

    document.getElementById('v-stats').innerHTML = `
      <div class="stat"><div class="stat-etiqueta">Total pagado (todos los métodos, hoy)</div><div class="stat-valor">${money(total)}</div></div>
      <div class="stat"><div class="stat-etiqueta">Efectivo esperado (turno en curso)</div><div class="stat-valor">${vigente ? money(efectivoEsperado) : '—'}</div></div>
    `;

    const metodos = Object.keys(porMetodo).sort((a, b) => porMetodo[b] - porMetodo[a]);
    document.getElementById('v-metodos-tbody').innerHTML = metodos.length
      ? metodos.map((m) => `<tr><td>${escapeHtml(m)}</td><td>${money(porMetodo[m])}</td></tr>`).join('')
      : `<tr><td colspan="2"><div class="vacio">Sin pagos ese día.</div></td></tr>`;

    const sinTurnoWrap = document.getElementById('v-sinturno');
    const cerrarTarjeta = document.getElementById('cerrar-turno-tarjeta');
    if (!vigente) {
      sinTurnoWrap.innerHTML = `<div class="banda-alerta rojo" style="background:#F6EBD6;border-color:#E9D4A0;">
        <h4 style="color:#8A6A22;">🟡 No hay un turno abierto ahora</h4>
        <p style="margin:0;color:#8A6A22;font-size:13px;">Abre uno nuevo arriba antes de seguir vendiendo o cerrando caja.</p>
      </div>`;
      cerrarTarjeta.style.display = 'none';
    } else {
      sinTurnoWrap.innerHTML = '';
      cerrarTarjeta.style.display = '';
    }

    // formulario de cierre: una fila por método
    const todosMetodos = Array.from(new Set([...METODOS_BASE, ...Object.keys(porMetodoTurno)]));
    document.getElementById('c-metodos').innerHTML = `
      <div class="tabla-wrap"><table class="tabla"><thead><tr><th>Método</th><th>Esperado</th><th>Contado</th><th>Diferencia</th></tr></thead><tbody>
        ${todosMetodos.map((m) => {
          const esperado = m === 'Efectivo' ? efectivoEsperado : (porMetodoTurno[m] || 0);
          const id = 'c-contado-' + m.replace(/[^a-zA-Z0-9]/g, '_');
          return `<tr><td>${escapeHtml(m)}</td><td>${money(esperado)}</td>
            <td><input type="number" id="${id}" data-metodo="${escapeHtml(m)}" data-esperado="${esperado}" placeholder="${m === 'Efectivo' ? 'obligatorio' : 'opcional'}" oninput="window.__actualizarDifTurno()" style="width:100px;"></td>
            <td id="dif-${id}">—</td></tr>`;
        }).join('')}
      </tbody></table></div>`;
    document.getElementById('c-fondo').textContent = money(fondoInicial);
    window.__actualizarDifTurno = actualizarDiferencia;
    actualizarDiferencia();

    document.getElementById('v-turnos-tbody').innerHTML = turnos.length
      ? turnos.map((t) => t.tipo === 'apertura'
          ? `<tr><td>${new Date(t.hora).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}</td><td>🟢 Apertura</td><td>${escapeHtml(t.responsable)}</td><td>Fondo: ${money(t.fondo_inicial)}</td><td>—</td><td>—</td></tr>`
          : `<tr><td>${new Date(t.hora).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}</td><td>🔴 Cierre</td><td>${escapeHtml(t.responsable)}</td><td>${detalleTexto(t)}</td><td>${escapeHtml(t.folio_tbk) || '—'}</td><td>${escapeHtml(t.justificacion) || '—'}</td></tr>`
        ).join('')
      : `<tr><td colspan="6"><div class="vacio">Aún no hay aperturas ni cierres este día.</div></td></tr>`;
  }

  function detalleTexto(t) {
    if (!t.detalle || !t.detalle.length) return money(t.diferencia_total);
    const verificados = t.detalle.filter((d) => d.contado !== null && d.contado !== undefined);
    if (!verificados.length) return 'Sin verificar';
    return verificados.map((d) => `${d.metodo}: ${money(d.diferencia)}`).join(' · ');
  }

  function actualizarDiferencia() {
    const inputs = document.querySelectorAll('#c-metodos input[data-metodo]');
    let totalDif = 0, algunaConDato = false;
    inputs.forEach((inp) => {
      const esperado = Number(inp.dataset.esperado) || 0;
      const celda = document.getElementById('dif-' + inp.id);
      if (inp.value === '') { celda.textContent = '—'; return; }
      algunaConDato = true;
      const dif = (Number(inp.value) || 0) - esperado;
      totalDif += dif;
      celda.textContent = money(dif);
      celda.style.color = dif === 0 ? '' : dif > 0 ? '#2E5C42' : '#9B2C2C';
    });
    document.getElementById('c-diferencia').textContent = money(totalDif);
    document.getElementById('c-justificacion-wrap').style.display = algunaConDato && totalDif !== 0 ? 'block' : 'none';
  }

  async function accionAbrir(ev) {
    const fecha = document.getElementById('v-fecha').value || todayStr();
    const responsable = document.getElementById('a-responsable').value.trim();
    const fondoInicial = document.getElementById('a-fondo').value;
    if (!responsable) { toast('Escribe el nombre del responsable'); return; }
    if (fondoInicial === '' || isNaN(Number(fondoInicial))) { toast('Ingresa el fondo inicial de caja'); return; }
    ev.target.disabled = true;
    try {
      await abrirTurno({ fecha, responsable, fondoInicial: Number(fondoInicial) });
      sugerirEmpleado(responsable);
      toast('Turno abierto con ' + money(fondoInicial) + ' de fondo');
      document.getElementById('a-responsable').value = '';
      document.getElementById('a-fondo').value = '';
      await pintar();
    } catch (e) {
      console.error(e);
      toast('No se pudo abrir el turno');
    } finally {
      ev.target.disabled = false;
    }
  }

  async function accionCerrar(ev) {
    const fecha = document.getElementById('v-fecha').value || todayStr();
    const responsable = document.getElementById('c-responsable').value.trim();
    const folioTBK = document.getElementById('c-folio-tbk').value.trim();
    const justificacion = document.getElementById('c-justificacion').value.trim();
    if (!responsable) { toast('Escribe el nombre del responsable'); return; }

    const inputs = document.querySelectorAll('#c-metodos input[data-metodo]');
    const detalle = [];
    let diferenciaTotal = 0, efectivoCompletado = false;
    inputs.forEach((inp) => {
      const metodo = inp.dataset.metodo;
      const esperado = Number(inp.dataset.esperado) || 0;
      if (inp.value === '') { detalle.push({ metodo, esperado, contado: null, diferencia: 0 }); return; }
      if (metodo === 'Efectivo') efectivoCompletado = true;
      const contado = Number(inp.value) || 0;
      const diferencia = contado - esperado;
      diferenciaTotal += diferencia;
      detalle.push({ metodo, esperado, contado, diferencia });
    });
    if (!efectivoCompletado) { toast('Cuenta el efectivo físico antes de cerrar el turno'); return; }
    if (diferenciaTotal !== 0 && !justificacion) { toast('Hay una diferencia: agrega una justificación'); return; }

    ev.target.disabled = true;
    try {
      await registrarCierreTurno({ fecha, responsable, detalle, folioTBK, justificacion });
      sugerirEmpleado(responsable);
      toast(diferenciaTotal === 0 ? 'Turno cerrado, caja cuadrada ✓' : 'Turno cerrado con diferencia justificada');
      document.getElementById('c-responsable').value = '';
      document.getElementById('c-folio-tbk').value = '';
      document.getElementById('c-justificacion').value = '';
      await pintar();
    } catch (e) {
      console.error(e);
      toast('No se pudo guardar el cierre de turno');
    } finally {
      ev.target.disabled = false;
    }
  }
}

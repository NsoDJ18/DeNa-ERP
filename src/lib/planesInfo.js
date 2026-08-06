import { PLANES, ETIQUETAS_FUNCION, CONTACTO_SOPORTE, todasLasFunciones, tieneFuncion } from '../planes.js';
import { abrirModal, cerrarModal } from './modal.js';
import { money } from './util.js';

/** Abre el modal comparativo de planes, con el actual resaltado. */
export function abrirModalPlanes(planActual) {
  const funciones = todasLasFunciones();
  const ordenPlanes = ['bronce', 'plata', 'oro'];
  const linkWhatsapp = `https://wa.me/${CONTACTO_SOPORTE.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent('Hola, quiero información para cambiar mi plan de DENA ERP.')}`;

  abrirModal(`
    <h3 style="margin-top:0;color:var(--navy);">Planes de DENA ERP</h3>
    <p style="color:var(--ink-soft);font-size:13px;margin-bottom:16px;">
      Tu plan actual: <b style="color:var(--navy);">${PLANES[planActual]?.etiqueta || planActual}</b>
    </p>
    <div style="overflow-x:auto;">
      <table class="tabla" style="min-width:520px;">
        <thead>
          <tr>
            <th>Incluye</th>
            ${ordenPlanes.map((p) => `<th style="${p === planActual ? 'color:var(--gold);' : ''}">${PLANES[p].etiqueta}${p === planActual ? ' (actual)' : ''}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><b>Precio mensual</b></td>
            ${ordenPlanes.map((p) => `<td><b>${money(PLANES[p].precioMensual)}</b></td>`).join('')}
          </tr>
          <tr>
            <td>Usuarios</td>
            ${ordenPlanes.map((p) => `<td>${PLANES[p].limiteUsuarios === null ? 'Sin límite' : 'Hasta ' + PLANES[p].limiteUsuarios}</td>`).join('')}
          </tr>
          ${funciones.map((f) => `
          <tr>
            <td>${ETIQUETAS_FUNCION[f] || f}</td>
            ${ordenPlanes.map((p) => `<td style="text-align:center;">${tieneFuncion(p, f) ? '✓' : '—'}</td>`).join('')}
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
    <div style="margin-top:18px;padding:14px;background:var(--bg-soft);border-radius:10px;">
      <p style="margin:0 0 10px;font-size:13.5px;color:var(--ink-soft);">
        ¿Quieres subir o bajar de plan? El cambio lo aplica nuestro equipo de soporte — contáctanos y te ayudamos en minutos.
      </p>
      <a href="${linkWhatsapp}" target="_blank" rel="noopener" class="boton boton-oro" style="display:inline-block;width:auto;padding:10px 20px;text-decoration:none;">${CONTACTO_SOPORTE.texto}</a>
    </div>
    <div class="pie-formulario">
      <button class="boton boton-ghost" id="btn-cerrar-planes">Cerrar</button>
    </div>
  `);
  document.getElementById('btn-cerrar-planes').onclick = () => cerrarModal();
}

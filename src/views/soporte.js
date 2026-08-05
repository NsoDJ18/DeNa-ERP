import { guardarNombreApp } from '../data/configuracion.js';
import { cambiarPlanEmpresa } from '../data/soporte.js';
import { esSuperAdminTI } from '../auth/session.js';
import { toast, escapeHtml } from '../lib/util.js';

export async function renderSoporte(contenedor, activa) {
  if (!esSuperAdminTI()) {
    contenedor.innerHTML = `<div class="tarjeta" style="max-width:420px;margin:40px auto;text-align:center;">
      <h3 style="color:var(--navy);">Sin acceso</h3>
      <p style="color:var(--ink-soft);font-size:13px;">Esta sección es solo para la cuenta de soporte técnico.</p>
    </div>`;
    return;
  }

  contenedor.innerHTML = `
    <div class="encabezado-vista">
      <h2>🛠️ Soporte</h2>
      <p class="subtitulo">Solo visible para la cuenta de soporte técnico — cambios que no pasan por Supabase directo.</p>
    </div>

    <div class="tarjeta" style="max-width:480px;margin-bottom:22px;">
      <h3 style="margin-top:0;">Empresa activa</h3>
      <p class="subtitulo">${escapeHtml(activa.nombreEmpresa)} — plan actual: <b>${escapeHtml(activa.plan)}</b></p>
    </div>

    <div class="tarjeta" style="max-width:480px;margin-bottom:22px;">
      <h3 style="margin-top:0;">Nombre de la aplicación</h3>
      <p class="subtitulo" style="margin-bottom:12px;">Reemplaza "DENA ERP" por el nombre del negocio en su menú. Déjalo vacío para volver al nombre por defecto.</p>
      <div class="campo"><label>Nombre a mostrar</label><input type="text" id="sop-nombre-app" value="${escapeHtml(activa.nombreApp || '')}" placeholder="Ej: Regalos con Cariño ERP"></div>
      <button class="boton boton-ghost" id="btn-sop-nombre-app">Guardar</button>
    </div>

    <div class="tarjeta" style="max-width:480px;">
      <h3 style="margin-top:0;">Plan de la empresa</h3>
      <p class="subtitulo" style="margin-bottom:12px;">Cambia el plan sin entrar a Supabase — se aplica al instante, la próxima vez que el cliente recargue la página.</p>
      <div class="campo"><label>Plan</label>
        <select id="sop-plan">
          <option value="bronce" ${activa.plan === 'bronce' ? 'selected' : ''}>Bronce</option>
          <option value="plata" ${activa.plan === 'plata' ? 'selected' : ''}>Plata</option>
          <option value="oro" ${activa.plan === 'oro' ? 'selected' : ''}>Oro</option>
        </select>
      </div>
      <button class="boton boton-oro" id="btn-sop-plan">Cambiar plan</button>
    </div>
  `;

  document.getElementById('btn-sop-nombre-app').onclick = async (ev) => {
    const texto = document.getElementById('sop-nombre-app').value.trim();
    ev.target.disabled = true;
    try {
      await guardarNombreApp(texto);
      activa.nombreApp = texto || null;
      toast('Nombre de la aplicación actualizado');
    } catch (e) {
      console.error(e);
      toast('No se pudo guardar');
    } finally {
      ev.target.disabled = false;
    }
  };

  document.getElementById('btn-sop-plan').onclick = async (ev) => {
    const nuevoPlan = document.getElementById('sop-plan').value;
    if (!confirm(`¿Cambiar el plan de "${activa.nombreEmpresa}" a ${nuevoPlan}?`)) return;
    ev.target.disabled = true;
    try {
      await cambiarPlanEmpresa(nuevoPlan);
      activa.plan = nuevoPlan;
      toast('Plan actualizado — recarga la página para ver el menú ajustado');
    } catch (e) {
      console.error(e);
      toast('No se pudo cambiar el plan: ' + (e.message || ''));
    } finally {
      ev.target.disabled = false;
    }
  };
}

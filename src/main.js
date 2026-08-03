import {
  iniciarSesion,
  registrarUsuario,
  cerrarSesion,
  obtenerSesion,
  alCambiarSesion,
  resolverEmpresaActiva,
  fijarEmpresaActiva,
} from './auth/session.js';
import { registrarRuta, iniciarRouter } from './router.js';
import { renderRecepcion } from './views/recepcion.js';
import { renderTorre } from './views/torre.js';
import { renderEstado } from './views/estado.js';

registrarRuta('recepcion', renderRecepcion);
registrarRuta('torre', renderTorre);
registrarRuta('estado', renderEstado);

const NAV = [
  { ruta: 'recepcion', etiqueta: 'Recepción' },
  { ruta: 'estado', etiqueta: 'Estado' },
  { ruta: 'torre', etiqueta: 'Torre de control' },
  // el resto de las pantallas (Ventas, Punto de venta, Bodega, Administración)
  // se agregan acá a medida que se migran, siguiendo el mismo patrón.
];

const app = document.getElementById('app');

// ============================================================
// RENDER: pantalla de login / registro
// ============================================================
function renderLogin(modo = 'login') {
  const esRegistro = modo === 'registro';
  app.innerHTML = `
    <div class="tarjeta-login">
      <h1>DENA ERP</h1>
      <p class="subtitulo">${esRegistro ? 'Crea tu cuenta' : 'Inicia sesión para continuar'}</p>
      <div class="error" id="msg-error"></div>
      <form id="form-login">
        <div class="campo">
          <label>Correo</label>
          <input type="email" id="campo-email" required autocomplete="email" />
        </div>
        <div class="campo">
          <label>Contraseña</label>
          <input type="password" id="campo-clave" required minlength="6" autocomplete="${esRegistro ? 'new-password' : 'current-password'}" />
        </div>
        <button type="submit" class="boton boton-oro">${esRegistro ? 'Crear cuenta' : 'Entrar'}</button>
      </form>
      <div style="text-align:center;margin-top:16px;">
        <button class="boton-texto" id="btn-cambiar-modo">
          ${esRegistro ? '¿Ya tienes cuenta? Inicia sesión' : '¿Primera vez? Crea tu cuenta'}
        </button>
      </div>
    </div>
  `;

  document.getElementById('btn-cambiar-modo').onclick = () => renderLogin(esRegistro ? 'login' : 'registro');

  document.getElementById('form-login').onsubmit = async (ev) => {
    ev.preventDefault();
    const email = document.getElementById('campo-email').value.trim();
    const clave = document.getElementById('campo-clave').value;
    const errBox = document.getElementById('msg-error');
    errBox.classList.remove('visible');

    try {
      if (esRegistro) {
        await registrarUsuario(email, clave);
        errBox.textContent = 'Cuenta creada. Revisa tu correo para confirmar, luego inicia sesión.';
        errBox.classList.add('visible');
        renderLogin('login');
      } else {
        await iniciarSesion(email, clave);
        // el listener de sesión (abajo) se encarga de redibujar la pantalla
      }
    } catch (e) {
      errBox.textContent = traducirError(e.message);
      errBox.classList.add('visible');
    }
  };
}

function traducirError(msg) {
  if (msg.includes('Invalid login credentials')) return 'Correo o contraseña incorrectos.';
  if (msg.includes('User already registered')) return 'Ya existe una cuenta con ese correo.';
  return msg;
}

// ============================================================
// RENDER: selector de empresa (si el usuario pertenece a varias)
// ============================================================
function renderSelectorEmpresa(empresas) {
  app.innerHTML = `
    <div class="tarjeta-login">
      <h1>¿Con qué negocio trabajas?</h1>
      <p class="subtitulo">Tu cuenta está vinculada a más de una empresa.</p>
      ${empresas.map(e => `
        <button class="boton" style="margin-bottom:10px;" data-id="${e.id}">
          ${e.nombreEmpresa} <span style="opacity:.7;font-weight:400;">(${e.rol})</span>
        </button>
      `).join('')}
    </div>
  `;
  app.querySelectorAll('button[data-id]').forEach(btn => {
    btn.onclick = () => {
      fijarEmpresaActiva(btn.dataset.id);
      arrancar();
    };
  });
}

// ============================================================
// RENDER: sin empresa asignada todavía
// ============================================================
function renderSinEmpresa() {
  app.innerHTML = `
    <div class="tarjeta-login" style="text-align:center;">
      <h1>Cuenta creada, casi listo</h1>
      <p class="subtitulo">Tu usuario todavía no está vinculado a ningún negocio. Pide al administrador que te agregue, o contáctanos para crear tu empresa.</p>
      <button class="boton" id="btn-salir">Cerrar sesión</button>
    </div>
  `;
  document.getElementById('btn-salir').onclick = async () => { await cerrarSesion(); };
}

// ============================================================
// RENDER: armazón de la app conectada (nav + contenido según la ruta)
// ============================================================
function renderAppShell(sesion, activa) {
  app.className = ''; // ya no es pantalla centrada
  app.innerHTML = `
    <div class="app-shell">
      <div class="app-nav">
        <div class="marca">DENA ERP <span style="color:var(--ink-soft);font-weight:400;font-size:12px;">— ${activa.nombreEmpresa}</span></div>
        <div class="botones" id="nav-botones">
          ${NAV.map((n) => `<button class="nav-boton" data-ruta="${n.ruta}">${n.etiqueta}</button>`).join('')}
          <button class="nav-boton" id="btn-salir" style="border-color:#F0C9C9;color:#9B2C2C;">Cerrar sesión</button>
        </div>
      </div>
      <div class="app-contenido" id="contenido"></div>
    </div>
  `;
  document.getElementById('nav-botones').querySelectorAll('[data-ruta]').forEach((btn) => {
    btn.onclick = () => { location.hash = btn.dataset.ruta; };
  });
  document.getElementById('btn-salir').onclick = async () => { await cerrarSesion(); };

  iniciarRouter();
}

// ============================================================
// ARRANQUE
// ============================================================
async function arrancar() {
  const sesion = await obtenerSesion();
  if (!sesion) { app.className = 'pantalla-centrada'; renderLogin('login'); return; }

  const { empresas, activa } = await resolverEmpresaActiva();
  if (empresas.length === 0) { app.className = 'pantalla-centrada'; renderSinEmpresa(); return; }
  if (!activa) { app.className = 'pantalla-centrada'; renderSelectorEmpresa(empresas); return; }
  renderAppShell(sesion, activa);
}

alCambiarSesion(() => arrancar());
arrancar();

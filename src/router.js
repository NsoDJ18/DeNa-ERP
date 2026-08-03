const rutas = {};
let limpiarVistaAnterior = null;
let verificarAcceso = null; // (funcion) => boolean — seteado desde main.js según el plan activo

/** Registra una vista. El tercer parámetro (opcional) es la "funcion" de
 *  src/planes.js requerida para verla — si el plan activo no la incluye,
 *  el router muestra un aviso en vez de la pantalla, aunque se entre por URL. */
export function registrarRuta(nombre, render, funcion = null) {
  rutas[nombre] = { render, funcion };
}

export function configurarControlAcceso(fn) {
  verificarAcceso = fn;
}

function rutaActual() {
  return (location.hash || '#recepcion').replace('#', '');
}

export async function navegar(nombre) {
  location.hash = nombre;
}

export async function renderRutaActual() {
  const contenedor = document.getElementById('contenido');
  if (!contenedor) return;

  if (limpiarVistaAnterior) {
    try { limpiarVistaAnterior(); } catch (e) { console.error('Error al limpiar la vista anterior:', e); }
    limpiarVistaAnterior = null;
  }

  const nombre = rutaActual();
  document.querySelectorAll('.nav-boton').forEach((b) => {
    b.classList.toggle('activo', b.dataset.ruta === nombre);
  });

  const entrada = rutas[nombre] || rutas['recepcion'];

  if (entrada.funcion && verificarAcceso && !verificarAcceso(entrada.funcion)) {
    contenedor.innerHTML = `
      <div class="tarjeta" style="max-width:420px;margin:40px auto;text-align:center;">
        <h3 style="color:var(--navy);">Esta función no está en tu plan</h3>
        <p style="color:var(--ink-soft);font-size:13px;">Habla con tu administrador para subir de plan y desbloquear esta pantalla.</p>
      </div>`;
    return;
  }

  contenedor.innerHTML = '<p style="color:var(--ink-soft);padding:20px;">Cargando…</p>';
  try {
    const resultado = await entrada.render(contenedor);
    if (typeof resultado === 'function') limpiarVistaAnterior = resultado;
  } catch (e) {
    console.error(e);
    contenedor.innerHTML = `<p style="color:#9B2C2C;padding:20px;">Ocurrió un error al cargar esta pantalla. Revisa la consola (F12) para más detalle.</p>`;
  }
}

export function iniciarRouter() {
  window.addEventListener('hashchange', renderRutaActual);
  renderRutaActual();
}

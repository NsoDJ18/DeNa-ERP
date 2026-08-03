const rutas = {};

/** Registra una vista: registrarRuta('recepcion', async (contenedor) => {...}) */
export function registrarRuta(nombre, render) {
  rutas[nombre] = render;
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

  const nombre = rutaActual();
  document.querySelectorAll('.nav-boton').forEach((b) => {
    b.classList.toggle('activo', b.dataset.ruta === nombre);
  });

  const render = rutas[nombre] || rutas['recepcion'];
  contenedor.innerHTML = '<p style="color:var(--ink-soft);padding:20px;">Cargando…</p>';
  try {
    await render(contenedor);
  } catch (e) {
    console.error(e);
    contenedor.innerHTML = `<p style="color:#9B2C2C;padding:20px;">Ocurrió un error al cargar esta pantalla. Revisa la consola (F12) para más detalle.</p>`;
  }
}

export function iniciarRouter() {
  window.addEventListener('hashchange', renderRutaActual);
  renderRutaActual();
}

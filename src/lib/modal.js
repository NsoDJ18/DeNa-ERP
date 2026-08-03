let elementoModal = null;

function asegurarModal() {
  if (elementoModal) return elementoModal;
  const fondo = document.createElement('div');
  fondo.className = 'modal-fondo';
  fondo.innerHTML = '<div class="modal-caja" id="modal-caja"></div>';
  fondo.onclick = (ev) => { if (ev.target === fondo) cerrarModal(); };
  document.body.appendChild(fondo);
  elementoModal = fondo;
  return fondo;
}

export function abrirModal(html) {
  const fondo = asegurarModal();
  document.getElementById('modal-caja').innerHTML = `<button class="modal-cerrar" onclick="window.__cerrarModalDena()">✕</button>${html}`;
  fondo.classList.add('visible');
  window.__cerrarModalDena = cerrarModal;
}

export function cerrarModal() {
  if (elementoModal) elementoModal.classList.remove('visible');
}

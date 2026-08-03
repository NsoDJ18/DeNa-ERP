export function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

export function money(n) {
  n = Number(n) || 0;
  return '$' + n.toLocaleString('es-CL');
}

export function localDateStr(d) {
  const dt = d ? new Date(d) : new Date();
  if (isNaN(dt)) return '';
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayStr() {
  return localDateStr(new Date());
}

export function fdate(iso) {
  if (!iso) return '—';
  const d = new Date(iso.includes('T') ? iso : iso + 'T00:00:00');
  if (isNaN(d)) return iso;
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function fdatetime(iso) {
  if (!iso) return '—';
  if (!iso.includes('T')) return fdate(iso);
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  const fecha = d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
  const hora = d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
  return `${fecha} · ${hora}`;
}

/** Muestra un mensaje flotante breve en la esquina inferior de la pantalla. */
export function toast(msg) {
  let el = document.getElementById('dena-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'dena-toast';
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('visible');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('visible'), 2600);
}

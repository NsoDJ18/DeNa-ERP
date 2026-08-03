import { entregarConPago, cambiarEstadoOrden } from '../data/ordenes.js';
import { abrirModal, cerrarModal } from './modal.js';
import { money, escapeHtml, toast } from './util.js';

const METODOS = ['Efectivo', 'Débito', 'Transferencia', 'Crédito', 'Otro'];

/** Punto único de entrada para marcar una orden como entregada.
 *  Si no queda saldo, cierra directo. Si queda saldo, exige registrar el
 *  pago antes de cerrar — así el turno abierto en Ventas siempre cuadra. */
export async function confirmarEntrega(orden, alCompletar) {
  const saldo = (orden.precio || 0) - (orden.abono || 0);
  if (saldo <= 0) {
    await cambiarEstadoOrden(orden.id, 'entregado');
    toast('Orden cerrada como entregada');
    if (alCompletar) alCompletar();
    return;
  }

  abrirModal(`
    <h3 style="margin-top:0;color:var(--navy);">Cerrar ${orden.folio} como entregado</h3>
    <p style="color:var(--ink-soft);font-size:13.5px;">
      Este pedido tiene saldo pendiente. Registra el pago antes de cerrar,
      para que el turno de caja abierto en Ventas cuadre bien.
    </p>
    <div class="grid-2" style="margin:14px 0;">
      <div><span class="mini-label">Total</span><div>${money(orden.precio)}</div></div>
      <div><span class="mini-label">Abonado</span><div>${money(orden.abono)}</div></div>
      <div><span class="mini-label">Saldo pendiente</span><div style="font-weight:700;">${money(saldo)}</div></div>
    </div>
    <div class="campo"><label>Monto que paga el cliente ahora</label><input type="number" id="entrega-monto" min="0" value="${saldo}"></div>
    <div class="campo"><label>Método de pago</label>
      <select id="entrega-metodo">${METODOS.map((m) => `<option>${escapeHtml(m)}</option>`).join('')}</select>
    </div>
    <div class="pie-formulario">
      <button class="boton boton-ghost" id="btn-entrega-cancelar">Cancelar</button>
      <button class="boton boton-oro" id="btn-entrega-confirmar">Registrar pago y cerrar</button>
    </div>
  `);

  document.getElementById('btn-entrega-cancelar').onclick = () => cerrarModal();
  document.getElementById('btn-entrega-confirmar').onclick = async (ev) => {
    const monto = Number(document.getElementById('entrega-monto').value);
    const metodo = document.getElementById('entrega-metodo').value;
    if (isNaN(monto) || monto < 0) { toast('Ingresa un monto válido'); return; }
    ev.target.disabled = true;
    try {
      await entregarConPago(orden.id, monto, metodo);
      toast('Pago registrado, orden cerrada como entregada');
      cerrarModal();
      if (alCompletar) alCompletar();
    } catch (e) {
      console.error(e);
      toast('No se pudo registrar el pago');
    } finally {
      ev.target.disabled = false;
    }
  };
}

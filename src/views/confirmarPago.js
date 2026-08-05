import { confirmarPagoWebpay } from '../data/pagos.js';
import { money, escapeHtml } from '../lib/util.js';

export async function renderConfirmarPago(contenedor) {
  const params = new URLSearchParams(location.search);
  const token = params.get('token_ws');
  const cancelado = params.get('pago') === 'cancelado';
  const errorPrevio = params.get('pago') === 'error';

  // limpia la URL para que un F5 no vuelva a intentar confirmar el mismo pago
  history.replaceState(null, '', location.pathname + location.hash);

  if (cancelado) {
    contenedor.innerHTML = tarjeta('🟡 Pago cancelado', 'El cliente canceló el pago antes de terminar. El pedido sigue con el saldo pendiente igual que antes — puedes intentarlo de nuevo.');
    return;
  }
  if (errorPrevio || !token) {
    contenedor.innerHTML = tarjeta('🔴 No pudimos procesar el pago', 'No llegó un token válido desde el banco. Si el cliente sí pagó, revisa el pedido en Estado antes de cobrar de nuevo — puede que ya esté registrado.');
    return;
  }

  contenedor.innerHTML = `<p style="color:var(--claro-soft);padding:20px;">Confirmando el pago con el banco…</p>`;
  try {
    const resultado = await confirmarPagoWebpay(token);
    if (resultado.aprobado) {
      contenedor.innerHTML = tarjeta(
        '🟢 Pago aprobado',
        `Se registró el pago de <b>${money(resultado.detalle.amount)}</b> para el pedido <b>${escapeHtml(resultado.orden?.folio || '')}</b> (${escapeHtml(resultado.orden?.cliente || '')}). Ya quedó sumado a la cuadratura de caja del turno.`
      );
    } else {
      contenedor.innerHTML = tarjeta('🔴 Pago rechazado', 'El banco rechazó la transacción. El pedido sigue con el saldo pendiente — puedes intentar cobrar de nuevo.');
    }
  } catch (e) {
    console.error(e);
    contenedor.innerHTML = tarjeta('🔴 Error al confirmar', e.message || 'No se pudo confirmar el pago con el banco.');
  }
}

function tarjeta(titulo, texto) {
  return `<div class="tarjeta" style="max-width:460px;margin:40px auto;text-align:center;">
    <h3 style="color:var(--navy);margin-top:0;">${titulo}</h3>
    <p style="color:var(--ink-soft);font-size:14px;">${texto}</p>
    <a href="#estado" class="boton boton-oro" style="display:inline-block;width:auto;padding:10px 20px;text-decoration:none;">Ir a Estado</a>
  </div>`;
}

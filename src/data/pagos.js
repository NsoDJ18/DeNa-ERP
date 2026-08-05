import { supabase } from '../lib/supabase.js';

/** Crea la transacción y redirige el navegador a Transbank con un
 *  formulario POST — es la forma correcta que exige Transbank, nunca se
 *  pega el token en la URL como texto. Esto navega fuera de la app: no
 *  hay nada que retornar, la página cambia. */
export async function iniciarPagoWebpay(ordenId, monto) {
  const { data, error } = await supabase.functions.invoke('crear-transaccion-webpay', {
    body: { ordenId, monto },
  });
  if (error) {
    const detalle = await error.context?.json?.().catch(() => null);
    throw new Error(detalle?.error || error.message);
  }
  const { token, url } = data;

  const form = document.createElement('form');
  form.method = 'POST';
  form.action = url;
  const input = document.createElement('input');
  input.type = 'hidden';
  input.name = 'token_ws';
  input.value = token;
  form.appendChild(input);
  document.body.appendChild(form);
  form.submit();
}

/** Confirma el pago cuando el navegador vuelve de Transbank con el token en la URL. */
export async function confirmarPagoWebpay(token) {
  const { data, error } = await supabase.functions.invoke('confirmar-transaccion-webpay', {
    body: { token },
  });
  if (error) {
    const detalle = await error.context?.json?.().catch(() => null);
    throw new Error(detalle?.error || error.message);
  }
  return data;
}

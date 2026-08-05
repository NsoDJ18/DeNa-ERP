// supabase/functions/recibir-pago-webpay/index.ts
//
// Transbank vuelve del pago con un POST (formulario, no JSON) que trae
// "token_ws". Un sitio estático (Netlify) no puede leer el cuerpo de un
// POST — por eso esta función existe: recibe ese POST, saca el token, y
// hace una redirección normal (GET) hacia la aplicación, donde el token
// va como parámetro de la URL, que sí se puede leer con JavaScript.
//
// Variable de entorno necesaria:
//   FRONTEND_URL → la URL pública de tu sitio, ej. https://denaerp.netlify.app
//   (configúrala con: supabase secrets set FRONTEND_URL=https://tu-sitio.netlify.app)

Deno.serve(async (req) => {
  const frontendUrl = Deno.env.get('FRONTEND_URL') || 'https://denaerp.netlify.app';

  try {
    let token = '';
    if (req.method === 'POST') {
      const formData = await req.formData();
      token = String(formData.get('token_ws') || '');
    } else {
      const url = new URL(req.url);
      token = url.searchParams.get('token_ws') || '';
    }

    if (!token) {
      // el cliente puede haber cancelado el pago antes de terminar
      return Response.redirect(`${frontendUrl}/?pago=cancelado#confirmar-pago`, 303);
    }

    return Response.redirect(`${frontendUrl}/?token_ws=${encodeURIComponent(token)}#confirmar-pago`, 303);
  } catch (e) {
    console.error(e);
    return Response.redirect(`${frontendUrl}/?pago=error#confirmar-pago`, 303);
  }
});

-- Agrega la variante de nota de crédito verificada por correo/contraseña
-- real del administrador (reemplaza el PIN compartido para este flujo).
-- Pega en el SQL Editor de Supabase y ejecuta una vez.

create or replace function aplicar_nota_credito_verificada(
  p_orden_id uuid, p_nuevo_precio numeric, p_motivo text,
  p_autorizado_por text, p_metodo_devolucion text
)
returns jsonb as $$
declare
  v_precio_actual numeric;
  v_abono numeric;
  v_pagos jsonb;
  v_historial jsonb;
  v_timestamps jsonb;
  v_diferencia numeric;
  v_nuevo_abono numeric;
  v_ahora timestamptz := now();
begin
  select precio, abono, pagos, historial, timestamps
    into v_precio_actual, v_abono, v_pagos, v_historial, v_timestamps
    from ordenes where id = p_orden_id;

  if v_precio_actual is null then
    raise exception 'Pedido no encontrado.';
  end if;
  if p_nuevo_precio > v_precio_actual then
    raise exception 'Una nota de crédito solo puede bajar el precio.';
  end if;

  v_diferencia := greatest(0, coalesce(v_abono, 0) - p_nuevo_precio);
  v_nuevo_abono := coalesce(v_abono, 0) - v_diferencia;
  v_pagos := coalesce(v_pagos, '[]'::jsonb);
  if v_diferencia > 0 then
    v_pagos := v_pagos || jsonb_build_object(
      'monto', -v_diferencia, 'metodo', p_metodo_devolucion, 'fecha', v_ahora, 'motivo', 'Devolución por nota de crédito (verificada)'
    );
  end if;
  v_historial := coalesce(v_historial, '[]'::jsonb) || jsonb_build_object(
    'texto', format('[Nota de crédito verificada] Precio ajustado de $%s a $%s. Motivo: %s. Autorizado por: %s (contraseña de administrador verificada).',
                     v_precio_actual, p_nuevo_precio, p_motivo, p_autorizado_por),
    'fecha', v_ahora
  );

  perform set_config('app.pin_autorizado', 'true', true);
  update ordenes set
    precio = p_nuevo_precio, abono = v_nuevo_abono, pagos = v_pagos,
    historial = v_historial, estado = 'cancelado',
    timestamps = coalesce(v_timestamps, '{}'::jsonb) || jsonb_build_object('cancelado', v_ahora)
  where id = p_orden_id;

  return jsonb_build_object('ok', true, 'diferencia_devuelta', v_diferencia);
end;
$$ language plpgsql security definer;

revoke all on function aplicar_nota_credito_verificada from public, authenticated, anon;
grant execute on function aplicar_nota_credito_verificada to service_role;

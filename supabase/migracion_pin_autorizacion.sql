-- Agrega el sistema de PIN de autorización instantánea (para Punto de
-- venta) y actualiza el trigger de nota de crédito para respetarlo.
-- Pega en el SQL Editor de Supabase y ejecuta una vez.

create table if not exists seguridad_empresa (
  empresa_id        uuid primary key references empresas(id) on delete cascade,
  pin_autorizacion  text
);
alter table seguridad_empresa enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'seguridad_empresa' and policyname = 'admin_administra_pin') then
    create policy admin_administra_pin on seguridad_empresa for all
      using (es_admin_de(empresa_id)) with check (es_admin_de(empresa_id));
  end if;
end $$;

create or replace function aplicar_nota_credito_con_pin(
  p_orden_id uuid, p_nuevo_precio numeric, p_motivo text, p_pin text,
  p_autorizado_por text, p_metodo_devolucion text
)
returns jsonb as $$
declare
  v_empresa_id uuid;
  v_precio_actual numeric;
  v_abono numeric;
  v_pagos jsonb;
  v_historial jsonb;
  v_timestamps jsonb;
  v_diferencia numeric;
  v_nuevo_abono numeric;
  v_ahora timestamptz := now();
begin
  select empresa_id, precio, abono, pagos, historial, timestamps
    into v_empresa_id, v_precio_actual, v_abono, v_pagos, v_historial, v_timestamps
    from ordenes where id = p_orden_id;

  if v_empresa_id is null then
    raise exception 'Pedido no encontrado.';
  end if;
  if not exists (select 1 from seguridad_empresa where empresa_id = v_empresa_id and pin_autorizacion = p_pin) then
    raise exception 'PIN incorrecto.';
  end if;
  if p_nuevo_precio > v_precio_actual then
    raise exception 'Una nota de crédito solo puede bajar el precio.';
  end if;

  v_diferencia := greatest(0, coalesce(v_abono, 0) - p_nuevo_precio);
  v_nuevo_abono := coalesce(v_abono, 0) - v_diferencia;
  v_pagos := coalesce(v_pagos, '[]'::jsonb);
  if v_diferencia > 0 then
    v_pagos := v_pagos || jsonb_build_object(
      'monto', -v_diferencia, 'metodo', p_metodo_devolucion, 'fecha', v_ahora, 'motivo', 'Devolución por nota de crédito (PIN)'
    );
  end if;
  v_historial := coalesce(v_historial, '[]'::jsonb) || jsonb_build_object(
    'texto', format('[Nota de crédito con PIN] Precio ajustado de $%s a $%s. Motivo: %s. Autorizado por: %s.',
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

grant execute on function aplicar_nota_credito_con_pin to authenticated;

create or replace function bloquear_baja_precio_sin_autorizacion()
returns trigger as $$
begin
  if new.precio < old.precio
     and coalesce(current_setting('app.pin_autorizado', true), 'false') != 'true'
     and not exists (
       select 1 from usuarios_empresas
       where usuario_id = auth.uid() and empresa_id = new.empresa_id and rol in ('admin','encargado')
     )
  then
    raise exception 'Solo un encargado de turno o administrador puede aplicar una nota de crédito.';
  end if;
  return new;
end;
$$ language plpgsql security definer;

-- ============================================================
-- ESQUEMA MULTI-EMPRESA (SaaS) — Sistema de gestión para pymes
-- Diseñado para Supabase (PostgreSQL + Auth + Row Level Security)
-- ============================================================
-- Estrategia de aislamiento de datos:
-- Cada tabla de negocio tiene una columna empresa_id.
-- Row Level Security (RLS) garantiza que cada usuario SOLO puede
-- leer/escribir filas de las empresas a las que pertenece,
-- sin tener que filtrar manualmente en cada consulta del frontend.
-- ============================================================


-- ---------- 1. EMPRESAS (tenants) ----------
create table empresas (
  id            uuid primary key default gen_random_uuid(),
  nombre        text not null,
  rut           text,
  rubro         text,                          -- ej: "Imprenta digital", "Peluquería", etc.
  sucursal_texto text default '',
  nombre_app    text,                            -- si está seteado y el plan lo permite, reemplaza "DENA ERP" en el menú
  plan          text not null default 'bronce' check (plan in ('bronce','plata','oro')),
  creado_en     timestamptz default now()
);

-- ---------- 2. USUARIOS ↔ EMPRESAS (roles) ----------
-- auth.users la crea Supabase automáticamente al registrarse.
-- Esta tabla es la que define a qué empresa(s) pertenece cada usuario y con qué rol.
create table usuarios_empresas (
  usuario_id    uuid references auth.users(id) on delete cascade,
  empresa_id    uuid references empresas(id) on delete cascade,
  rol           text not null check (rol in ('admin','encargado','trabajador')),
  nombre_mostrar text,                         -- nombre visible (para "responsable" en OT, turnos, etc.)
  creado_en     timestamptz default now(),
  primary key (usuario_id, empresa_id)
);

-- Función helper: empresas a las que pertenece el usuario autenticado
create or replace function empresas_del_usuario()
returns setof uuid as $$
  select empresa_id from usuarios_empresas where usuario_id = auth.uid();
$$ language sql stable security definer;

-- Función helper: ¿el usuario autenticado es admin de esta empresa?
-- security definer para evitar que la política que la usa se referencie
-- a sí misma (RLS recursiva) al consultar usuarios_empresas.
create or replace function es_admin_de(p_empresa_id uuid)
returns boolean as $$
  select exists (
    select 1 from usuarios_empresas
    where usuario_id = auth.uid() and empresa_id = p_empresa_id and rol = 'admin'
  );
$$ language sql stable security definer;


-- ---------- 3. ÓRDENES DE TRABAJO (equivalente a "pedidos") ----------
create table ordenes (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid references empresas(id) on delete cascade not null,
  folio           text not null,
  folio_num       int not null,
  rut_cliente     text,
  cliente         text not null,
  telefono        text,
  tipo            text not null,
  cantidad        int default 1,
  descripcion     text,
  fecha_recepcion timestamptz default now(),
  fecha_entrega   date,
  responsable     text,
  precio          numeric(12,2) default 0,
  abono           numeric(12,2) default 0,
  estado          text not null default 'ingreso',   -- ingreso|diseno|fabricacion|calidad|listo|entregado|cancelado|no_retirado
  timestamps      jsonb default '{}',                 -- {estado: fecha_iso, ...}
  notas           jsonb default '[]',
  fotos           jsonb default '[]',
  pagos           jsonb default '[]',                 -- [{monto, metodo, fecha}]
  historial       jsonb default '[]',                 -- auditoría de cambios
  pago_pendiente_token text,                           -- token de Webpay mientras el cliente paga
  archivado       boolean default false,
  archivado_en    timestamptz,
  unique (empresa_id, folio)
);
create index idx_ordenes_empresa on ordenes(empresa_id);
create index idx_ordenes_estado on ordenes(empresa_id, estado);

-- Nota de crédito real: nadie sin autorización puede bajar el precio de un
-- pedido, aunque llame la API directo. Subir el precio (corregir un error
-- hacia arriba) sigue permitido para cualquiera, solo se protege la baja.
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

create trigger trg_bloquear_baja_precio
  before update on ordenes
  for each row execute function bloquear_baja_precio_sin_autorizacion();

-- ---------- 4. BODEGA (productos de mostrador) ----------
create table productos (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid references empresas(id) on delete cascade not null,
  sku           text,
  nombre        text not null,
  categoria     text,
  stock         int default 0,
  stock_minimo  int default 0,
  precio_costo  numeric(12,2) default 0,
  precio_venta  numeric(12,2) default 0,
  activo        boolean default true
);
create index idx_productos_empresa on productos(empresa_id);

-- Aunque el botón de editar precio esté oculto en el frontend para un
-- trabajador común, esto es lo que realmente lo impide: sin este trigger,
-- alguien podría cambiar el precio llamando la API directo, saltándose la
-- interfaz. El ajuste de stock (+1/-1) sigue permitido para cualquier rol.
create or replace function bloquear_cambio_precio_sin_autorizacion()
returns trigger as $$
begin
  if (new.precio_venta is distinct from old.precio_venta or new.precio_costo is distinct from old.precio_costo)
     and not exists (
       select 1 from usuarios_empresas
       where usuario_id = auth.uid() and empresa_id = new.empresa_id and rol in ('admin','encargado')
     )
  then
    raise exception 'Solo un encargado de turno o administrador puede cambiar el precio de un producto.';
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_bloquear_cambio_precio
  before update on productos
  for each row execute function bloquear_cambio_precio_sin_autorizacion();

-- ---------- 5. VENTAS DE MOSTRADOR (punto de venta) ----------
create table ventas (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid references empresas(id) on delete cascade not null,
  fecha           timestamptz default now(),
  items           jsonb not null,               -- [{productoId, nombre, cantidad, precioUnitario, subtotal}]
  total           numeric(12,2) not null,
  metodo_pago     text not null,
  responsable     text,
  cliente_nombre  text,
  cliente_telefono text
);
create index idx_ventas_empresa_fecha on ventas(empresa_id, fecha);

-- ---------- 6. CLIENTES FRECUENTES ----------
create table clientes (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid references empresas(id) on delete cascade not null,
  nombre          text not null,
  telefono        text,
  compras_totales int default 0,
  monto_total     numeric(12,2) default 0,
  ultima_compra   timestamptz
);
create index idx_clientes_empresa on clientes(empresa_id);

-- ---------- 7. TURNOS DE CAJA (apertura / cierre) ----------
create table turnos (
  id                uuid primary key default gen_random_uuid(),
  empresa_id        uuid references empresas(id) on delete cascade not null,
  fecha             date not null,
  hora              timestamptz default now(),
  responsable       text,
  tipo              text not null check (tipo in ('apertura','cierre')),
  fondo_inicial     numeric(12,2),               -- solo aperturas
  detalle           jsonb,                       -- solo cierres: [{metodo, esperado, contado, diferencia}]
  folio_tbk         text,
  justificacion     text,
  diferencia_total  numeric(12,2),
  ajuste_admin      boolean default false
);
create index idx_turnos_empresa_fecha on turnos(empresa_id, fecha);

-- ---------- 8. CIERRES DIARIOS (cuadratura contable) ----------
create table cierres_diarios (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid references empresas(id) on delete cascade not null,
  fecha         date not null,
  total_pedidos int, entregados int, cancelados int,
  ingresos      numeric(12,2), abonos numeric(12,2), saldo numeric(12,2),
  justificacion text,
  cerrado_en    timestamptz default now(),
  unique (empresa_id, fecha)
);

-- ---------- 9. CONFIGURACIÓN POR EMPRESA ----------
create table configuracion (
  empresa_id    uuid primary key references empresas(id) on delete cascade,
  tiempos_max   jsonb default '{"ingreso":60,"diseno":180,"fabricacion":240,"calidad":60,"listo":4320}'
);

-- ---------- 10. TRABAJADORES (sugerencia de nombre, no necesariamente usuarios con login) ----------
create table empleados (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid references empresas(id) on delete cascade not null,
  nombre        text not null
);
create index idx_empleados_empresa on empleados(empresa_id);

-- ---------- 11. SOLICITUDES DE NOTA DE CRÉDITO (trabajador pide, encargado/admin autoriza) ----------
create table solicitudes_nc (
  id                uuid primary key default gen_random_uuid(),
  empresa_id        uuid references empresas(id) on delete cascade not null,
  orden_id          uuid references ordenes(id) on delete cascade not null,
  precio_actual     numeric(12,2) not null,
  precio_solicitado numeric(12,2) not null,
  motivo            text not null,
  solicitado_por    text,
  estado            text not null default 'pendiente' check (estado in ('pendiente','aprobada','rechazada')),
  fecha_solicitud   timestamptz default now(),
  revisado_por      text,
  fecha_revision    timestamptz,
  motivo_rechazo    text
);
create index idx_solicitudes_nc_empresa on solicitudes_nc(empresa_id, estado);

-- ---------- 13. SUPER ADMIN TI (soporte/pruebas — bypass de plan, no de RLS) ----------
-- Guardado como dato, no en el código: si el correo de soporte cambia, se
-- edita esta tabla directo en Supabase (Table Editor), sin tocar ni
-- desplegar nada. Esto NO salta la seguridad de datos (RLS sigue
-- exigiendo pertenecer a la empresa) — solo hace que, en las empresas
-- donde esta persona SÍ está vinculada, vea todas las pantallas sin
-- importar el plan contratado. Sirve para pruebas y soporte técnico.
create table ti_super_admins (
  email      text primary key,
  nota       text,
  creado_en  timestamptz default now()
);
alter table ti_super_admins enable row level security;
-- sin política de SELECT: nadie puede leer la lista completa por la API,
-- cada quien solo puede preguntar "¿SOY yo?" a través de la función de abajo.

create or replace function soy_super_admin_ti()
returns boolean as $$
  select exists (select 1 from ti_super_admins where email = auth.email());
$$ language sql stable security definer;

grant execute on function soy_super_admin_ti to authenticated;

insert into ti_super_admins (email, nota) values
  ('c.medinagodoy@gmail.com', 'Responsable de pruebas de funcionamiento, administración y soporte TI');

-- ---------- 12. PIN DE AUTORIZACIÓN (para validar en el momento, sin cola de espera) ----------
-- Tabla separada a propósito: nadie puede LEER el pin directo por la API
-- (ni con RLS "for all", porque no hay ninguna política de SELECT acá) —
-- solo se puede escribir (admin) o VALIDAR a través de la función de abajo,
-- que nunca revela el valor guardado, solo dice si coincide o no.
create table seguridad_empresa (
  empresa_id        uuid primary key references empresas(id) on delete cascade,
  pin_autorizacion  text
);
alter table seguridad_empresa enable row level security;
create policy admin_administra_pin on seguridad_empresa for all
  using (es_admin_de(empresa_id)) with check (es_admin_de(empresa_id));

-- Aplica una nota de crédito validando el PIN en el mismo paso, sin
-- necesitar que quien esté logueado sea encargado/admin — el PIN reemplaza
-- esa validación por esta vez, exactamente para el mostrador donde no hay
-- tiempo de esperar una cola de aprobación.
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

  -- autoriza este UPDATE puntual, saltándose el candado de rol para esta transacción
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

-- Variante para verificación por correo/contraseña real del administrador
-- (no PIN compartido). Solo puede llamarla el servidor (service_role) — un
-- usuario normal desde el navegador NO puede invocarla directo, así el
-- candado real está en que solo la Edge Function "autorizar-nc-admin"
-- tiene la llave para usarla, después de confirmar la contraseña del admin.
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


-- ============================================================
-- ROW LEVEL SECURITY — aislamiento automático por empresa
-- ============================================================
alter table empresas enable row level security;
alter table usuarios_empresas enable row level security;
alter table ordenes enable row level security;
alter table productos enable row level security;
alter table ventas enable row level security;
alter table clientes enable row level security;
alter table turnos enable row level security;
alter table cierres_diarios enable row level security;
alter table configuracion enable row level security;
alter table empleados enable row level security;
alter table solicitudes_nc enable row level security;

-- Política estándar reutilizable: solo empresas del usuario autenticado
create policy tenant_isolation on ordenes for all
  using (empresa_id in (select empresas_del_usuario()));
create policy tenant_isolation on productos for all
  using (empresa_id in (select empresas_del_usuario()));
create policy tenant_isolation on ventas for all
  using (empresa_id in (select empresas_del_usuario()));
create policy tenant_isolation on clientes for all
  using (empresa_id in (select empresas_del_usuario()));
create policy tenant_isolation on turnos for all
  using (empresa_id in (select empresas_del_usuario()));
create policy tenant_isolation on cierres_diarios for all
  using (empresa_id in (select empresas_del_usuario()));
create policy tenant_isolation on configuracion for all
  using (empresa_id in (select empresas_del_usuario()));
create policy tenant_isolation on empleados for all
  using (empresa_id in (select empresas_del_usuario()));
create policy tenant_isolation on solicitudes_nc for all
  using (empresa_id in (select empresas_del_usuario()));

-- usuarios_empresas: cada usuario solo ve sus propias membresías
create policy propia_membresia on usuarios_empresas for select
  using (usuario_id = auth.uid());

-- un admin puede ver y editar el rol de todo su equipo (para asignar jerarquías)
create policy admin_ve_su_equipo on usuarios_empresas for select
  using (es_admin_de(empresa_id));
create policy admin_edita_roles on usuarios_empresas for update
  using (es_admin_de(empresa_id));

-- Candado real: en plan Bronce, ni siquiera el admin de esa empresa puede
-- cambiar jerarquías desde acá (según el diseño de planes) — solo lo hace
-- soporte TI. No es solo que el selector esté oculto en la interfaz: si
-- alguien intentara el cambio directo por la API, esto lo rechaza igual.
create or replace function bloquear_cambio_rol_sin_plan()
returns trigger as $$
declare
  v_plan text;
begin
  if new.rol is distinct from old.rol
     and coalesce((select email from auth.users where id = auth.uid()), '') not in (select email from ti_super_admins)
  then
    select plan into v_plan from empresas where id = new.empresa_id;
    if v_plan = 'bronce' then
      raise exception 'Tu plan no permite cambiar jerarquías del equipo — contacta a soporte.';
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_bloquear_cambio_rol
  before update on usuarios_empresas
  for each row execute function bloquear_cambio_rol_sin_plan();

-- empresas: un usuario puede ver (y un admin editar) solo las empresas
-- a las que pertenece — sin esto, RLS bloquea todo por defecto y el
-- nombre de la empresa llega "undefined" al frontend.
create policy ver_empresas_propias on empresas for select
  using (id in (select empresas_del_usuario()));
create policy admin_edita_su_empresa on empresas for update
  using (id in (
    select empresa_id from usuarios_empresas
    where usuario_id = auth.uid() and rol = 'admin'
  ));

-- Ejemplo de política diferenciada por rol (solo admin puede borrar productos):
-- create policy solo_admin_borra on productos for delete
--   using (empresa_id in (
--     select empresa_id from usuarios_empresas
--     where usuario_id = auth.uid() and rol = 'admin'
--   ));

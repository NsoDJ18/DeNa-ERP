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
  plan          text default 'gratis',         -- 'gratis' | 'pro' | 'enterprise' (para cuando monetices)
  creado_en     timestamptz default now()
);

-- ---------- 2. USUARIOS ↔ EMPRESAS (roles) ----------
-- auth.users la crea Supabase automáticamente al registrarse.
-- Esta tabla es la que define a qué empresa(s) pertenece cada usuario y con qué rol.
create table usuarios_empresas (
  usuario_id    uuid references auth.users(id) on delete cascade,
  empresa_id    uuid references empresas(id) on delete cascade,
  rol           text not null check (rol in ('admin','trabajador')),
  nombre_mostrar text,                         -- nombre visible (para "responsable" en OT, turnos, etc.)
  creado_en     timestamptz default now(),
  primary key (usuario_id, empresa_id)
);

-- Función helper: empresas a las que pertenece el usuario autenticado
create or replace function empresas_del_usuario()
returns setof uuid as $$
  select empresa_id from usuarios_empresas where usuario_id = auth.uid();
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

-- usuarios_empresas: cada usuario solo ve sus propias membresías
create policy propia_membresia on usuarios_empresas for select
  using (usuario_id = auth.uid());

-- Ejemplo de política diferenciada por rol (solo admin puede borrar productos):
-- create policy solo_admin_borra on productos for delete
--   using (empresa_id in (
--     select empresa_id from usuarios_empresas
--     where usuario_id = auth.uid() and rol = 'admin'
--   ));

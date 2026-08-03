-- Solo necesario si ya corriste supabase/schema.sql ANTES de esta versión.
-- Pégalo en el SQL Editor de Supabase y ejecútalo una vez.

create table if not exists empleados (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid references empresas(id) on delete cascade not null,
  nombre        text not null
);
create index if not exists idx_empleados_empresa on empleados(empresa_id);

alter table empleados enable row level security;

create policy tenant_isolation on empleados for all
  using (empresa_id in (select empresas_del_usuario()));

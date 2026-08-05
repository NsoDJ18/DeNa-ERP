-- Agrega la tabla de solicitudes de nota de crédito (para que un trabajador
-- pueda pedirla y un encargado/admin la autorice). Pega en el SQL Editor
-- de Supabase y ejecuta una vez.

create table if not exists solicitudes_nc (
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
create index if not exists idx_solicitudes_nc_empresa on solicitudes_nc(empresa_id, estado);

alter table solicitudes_nc enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'solicitudes_nc' and policyname = 'tenant_isolation') then
    create policy tenant_isolation on solicitudes_nc for all
      using (empresa_id in (select empresas_del_usuario()));
  end if;
end $$;


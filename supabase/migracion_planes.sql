-- Solo necesario si ya corriste supabase/schema.sql ANTES de esta versión
-- (cuando "plan" todavía usaba 'gratis'/'pro'/'enterprise').
-- Pega esto en el SQL Editor de Supabase y ejecútalo — es seguro correrlo
-- más de una vez, no falla si ya estaba aplicado.

-- pasa cualquier valor viejo o vacío a "bronce" (el plan de entrada)
update empresas set plan = 'bronce' where plan not in ('bronce','plata','oro') or plan is null;

alter table empresas alter column plan set default 'bronce';
alter table empresas alter column plan set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'empresas_plan_check'
  ) then
    alter table empresas add constraint empresas_plan_check check (plan in ('bronce','plata','oro'));
  end if;
end $$;


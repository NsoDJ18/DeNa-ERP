-- Solo necesario si ya corriste supabase/schema.sql ANTES de esta versión
-- (cuando "plan" todavía usaba 'gratis'/'pro'/'enterprise').
-- Pega esto en el SQL Editor de Supabase y ejecútalo una vez.

-- pasa cualquier valor viejo a "bronce" (el plan de entrada) para no dejar filas inválidas
update empresas set plan = 'bronce' where plan not in ('bronce','plata','oro') or plan is null;

alter table empresas alter column plan set default 'bronce';
alter table empresas alter column plan set not null;
alter table empresas add constraint empresas_plan_check check (plan in ('bronce','plata','oro'));

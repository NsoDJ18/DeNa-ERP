-- Agrega el candado real: nadie salvo soporte TI puede cambiar el plan de
-- una empresa, ni siquiera el admin de esa empresa. Requiere que ya exista
-- la tabla ti_super_admins (corre migracion_ti_super_admin.sql primero si
-- no lo has hecho). Pega en el SQL Editor y ejecuta una vez.

create or replace function bloquear_cambio_plan_sin_ti()
returns trigger as $$
begin
  if new.plan is distinct from old.plan
     and coalesce((select email from auth.users where id = auth.uid()), '') not in (select email from ti_super_admins)
  then
    raise exception 'Solo soporte técnico puede cambiar el plan de una empresa.';
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_bloquear_cambio_plan on empresas;
create trigger trg_bloquear_cambio_plan
  before update on empresas
  for each row execute function bloquear_cambio_plan_sin_ti();

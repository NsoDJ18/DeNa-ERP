-- Agrega el candado real: en plan Bronce, ni el propio admin puede cambiar
-- jerarquías del equipo desde la API — solo soporte TI. Corre esto
-- DESPUÉS de migracion_ti_super_admin.sql (necesita que exista la tabla
-- ti_super_admins). Pega en el SQL Editor y ejecuta una vez.

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

drop trigger if exists trg_bloquear_cambio_rol on usuarios_empresas;
create trigger trg_bloquear_cambio_rol
  before update on usuarios_empresas
  for each row execute function bloquear_cambio_rol_sin_plan();

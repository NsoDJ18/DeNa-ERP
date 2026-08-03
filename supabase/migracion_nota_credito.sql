-- Agrega el candado real para notas de crédito: nadie sin rol de encargado
-- o admin puede bajar el precio de un pedido ya creado. Pega en el SQL
-- Editor de Supabase y ejecuta una vez.

create or replace function bloquear_baja_precio_sin_autorizacion()
returns trigger as $$
begin
  if new.precio < old.precio and not exists (
    select 1 from usuarios_empresas
    where usuario_id = auth.uid() and empresa_id = new.empresa_id and rol in ('admin','encargado')
  )
  then
    raise exception 'Solo un encargado de turno o administrador puede aplicar una nota de crédito.';
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_bloquear_baja_precio on ordenes;
create trigger trg_bloquear_baja_precio
  before update on ordenes
  for each row execute function bloquear_baja_precio_sin_autorizacion();

-- Agrega el candado real (a nivel de base de datos, no solo de interfaz)
-- que impide cambiar el precio de un producto sin ser encargado o admin.
-- Pega en el SQL Editor de Supabase y ejecuta una vez.

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

drop trigger if exists trg_bloquear_cambio_precio on productos;
create trigger trg_bloquear_cambio_precio
  before update on productos
  for each row execute function bloquear_cambio_precio_sin_autorizacion();

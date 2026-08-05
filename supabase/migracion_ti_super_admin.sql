-- Agrega el sistema de "super admin TI" — una cuenta con acceso a todas
-- las pantallas de cualquier plan, guardada como dato editable en
-- Supabase, no en el código. Pega en el SQL Editor y ejecuta una vez.

create table if not exists ti_super_admins (
  email      text primary key,
  nota       text,
  creado_en  timestamptz default now()
);
alter table ti_super_admins enable row level security;

create or replace function soy_super_admin_ti()
returns boolean as $$
  select exists (select 1 from ti_super_admins where email = auth.email());
$$ language sql stable security definer;

grant execute on function soy_super_admin_ti to authenticated;

insert into ti_super_admins (email, nota) values
  ('c.medinagodoy@gmail.com', 'Responsable de pruebas de funcionamiento, administración y soporte TI')
on conflict (email) do nothing;

-- Para cambiar el correo más adelante, no vuelvas a correr este archivo —
-- solo edita la tabla directo en Table Editor → ti_super_admins:
-- borra la fila vieja y agrega una nueva con el correo nuevo.

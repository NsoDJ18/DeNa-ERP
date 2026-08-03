-- Agrega el rol intermedio "encargado" (encargado de turno) y permite que
-- un admin vea/edite el rol de todo su equipo. Pega en el SQL Editor de
-- Supabase y ejecuta una vez.

alter table usuarios_empresas drop constraint if exists usuarios_empresas_rol_check;
alter table usuarios_empresas add constraint usuarios_empresas_rol_check
  check (rol in ('admin','encargado','trabajador'));

create or replace function es_admin_de(p_empresa_id uuid)
returns boolean as $$
  select exists (
    select 1 from usuarios_empresas
    where usuario_id = auth.uid() and empresa_id = p_empresa_id and rol = 'admin'
  );
$$ language sql stable security definer;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'usuarios_empresas' and policyname = 'admin_ve_su_equipo') then
    create policy admin_ve_su_equipo on usuarios_empresas for select using (es_admin_de(empresa_id));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'usuarios_empresas' and policyname = 'admin_edita_roles') then
    create policy admin_edita_roles on usuarios_empresas for update using (es_admin_de(empresa_id));
  end if;
end $$;

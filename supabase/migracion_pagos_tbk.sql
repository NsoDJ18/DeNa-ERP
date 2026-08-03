-- Solo necesario si ya corriste supabase/schema.sql ANTES de agregar
-- la integración de pagos con Transbank. Pégalo en el SQL Editor de
-- Supabase y ejecútalo una vez.

alter table ordenes add column if not exists pago_pendiente_token text;

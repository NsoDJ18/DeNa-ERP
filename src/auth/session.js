import { supabase } from '../lib/supabase.js';

// ============================================================
// AUTENTICACIÓN
// ============================================================

/** Crea una cuenta de usuario nueva (aún no pertenece a ninguna empresa). */
export async function registrarUsuario(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

/** Inicia sesión con correo y clave. */
export async function iniciarSesion(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

/** Cierra la sesión actual. */
export async function cerrarSesion() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/** Devuelve la sesión activa (o null si no hay usuario logueado). */
export async function obtenerSesion() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

/** Se ejecuta cada vez que cambia el estado de autenticación (login/logout/refresh). */
export function alCambiarSesion(callback) {
  const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
  return () => listener.subscription.unsubscribe();
}

// ============================================================
// EMPRESA ACTIVA (multi-tenant)
// ============================================================
// Un usuario puede pertenecer a más de una empresa (ej. un contador que
// administra varios talleres). Guardamos cuál empresa está usando ahora
// mismo en localStorage, solo como preferencia de UI — la seguridad real
// la da Row Level Security en la base de datos, no esta variable.

const CLAVE_EMPRESA_ACTIVA = 'dena_empresa_activa';

/** Lista las empresas (con su rol) a las que pertenece el usuario logueado. */
export async function obtenerEmpresasDelUsuario() {
  const { data, error } = await supabase
    .from('usuarios_empresas')
    .select('empresa_id, rol, nombre_mostrar, empresas ( id, nombre, sucursal_texto, rubro, plan )');
  if (error) throw error;
  return data.map((fila) => ({
    id: fila.empresa_id,
    rol: fila.rol,
    nombreMostrar: fila.nombre_mostrar,
    nombreEmpresa: fila.empresas?.nombre,
    sucursal: fila.empresas?.sucursal_texto,
    rubro: fila.empresas?.rubro,
    plan: fila.empresas?.plan || 'bronce',
  }));
}

export function empresaActivaId() {
  return localStorage.getItem(CLAVE_EMPRESA_ACTIVA);
}

export function fijarEmpresaActiva(empresaId) {
  localStorage.setItem(CLAVE_EMPRESA_ACTIVA, empresaId);
}

export function limpiarEmpresaActiva() {
  localStorage.removeItem(CLAVE_EMPRESA_ACTIVA);
}

/**
 * Resuelve qué empresa debe quedar activa al iniciar sesión:
 * - Si el usuario pertenece a una sola empresa, se selecciona automáticamente.
 * - Si pertenece a varias, se debe mostrar un selector (ver migración: pantalla "Elegir negocio").
 * - Si no pertenece a ninguna, probablemente es una cuenta recién creada
 *   que todavía no fue vinculada a un negocio (flujo de "crear mi empresa" pendiente).
 */
export async function resolverEmpresaActiva() {
  const empresas = await obtenerEmpresasDelUsuario();
  if (empresas.length === 0) return { empresas, activa: null };
  const guardada = empresaActivaId();
  const activa = empresas.find((e) => e.id === guardada) || empresas[0];
  fijarEmpresaActiva(activa.id);
  _rolActivo = activa.rol;
  return { empresas, activa };
}

// ============================================================
// ROL ACTIVO (caché en memoria, se fija cada vez que se resuelve la empresa)
// ============================================================
// Evita tener que pasar "activa.rol" a mano por cada función — cualquier
// módulo puede preguntar "¿puedo hacer esto?" sin necesitar el objeto
// completo. Solo es una ayuda de UI: la seguridad real siempre vive en las
// políticas RLS / triggers de la base de datos, no acá.
let _rolActivo = null;

export function rolActivo() {
  return _rolActivo;
}

export function puedeAutorizar() {
  return _rolActivo === 'admin' || _rolActivo === 'encargado';
}

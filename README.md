# DENA ERP — arquitectura base

Esqueleto real del proyecto: Vite + Supabase (base de datos, autenticación,
seguridad multi-empresa) + PWA (instalable en celular y PC). Esta es la
**fase de arquitectura** — las pantallas de Recepción, Torre de Control,
Ventas, Bodega, etc. se agregan en la fase de migración, reutilizando la
lógica ya probada en el prototipo HTML.

## 1. Crear el proyecto en Supabase (una vez)

1. Entra a [supabase.com](https://supabase.com) → crea una cuenta gratis → "New project".
2. Cuando el proyecto esté listo, ve a **SQL Editor** → pega el contenido completo
   de `supabase/schema.sql` (está en esta carpeta) → **Run**.
   Esto crea todas las tablas, la seguridad por empresa (Row Level Security)
   y las funciones necesarias.
3. Ve a **Project Settings → API** y copia dos datos:
   - **Project URL**
   - **anon public key**

## 2. Configurar el proyecto local

```bash
cp .env.example .env
```

Abre `.env` y pega ahí la URL y la clave que copiaste en el paso anterior.

```bash
npm install
npm run dev
```

Abre `http://localhost:5173` — deberías ver la pantalla de login.

## 3. Crear tu primera empresa y usuario admin

Por ahora esto se hace directo en Supabase (en la fase de migración se agrega
una pantalla para hacerlo desde la app):

1. En la app, haz clic en "¿Primera vez? Crea tu cuenta" y regístrate con tu correo.
2. Confirma el correo (Supabase envía un mail de verificación).
3. En Supabase → **Table Editor → empresas** → agrega una fila con el nombre
   de tu negocio (ej. "Regalos con Cariño").
4. En **Table Editor → usuarios_empresas** → agrega una fila conectando tu
   usuario (busca tu `id` en **Authentication → Users**) con el `id` de la
   empresa que acabas de crear, y `rol = admin`.
5. Vuelve a la app e inicia sesión — deberías ver el panel conectado con el
   nombre de tu empresa.

## 4. Desplegar en línea (Netlify)

```bash
npm run build
```

Esto genera la carpeta `dist/` lista para publicar.

1. Sube este proyecto a un repositorio de GitHub.
2. En [netlify.com](https://netlify.com) → "Add new site" → "Import from Git" → elige el repo.
3. Configuración de build:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
4. En **Site settings → Environment variables**, agrega `VITE_SUPABASE_URL`
   y `VITE_SUPABASE_ANON_KEY` con los mismos valores de tu `.env`.
5. Deploy. Netlify te da una URL tipo `tu-proyecto.netlify.app` con HTTPS automático.

## 5. Que un cliente lo abra en su celular

Una vez desplegado, cualquiera que entre a la URL desde Chrome (Android) o
Safari (iPhone) puede tocar "Agregar a pantalla de inicio" — queda instalado
como una app normal, sin pasar por ninguna tienda de aplicaciones.

## Estructura del proyecto

```
dena-erp-web/
├── supabase/schema.sql       ← base de datos completa (correr una sola vez en Supabase)
├── src/
│   ├── lib/supabase.js       ← conexión única a la base de datos
│   ├── auth/session.js       ← login, registro, sesión, empresa activa
│   ├── data/ordenes.js       ← ejemplo de acceso a datos (patrón para migrar el resto)
│   ├── styles/main.css       ← paleta de marca (navy + dorado)
│   └── main.js                ← arranca la app: login → selector de empresa → panel
├── vite.config.js            ← configuración de build + PWA instalable
└── .env.example               ← plantilla de credenciales (no subir el .env real a git)
```

## Próximo paso: migración

Con esta base funcionando, la fase de migración consiste en portar cada
pantalla del prototipo HTML (Recepción, Estado, Torre de Control, Ventas,
Punto de Venta, Bodega, Monitor, Administración) a este proyecto, agregando
un archivo en `src/data/` por módulo (siguiendo el patrón de `ordenes.js`)
y su vista correspondiente.

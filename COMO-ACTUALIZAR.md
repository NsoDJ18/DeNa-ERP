# Cómo actualizar tu sitio en línea con lo que te envío

## 🔑 Regla de oro (para no gastar créditos de Netlify de más)

Cada `git push` cuesta 15 créditos en Netlify, sin importar el tamaño del
cambio. Con el plan gratis (300 créditos/mes) eso se gasta rápido si subes
cada micro-ajuste por separado.

**A partir de ahora: prueba SIEMPRE local primero con `npm run dev`, y solo
haz `git push` cuando ya confirmaste que el cambio funciona.** Si te mando
varios archivos en una misma ronda de conversación, cópialos todos y prueba
todo junto — un solo push al final, no uno por archivo.

---

Cada vez que te mando un `dena-erp-web.zip` nuevo, estos son los pasos para
que esos cambios lleguen a `denaerp.netlify.app`. Es siempre el mismo
procedimiento, así que puedes seguirlo solo, o pasarle la sección de abajo
a otra IA para que te guíe en vivo.

## Procedimiento (siempre igual)

### 1. Descarga y reemplaza los archivos

1. Descarga el `.zip` que te compartí y descomprímelo.
2. **Antes de copiar nada**, guarda tu archivo `.env` actual aparte (tiene
   tus claves de Supabase) — el zip trae un `.env.example`, no tu `.env` real,
   así que no lo vas a perder, pero conviene ser cuidadoso.
3. Copia todo el contenido de la carpeta descomprimida `dena-erp-web/`
   **encima** de tu carpeta de proyecto local, reemplazando los archivos
   existentes.
4. Confirma que tu `.env` (con tus claves reales) siga ahí después de copiar.

### 2. Si hay un archivo `.sql` nuevo (migración)

Si en la entrega venía algún archivo como `migracion_algo.sql` o
`fix_algo.sql`: ábrelo, copia el contenido, pégalo en **Supabase → SQL
Editor → New query**, y dale **Run**. Esto actualiza la base de datos para
que coincida con el código nuevo. Sin este paso, el código nuevo puede
fallar contra una base de datos desactualizada.

### 3. Prueba local (opcional pero recomendado)

```bash
npm install
npm run dev
```

Abre `http://localhost:5173`, prueba lo que cambió. Si todo bien, sigue.

### 4. Sube los cambios (esto dispara el deploy automático en Netlify)

```bash
git add .
git commit -m "Actualización: describe brevemente qué cambió"
git push
```

Netlify detecta el `push` a GitHub solo y vuelve a desplegar automáticamente
(1-2 minutos). Puedes ver el progreso en netlify.com → tu sitio → pestaña
**Deploys**.

### 5. Confirma en línea

Abre `https://denaerp.netlify.app` (forzando recarga sin caché: Ctrl+Shift+R
o Cmd+Shift+R) y prueba que el cambio esté ahí.

---

## Bloque para pegarle a otra IA

Si quieres que otro asistente (ChatGPT, Gemini, Copilot, etc.) te acompañe
en vivo mientras haces esto, copia y pega TODO el siguiente bloque como tu
primer mensaje — le da todo el contexto que necesita para ayudarte sin
tener que explicarle desde cero:

```
Estoy desarrollando "DENA ERP", un sistema de gestión web para pymes
(imprentas/talleres). El stack es:

- Frontend: Vite + JavaScript vanilla (sin framework), en una carpeta
  llamada dena-erp-web/
- Backend: Supabase (PostgreSQL + autenticación + Row Level Security)
- Hosting: Netlify, conectado a un repositorio de GitHub — cada
  "git push" a la rama principal dispara un redeploy automático
- La app está en https://denaerp.netlify.app

Necesito ayuda para: [describe aquí exactamente en qué paso estás atascado,
por ejemplo: "git me da un error al hacer push", "no sé cómo abrir una
terminal en esta carpeta", "npm install se queda pegado", etc.]

Mi sistema operativo es: [Windows / Mac / Linux]
Ya tengo instalado: [Node.js sí/no, Git sí/no, cuenta de GitHub sí/no]
```

Rellena los corchetes con tu situación real antes de mandarlo — mientras
más específico seas sobre en qué paso te trabaste, mejor te va a poder
ayudar sin dar vueltas.

## Nota importante

Este archivo es una guía **de procedimiento** (los pasos mecánicos de
actualizar). Las decisiones de **qué construir o cómo arreglar un bug
específico del código de DENA ERP** las seguimos viendo tú y yo directamente
— otra IA no tiene el contexto de todo lo que hemos construido juntos en
esta conversación, así que para eso seguimos aquí.

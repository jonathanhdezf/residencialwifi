# Guía de Publicación Web

Este proyecto es una aplicación web estática construida con **Vite**. Esto significa que puede ser alojada gratuitamente en servicios líderes como **Netlify** o **Vercel**.

## Paso 1: Generar la Versión de Producción
Antes de subir tu sitio, asegurate de tener la versión más optimizada.
1. Abre tu terminal.
2. Ejecuta el comando:
   ```bash
   npm run build
   ```
3. Esto creará una carpeta llamada **`dist`** en tu proyecto (`c:\Users\ACER\.gemini\antigravity\scratch\portal_cautivo\dist`).
   * Esta carpeta contiene todo tu sitio comprimido y listo para la web.

## Paso 2: Publicar (Opción Fácil: Netlify Drop)
La forma más rápida sin configurar servidores:

1. Ve a [app.netlify.com/drop](https://app.netlify.com/drop).
2. Busca la carpeta **`dist`** que se generó en el Paso 1.
3. **Arrastra y suelta** la carpeta `dist` entera dentro del área punteada en la página de Netlify.
4. ¡Listo! En unos segundos te darán un link (ej. `random-name.netlify.app`) que puedes compartir.

## Paso 3: Publicar con GitHub (Recomendado)
Si quieres actualizaciones automáticas cada vez que guardes cambios:

1. Crea un nuevo repositorio vacío en [GitHub](https://github.com/new). No marques "Initialize with README".
2. Copia la URL del repositorio (ej. `https://github.com/usuario/mi-proyecto.git`).
3. En tu terminal del proyecto, ejecuta estos comandos (reemplazando `URL_DE_TU_REPO`):
   ```bash
   git remote add origin https://github.com/jonathanhdezf/residencialwifi.git
   git branch -M main
   git push -u origin main
   ```
2. Crea una cuenta en **Vercel** o **Netlify**.
3. Selecciona "Import Project from GitHub".
4. Elige tu repositorio.
5. El sistema detectará automáticamente que es `Vite`.
   * **Build Command**: `npm run build`
   * **Output Directory**: `dist`
6. Dale a "Deploy".

## Paso 4: Configuración de Variables de Entorno (CRÍTICO)
Para que tu App se conecte a Supabase en producción, debes configurar las claves manualmente en el panel de tu host (Netlify o Vercel), ya que el archivo `.env` **NO** se sube a GitHub por seguridad.

### En Netlify:
1. Ve a **Site configuration** > **Environment variables**.
2. Agrega las siguientes variables (copialas de tu archivo `.env` local):
   * Key: `VITE_SUPABASE_URL`  Value: `https://tu-proyecto.supabase.co`
   * Key: `VITE_SUPABASE_ANON_KEY` Value: `tu-clave-larga-anonima...`

### En Vercel:
1. Ve a **Settings** > **Environment Variables**.
2. Agrega las mismas variables:
   * `VITE_SUPABASE_URL`
   * `VITE_SUPABASE_ANON_KEY`

> **Nota:** Después de agregar las variables, es posible que necesites hacer un "Redeploy" (volver a desplegar) para que los cambios surtan efecto.

## Notas Importantes
* **Base de Datos**: El proyecto ahora utiliza **Supabase** como backend real.
    * Asegúrate de que las variables de entorno (`VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`) estén configuradas correctamente en Netlify/Vercel (ver Paso 4) para que la aplicación funcione.
    * Ejecuta el script SQL en Supabase si aún no lo has hecho.

# 🚀 Cómo publicar RESCUE AI en la web (GRATIS)

## GitHub Pages — Sin costo, sin servidor, URL pública permanente

---

## PASO 1 — Crea una cuenta en GitHub
👉 https://github.com/signup  
Solo necesitas email y contraseña.

---

## PASO 2 — Crea un repositorio nuevo

1. Entra a https://github.com
2. Click en el botón verde **"New"** (esquina superior izquierda)
3. Ponle de nombre exactamente: `rescue-ai` (en minúsculas)
4. Marca **"Public"**
5. Click **"Create repository"**

---

## PASO 3 — Sube los archivos

### Opción A: Directamente desde el navegador (más fácil)

1. En tu repositorio vacío, verás un link que dice **"uploading an existing file"** → click
2. Arrastra TODA la carpeta `rescue-agent-v3` al área de subida
   - O selecciona todos los archivos manualmente
3. Asegúrate de subir esta estructura exacta:
   ```
   index.html
   css/style.css
   js/environment.js
   js/search.js
   js/knowledge.js
   js/uncertainty.js
   js/planner.js
   js/decision.js
   js/learning.js
   js/agent.js
   js/audio.js
   js/particles.js
   js/main.js
   ```
4. Abajo en "Commit changes", escribe "Initial commit" y haz click en **"Commit changes"**

### Opción B: Con Git (si lo tienes instalado)
```bash
cd rescue-agent-v3
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/rescue-ai.git
git push -u origin main
```

---

## PASO 4 — Activa GitHub Pages

1. En tu repositorio, ve a **Settings** (pestaña de arriba)
2. En el menú izquierdo, busca **Pages**
3. En "Branch", selecciona **main** y carpeta **/ (root)**
4. Click **Save**

⏳ Espera 1-2 minutos...

---

## PASO 5 — Tu URL pública estará en:

```
https://TU_USUARIO.github.io/rescue-ai/
```

¡Eso es todo! Comparte ese link con tu profesor o grupo.

---

## ✅ Checklist antes de subir

- [ ] `index.html` está en la raíz (no dentro de una subcarpeta)
- [ ] Las carpetas `css/` y `js/` están en la raíz
- [ ] El repositorio es **Public**
- [ ] GitHub Pages está activado con branch **main**

---

## ❓ Problemas comunes

**La página sale en blanco:**
- Abre las DevTools del navegador (F12) → pestaña Console
- Si ves errores de archivos no encontrados, verifica que los paths sean correctos

**Los cambios no se ven:**
- Espera 2-3 minutos y recarga con Ctrl+Shift+R

**Error 404:**
- Verifica que `index.html` esté en la raíz del repositorio, no dentro de una subcarpeta

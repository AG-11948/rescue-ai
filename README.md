# 🚁 RESCUE AI — Agente Inteligente de Rescate

## Descripción
Sistema de agente inteligente autónomo que opera en una ciudad representada como cuadrícula,
integrando múltiples técnicas de inteligencia artificial para rescatar víctimas.

---

## 🛠 Tecnología
- **Lenguaje:** JavaScript (Vanilla, ES6+)
- **Visualización:** HTML5 Canvas + CSS3
- **Sin dependencias externas** — corre directamente en el navegador

---

## 🚀 Cómo ejecutar

### Opción 1: Directamente en el navegador
```bash
# Abre el archivo index.html en tu navegador
# Windows:
start index.html

# Mac:
open index.html

# Linux:
xdg-open index.html
```

### Opción 2: Servidor local (recomendado)
```bash
# Con Python 3 (viene instalado en la mayoría de sistemas)
cd rescue-agent
python3 -m http.server 8080

# Luego abre: http://localhost:8080

# Con Node.js (si lo tienes instalado)
npx serve .
# o
npx http-server . -p 8080
```

### Opción 3: VS Code Live Server
1. Instala la extensión **Live Server** en VS Code
2. Click derecho en `index.html` → "Open with Live Server"

---

## 🗂 Estructura del Proyecto
```
rescue-agent/
├── index.html          # Interfaz principal (videojuego)
├── css/
│   └── style.css       # Estilos dark/sci-fi
├── js/
│   ├── main.js         # Controlador UI + Game Loop
│   ├── environment.js  # Cuadrícula, celdas, renderizado
│   ├── search.js       # BFS (no informado) + A* (informado)
│   ├── knowledge.js    # Base de conocimiento + inferencia
│   ├── uncertainty.js  # Sensores imperfectos + Bayes
│   ├── planner.js      # Planificador STRIPS
│   ├── decision.js     # Función de utilidad
│   └── learning.js     # Q-Learning (aprendizaje por refuerzo)
└── README.md
```

---

## 🤖 Técnicas de IA Implementadas

| Criterio | Técnica | Archivo |
|----------|---------|---------|
| Tipo de Agente | Basado en modelo (model-based) | `agent.js` |
| Búsqueda No Informada | BFS (Breadth-First Search) | `search.js` |
| Búsqueda Informada | A* con heurística Manhattan | `search.js` |
| Base de Conocimiento | Lógica proposicional + Forward Chaining | `knowledge.js` |
| Planificación | STRIPS (acciones + precondiciones + efectos) | `planner.js` |
| Incertidumbre | Sensores con ruido + Actualización Bayesiana | `uncertainty.js` |
| Toma de Decisiones | Función de utilidad multi-criterio | `decision.js` |
| Aprendizaje | Q-Learning (ε-greedy) | `learning.js` |

---

## 🎮 Cómo usar la interfaz

1. **Configurar** el tamaño del mapa, algoritmo, velocidad y número de víctimas
2. **GENERAR MAPA** — Crea un entorno aleatorio
3. **INICIAR AGENTE** — El agente comienza a ejecutar
4. **Observar** los paneles:
   - **LOG**: Acciones del agente en tiempo real
   - **BASE CONOCIMIENTO**: Hechos inferidos con lógica proposicional
   - **APRENDIZAJE**: Mapa de calor de Q-valores
   - **PLAN**: Plan STRIPS generado

5. **COMPARAR ALGORITMOS** — Ejecuta benchmark BFS vs A*

---

## 📊 Leyenda del Mapa
| Símbolo | Significado |
|---------|-------------|
| 🚁 | Agente de rescate |
| 🧍 | Víctima a rescatar |
| ⚠ | Zona peligrosa (probabilística) |
| ⚡ | Estación de recarga |
| ■ (oscuro) | Obstáculo |
| · (verde) | Ruta planeada |

---

## 📝 Integrantes
- [Nombre 1]
- [Nombre 2]

**Curso:** Inteligencia Artificial  
**Entrega:** 24 de mayo de 2026

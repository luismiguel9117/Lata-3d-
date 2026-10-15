# Visor 3D • KALPA Café Cold Brew (Modelo Final)

Visualizador interactivo 3D en tiempo real para la lata comercial **KALPA Café Cold Brew (355 mL)** desarrollado con **Three.js** y **WebGL**.

---

## ⚡ Características Principales

- **Modelo 3D Exclusivo:** Basado en `Models/SM_BeerCan_A.fbx` con orientación estándar vertical (Y-Up), escala normalizada y centrado en el suelo del estudio.
- **Refinador Geométrico (`CanRefinerPro.js`):**
  - **Cuerpo Cilíndrico y Cuello:** Subdivisión y proyección radial continua de 18 a 72 segmentos, eliminando facetas cuadradas sin distorsión de textura.
  - **Reborde Superior (Chime Roll):** Aro de aluminio extruido y curvado hacia afuera idéntico a las latas reales de referencia, con normales exteriores perfectas.
  - **Tapa de Aluminio:** Conserva la tapa interior con su abre-fácil original y mapa UV concéntrico.
  - **Base de Aluminio:** Anillo biselado suave de 72 sectores con costura oculta en la parte posterior, y disco plano con textura concéntrica de aluminio cepillado 100% continua (sin solapamientos, ranuras ni z-fighting).
- **Diseño Oficial KALPA:**
  - Logotipo frontal de KALPA Café Cold Brew, sellos de calidad y tabla nutricional completa.
  - Patrón andino oscuro continuo en cuello y cuerpo.
- **Estudio Fotográfico Comercial:**
  - Fondo blanco puro de estudio comercial (`#ffffff`).
  - Iluminación de estudio con softboxes laterales, luz cenital para la tapa y luz trasera de recorte.
  - Sombra de contacto circular suave en el suelo.
- **Ángulos de Cámara Preset:**
  - `0° Frente`: Logotipo frontal a la altura de los ojos.
  - `45° Ángulo`: Perspectiva en tres cuartos.
  - `90° Lateral`: Vista lateral del patrón andino.
  - `180° Nutri`: Tabla nutricional y código de barras.
  - `🔝 Tapa`: Vista cenital directa hacia la tapa y el abre-fácil.
  - `⬇️ Base`: Vista inferior directa hacia el domo de aluminio.
- **Herramientas de Estudio:**
  - **🧊 Modo Congelada (Gotas y Escarcha 3D):** Capa física de micro-gotas, gotas medianas y escurrimientos con normales 3D (`MeshPhysicalMaterial.clearcoatNormalMap`), reflejos cristalinos y halo de escarcha (*sheen* sub-cero), conmutable ON/OFF y regulador continuo de intensidad en tiempo real.
  - Tinte interactivo del cuerpo (sin alterar el aluminio de la tapa ni de la base).
  - Control de lustre satinado (roughness) e intensidad de luces.
  - Giro automático, modo malla (wireframe) y captura de pantalla en alta resolución (HD).

---

## 🚀 Cómo Ejecutar Localmente

### Opción 1: Acceso Directo (Windows)
Haz doble clic en:
```bash
iniciar_servidor.bat
```

### Opción 2: Con Python
```bash
python -m http.server 8080
```
Abre en tu navegador: [http://localhost:8080](http://localhost:8080)

### Opción 3: Con Node.js
```bash
npx serve -p 8080 .
```

---

## 📄 Créditos y Licencia
- Modelo base 3D bajo licencia **Creative Commons Attribution 4.0 (CC BY 4.0)** por Likhandristov Sergei (ver `licenseCC.txt`).
- Diseño gráfico de etiqueta: **KALPA Café Cold Brew**.

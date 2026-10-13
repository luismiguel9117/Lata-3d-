# Visor 3D - Lata de Cerveza con Three.js

Visualizador interactivo 3D en tiempo real para modelos de lata de cerveza (FBX) desarrollado con **Three.js** y **WebGL**.

## 🚀 Características

- **Carga de Modelos FBX:** Soporta los modelos originales `SM_BeerCan_A.fbx`, `SM_BeerCan_B.fbx`, `SM_BeerCan_C.fbx`, `SM_BeerCan_D.fbx` y `SM_Beer.fbx`.
- **Corrección de Borde Circular:** Algoritmo que refina la geometría original para suavizar y redondear el borde superior (de 18 lados a 72 segmentos radiales suaves).
- **Materiales PBR:** Texturas de color base, mapa de normales y mapa RMAO (Roughness / Metallic / AO).
- **Iluminación de Estudio:** Iluminación de 3 puntos + luz focal cenital para resaltar reflejos metálicos en el borde.
- **Controles Interactivos:**
  - Alternar corrección de borde circular en tiempo real.
  - Vistas rápidas de cámara (Zoom al Borde / Vista Completa).
  - Ajuste de metalicidad, rugosidad e intensidad lumínica.
  - Modos de visualización: Auto-giro, Malla (wireframe) y captura de pantalla en PNG.

## 💻 Cómo Ejecutar Localmente

### Opción 1: Con el acceso directo (Windows)
Haz doble clic en:
```bash
iniciar_servidor.bat
```

### Opción 2: Con Python
```bash
python -m http.server 8080
```
Y abre en tu navegador: [http://localhost:8080](http://localhost:8080)

### Opción 3: Con Node.js
```bash
npx serve -p 8080 .
```

## 📄 Créditos y Licencia
- Modelo base de lata bajo licencia **Creative Commons Attribution 4.0 (CC BY 4.0)** por Likhandristov Sergei (ver `licenseCC.txt`).

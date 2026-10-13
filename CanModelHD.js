import * as THREE from 'three';

/**
 * Genera una lata de aluminio de ultra-alta definición (128 segmentos radiales)
 * basada fielmente en las fotos de referencia:
 * - Parte superior perfectamente redonda (sin facetas cuadradas)
 * - Cuello curvado en S (necking fillet continuo)
 * - Borde superior toroidal redondeado con sello mecánico (chime lip)
 * - Canal de sellado interior (countersink)
 * - Tapa de aluminio con acabado cepillado radial concéntrico
 * - Anilla abridora 3D (pull-tab) con bisel suave, orificios redondeados y remache central
 * - Cuerpo cilíndrico independiente para aplicar las etiquetas / texturas
 */
export function createHighDetailCan(textures = {}) {
  const root = new THREE.Group();
  root.name = "HighDetailCan_Root";

  // 1. Textura de aluminio cepillado radial concéntrico (como en la foto de referencia)
  const brushedCanvas = document.createElement('canvas');
  brushedCanvas.width = 1024;
  brushedCanvas.height = 1024;
  const ctx = brushedCanvas.getContext('2d');

  // Base metal
  ctx.fillStyle = '#dbe0e6';
  ctx.fillRect(0, 0, 1024, 1024);

  // Micro-estrías radiales concéntricas (torneado de fábrica de la tapa de aluminio)
  const cx = 512, cy = 512;
  for (let r = 8; r < 510; r += 1.25) {
    const alpha = 0.03 + Math.random() * 0.09;
    ctx.strokeStyle = Math.random() > 0.5 ? `rgba(255,255,255,${alpha})` : `rgba(60,70,80,${alpha})`;
    ctx.lineWidth = 0.75 + Math.random() * 0.75;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Reflejo suave anisotrópico
  const grad = ctx.createRadialGradient(cx, cy, 30, cx, cy, 500);
  grad.addColorStop(0, 'rgba(255,255,255,0.25)');
  grad.addColorStop(0.3, 'rgba(230,235,245,0.05)');
  grad.addColorStop(0.7, 'rgba(255,255,255,0.18)');
  grad.addColorStop(1, 'rgba(100,110,125,0.22)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 1024);

  const brushedTexture = new THREE.CanvasTexture(brushedCanvas);
  brushedTexture.wrapS = THREE.RepeatWrapping;
  brushedTexture.wrapT = THREE.RepeatWrapping;

  // Material de aluminio puro para tapa, aros y fondo
  const lidMaterial = new THREE.MeshStandardMaterial({
    color: 0xf0f3f6,
    metalness: 0.98,
    roughness: 0.20,
    map: brushedTexture
  });

  // Material para el cuerpo cilíndrico (acepta texturas de cerveza / lata)
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    metalness: 0.88,
    roughness: 0.25,
    map: textures.base || null,
    normalMap: textures.normal || null,
    normalScale: new THREE.Vector2(1, 1)
  });

  if (textures.rmao) {
    bodyMaterial.roughnessMap = textures.rmao;
    bodyMaterial.aoMap = textures.rmao;
    bodyMaterial.aoMapIntensity = 1.0;
  }

  // Material para la anilla abridora (pull-tab)
  const tabMaterial = new THREE.MeshStandardMaterial({
    color: 0xf4f6f9,
    metalness: 0.97,
    roughness: 0.24
  });

  const radialSegments = 128; // Ultra suave y perfectamente circular

  // -------------------------------------------------------------
  // A. CUERPO CILÍNDRICO DE LA LATA (Con UVs precisos para la etiqueta)
  // -------------------------------------------------------------
  const bodyRadius = 0.475;
  const bodyBottomY = 0.125;
  const bodyTopY = 1.660;
  const bodyHeight = bodyTopY - bodyBottomY;

  const bodyGeo = new THREE.CylinderGeometry(
    bodyRadius,
    bodyRadius,
    bodyHeight,
    radialSegments,
    1,
    true // openEnded para unirlo con cuello y fondo
  );
  bodyGeo.translate(0, bodyBottomY + bodyHeight / 2, 0);

  const bodyMesh = new THREE.Mesh(bodyGeo, bodyMaterial);
  bodyMesh.name = "Can_PrintBody";
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  root.add(bodyMesh);

  // -------------------------------------------------------------
  // B. PARTE SUPERIOR: CUELLO CURVO, BORDE REDONDEADO Y TAPA
  // -------------------------------------------------------------
  const topPoints = [];

  // Empieza exactamente en el borde superior del cuerpo cilíndrico
  topPoints.push(new THREE.Vector2(bodyRadius, bodyTopY));

  // Transición suave en S del cuello (Necking fillet con 18 pasos ultra-redondeados)
  const neckStart = bodyTopY;
  const neckEnd = 1.905;
  const neckTargetR = 0.395;
  const neckSteps = 18;
  for (let i = 1; i <= neckSteps; i++) {
    const t = i / neckSteps;
    // Función suave cúbica (smoothstep) para evitar aristas
    const ease = t * t * (3 - 2 * t);
    const y = neckStart + (neckEnd - neckStart) * t;
    const r = bodyRadius - (bodyRadius - neckTargetR) * ease;
    topPoints.push(new THREE.Vector2(r, y));
  }

  // Reborde exterior redondeado (Chime / Lip) - sección curva toroidal
  topPoints.push(new THREE.Vector2(0.400, 1.915));
  topPoints.push(new THREE.Vector2(0.408, 1.932));
  topPoints.push(new THREE.Vector2(0.414, 1.952));
  topPoints.push(new THREE.Vector2(0.417, 1.972));
  topPoints.push(new THREE.Vector2(0.416, 1.988)); // Curva superior exterior
  topPoints.push(new THREE.Vector2(0.408, 2.000)); // Vértice redondeado superior
  topPoints.push(new THREE.Vector2(0.398, 1.996)); // Comienzo de curvatura interior
  topPoints.push(new THREE.Vector2(0.390, 1.980));

  // Pared interior del canal de sellado (Countersink Wall)
  topPoints.push(new THREE.Vector2(0.380, 1.940));
  topPoints.push(new THREE.Vector2(0.370, 1.905));
  topPoints.push(new THREE.Vector2(0.362, 1.888)); // Fondo del canal
  topPoints.push(new THREE.Vector2(0.354, 1.888)); // Base redonda del canal
  topPoints.push(new THREE.Vector2(0.344, 1.902)); // Subida hacia el panel central

  // Panel central de la tapa
  topPoints.push(new THREE.Vector2(0.315, 1.922));
  topPoints.push(new THREE.Vector2(0.220, 1.930));
  topPoints.push(new THREE.Vector2(0.120, 1.933));
  topPoints.push(new THREE.Vector2(0.000, 1.934)); // Centro exacto

  const topGeo = new THREE.LatheGeometry(topPoints, radialSegments);
  topGeo.computeVertexNormals();

  // UV mapping radial para que el aluminio cepillado quede concéntrico
  const topUV = topGeo.attributes.uv;
  const topPos = topGeo.attributes.position;
  for (let i = 0; i < topPos.count; i++) {
    const x = topPos.getX(i);
    const z = topPos.getZ(i);
    topUV.setXY(i, 0.5 + (x / 0.85), 0.5 + (z / 0.85));
  }
  topUV.needsUpdate = true;

  const topMesh = new THREE.Mesh(topGeo, lidMaterial);
  topMesh.name = "Can_TopLid";
  topMesh.castShadow = true;
  topMesh.receiveShadow = true;
  root.add(topMesh);

  // -------------------------------------------------------------
  // C. FONDO INFERIOR DE LA LATA (Dome cóncavo y anillo de apoyo)
  // -------------------------------------------------------------
  const botPoints = [];
  botPoints.push(new THREE.Vector2(0.000, 0.060));
  botPoints.push(new THREE.Vector2(0.120, 0.055));
  botPoints.push(new THREE.Vector2(0.240, 0.040));
  botPoints.push(new THREE.Vector2(0.320, 0.015));
  botPoints.push(new THREE.Vector2(0.360, 0.000)); // Anillo de apoyo en el suelo
  botPoints.push(new THREE.Vector2(0.380, 0.002));
  botPoints.push(new THREE.Vector2(0.405, 0.015));
  botPoints.push(new THREE.Vector2(0.435, 0.045));
  botPoints.push(new THREE.Vector2(0.455, 0.080));
  botPoints.push(new THREE.Vector2(0.470, 0.125));
  botPoints.push(new THREE.Vector2(bodyRadius, bodyBottomY));

  const botGeo = new THREE.LatheGeometry(botPoints, radialSegments);
  botGeo.computeVertexNormals();
  const botMesh = new THREE.Mesh(botGeo, lidMaterial);
  botMesh.name = "Can_BottomBase";
  botMesh.castShadow = true;
  botMesh.receiveShadow = true;
  root.add(botMesh);

  // -------------------------------------------------------------
  // D. HENDIDURA DE APERTURA (Scoreline troquelada en la tapa)
  // -------------------------------------------------------------
  const scoreGeo = new THREE.RingGeometry(0.086, 0.095, 64);
  const scoreMat = new THREE.MeshStandardMaterial({
    color: 0x8a929a,
    metalness: 0.92,
    roughness: 0.38
  });
  const scoreMesh = new THREE.Mesh(scoreGeo, scoreMat);
  scoreMesh.rotation.x = -Math.PI / 2;
  scoreMesh.position.set(0, 1.935, -0.115);
  root.add(scoreMesh);

  // -------------------------------------------------------------
  // E. REMACHE CENTRAL (Rivet metálico de fijación)
  // -------------------------------------------------------------
  const rivetGeo = new THREE.CylinderGeometry(0.020, 0.024, 0.014, 32);
  const rivet = new THREE.Mesh(rivetGeo, tabMaterial);
  rivet.position.set(0, 1.940, 0);
  rivet.castShadow = true;
  root.add(rivet);

  // -------------------------------------------------------------
  // F. ANILLA ABRIDORA 3D (Pull-Tab realista con bisel y agujeros)
  // -------------------------------------------------------------
  const tabShape = new THREE.Shape();
  const w = 0.082;
  const lBack = 0.145;
  const lFront = 0.120;

  tabShape.moveTo(-w * 0.72, -lBack * 0.6);
  // Anillo curvo posterior
  tabShape.bezierCurveTo(-w * 0.72, -lBack, -w * 0.28, -lBack, 0, -lBack);
  tabShape.bezierCurveTo(w * 0.28, -lBack, w * 0.72, -lBack, w * 0.72, -lBack * 0.6);
  // Cintura anatómica
  tabShape.bezierCurveTo(w * 0.72, -0.02, w * 0.62, 0.02, w * 0.62, 0.05);
  // Punta frontal redondeada
  tabShape.bezierCurveTo(w * 0.62, lFront * 0.8, w * 0.32, lFront, 0, lFront);
  tabShape.bezierCurveTo(-w * 0.32, lFront, -w * 0.62, lFront * 0.8, -w * 0.62, 0.05);
  tabShape.bezierCurveTo(-w * 0.62, 0.02, -w * 0.72, -0.02, -w * 0.72, -lBack * 0.6);

  // Orificio grande posterior (para el dedo)
  const fingerHole = new THREE.Path();
  fingerHole.absarc(0, -0.082, 0.038, 0, Math.PI * 2, true);
  tabShape.holes.push(fingerHole);

  // Orificio pequeño delantero (remache)
  const rivetHole = new THREE.Path();
  rivetHole.absarc(0, 0.010, 0.022, 0, Math.PI * 2, true);
  tabShape.holes.push(rivetHole);

  const extrudeSettings = {
    steps: 1,
    depth: 0.009,
    bevelEnabled: true,
    bevelThickness: 0.0035,
    bevelSize: 0.0035,
    bevelOffset: 0,
    bevelSegments: 4
  };

  const tabGeometry = new THREE.ExtrudeGeometry(tabShape, extrudeSettings);
  tabGeometry.center();
  const tabMesh = new THREE.Mesh(tabGeometry, tabMaterial);
  tabMesh.rotation.x = -Math.PI / 2;
  tabMesh.position.set(0, 1.944, -0.015);
  tabMesh.castShadow = true;
  tabMesh.receiveShadow = true;
  root.add(tabMesh);

  return {
    root,
    bodyMesh,
    topMesh,
    botMesh,
    tabMesh,
    bodyMaterial,
    lidMaterial,
    tabMaterial
  };
}

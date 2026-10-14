import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Suaviza y circulariza el cuerpo y cuello cilíndrico de la lata de 18 a 72 segmentos radiales en plano X-Z (Y-up),
 * eliminando por completo cualquier aspecto facetado o "cuadrado".
 * Preserva UVs continuos sin distorsiones en la costura.
 */
export function smoothCanBody(sourceGeo) {
  let geo = sourceGeo.index ? sourceGeo.toNonIndexed() : sourceGeo.clone();

  for (let pass = 0; pass < 2; pass++) {
    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    const newPos = [];
    const newUV = [];

    const getV = (i) => new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
    const getU = (i) => uv ? new THREE.Vector2(uv.getX(i), uv.getY(i)) : new THREE.Vector2();

    for (let i = 0; i < pos.count; i += 3) {
      const v1 = getV(i), v2 = getV(i + 1), v3 = getV(i + 2);
      const u1 = getU(i), u2 = getU(i + 1), u3 = getU(i + 2);

      // Interpolación segura de UVs teniendo en cuenta el salto de costura (U de ~0.50 a ~0.00)
      const interpUV = (ua, ub) => {
        let bx = ub.x;
        const diff = bx - ua.x;
        if (diff > 0.35) bx -= 0.50; // salto de costura
        else if (diff < -0.35) bx += 0.50;
        let midX = (ua.x + bx) * 0.5;
        if (midX < 0) midX += 0.50;
        if (midX > 0.50) midX -= 0.50;
        return new THREE.Vector2(midX, (ua.y + ub.y) * 0.5);
      };

      const m12 = new THREE.Vector3().addVectors(v1, v2).multiplyScalar(0.5);
      const m23 = new THREE.Vector3().addVectors(v2, v3).multiplyScalar(0.5);
      const m31 = new THREE.Vector3().addVectors(v3, v1).multiplyScalar(0.5);

      const u12 = interpUV(u1, u2);
      const u23 = interpUV(u2, u3);
      const u31 = interpUV(u3, u1);

      // Proyectar midpoints horizontales al radio circular real del cilindro (plano X-Z, eje Y)
      const project = (va, vb, vm) => {
        const ra = Math.hypot(va.x, va.z);
        const rb = Math.hypot(vb.x, vb.z);
        if (Math.abs(ra - rb) < 1.5 && Math.abs(va.y - vb.y) < 1.5 && ra > 10.0) {
          const targetR = (ra + rb) * 0.5;
          const angle = Math.atan2(vm.x, vm.z);
          vm.x = targetR * Math.sin(angle);
          vm.z = targetR * Math.cos(angle);
        }
      };

      project(v1, v2, m12);
      project(v2, v3, m23);
      project(v3, v1, m31);

      const pushT = (a, b, c, ua, ub, uc) => {
        newPos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
        newUV.push(ua.x, ua.y, ub.x, ub.y, uc.x, uc.y);
      };

      pushT(v1, m12, m31, u1, u12, u31);
      pushT(m12, v2, m23, u12, u2, u23);
      pushT(m31, m23, v3, u31, u23, u3);
      pushT(m12, m23, m31, u12, u23, u31);
    }

    geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(newPos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(newUV, 2));
  }

  const merged = mergeVertices(geo, 0.02);
  merged.computeVertexNormals();
  return merged;
}

/**
 * Reconstruye el borde superior de aluminio (chime) como un reborde redondeado, grueso y sobresaliente
 * idéntico a las latas reales de referencia, eliminando sombras extrañas y el aspecto hundido.
 * Conserva la tapa interior (Y ~ 162.54, R <= 25.5) y suaviza la base cóncava inferior (Y <= 7.95)
 * a 72 segmentos radiales continuos.
 */
export function buildRealisticCanRimAndBase(sourceAlumGeo) {
  const geo = sourceAlumGeo.index ? sourceAlumGeo.toNonIndexed() : sourceAlumGeo.clone();
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;

  const newPos = [];
  const newUV = [];

  const getV = (i) => new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
  const getU = (i) => uv ? new THREE.Vector2(uv.getX(i), uv.getY(i)) : new THREE.Vector2();

  // 1. Conservar intacta la tapa plana interior con textura de abre-fácil original
  for (let i = 0; i < pos.count; i += 3) {
    const v1 = getV(i), v2 = getV(i + 1), v3 = getV(i + 2);
    const u1 = getU(i), u2 = getU(i + 1), u3 = getU(i + 2);

    const maxY = Math.max(v1.y, v2.y, v3.y);
    const minY = Math.min(v1.y, v2.y, v3.y);
    const maxR = Math.max(Math.hypot(v1.x, v1.z), Math.hypot(v2.x, v2.z), Math.hypot(v3.x, v3.z));

    // Tapa plana interior (Y ~ 162.5, R <= 25.5): 100% intacta
    const isLidFace = (maxY <= 162.7 && minY >= 162.3 && maxR <= 25.5);

    if (isLidFace) {
      newPos.push(v1.x, v1.y, v1.z, v2.x, v2.y, v2.z, v3.x, v3.y, v3.z);
      newUV.push(u1.x, u1.y, u2.x, u2.y, u3.x, u3.y);
    }
  }

  // 2. Construir la base inferior en 72 segmentos radiales suaves
  // Perfil de la base inferior: domo cóncavo (R: 0 -> 24), anillo de apoyo (R: 27, Y: 0), bisel exterior (R: 33, Y: 7.85)
  const segments = 72;
  const baseProfile = [
    { r: 0.0,  y: 3.5,  v: 0.16 }, // Centro cóncavo hacia adentro
    { r: 12.0, y: 2.8,  v: 0.16 },
    { r: 21.0, y: 1.2,  v: 0.15 },
    { r: 25.0, y: 0.1,  v: 0.14 },
    { r: 27.0, y: 0.0,  v: 0.14 }, // Anillo de contacto con la mesa
    { r: 28.5, y: 0.4,  v: 0.18 }, // Inicio del bisel exterior
    { r: 31.0, y: 2.5,  v: 0.22 },
    { r: 33.0, y: 7.85, v: 0.24 }  // Encuentro con el cuerpo impreso de la lata
  ];

  for (let s = 0; s < segments; s++) {
    const a1 = (s / segments) * Math.PI * 2;
    const a2 = ((s + 1) / segments) * Math.PI * 2;

    const sin1 = Math.sin(a1), cos1 = Math.cos(a1);
    const sin2 = Math.sin(a2), cos2 = Math.cos(a2);

    // Mapeo en la zona de textura inferior del atlas (U: ~0.0 a 0.5, V: ~0.08 a 0.24)
    const u1 = 0.25 + 0.20 * cos1;
    const u2 = 0.25 + 0.20 * cos2;

    for (let p = 0; p < baseProfile.length - 1; p++) {
      const pA = baseProfile[p];
      const pB = baseProfile[p + 1];

      const xA1 = pA.r * sin1, zA1 = pA.r * cos1, yA1 = pA.y;
      const xA2 = pA.r * sin2, zA2 = pA.r * cos2, yA2 = pA.y;
      const xB1 = pB.r * sin1, zB1 = pB.r * cos1, yB1 = pB.y;
      const xB2 = pB.r * sin2, zB2 = pB.r * cos2, yB2 = pB.y;

      const vA = pA.v;
      const vB = pB.v;

      // Triángulo 1
      newPos.push(xA1, yA1, zA1, xB1, yB1, zB1, xA2, yA2, zA2);
      newUV.push(u1, vA, u1, vB, u2, vA);

      // Triángulo 2
      newPos.push(xA2, yA2, zA2, xB1, yB1, zB1, xB2, yB2, zB2);
      newUV.push(u2, vA, u1, vB, u2, vB);
    }
  }

  // 3. Generar un reborde superior (Chime Roll) redondeado, grueso y exterior de 72 segmentos radiales
  // Con sección curvada que sobresale suavemente hacia afuera idéntico a las latas reales
  const rimProfile = [
    // Encuentro con el cuello cónico de la lata
    { r: 28.80, y: 162.10, v: 0.238 },
    // Bisel curvado exterior hacia arriba
    { r: 29.35, y: 163.40, v: 0.239 },
    { r: 29.50, y: 164.50, v: 0.240 },
    // Labio redondeado superior (cúspide del reborde)
    { r: 29.35, y: 165.25, v: 0.241 },
    { r: 28.95, y: 165.35, v: 0.242 },
    { r: 28.45, y: 165.00, v: 0.242 },
    // Pared interior descendente hacia el canal de sellado
    { r: 27.60, y: 163.80, v: 0.243 },
    { r: 26.80, y: 162.80, v: 0.243 },
    // Empalme con la tapa plana interior
    { r: 25.40, y: 162.54, v: 0.244 }
  ];

  for (let s = 0; s < segments; s++) {
    const a1 = (s / segments) * Math.PI * 2;
    const a2 = ((s + 1) / segments) * Math.PI * 2;

    const sin1 = Math.sin(a1), cos1 = Math.cos(a1);
    const sin2 = Math.sin(a2), cos2 = Math.cos(a2);

    const u1 = 0.50 + 0.40 * (s / segments);
    const u2 = 0.50 + 0.40 * ((s + 1) / segments);

    for (let p = 0; p < rimProfile.length - 1; p++) {
      const pA = rimProfile[p];
      const pB = rimProfile[p + 1];

      const xA1 = pA.r * sin1, zA1 = pA.r * cos1, yA1 = pA.y;
      const xA2 = pA.r * sin2, zA2 = pA.r * cos2, yA2 = pA.y;
      const xB1 = pB.r * sin1, zB1 = pB.r * cos1, yB1 = pB.y;
      const xB2 = pB.r * sin2, zB2 = pB.r * cos2, yB2 = pB.y;

      // Triángulo 1
      newPos.push(xA1, yA1, zA1, xA2, yA2, zA2, xB1, yB1, zB1);
      newUV.push(u1, pA.v, u2, pA.v, u1, pB.v);

      // Triángulo 2
      newPos.push(xA2, yA2, zA2, xB2, yB2, zB2, xB1, yB1, zB1);
      newUV.push(u2, pA.v, u2, pB.v, u1, pB.v);
    }
  }

  const resultGeo = new THREE.BufferGeometry();
  resultGeo.setAttribute('position', new THREE.Float32BufferAttribute(newPos, 3));
  resultGeo.setAttribute('uv', new THREE.Float32BufferAttribute(newUV, 2));

  const merged = mergeVertices(resultGeo, 0.05);
  merged.computeVertexNormals();
  return merged;
}

import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Subdivide una geometría cilíndrica proyectando los midpoints horizontales al radio circular real (en plano X-Z).
 * Preserva UVs continuos sin distorsiones en la costura.
 */
function subdivideCylindricalGeometry(sourceGeo, passes = 2) {
  let g = sourceGeo.index ? sourceGeo.toNonIndexed() : sourceGeo.clone();

  for (let pass = 0; pass < passes; pass++) {
    const p = g.attributes.position;
    const u = g.attributes.uv;
    const newPos = [];
    const newUV = [];

    const getV = (i) => new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i));
    const getU = (i) => u ? new THREE.Vector2(u.getX(i), u.getY(i)) : new THREE.Vector2();

    for (let i = 0; i < p.count; i += 3) {
      const v1 = getV(i), v2 = getV(i + 1), v3 = getV(i + 2);
      const u1 = getU(i), u2 = getU(i + 1), u3 = getU(i + 2);

      const interpUV = (ua, ub) => {
        let bx = ub.x;
        const diff = bx - ua.x;
        if (diff > 0.35) bx -= 0.50;
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

    g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(newPos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(newUV, 2));
  }

  const merged = mergeVertices(g, 0.02);
  merged.computeVertexNormals();
  return merged;
}

/**
 * Suaviza y circulariza el cuerpo y cuello cilíndrico de la lata de 18 a 72 segmentos radiales en plano X-Z (Y-up),
 * eliminando por completo cualquier aspecto facetado o "cuadrado".
 */
export function smoothCanBody(sourceGeo) {
  return subdivideCylindricalGeometry(sourceGeo, 2);
}

/**
 * Reconstruye y suaviza todas las secciones de aluminio:
 * 1. Base inferior: subdivide la base original con proyección circular idéntica al cuerpo (empalme perfecto sin huecos ni transparencias).
 * 2. Tapa interior: conserva 100% intacta la tapa plana con su abre-fácil original.
 * 3. Borde superior (chime): genera el reborde redondeado, grueso y continuo de 72 segmentos con normales exteriores correctas.
 */
export function buildRealisticCanRimAndBase(sourceAlumGeo) {
  const geo = sourceAlumGeo.index ? sourceAlumGeo.toNonIndexed() : sourceAlumGeo.clone();
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;

  // 1. Separar triángulos de la base (Y <= 7.95) y de la tapa plana interior (Y ~ 162.54, R <= 25.5)
  const basePos = [], baseUV = [];
  const lidPos = [], lidUV = [];

  for (let i = 0; i < pos.count; i += 3) {
    const avgY = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3;

    if (avgY <= 7.95) {
      // Triángulo de la base inferior original
      for (let c = 0; c < 3; c++) {
        basePos.push(pos.getX(i + c), pos.getY(i + c), pos.getZ(i + c));
        if (uv) baseUV.push(uv.getX(i + c), uv.getY(i + c));
      }
    } else if (avgY >= 162.05) {
      const maxY = Math.max(pos.getY(i), pos.getY(i + 1), pos.getY(i + 2));
      const minY = Math.min(pos.getY(i), pos.getY(i + 1), pos.getY(i + 2));
      const maxR = Math.max(
        Math.hypot(pos.getX(i), pos.getZ(i)),
        Math.hypot(pos.getX(i + 1), pos.getZ(i + 1)),
        Math.hypot(pos.getX(i + 2), pos.getZ(i + 2))
      );

      // Tapa plana interior con relieve y pestaña original
      if (maxY <= 162.7 && minY >= 162.3 && maxR <= 25.5) {
        for (let c = 0; c < 3; c++) {
          lidPos.push(pos.getX(i + c), pos.getY(i + c), pos.getZ(i + c));
          if (uv) lidUV.push(uv.getX(i + c), uv.getY(i + c));
        }
      }
    }
  }

  // 2. Subdividir la base original a 72 segmentos radiales suaves
  const rawBaseGeo = new THREE.BufferGeometry();
  rawBaseGeo.setAttribute('position', new THREE.Float32BufferAttribute(basePos, 3));
  if (uv) rawBaseGeo.setAttribute('uv', new THREE.Float32BufferAttribute(baseUV, 2));
  const smoothBase = subdivideCylindricalGeometry(rawBaseGeo, 2);

  // 3. Generar el aro del reborde superior (chime roll) con 72 sectores y normales exteriores
  const rimPos = [], rimUV = [];
  const segments = 72;
  const rimProfile = [
    // Encuentro con cuello cónico
    { r: 28.80, y: 162.10, v: 0.238 },
    // Bisel exterior curvado hacia arriba
    { r: 29.35, y: 163.40, v: 0.239 },
    { r: 29.50, y: 164.50, v: 0.240 },
    // Cúspide del reborde redondeado
    { r: 29.35, y: 165.25, v: 0.241 },
    { r: 28.95, y: 165.35, v: 0.242 },
    { r: 28.45, y: 165.00, v: 0.242 },
    // Pared interior descendente hacia la tapa
    { r: 27.60, y: 163.80, v: 0.243 },
    { r: 26.80, y: 162.80, v: 0.243 },
    // Empalme con la tapa plana
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
      const pA = rimProfile[p], pB = rimProfile[p + 1];
      const xA1 = pA.r * sin1, zA1 = pA.r * cos1, yA1 = pA.y;
      const xA2 = pA.r * sin2, zA2 = pA.r * cos2, yA2 = pA.y;
      const xB1 = pB.r * sin1, zB1 = pB.r * cos1, yB1 = pB.y;
      const xB2 = pB.r * sin2, zB2 = pB.r * cos2, yB2 = pB.y;

      // Triángulo 1
      rimPos.push(xA1, yA1, zA1, xA2, yA2, zA2, xB1, yB1, zB1);
      rimUV.push(u1, pA.v, u2, pA.v, u1, pB.v);

      // Triángulo 2
      rimPos.push(xA2, yA2, zA2, xB2, yB2, zB2, xB1, yB1, zB1);
      rimUV.push(u2, pA.v, u2, pB.v, u1, pB.v);
    }
  }

  // 4. Combinar Base Suavizada + Tapa Original + Borde Superior Redondeado
  const combPos = [];
  const combUV = [];

  // Base suavizada
  const bNonIndexed = smoothBase.toNonIndexed();
  const bp = bNonIndexed.attributes.position;
  const bu = bNonIndexed.attributes.uv;
  for (let i = 0; i < bp.count; i++) {
    combPos.push(bp.getX(i), bp.getY(i), bp.getZ(i));
    if (bu) combUV.push(bu.getX(i), bu.getY(i));
  }

  // Tapa interior
  for (let i = 0; i < lidPos.length; i++) combPos.push(lidPos[i]);
  for (let i = 0; i < lidUV.length; i++) combUV.push(lidUV[i]);

  // Borde superior
  for (let i = 0; i < rimPos.length; i++) combPos.push(rimPos[i]);
  for (let i = 0; i < rimUV.length; i++) combUV.push(rimUV[i]);

  const totalAlumGeo = new THREE.BufferGeometry();
  totalAlumGeo.setAttribute('position', new THREE.Float32BufferAttribute(combPos, 3));
  totalAlumGeo.setAttribute('uv', new THREE.Float32BufferAttribute(combUV, 2));

  const mergedTotal = mergeVertices(totalAlumGeo, 0.02);
  mergedTotal.computeVertexNormals();
  return mergedTotal;
}

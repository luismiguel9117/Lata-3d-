import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Subdivide una geometría cilíndrica (el cuerpo impreso de la lata) proyectando los midpoints
 * de aristas perimetrales al radio circular real (en plano X-Z).
 * Preserva UVs continuos sin distorsiones en la costura.
 */
export function smoothCanBody(sourceGeo) {
  let g = sourceGeo.index ? sourceGeo.toNonIndexed() : sourceGeo.clone();

  for (let pass = 0; pass < 2; pass++) {
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

      // Proyectar aristas cilíndricas perimetrales
      const project = (va, vb, vm) => {
        const d = va.distanceTo(vb);
        const ra = Math.hypot(va.x, va.z);
        const rb = Math.hypot(vb.x, vb.z);
        const avgR = (ra + rb) * 0.5;
        if (d < 0.45 * avgR && Math.abs(ra - rb) < 1.5 && Math.abs(va.y - vb.y) < 1.5 && ra > 10.0) {
          const targetR = avgR;
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
 * Reconstruye y suaviza todas las secciones de aluminio:
 * 1. Base interior (disco Y=0): conserva 100% INTACTO el mapeo UV del círculo de aluminio cepillado concéntrico sin cortes ni pliegues.
 * 2. Bisel inferior: genera un anillo biselado suave de 72 segmentos alineado con la costura trasera de la lata (-PI a +PI).
 * 3. Tapa interior: conserva 100% INTACTA la tapa plana con su abre-fácil original.
 * 4. Borde superior (chime): genera el reborde redondeado, grueso y continuo de 72 segmentos con normales exteriores correctas.
 */
export function buildRealisticCanRimAndBase(sourceAlumGeo) {
  const geo = sourceAlumGeo.index ? sourceAlumGeo.toNonIndexed() : sourceAlumGeo.clone();
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;

  // 1. Conservar el disco plano original de la base (Triángulos con Y <= 0.01)
  // Contiene el mapa UV concéntrico original del aluminio cepillado sin cortes en U=0.50
  const diskPos = [];
  const diskUV = [];

  // Tapa superior plana interior con relieve y pestaña original
  const lidPos = [];
  const lidUV = [];

  for (let i = 0; i < pos.count; i += 3) {
    const avgY = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3;

    if (avgY <= 0.01) {
      // Disco plano de la base original (R <= 27.03, Y = 0)
      for (let c = 0; c < 3; c++) {
        diskPos.push(pos.getX(i + c), pos.getY(i + c), pos.getZ(i + c));
        if (uv) diskUV.push(uv.getX(i + c), uv.getY(i + c));
      }
    } else if (avgY >= 162.05) {
      const maxY = Math.max(pos.getY(i), pos.getY(i + 1), pos.getY(i + 2));
      const minY = Math.min(pos.getY(i), pos.getY(i + 1), pos.getY(i + 2));
      const maxR = Math.max(
        Math.hypot(pos.getX(i), pos.getZ(i)),
        Math.hypot(pos.getX(i + 1), pos.getZ(i + 1)),
        Math.hypot(pos.getX(i + 2), pos.getZ(i + 2))
      );

      // Tapa plana interior (Y ~ 162.54, R <= 25.5)
      if (maxY <= 162.7 && minY >= 162.3 && maxR <= 25.5) {
        for (let c = 0; c < 3; c++) {
          lidPos.push(pos.getX(i + c), pos.getY(i + c), pos.getZ(i + c));
          if (uv) lidUV.push(uv.getX(i + c), uv.getY(i + c));
        }
      }
    }
  }

  // 2. Generar el bisel inferior en 72 segmentos radiales suaves y continuos
  // Conecta exactamente el disco base (R = 27.031, Y = 0.0) con el cuerpo (R = 33.000, Y = 7.851)
  // Ángulo de -PI a +PI para que la costura quede en la parte trasera de la lata (Z = -33) y el frente sea 100% puro y continuo
  const bevelPos = [];
  const bevelUV = [];
  const segments = 72;

  const rLower = 27.031, yLower = 0.0;
  const rUpper = 33.000, yUpper = 7.851;
  const vLower = 0.220;
  const vUpper = 0.244;

  for (let s = 0; s < segments; s++) {
    const a1 = -Math.PI + (s / segments) * Math.PI * 2;
    const a2 = -Math.PI + ((s + 1) / segments) * Math.PI * 2;

    const sin1 = Math.sin(a1), cos1 = Math.cos(a1);
    const sin2 = Math.sin(a2), cos2 = Math.cos(a2);

    // Mapeo seguro U: 0.004 a 0.462 (zona 100% pura de aluminio libre de artefactos)
    const u1 = 0.004 + 0.458 * (s / segments);
    const u2 = 0.004 + 0.458 * ((s + 1) / segments);

    const xL1 = rLower * sin1, zL1 = rLower * cos1, yL1 = yLower;
    const xL2 = rLower * sin2, zL2 = rLower * cos2, yL2 = yLower;
    const xU1 = rUpper * sin1, zU1 = rUpper * cos1, yU1 = yUpper;
    const xU2 = rUpper * sin2, zU2 = rUpper * cos2, yU2 = yUpper;

    // Triángulo 1 (normal exterior hacia afuera y hacia abajo)
    bevelPos.push(xL1, yL1, zL1, xL2, yL2, zL2, xU1, yU1, zU1);
    bevelUV.push(u1, vLower, u2, vLower, u1, vUpper);

    // Triángulo 2
    bevelPos.push(xL2, yL2, zL2, xU2, yU2, zU2, xU1, yU1, zU1);
    bevelUV.push(u2, vLower, u2, vUpper, u1, vUpper);
  }

  // 3. Generar el aro del reborde superior (chime roll) con 72 sectores y normales exteriores
  const rimPos = [];
  const rimUV = [];
  const rimProfile = [
    { r: 28.80, y: 162.10, v: 0.238 },
    { r: 29.35, y: 163.40, v: 0.239 },
    { r: 29.50, y: 164.50, v: 0.240 },
    { r: 29.35, y: 165.25, v: 0.241 },
    { r: 28.95, y: 165.35, v: 0.242 },
    { r: 28.45, y: 165.00, v: 0.242 },
    { r: 27.60, y: 163.80, v: 0.243 },
    { r: 26.80, y: 162.80, v: 0.243 },
    { r: 25.40, y: 162.54, v: 0.244 }
  ];

  for (let s = 0; s < segments; s++) {
    const a1 = -Math.PI + (s / segments) * Math.PI * 2;
    const a2 = -Math.PI + ((s + 1) / segments) * Math.PI * 2;
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

  // 4. Combinar Disco Base Original + Bisel 72 Segmentos + Tapa Original + Borde Superior Redondeado
  const combPos = [...diskPos, ...bevelPos, ...lidPos, ...rimPos];
  const combUV = [...diskUV, ...bevelUV, ...lidUV, ...rimUV];

  const totalAlumGeo = new THREE.BufferGeometry();
  totalAlumGeo.setAttribute('position', new THREE.Float32BufferAttribute(combPos, 3));
  totalAlumGeo.setAttribute('uv', new THREE.Float32BufferAttribute(combUV, 2));

  const mergedTotal = mergeVertices(totalAlumGeo, 0.02);
  mergedTotal.computeVertexNormals();
  return mergedTotal;
}

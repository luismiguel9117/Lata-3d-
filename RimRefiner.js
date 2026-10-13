import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Modifica la geometría de la lata original existente para que tanto el borde exterior (rim)
 * como el bisel de la base inferior pasen de ser polígonos facetados de 18 lados a círculos
 * suaves, perfectamente cilíndricos y continuos (72 lados), eliminando aristas y líneas negras,
 * y dejando la tapa plana interior 100% intacta sin deformaciones en la textura.
 * 
 * @param {THREE.BufferGeometry} geometry - Geometría original del FBX
 * @param {number} passes - Número de pases de subdivisión (2 = 72 segmentos radiales)
 * @returns {THREE.BufferGeometry} Geometría con borde y base circularizados
 */
export function makeCanRimCircular(geometry, passes = 2) {
  let currentGeo = geometry.clone();

  if (currentGeo.index) {
    currentGeo = currentGeo.toNonIndexed();
  }

  for (let pass = 0; pass < passes; pass++) {
    const pos = currentGeo.attributes.position;
    const uv = currentGeo.attributes.uv;
    const newPos = [];
    const newUV = [];

    const getV = (i) => new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
    const getU = (i) => uv ? new THREE.Vector2(uv.getX(i), uv.getY(i)) : new THREE.Vector2();

    for (let i = 0; i < pos.count; i += 3) {
      const v1 = getV(i), v2 = getV(i + 1), v3 = getV(i + 2);
      const u1 = getU(i), u2 = getU(i + 1), u3 = getU(i + 2);

      const z1 = v1.z, z2 = v2.z, z3 = v3.z;
      const r1 = Math.hypot(v1.x, v1.y);
      const r2 = Math.hypot(v2.x, v2.y);
      const r3 = Math.hypot(v3.x, v3.y);

      const maxZ = Math.max(z1, z2, z3);
      const minZ = Math.min(z1, z2, z3);
      const maxR = Math.max(r1, r2, r3);

      // 1. Tapa plana interior (Z ~ 162.5, R <= 25.5): 100% intacta para proteger textura de la chapa
      const isLidFace = (maxZ <= 162.6 && minZ >= 162.4 && maxR <= 25.5);

      // 2. Borde exterior superior (rim/chime): Z >= 161.8 y R >= 26.2
      const isOuterRim = !isLidFace && (maxZ >= 161.8 && maxR >= 26.2);

      // 3. Bisel exterior de la base de aluminio: Z <= 8.2 y R >= 26.0
      const isBaseBevel = (maxZ <= 8.2 && maxR >= 26.0);

      if (isOuterRim || isBaseBevel) {
        // Subdivisión 1 -> 4
        const m12 = new THREE.Vector3().addVectors(v1, v2).multiplyScalar(0.5);
        const m23 = new THREE.Vector3().addVectors(v2, v3).multiplyScalar(0.5);
        const m31 = new THREE.Vector3().addVectors(v3, v1).multiplyScalar(0.5);

        const u12 = new THREE.Vector2().addVectors(u1, u2).multiplyScalar(0.5);
        const u23 = new THREE.Vector2().addVectors(u2, u3).multiplyScalar(0.5);
        const u31 = new THREE.Vector2().addVectors(u3, u1).multiplyScalar(0.5);

        // Proyectar vértices del aro exterior al círculo exacto
        const projectToCircle = (va, vb, vm) => {
          const ra = Math.hypot(va.x, va.y);
          const rb = Math.hypot(vb.x, vb.y);
          if (ra >= 25.5 && rb >= 25.5 && Math.abs(ra - rb) < 1.8 && Math.abs(va.z - vb.z) < 1.5) {
            const targetR = (ra + rb) * 0.5;
            const angle = Math.atan2(vm.y, vm.x);
            vm.x = targetR * Math.cos(angle);
            vm.y = targetR * Math.sin(angle);
          }
        };

        projectToCircle(v1, v2, m12);
        projectToCircle(v2, v3, m23);
        projectToCircle(v3, v1, m31);

        const pushTri = (a, b, c, ua, ub, uc) => {
          newPos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
          newUV.push(ua.x, ua.y, ub.x, ub.y, uc.x, uc.y);
        };

        pushTri(v1, m12, m31, u1, u12, u31);
        pushTri(m12, v2, m23, u12, u2, u23);
        pushTri(m31, m23, v3, u31, u23, u3);
        pushTri(m12, m23, m31, u12, u23, u31);
      } else {
        newPos.push(v1.x, v1.y, v1.z, v2.x, v2.y, v2.z, v3.x, v3.y, v3.z);
        newUV.push(u1.x, u1.y, u2.x, u2.y, u3.x, u3.y);
      }
    }

    currentGeo = new THREE.BufferGeometry();
    currentGeo.setAttribute('position', new THREE.Float32BufferAttribute(newPos, 3));
    currentGeo.setAttribute('uv', new THREE.Float32BufferAttribute(newUV, 2));
  }

  const merged = mergeVertices(currentGeo, 0.05);
  merged.computeVertexNormals();

  return merged;
}

import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Modifica la geometría de la lata original existente para que el borde superior (rim)
 * pase de ser un polígono facetado de 18 lados a un círculo perfectamente suave y continuo (72 lados),
 * manteniendo el resto de la lata, sus proporciones y sus UVs intactos.
 * 
 * @param {THREE.BufferGeometry} geometry - Geometría original del FBX
 * @param {number} passes - Número de pases de subdivisión (2 = 72 segmentos radiales)
 * @returns {THREE.BufferGeometry} Geometría con el borde circular suavizado
 */
export function makeCanRimCircular(geometry, passes = 2) {
  // Trabajar sobre una copia limpia
  let currentGeo = geometry.clone();

  // Asegurar que no esté indexada temporalmente para poder subdividir los triángulos del borde limpiamente
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

      // En el FBX de la lata, la altura va a lo largo del eje Z (de 0 en la base a 165 en la tapa)
      const maxZ = Math.max(v1.z, v2.z, v3.z);

      // Si el triángulo pertenece al cuello superior o al borde (Z >= 152)
      if (maxZ >= 152) {
        // Subdivisión 1 triángulo -> 4 triángulos
        const m12 = new THREE.Vector3().addVectors(v1, v2).multiplyScalar(0.5);
        const m23 = new THREE.Vector3().addVectors(v2, v3).multiplyScalar(0.5);
        const m31 = new THREE.Vector3().addVectors(v3, v1).multiplyScalar(0.5);

        const u12 = new THREE.Vector2().addVectors(u1, u2).multiplyScalar(0.5);
        const u23 = new THREE.Vector2().addVectors(u2, u3).multiplyScalar(0.5);
        const u31 = new THREE.Vector2().addVectors(u3, u1).multiplyScalar(0.5);

        // Proyectar los puntos medios al radio circular exacto en el plano X-Y
        const projectToCircle = (va, vb, vm) => {
          const ra = Math.hypot(va.x, va.y);
          const rb = Math.hypot(vb.x, vb.y);
          // Si ambos vértices están en el mismo aro circular concéntrico
          if (Math.abs(ra - rb) < 1.8 && Math.abs(va.z - vb.z) < 1.5 && ra > 4.0) {
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
        // Mantener intacto el resto de la lata original
        newPos.push(v1.x, v1.y, v1.z, v2.x, v2.y, v2.z, v3.x, v3.y, v3.z);
        newUV.push(u1.x, u1.y, u2.x, u2.y, u3.x, u3.y);
      }
    }

    currentGeo = new THREE.BufferGeometry();
    currentGeo.setAttribute('position', new THREE.Float32BufferAttribute(newPos, 3));
    currentGeo.setAttribute('uv', new THREE.Float32BufferAttribute(newUV, 2));
  }

  // Fusionar vértices adyacentes para permitir cálculo de normales suaves continuas
  const merged = mergeVertices(currentGeo, 0.05);
  merged.computeVertexNormals();

  return merged;
}

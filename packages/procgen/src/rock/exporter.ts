/**
 * Rock Export Utilities
 *
 * Functions for exporting generated rocks to various formats.
 * Uses consolidated GLBExporter from export module.
 */

import * as THREE from "three";
import { exportToGLB as coreExportToGLB } from "../export/GLBExporter.js";

/**
 * Export options
 */
export type ExportOptions = {
  /** Filename without extension */
  filename?: string;
  /** Whether to download automatically (browser only) */
  download?: boolean;
};

/**
 * Export result
 */
export type ExportResult = {
  /** Raw data (ArrayBuffer for GLB, string for OBJ) */
  data: ArrayBuffer | string;
  /** Suggested filename with extension */
  filename: string;
  /** MIME type */
  mimeType: string;
};

/**
 * Export a mesh to GLB format
 */
export async function exportToGLB(
  mesh: THREE.Mesh,
  options: ExportOptions = {},
): Promise<ExportResult> {
  const filename = options.filename || "rock";

  const result = await coreExportToGLB(mesh, {
    filename,
    download: options.download,
  });

  return {
    data: result.data,
    filename: result.filename,
    mimeType: result.mimeType,
  };
}

/**
 * Export a mesh to OBJ format with vertex colors
 */
export function exportToOBJ(
  mesh: THREE.Mesh,
  options: ExportOptions = {},
): ExportResult {
  const geometry = mesh.geometry;
  const position = geometry.attributes.position;
  const normal = geometry.attributes.normal;
  const color = geometry.attributes.color;
  const filename = options.filename || "rock";

  let obj = "# Procedural Rock - @hyperforge/procgen/rock\n";
  obj += `# Vertices: ${position.count}\n\n`;

  // Vertices with optional colors
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i).toFixed(6);
    const y = (position.getY(i) + mesh.position.y).toFixed(6);
    const z = position.getZ(i).toFixed(6);

    if (color) {
      const r = color.getX(i).toFixed(4);
      const g = color.getY(i).toFixed(4);
      const b = color.getZ(i).toFixed(4);
      obj += `v ${x} ${y} ${z} ${r} ${g} ${b}\n`;
    } else {
      obj += `v ${x} ${y} ${z}\n`;
    }
  }

  obj += "\n";

  // Normals
  if (normal) {
    for (let i = 0; i < normal.count; i++) {
      const nx = normal.getX(i).toFixed(6);
      const ny = normal.getY(i).toFixed(6);
      const nz = normal.getZ(i).toFixed(6);
      obj += `vn ${nx} ${ny} ${nz}\n`;
    }
    obj += "\n";
  }

  // Faces
  if (geometry.index) {
    const index = geometry.index;
    for (let i = 0; i < index.count; i += 3) {
      const a = index.getX(i) + 1;
      const b = index.getX(i + 1) + 1;
      const c = index.getX(i + 2) + 1;
      if (normal) {
        obj += `f ${a}//${a} ${b}//${b} ${c}//${c}\n`;
      } else {
        obj += `f ${a} ${b} ${c}\n`;
      }
    }
  } else {
    for (let i = 0; i < position.count; i += 3) {
      const a = i + 1;
      const b = i + 2;
      const c = i + 3;
      if (normal) {
        obj += `f ${a}//${a} ${b}//${b} ${c}//${c}\n`;
      } else {
        obj += `f ${a} ${b} ${c}\n`;
      }
    }
  }

  const result: ExportResult = {
    data: obj,
    filename: `${filename}.obj`,
    mimeType: "text/plain",
  };

  if (options.download && typeof window !== "undefined") {
    downloadBlob(new Blob([obj], { type: result.mimeType }), result.filename);
  }

  return result;
}

/**
 * Download a blob as a file (browser only)
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Get geometry data as transferable arrays for workers
 */
export type GeometryData = {
  positions: Float32Array;
  normals: Float32Array;
  colors: Float32Array | null;
  indices: Uint16Array | Uint32Array | null;
};

/**
 * Extract geometry data from a mesh for serialization
 */
export function extractGeometryData(mesh: THREE.Mesh): GeometryData {
  const geometry = mesh.geometry;

  return {
    positions: geometry.attributes.position.array as Float32Array,
    normals: geometry.attributes.normal?.array as Float32Array,
    colors: (geometry.attributes.color?.array as Float32Array) ?? null,
    indices: (geometry.index?.array as Uint16Array | Uint32Array) ?? null,
  };
}

/**
 * Create a mesh from geometry data
 */
export function createMeshFromData(
  data: GeometryData,
  material?: THREE.Material,
): THREE.Mesh {
  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(data.positions, 3),
  );

  if (data.normals) {
    geometry.setAttribute("normal", new THREE.BufferAttribute(data.normals, 3));
  }

  if (data.colors) {
    geometry.setAttribute("color", new THREE.BufferAttribute(data.colors, 3));
  }

  if (data.indices) {
    geometry.setIndex(new THREE.BufferAttribute(data.indices, 1));
  }

  const mat =
    material ??
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.85,
      metalness: 0.0,
    });

  return new THREE.Mesh(geometry, mat);
}

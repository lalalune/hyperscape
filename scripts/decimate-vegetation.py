#!/usr/bin/env python3
"""
Vegetation Decimation Script for Hyperia

Uses Blender's Python API to generate optimized LOD versions of vegetation models.
Preserves vertex colors and creates multiple LOD levels.

Usage:
    blender --background --python scripts/decimate-vegetation.py -- [options]

Options:
    --input <dir>       Input directory (default: assets/vegetation)
    --output <dir>      Output directory (default: assets/vegetation-optimized)
    --lod-ratios        LOD decimation ratios (default: 1.0,0.5,0.25)
    --in-place          Overwrite original files
    --dry-run           Show what would be done

Requirements:
    - Blender 3.0+ installed and accessible via command line
    - macOS: brew install blender OR download from blender.org
    - Run: blender --background --python scripts/decimate-vegetation.py
"""

import bpy
import sys
import os
from pathlib import Path

# Parse arguments after "--"
argv = sys.argv
if "--" in argv:
    argv = argv[argv.index("--") + 1:]
else:
    argv = []

# Default configuration
CONFIG = {
    "input_dir": "assets/vegetation",
    "output_dir": "assets/vegetation-optimized",
    "lod_ratios": [1.0, 0.5, 0.25],  # LOD0=100%, LOD1=50%, LOD2=25%
    "in_place": False,
    "dry_run": False,
    "min_faces": 100,  # Don't decimate if under this
    "target_max_faces": 5000,  # Target for LOD0 if over this
}

# Parse command line arguments
i = 0
while i < len(argv):
    arg = argv[i]
    if arg == "--input" and i + 1 < len(argv):
        CONFIG["input_dir"] = argv[i + 1]
        i += 2
    elif arg == "--output" and i + 1 < len(argv):
        CONFIG["output_dir"] = argv[i + 1]
        i += 2
    elif arg == "--lod-ratios" and i + 1 < len(argv):
        CONFIG["lod_ratios"] = [float(x) for x in argv[i + 1].split(",")]
        i += 2
    elif arg == "--in-place":
        CONFIG["in_place"] = True
        i += 1
    elif arg == "--dry-run":
        CONFIG["dry_run"] = True
        i += 1
    else:
        i += 1

# Get script directory and project root
SCRIPT_DIR = Path(__file__).parent.absolute()
PROJECT_ROOT = SCRIPT_DIR.parent
INPUT_DIR = PROJECT_ROOT / CONFIG["input_dir"]
OUTPUT_DIR = PROJECT_ROOT / CONFIG["output_dir"] if not CONFIG["in_place"] else INPUT_DIR


def clear_scene():
    """Remove all objects from the scene"""
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()
    
    # Also clear orphan data
    for block in bpy.data.meshes:
        if block.users == 0:
            bpy.data.meshes.remove(block)
    for block in bpy.data.materials:
        if block.users == 0:
            bpy.data.materials.remove(block)


def import_glb(filepath):
    """Import a GLB file and return the imported objects"""
    clear_scene()
    bpy.ops.import_scene.gltf(filepath=str(filepath))
    return list(bpy.context.scene.objects)


def get_face_count(obj):
    """Get the number of faces in a mesh object"""
    if obj.type != 'MESH':
        return 0
    return len(obj.data.polygons)


def get_vertex_count(obj):
    """Get the number of vertices in a mesh object"""
    if obj.type != 'MESH':
        return 0
    return len(obj.data.vertices)


def has_vertex_colors(obj):
    """Check if mesh has vertex colors"""
    if obj.type != 'MESH':
        return False
    return len(obj.data.color_attributes) > 0


def decimate_mesh(obj, ratio, preserve_vertex_colors=True):
    """Apply decimation to a mesh object"""
    if obj.type != 'MESH':
        return False
    
    if ratio >= 1.0:
        return True  # No decimation needed
    
    # Store original data
    original_faces = get_face_count(obj)
    original_verts = get_vertex_count(obj)
    has_colors = has_vertex_colors(obj)
    
    if original_faces < CONFIG["min_faces"]:
        print(f"    Skipping {obj.name}: only {original_faces} faces")
        return True
    
    # Make sure object is active
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    
    # Add decimate modifier
    mod = obj.modifiers.new(name="Decimate", type='DECIMATE')
    mod.decimate_type = 'COLLAPSE'
    mod.ratio = ratio
    mod.use_collapse_triangulate = True
    
    # Apply the modifier
    bpy.ops.object.modifier_apply(modifier=mod.name)
    
    new_faces = get_face_count(obj)
    new_verts = get_vertex_count(obj)
    
    print(f"    Decimated {obj.name}: {original_verts} -> {new_verts} verts, {original_faces} -> {new_faces} faces ({ratio:.0%})")
    
    # Verify vertex colors preserved
    if has_colors and not has_vertex_colors(obj):
        print(f"    WARNING: Vertex colors may have been lost for {obj.name}")
    
    return True


def export_glb(filepath, objects=None):
    """Export scene or specific objects to GLB"""
    # Select objects to export
    bpy.ops.object.select_all(action='DESELECT')
    
    if objects:
        for obj in objects:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = objects[0]
    else:
        bpy.ops.object.select_all(action='SELECT')
    
    # Ensure output directory exists
    filepath.parent.mkdir(parents=True, exist_ok=True)
    
    # Export
    bpy.ops.export_scene.gltf(
        filepath=str(filepath),
        export_format='GLB',
        use_selection=True if objects else False,
        export_colors=True,  # Preserve vertex colors
        export_normals=True,
        export_materials='EXPORT',
        export_textures=True,
    )


def process_glb_file(input_path, output_dir):
    """Process a single GLB file, creating LOD variants"""
    filename = input_path.stem
    
    print(f"\nProcessing: {input_path.name}")
    
    # Import the model
    objects = import_glb(input_path)
    
    if not objects:
        print(f"  No objects found in {input_path.name}")
        return
    
    # Count total faces
    total_faces = sum(get_face_count(obj) for obj in objects if obj.type == 'MESH')
    total_verts = sum(get_vertex_count(obj) for obj in objects if obj.type == 'MESH')
    
    print(f"  Original: {total_verts} vertices, {total_faces} faces")
    
    # Check for vertex colors
    mesh_objects = [obj for obj in objects if obj.type == 'MESH']
    has_colors = any(has_vertex_colors(obj) for obj in mesh_objects)
    print(f"  Vertex colors: {'Yes' if has_colors else 'No'}")
    
    if CONFIG["dry_run"]:
        print(f"  [DRY RUN] Would create LOD variants with ratios: {CONFIG['lod_ratios']}")
        return
    
    # Generate LOD variants
    for lod_idx, ratio in enumerate(CONFIG["lod_ratios"]):
        # Re-import for each LOD (to start fresh)
        objects = import_glb(input_path)
        mesh_objects = [obj for obj in objects if obj.type == 'MESH']
        
        # Calculate actual ratio based on face count
        if total_faces > CONFIG["target_max_faces"] and ratio == 1.0:
            # Even LOD0 needs some decimation
            actual_ratio = CONFIG["target_max_faces"] / total_faces
            print(f"  LOD{lod_idx}: Adjusting ratio {ratio:.0%} -> {actual_ratio:.0%} (over target)")
        else:
            actual_ratio = ratio
        
        # Apply decimation to all mesh objects
        for obj in mesh_objects:
            decimate_mesh(obj, actual_ratio)
        
        # Export
        if len(CONFIG["lod_ratios"]) > 1:
            output_path = output_dir / f"{filename}_LOD{lod_idx}.glb"
        else:
            output_path = output_dir / f"{filename}.glb"
        
        export_glb(output_path)
        
        # Get new stats
        new_faces = sum(get_face_count(obj) for obj in mesh_objects)
        new_verts = sum(get_vertex_count(obj) for obj in mesh_objects)
        print(f"  Exported LOD{lod_idx}: {output_path.name} ({new_verts} verts, {new_faces} faces)")


def process_directory(input_dir, output_dir):
    """Process all GLB files in a directory recursively"""
    input_path = Path(input_dir)
    output_path = Path(output_dir)
    
    if not input_path.exists():
        print(f"Error: Input directory does not exist: {input_path}")
        return
    
    # Find all GLB files
    glb_files = list(input_path.rglob("*.glb"))
    
    if not glb_files:
        print(f"No GLB files found in {input_path}")
        return
    
    print(f"Found {len(glb_files)} GLB files to process")
    print(f"Input: {input_path}")
    print(f"Output: {output_path}")
    print(f"LOD ratios: {CONFIG['lod_ratios']}")
    print(f"Dry run: {CONFIG['dry_run']}")
    print("")
    
    # Process each file
    for glb_file in sorted(glb_files):
        # Maintain directory structure
        rel_path = glb_file.relative_to(input_path)
        out_dir = output_path / rel_path.parent
        
        process_glb_file(glb_file, out_dir)
    
    print(f"\nDone! Processed {len(glb_files)} files.")


def main():
    print("=" * 60)
    print("Vegetation Decimation Script")
    print("=" * 60)
    
    process_directory(INPUT_DIR, OUTPUT_DIR)


if __name__ == "__main__":
    main()

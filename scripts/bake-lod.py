#!/usr/bin/env python3
"""
LOD Baking Script for Hyperia

Generates LOD1 (low-poly) versions of vegetation and resource models using Blender.
The LOD1 models are saved alongside the originals with '_lod1' suffix.

Usage:
    blender --background --python scripts/bake-lod.py -- [options]

Options:
    --input <dir>       Input directory (default: assets/vegetation)
    --dry-run           Show what would be done without creating files
    --verbose           Show detailed progress

Output:
    For each model.glb, creates model_lod1.glb in the same directory.
    LOD1 targets ~10-20% of original vertex count depending on category.

Requirements:
    - Blender 3.0+ installed
    - macOS: brew install blender OR download from blender.org
"""

import bpy
import sys
import os
import json
from pathlib import Path
from typing import Dict, List, Tuple

# Parse arguments after "--"
argv = sys.argv
if "--" in argv:
    argv = argv[argv.index("--") + 1:]
else:
    argv = []

# Check for temp directory (decompressed meshopt files)
TEMP_DIR = os.environ.get("LOD_TEMP_DIR", "")

# Configuration
# Note: Rocks are now procedurally generated via @hyperforge/procgen/rock
# and do not need static LOD GLB files
CONFIG = {
    "dry_run": False,
    "verbose": False,
    "input_dirs": [
        "packages/server/world/assets/vegetation",
        "assets/trees",
        "assets/grass",
        "assets/models/trees",
        "assets/models/mining-rocks",
        "assets/models/mining-nodes"
    ],
    # LOD ratios by category (inferred from path)
    "lod_ratios": {
        "tree": 0.10,      # Trees: 10% (min 100 verts)
        "bush": 0.15,      # Bushes: 15% (min 50 verts)
        "rock": 0.20,      # Rocks: 20% (min 30 verts)
        "fern": 0.20,      # Ferns: 20% (min 20 verts)
        "flower": 0.30,    # Flowers: 30% (min 10 verts)
        "grass": 0.0,      # Grass: skip LOD1 (too small)
        "mushroom": 0.0,   # Mushrooms: skip LOD1 (too small)
        "ivy": 0.25,       # Ivy: 25%
        "fallen": 0.10,    # Fallen trees: 10%
        "avatar": 0.06,    # Avatars: 6% (~30K from 500K)
        "character": 0.06, # Characters: 6%
        "default": 0.15,   # Default: 15%
    },
    "min_vertices": {
        "tree": 100,
        "bush": 50,
        "rock": 30,
        "fern": 20,
        "flower": 10,
        "ivy": 20,
        "fallen": 80,
        "avatar": 5000,    # Avatars need reasonable minimum for bone deformation
        "character": 5000,
        "default": 50,
    },
    # Skip LOD1 if original is under this many vertices
    "skip_threshold": 200,
}

# Parse command line arguments
i = 0
input_files = []  # List of specific files to process
input_file_configs = []  # List of (path, level, targetPercent) tuples for multi-level mode
multi_level_mode = False

while i < len(argv):
    arg = argv[i]
    if arg == "--input" and i + 1 < len(argv):
        CONFIG["input_dirs"] = [argv[i + 1]]
        i += 2
    elif arg == "--input-list" and i + 1 < len(argv):
        # Read list of files from a text file
        # Supports two formats:
        # 1. Simple: just filepath per line
        # 2. Multi-level: filepath|level|targetPercent per line
        list_path = argv[i + 1]
        if Path(list_path).exists():
            with open(list_path, 'r') as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    if '|' in line:
                        # Multi-level format: path|level|targetPercent
                        parts = line.split('|')
                        if len(parts) >= 3:
                            input_file_configs.append({
                                'path': parts[0],
                                'level': parts[1],  # 'lod1' or 'lod2'
                                'target_percent': float(parts[2]) / 100.0  # Convert from percent to ratio
                            })
                    else:
                        input_files.append(line)
        i += 2
    elif arg == "--multi-level":
        multi_level_mode = True
        i += 1
    elif arg == "--dry-run":
        CONFIG["dry_run"] = True
        i += 1
    elif arg == "--verbose":
        CONFIG["verbose"] = True
        i += 1
    else:
        i += 1

# Get project root
SCRIPT_DIR = Path(__file__).parent.absolute()
PROJECT_ROOT = SCRIPT_DIR.parent


def log(msg: str, verbose_only: bool = False):
    """Print log message"""
    if verbose_only and not CONFIG["verbose"]:
        return
    print(msg)


def clear_scene():
    """Remove all objects from the scene"""
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()
    
    # Clear orphan data
    for block in bpy.data.meshes:
        if block.users == 0:
            bpy.data.meshes.remove(block)
    for block in bpy.data.materials:
        if block.users == 0:
            bpy.data.materials.remove(block)


def import_glb(filepath: Path) -> List:
    """Import a GLB file and return the imported objects"""
    clear_scene()
    try:
        bpy.ops.import_scene.gltf(filepath=str(filepath))
        return list(bpy.context.scene.objects)
    except RuntimeError as e:
        log(f"  ERROR: Failed to import {filepath.name}: {e}")
        return []


def get_vertex_count(obj) -> int:
    """Get the number of vertices in a mesh object"""
    if obj.type != 'MESH':
        return 0
    return len(obj.data.vertices)


def get_total_vertices(objects: List) -> int:
    """Get total vertex count across all mesh objects"""
    return sum(get_vertex_count(obj) for obj in objects if obj.type == 'MESH')


def has_vertex_colors(obj) -> bool:
    """Check if mesh has vertex colors"""
    if obj.type != 'MESH':
        return False
    return len(obj.data.color_attributes) > 0


def infer_category(filepath: Path) -> str:
    """Infer asset category from file path"""
    path_str = str(filepath).lower()
    
    # Check for avatar/character files first (VRM format)
    if "avatar" in path_str or filepath.suffix.lower() == ".vrm":
        return "avatar"
    elif "character" in path_str:
        return "character"
    elif "tree" in path_str:
        if "fallen" in path_str:
            return "fallen"
        return "tree"
    elif "bush" in path_str:
        return "bush"
    elif "rock" in path_str:
        return "rock"
    elif "fern" in path_str:
        return "fern"
    elif "flower" in path_str:
        return "flower"
    elif "grass" in path_str:
        return "grass"
    elif "mushroom" in path_str:
        return "mushroom"
    elif "ivy" in path_str:
        return "ivy"
    
    return "default"


def get_lod_config(category: str) -> Tuple[float, int]:
    """Get LOD ratio and min vertices for a category"""
    ratio = CONFIG["lod_ratios"].get(category, CONFIG["lod_ratios"]["default"])
    min_verts = CONFIG["min_vertices"].get(category, CONFIG["min_vertices"]["default"])
    return ratio, min_verts


def decimate_mesh(obj, ratio: float, min_vertices: int) -> bool:
    """Apply decimation to a mesh object"""
    if obj.type != 'MESH':
        return True
    
    if ratio <= 0 or ratio >= 1.0:
        return True  # No decimation needed
    
    original_verts = get_vertex_count(obj)
    
    if original_verts < CONFIG["skip_threshold"]:
        log(f"    Skipping {obj.name}: only {original_verts} verts", verbose_only=True)
        return True
    
    # Calculate target count
    target_verts = max(min_vertices, int(original_verts * ratio))
    actual_ratio = target_verts / original_verts
    
    # Make sure object is active
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    
    # Add decimate modifier
    mod = obj.modifiers.new(name="Decimate", type='DECIMATE')
    mod.decimate_type = 'COLLAPSE'
    mod.ratio = actual_ratio
    mod.use_collapse_triangulate = True
    
    # Apply the modifier
    bpy.ops.object.modifier_apply(modifier=mod.name)
    
    new_verts = get_vertex_count(obj)
    log(f"    {obj.name}: {original_verts} → {new_verts} verts ({actual_ratio:.1%})", verbose_only=True)
    
    return True


def export_glb(filepath: Path, objects=None):
    """Export scene or specific objects to GLB"""
    bpy.ops.object.select_all(action='DESELECT')
    
    if objects:
        for obj in objects:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = objects[0]
    else:
        bpy.ops.object.select_all(action='SELECT')
    
    # Ensure output directory exists
    filepath.parent.mkdir(parents=True, exist_ok=True)
    
    # Export - Blender 5.0+ compatible parameters
    try:
        # Try Blender 5.0+ API first
        bpy.ops.export_scene.gltf(
            filepath=str(filepath),
            export_format='GLB',
            use_selection=True if objects else False,
            export_normals=True,
            export_materials='EXPORT',
        )
    except TypeError:
        # Fallback for older Blender versions
        bpy.ops.export_scene.gltf(
            filepath=str(filepath),
            export_format='GLB',
            use_selection=True if objects else False,
            export_colors=True,
            export_normals=True,
            export_materials='EXPORT',
            export_textures=True,
        )


def process_glb_file(input_path: Path, lod_level: str = "lod1", target_ratio: float = None) -> Dict:
    """Process a single GLB file, creating LOD variant
    
    Args:
        input_path: Path to input GLB file
        lod_level: "lod1" or "lod2"
        target_ratio: Override target ratio (0.0-1.0), or None to use category defaults
    """
    filename = input_path.stem
    suffix = "_lod1" if lod_level == "lod1" else "_lod2"
    output_path = input_path.parent / f"{filename}{suffix}.glb"
    
    # Skip if already an LOD file
    if "_lod1" in filename.lower() or "_lod2" in filename.lower() or "_lod" in filename.lower():
        log(f"  Skipping {input_path.name}: already an LOD file", verbose_only=True)
        return None
    
    # Infer category and get LOD config
    category = infer_category(input_path)
    
    if target_ratio is not None:
        ratio = target_ratio
        min_verts = CONFIG["min_vertices"].get(category, CONFIG["min_vertices"]["default"])
    else:
        ratio, min_verts = get_lod_config(category)
        # For LOD2, use half the LOD1 ratio (more aggressive decimation)
        if lod_level == "lod2":
            ratio = ratio * 0.33  # LOD2 is roughly 1/3 of LOD1
            min_verts = max(20, min_verts // 2)
    
    # Skip categories that don't need this LOD level
    if ratio <= 0:
        log(f"  Skipping {input_path.name} {lod_level}: category '{category}' doesn't need {lod_level}")
        return None
    
    log(f"\nProcessing: {input_path.name} -> {lod_level}")
    log(f"  Category: {category}, Target ratio: {ratio:.0%}, Min verts: {min_verts}")
    
    # Import the model
    objects = import_glb(input_path)
    
    if not objects:
        log(f"  ERROR: No objects found in {input_path.name}")
        return None
    
    # Get original stats
    original_verts = get_total_vertices(objects)
    mesh_objects = [obj for obj in objects if obj.type == 'MESH']
    
    log(f"  Original: {original_verts} vertices")
    
    # Skip if too small (but lower threshold for LOD2)
    skip_threshold = CONFIG["skip_threshold"] if lod_level == "lod1" else CONFIG["skip_threshold"] // 2
    if original_verts < skip_threshold:
        log(f"  Skipping {lod_level}: under {skip_threshold} vertices (too small for {lod_level})")
        return None
    
    if CONFIG["dry_run"]:
        target_verts = max(min_verts, int(original_verts * ratio))
        log(f"  [DRY RUN] Would create {output_path.name} (~{target_verts} verts)")
        return {
            "input": str(input_path.relative_to(PROJECT_ROOT)),
            "output": str(output_path.relative_to(PROJECT_ROOT)),
            "category": category,
            "level": lod_level,
            "original_verts": original_verts,
            "target_verts": target_verts,
        }
    
    # Apply decimation to all mesh objects
    for obj in mesh_objects:
        decimate_mesh(obj, ratio, min_verts)
    
    # Get new stats
    new_verts = get_total_vertices(mesh_objects)
    
    # Export LOD
    export_glb(output_path)
    
    log(f"  Created: {output_path.name} ({new_verts} verts, {new_verts/original_verts:.1%})")
    
    return {
        "input": str(input_path.relative_to(PROJECT_ROOT)),
        "output": str(output_path.relative_to(PROJECT_ROOT)),
        "category": category,
        "level": lod_level,
        "original_verts": original_verts,
        "final_verts": new_verts,
    }


def process_all_directories() -> List[Dict]:
    """Process all GLB files in configured directories"""
    results = []
    
    # Build list of search directories (include temp if available)
    search_roots = [PROJECT_ROOT]
    if TEMP_DIR and Path(TEMP_DIR).exists():
        search_roots.append(Path(TEMP_DIR))
        log(f"Also searching temp directory: {TEMP_DIR}")
    
    for input_dir in CONFIG["input_dirs"]:
        for search_root in search_roots:
            input_path = search_root / input_dir
            
            if not input_path.exists():
                continue
            
            # Find all GLB files (excluding existing LOD files)
            glb_files = [
                f for f in input_path.rglob("*.glb")
                if "_lod1" not in f.stem.lower() and "_lod" not in f.stem.lower()
            ]
            
            if not glb_files:
                continue
            
            dir_label = f"{input_dir}" if search_root == PROJECT_ROOT else f"{input_dir} (temp)"
            
            log(f"\n{'='*60}")
            log(f"Processing {len(glb_files)} files in {dir_label}")
            log(f"{'='*60}")
            
            for glb_file in sorted(glb_files):
                result = process_glb_file(glb_file)
                if result:
                    results.append(result)
    
    return results


def process_input_files(files: List[str]) -> List[Dict]:
    """Process a specific list of input files (simple format - LOD1 only)"""
    results = []
    
    log(f"\n{'='*60}")
    log(f"Processing {len(files)} files from input list")
    log(f"{'='*60}")
    
    for filepath in files:
        file_path = Path(filepath)
        if not file_path.exists():
            log(f"  Skipping {filepath}: file not found")
            continue
        if "_lod1" in file_path.stem.lower() or "_lod2" in file_path.stem.lower() or "_lod" in file_path.stem.lower():
            log(f"  Skipping {filepath}: already an LOD file")
            continue
        
        result = process_glb_file(file_path, lod_level="lod1")
        if result:
            results.append(result)
    
    return results


def process_multi_level_files(configs: List[Dict]) -> List[Dict]:
    """Process files with multi-level configuration (path|level|targetPercent format)"""
    results = []
    
    log(f"\n{'='*60}")
    log(f"Processing {len(configs)} multi-level LOD operations")
    log(f"{'='*60}")
    
    for config in configs:
        filepath = config['path']
        lod_level = config['level']
        target_percent = config['target_percent']
        
        file_path = Path(filepath)
        if not file_path.exists():
            log(f"  Skipping {filepath}: file not found")
            continue
        if "_lod1" in file_path.stem.lower() or "_lod2" in file_path.stem.lower():
            log(f"  Skipping {filepath}: already an LOD file")
            continue
        
        result = process_glb_file(file_path, lod_level=lod_level, target_ratio=target_percent)
        if result:
            results.append(result)
    
    return results


def main():
    print("=" * 60)
    print("LOD Baking Script for Hyperia")
    print("=" * 60)
    print(f"Dry run: {CONFIG['dry_run']}")
    print(f"Verbose: {CONFIG['verbose']}")
    print(f"Multi-level mode: {multi_level_mode}")
    
    # Check processing mode
    if input_file_configs:
        # Multi-level format: path|level|targetPercent
        print(f"Input file configs: {len(input_file_configs)} operations")
        results = process_multi_level_files(input_file_configs)
    elif input_files:
        # Simple format: just filepaths (LOD1 only)
        print(f"Input files: {len(input_files)} files")
        results = process_input_files(input_files)
    else:
        print(f"Input directories: {CONFIG['input_dirs']}")
        results = process_all_directories()
    
    print("\n" + "=" * 60)
    print(f"Summary: Processed {len(results)} operations")
    print("=" * 60)
    
    if results:
        # Calculate totals
        total_original = sum(r.get("original_verts", 0) for r in results)
        total_final = sum(r.get("final_verts", r.get("target_verts", 0)) for r in results)
        
        if total_original > 0:
            print(f"Total vertices: {total_original:,} → {total_final:,} ({total_final/total_original:.1%})")
        
        # Group by level
        by_level = {}
        for r in results:
            level = r.get("level", "lod1")
            if level not in by_level:
                by_level[level] = []
            by_level[level].append(r)
        
        print("\nBy LOD level:")
        for level, items in sorted(by_level.items()):
            print(f"  {level}: {len(items)} files")
        
        # Group by category
        by_category = {}
        for r in results:
            cat = r["category"]
            if cat not in by_category:
                by_category[cat] = []
            by_category[cat].append(r)
        
        print("\nBy category:")
        for cat, items in sorted(by_category.items()):
            print(f"  {cat}: {len(items)} files")
    
    print("\nDone!")


if __name__ == "__main__":
    main()

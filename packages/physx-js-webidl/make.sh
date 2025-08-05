#!/bin/bash

# Unified build script for PhysX WebIDL bindings
# Supports multiple build types and generates TypeScript definitions
# Usage: ./make.sh [release|debug|profile|all] (default: release)

BUILD_TYPE=${1:-release}

# Auto-detect EMSDK if not set
if [ -z "$EMSDK" ]; then
    # Try common locations
    if [ -d "/opt/homebrew/Cellar/emscripten" ]; then
        # Find the latest version on macOS with Homebrew
        EMSDK=$(find /opt/homebrew/Cellar/emscripten -name "libexec" -type d | sort -V | tail -1)
    elif [ -d "/usr/local/lib/emscripten" ]; then
        EMSDK="/usr/local/lib/emscripten"
    elif [ -d "$HOME/emsdk" ]; then
        EMSDK="$HOME/emsdk"
    fi
    
    if [ -z "$EMSDK" ]; then
        echo "Error: EMSDK not found. Please set EMSDK environment variable or install emscripten."
        exit 1
    fi
    
    export EMSDK
    echo "Auto-detected EMSDK at: $EMSDK"
fi

# Function to generate project files
generate_projects() {
    echo "Generating PhysX project files..."
    cd ./PhysX/physx
    rm -rf compiler/emscripten-*
    ./generate_projects.sh emscripten
    cd ../..
}

# Function to generate TypeScript definitions
generate_types() {
    if [ -f "types/generate_types.sh" ]; then
        echo "Generating TypeScript type definitions..."
        cd types
        chmod +x generate_types.sh
        ./generate_types.sh
        cd ..
    fi
}

# Function to build specific configuration
build_config() {
    local config=$1
    local output_suffix=$2
    local emcc_flags=$3
    
    echo "Building $config configuration..."
    cd PhysX/physx/compiler/emscripten-$config/
    
    # Clean previous builds
    rm -f sdk_source_bin/physx-js-webidl.*
    
    # Set environment flags for the build
    export EMSCRIPTEN_FLAGS="$emcc_flags"
    
    # Build
    make -j8
    
    # Create dist directory if it doesn't exist
    mkdir -p ../../../../dist/
    
    # Copy build artifacts
    if [ -f "sdk_source_bin/physx-js-webidl.js" ] && [ -f "sdk_source_bin/physx-js-webidl.wasm" ]; then
        if [ -z "$output_suffix" ]; then
            # Release build - no suffix
            cp sdk_source_bin/physx-js-webidl.js ../../../../dist/
            cp sdk_source_bin/physx-js-webidl.wasm ../../../../dist/
        else
            # Debug/Profile builds - with suffix
            cp sdk_source_bin/physx-js-webidl.js ../../../../dist/physx-js-webidl.$output_suffix.js
            cp sdk_source_bin/physx-js-webidl.wasm ../../../../dist/physx-js-webidl.$output_suffix.wasm
        fi
        echo "Build artifacts copied to dist/"
    else
        echo "Error: Build artifacts not found in sdk_source_bin/"
        exit 1
    fi
    
    cd ../../../..
}

# Main build process
echo "PhysX WebIDL Build Script"
echo "========================="
echo "Build type: $BUILD_TYPE"
echo ""

# Always generate projects first
generate_projects

# Always generate types
generate_types

# Copy TypeScript definitions to dist
if [ -f "types/physx-js-webidl.d.ts" ]; then
    mkdir -p dist/
    cp types/physx-js-webidl.d.ts dist/
    echo "TypeScript definitions copied to dist/"
elif [ -f "dist/physx-js-webidl.d.ts" ]; then
    echo "TypeScript definitions already in dist/"
else
    echo "Warning: TypeScript definitions not found"
fi

# Base flags for all builds - supports web, worker, and node environments
BASE_FLAGS="-s ENVIRONMENT='web,worker,node' -s EXPORT_ES6=1 -s MODULARIZE=1 -s USE_ES6_IMPORT_META=0 -s ALLOW_MEMORY_GROWTH=1"

# Build based on requested type
case $BUILD_TYPE in
    debug)
        build_config "debug" "debug" "$BASE_FLAGS -g3 -O0 -s ASSERTIONS=2 -s SAFE_HEAP=1 -s STACK_OVERFLOW_CHECK=1"
        ;;
    profile)
        build_config "profile" "profile" "$BASE_FLAGS -O2 --profiling-funcs -g2"
        ;;
    release)
        build_config "release" "" "$BASE_FLAGS -O3"
        ;;
    all)
        # Build all configurations
        build_config "release" "" "$BASE_FLAGS -O3"
        build_config "debug" "debug" "$BASE_FLAGS -g3 -O0 -s ASSERTIONS=2 -s SAFE_HEAP=1 -s STACK_OVERFLOW_CHECK=1"
        build_config "profile" "profile" "$BASE_FLAGS -O2 --profiling-funcs -g2"
        ;;
    *)
        echo "Unknown build type: $BUILD_TYPE"
        echo "Usage: $0 [release|debug|profile|all]"
        exit 1
        ;;
esac

echo ""
echo "Build completed successfully!"
echo "Output files in dist/:"
ls -la dist/physx-js-webidl*
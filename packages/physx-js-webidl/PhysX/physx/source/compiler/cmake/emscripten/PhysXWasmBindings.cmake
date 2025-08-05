#
# Build emscripten/WASM Bindings
#

FIND_PACKAGE(Python3)
SET(PYTHON ${Python3_EXECUTABLE} CACHE STRING "Python path")
SET(EMSCRIPTEN_ROOT $ENV{EMSDK}/upstream/emscripten CACHE STRING "Emscripten path")
SET(CMAKE_TOOLCHAIN_FILE ${EMSCRIPTEN_ROOT}/cmake/Modules/Platform/Emscripten.cmake)
SET(WEBIDL_BINDER_SCRIPT ${EMSCRIPTEN_ROOT}/tools/webidl_binder.py)

SET(PHYSX_SOURCE_DIR ${PHYSX_ROOT_DIR}/source)
SET(PHYSX_WASM_SOURCE_DIR ${PHYSX_SOURCE_DIR}/webidlbindings/src)

SET(PHYSXWASM_INCLUDE_DIR ${PHYSX_ROOT_DIR}/include)
SET(PHYSXWASM_GLUE_WRAPPER ${PHYSX_WASM_SOURCE_DIR}/wasm/PhysXWasm.cpp)
SET(PHYSXWASM_IDL_FILE ${PHYSX_WASM_SOURCE_DIR}/wasm/PhysXWasm.idl)
SET(EMCC_WASM_ARGS
		--post-js glue.js
		--post-js ${PHYSX_WASM_SOURCE_DIR}/wasm/onload.js
		-s MODULARIZE=1
		-s EXPORT_NAME=PhysX
		-s ENVIRONMENT=web,worker,node
		-s NO_FILESYSTEM=1
		-s ALLOW_TABLE_GROWTH=1
		-s ALLOW_MEMORY_GROWTH=1
		-s TOTAL_MEMORY=268435456
		-s EXPORTED_RUNTIME_METHODS=ccall,cwrap,HEAPF32,HEAPU8,HEAPU16,HEAPU32,HEAP32
		${WASM_EXPORTED_FUNCTIONS}
		${PHYSX_WASM_PTHREAD}
		${PHYSX_WASM_THREAD_POOL_SZ}
)

SET(EMCC_GLUE_ARGS
		-c
		-DNDEBUG
		${PHYSX_WASM_PTHREAD}
		-I${PHYSXWASM_INCLUDE_DIR}
		# Include the current binary directory where glue.cpp is generated
		-I${CMAKE_CURRENT_BINARY_DIR}
)

ADD_CUSTOM_COMMAND(
		OUTPUT glue.cpp glue.js
		BYPRODUCTS parser.out WebIDLGrammar.pkl
		COMMAND ${PYTHON} ${WEBIDL_BINDER_SCRIPT} ${PHYSXWASM_IDL_FILE} glue
		DEPENDS ${PHYSXWASM_IDL_FILE}
		COMMENT "Generating physx-js-webidl bindings"
		VERBATIM
)

ADD_CUSTOM_COMMAND(
		OUTPUT glue.o
		COMMAND emcc ${PHYSXWASM_GLUE_WRAPPER} ${EMCC_GLUE_ARGS} -o glue.o
		DEPENDS glue.cpp
		COMMENT "Building physx-js-webidl bindings"
		VERBATIM
)
ADD_CUSTOM_TARGET(physx-js-bindings ALL DEPENDS glue.js glue.o)

SET(PHYSX_TARGETS PhysX PhysXCharacterKinematic PhysXCommon PhysXCooking PhysXExtensions PhysXFoundation PhysXVehicle2 PhysXPvdSDK)
FOREACH(_TARGET ${PHYSX_TARGETS})
	LIST(APPEND PHYSX_LIBS $<TARGET_FILE:${_TARGET}>)
ENDFOREACH()

ADD_CUSTOM_COMMAND(
		OUTPUT ${CMAKE_CURRENT_BINARY_DIR}/sdk_source_bin/physx-js-webidl.js ${CMAKE_CURRENT_BINARY_DIR}/sdk_source_bin/physx-js-webidl.wasm
		COMMAND ${CMAKE_COMMAND} -E make_directory ${CMAKE_CURRENT_BINARY_DIR}/sdk_source_bin
		COMMAND emcc glue.o ${PHYSX_LIBS} ${EMCC_WASM_ARGS} -o ${CMAKE_CURRENT_BINARY_DIR}/sdk_source_bin/physx-js-webidl.js
		DEPENDS physx-js-bindings ${PHYSX_TARGETS}
		COMMENT "Building physx-js-webidl webassembly"
		VERBATIM
)
ADD_CUSTOM_TARGET(PhysXWasmBindings ALL DEPENDS ${CMAKE_CURRENT_BINARY_DIR}/sdk_source_bin/physx-js-webidl.js ${CMAKE_CURRENT_BINARY_DIR}/sdk_source_bin/physx-js-webidl.wasm)

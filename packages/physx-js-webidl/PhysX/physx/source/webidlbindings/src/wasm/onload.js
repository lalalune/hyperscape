/**
 * Makes the API a little less verbose
 */
Object.defineProperty(Module, 'PHYSICS_VERSION', { get() { return Module.PxTopLevelFunctions.prototype.PHYSICS_VERSION; }});

//Move PxTopLevelFunctions to PhysX object
for(const prop in Module.PxTopLevelFunctions.prototype) {
    if(prop !== 'constructor' && !prop.startsWith('get_') && !prop.startsWith('__')) {
        Object.defineProperty(Module, prop, { get() { return Module.PxTopLevelFunctions.prototype[prop]; }});
    }
}

//Move NativeArrayHelpers to PhysX object
for(const prop in Module.NativeArrayHelpers.prototype) {
    if(prop !== 'constructor' && !prop.startsWith('get_') && !prop.startsWith('__')) {
        Object.defineProperty(Module, prop, { get() { return Module.NativeArrayHelpers.prototype[prop]; }});
    }
}

//Group enums
const regex = /_emscripten_enum_(.*?)_(.*)/;
const enums = Object.keys(Module).filter(key => key.includes('_emscripten_enum_')).map(emscript => emscript.match(regex));

for (const [emscript, enumName, entryName] of enums) {
    Module[enumName] ??= {};
    Object.defineProperty(Module[enumName], entryName, { get() { return Module[emscript](); }});
}
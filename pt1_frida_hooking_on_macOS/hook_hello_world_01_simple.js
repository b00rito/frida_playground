// reminder: load the utils.js
const moduleName = 'hello_world.c.bin'
const targetFuncName = 'checkValueA'

const module = Process.getModuleByName(moduleName)
const targetFuncPtr = module.getSymbolByName(targetFuncName)

console.log("[+]", targetFuncName, "found at:", targetFuncPtr);
console.log("[*] Before:");
logInsn(targetFuncPtr, 1);
logInsn(targetFuncPtr.add(0x4), 1);
logInsn(targetFuncPtr.add(0x8), 1);

try {
    Interceptor.replace(targetFuncPtr, new NativeCallback(function () {
        return 1;
    }, 'bool', []));

    console.log("[*] replace() returned normally");
} catch (e) {
    console.log("[!] replace() threw:", e);
}

console.log("[*] After:");
logInsn(targetFuncPtr, 1);
logInsn(targetFuncPtr.add(0x4), 1);
logInsn(targetFuncPtr.add(0x8), 1);

// EOF

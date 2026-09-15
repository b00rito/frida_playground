const moduleName = 'hello_world.c.bin'
const targetFuncName = 'checkValueA'

const module = Process.getModuleByName(moduleName)
const targetFuncPtr = module.getSymbolByName(targetFuncName)

const printfPtr = Module.getGlobalExportByName("printf");
const exitPtr = Module.getGlobalExportByName("exit");

const exitFn = new NativeFunction(exitPtr, 'void', ['int']);

console.log("[+]", targetFuncName, "found at:", targetFuncPtr);
console.log("[+] printf() found at:", printfPtr);
console.log("[+] exit() found at:", exitPtr);

Interceptor.replace(targetFuncPtr, new NativeCallback(function () {
    return 1;
}, 'bool', []));

console.log("[*] replace() returned normally");

Interceptor.attach(printfPtr, {
    onEnter(args) {
        // Stash the format string for onLeave
        this.fmt = args[0].readUtf8String();
    },
    onLeave(retval) {
        if (this.fmt && this.fmt.includes(':)')) {
            console.log("[*] :) printed once - exiting with status 0x14");
            exitFn(0x14);
        }
    }
});

// EOF

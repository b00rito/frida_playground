const moduleName = 'hello_world.c.bin'
const targetFuncName = 'checkValueA'

const module = Process.getModuleByName(moduleName)
const targetFuncPtr = module.getSymbolByName(targetFuncName)

const printfPtr = Module.getGlobalExportByName("printf");
const sleepPtr = Module.getGlobalExportByName("sleep");

let smileyPrinted = false;

console.log("[+]", targetFuncName, "found at:", targetFuncPtr);
console.log("[+] printf() found at:", printfPtr);
console.log("[+] sleep() found at:", sleepPtr);

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
        if (this.fmt && this.fmt.includes(':)') && !smileyPrinted) {
            smileyPrinted = true;
            console.log("[*] :) printed once - proceed to patching");
        }
    }
});

Interceptor.attach(sleepPtr, {
    onEnter(args) {
        // Stash the return address
        this.retAddr = this.returnAddress;
        console.log("[*] sleep(" + args[0].toInt32() + ") called and will return to", this.retAddr);

        if (!smileyPrinted) {
            return;
        }

        console.log("[*] lr at sleep() call:", this.context.lr);
    },
    onLeave(retval) {
        // smiley not printed yet
        if (!smileyPrinted) {
            return;
        }

        console.log("[*] Patching back-branch at", this.retAddr, "to RET");

        Memory.patchCode(this.retAddr, 4, code => {
            new Arm64Writer(code, { pc: this.retAddr }).putRet();
        });

        console.log("[*] After:");
        logInsn(this.retAddr, 1);
        console.log("[*] Loop will break and return");
    }
});

// EOF

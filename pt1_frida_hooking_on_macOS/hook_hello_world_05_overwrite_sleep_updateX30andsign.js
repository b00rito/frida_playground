const moduleName = 'hello_world.c.bin'
const targetFuncName = 'checkValueA'

const module = Process.getModuleByName(moduleName)
const targetFuncPtr = module.getSymbolByName(targetFuncName)

const printfPtr = Module.getGlobalExportByName("printf");
const sleepPtr = Module.getGlobalExportByName("sleep");

let smileyPrinted = false;
let armed = false;

console.log("[+]", targetFuncName, "found at:", targetFuncPtr);
console.log("[+] printf() found at:", printfPtr);
console.log("[+] sleep() found at:", sleepPtr);

// `start` is NOT in dyld's export table; use the local symbol table
const dyld = Process.getModuleByName('dyld');
const startFuncAddr = dyld.enumerateSymbols().filter(s => s.name === 'start')[0].address;
console.log("[+] dyld 'start' found at:", startFuncAddr, "(dyld base:", dyld.base, ")");

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
        if (!smileyPrinted || armed) {
            return;
        }

        armed = true;
        const mainFp = this.context.fp;
        this.mainReturnAddr = mainFp.add(0x8).readPointer();    // start's address
        this.callerFp = mainFp.readPointer();
        this.mainSp = mainFp.add(0x10);

        console.log("[*] onEnter - X30 (LR) original:", this.context.lr);

        this.context.lr = this.mainReturnAddr;      // before pacibsp

        console.log("[*] onEnter - X30 (LR) updated:", this.context.lr);
    },
    onLeave(retval) {
        if (this.mainSp === undefined) {
            console.log("[*] mainSP undefined");
            return;
        }

        console.log("[*] onLeave - X30 (LR):", this.context.lr);
        console.log("[*] ---");
        console.log("[*] onLeave - SP:", this.context.sp);
        console.log("[*] onLeave - FP:", this.context.fp);

        this.context.sp = this.mainSp;
        this.context.fp = this.callerFp;

        console.log("[*] onLeave - new SP:", this.context.sp);
        console.log("[*] onLeave - new FP:", this.context.fp);
    }
});

// EOF

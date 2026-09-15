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

// sleep's prologue
console.log("[*] sleep prologue:");
logInsn(sleepPtr, 1);
logInsn(sleepPtr.add(0x4), 1);
logInsn(sleepPtr.add(0x8), 1);

function findRetab(funcStart, maxInsns) {
    let p = funcStart;

    for (let i = 0; i < maxInsns; i++) {
        const insn = Instruction.parse(p);

        if (insn.mnemonic === 'retab' || insn.mnemonic === 'retaa') {
            return insn.address;
        }
        p = insn.next;
    }
    throw new Error('retab not found');
}

const retabAddr = findRetab(sleepPtr, 60);
console.log("[+] sleep()'s retab found. Before patching:");
logInsn(retabAddr, 1);

// `start` is NOT in dyld's export table; use the local symbol table
const dyld = Process.getModuleByName('dyld');
const startFuncAddr = dyld.enumerateSymbols().filter(s => s.name === 'start')[0].address;
console.log("[+] dyld 'start' found at:", startFuncAddr, "(dyld base:", dyld.base, ")");

// Patch sleep's pacibsp -> nop and retab -> ret before the Interceptor
// installs its trampoline.
console.log("[*] sleep's first insn before patch:");
logInsn(sleepPtr, 1);
logInsn(sleepPtr.add(0x4), 1);
logInsn(sleepPtr.add(0x8), 1);

Memory.patchCode(sleepPtr, 4, code => {
    new Arm64Writer(code, { pc: sleepPtr }).putNop();
});

console.log("[*] pacibsp -> nop done:");
logInsn(sleepPtr, 1);
logInsn(sleepPtr.add(0x4), 1);
logInsn(sleepPtr.add(0x8), 1);

Memory.patchCode(retabAddr, 4, code => {
    new Arm64Writer(code, { pc: retabAddr }).putRet();
});

console.log("[*] retab -> ret done:");
logInsn(retabAddr, 1);

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
        if (!smileyPrinted) {
            return;
        }

        // x30 before sleep's prologue. This is the loop's back-branch
        // address, which segfaults the ret-only patch
        console.log("[*] sleep() onEnter - x30 (lr):", this.context.lr);
        console.log("[*] Disassembling this address (main's back-branch):")
        logInsn(this.context.lr, 1);

        const mainFp = this.context.fp;
        this.mainReturnAddr = mainFp.add(0x8).readPointer();      // start's address
        this.callerFp = mainFp.readPointer();
        this.mainSp = mainFp.add(0x10);
        this.shouldRedirect = true;

        // start's body; where main is called
        console.log("[*] target lr (main's real caller):", this.mainReturnAddr);
        logInsn(this.mainReturnAddr.sub(4), 1);
        logInsn(this.mainReturnAddr, 1);

        if (startFuncAddr <= this.mainReturnAddr) {
            // const startOffset = this.mainReturnAddr.sub(startFuncAddr).toInt32();

            // console.log("[*] start's start address is before main's jump-back");
            // console.log("[*] offset from dyld 'start':", startOffset, "bytes");
        }

        // console.log("[*] target sp:", this.mainSp, "target fp:", this.callerFp);
        console.log("[*] mains's stack:", mainFp, "to", this.mainSp);
    },
    onLeave(retval) {
        if (!this.shouldRedirect) {
            return;
        }

        // sleep's epilogue has run by now, so x30 is what was reloaded
        // from its stack frame; the signed return address.
        console.log("[*] onLeave - x30 (lr) before we touch it:", this.context.lr);

        this.context.lr = this.mainReturnAddr;
        this.context.sp = this.mainSp;
        this.context.fp = this.callerFp;

        console.log("[*] onLeave - x30 (lr) after we set it:", this.context.lr);
        console.log("[*] sp now:", this.context.sp, "fp now:", this.context.fp);
    }
});

// EOF

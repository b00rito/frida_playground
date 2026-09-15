const moduleName = 'hello_world.c.bin'
const targetFuncName = 'checkValueA'

const module = Process.getModuleByName(moduleName)
const mainPtr = module.getSymbolByName('main')
const targetFuncPtr = module.getSymbolByName(targetFuncName)

const printfPtr = Module.getGlobalExportByName("printf");
const sleepPtr = Module.getGlobalExportByName("sleep");

let smileyPrinted = false;
let patched = false;

console.log("[+] main found at:", mainPtr);
console.log("[+]", targetFuncName, "found at:", targetFuncPtr);
console.log("[+] printf() found at:", printfPtr);
console.log("[+] sleep() found at:", sleepPtr);

// Find main's loop back-branch; the `b` instruction
function findBackBranch(funcStart, maxInsns) {
    let p = funcStart;

    for (let i = 0; i < maxInsns; i++) {
        const insn = Instruction.parse(p);

        if (insn.mnemonic === 'b') {
            const target = ptr(insn.opStr.replace('#', ''));

            if (target.compare(insn.address) < 0) {
                return insn.address;
            }
        }
        p = insn.next;
    }
    throw new Error('back-branch not found');
}

const backBranchAddr = findBackBranch(mainPtr, 30);

console.log("[*] main's loop back-branch:", backBranchAddr);
logInsn(backBranchAddr, 1);

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
        if (!smileyPrinted || patched) {
            return;
        }

        patched = true;

        const mainFp = this.context.fp;
        const mainReturnAddr = mainFp.add(8).readPointer();
        const callerFp = mainFp.readPointer();
        const mainSp = mainFp.add(0x10);

        console.log("[*] target:", mainReturnAddr, "sp:", mainSp, "fp:", callerFp);
        console.log("[*] mainFp:", mainFp);

        const trampoline = Memory.alloc(64);
        const w = new Arm64Writer(trampoline, { pc: trampoline });

        w.putLdrRegAddress('x16', mainReturnAddr);
        w.putLdrRegAddress('x17', callerFp);
        w.putMovRegReg('x29', 'x17');
        w.putLdrRegAddress('x17', mainSp);
        w.putMovRegReg('sp', 'x17');
        w.putBrReg('x16');
        w.flush();

        // probably problematic
        // Memory.protect(trampoline, 64, 'rx');

        console.log("[*] trampoline written at:", trampoline);
        logInsn(trampoline, 1);
        logInsn(trampoline.add(0x4), 1);
        logInsn(trampoline.add(0x8), 1);
        logInsn(trampoline.add(0xc), 1);
        logInsn(trampoline.add(0x10), 1);
        logInsn(trampoline.add(0x14), 1);

        Memory.patchCode(backBranchAddr, 4, code => {
            new Arm64Writer(code, { pc: backBranchAddr }).putBImm(trampoline);
        });

        console.log("[*] main's back-branch redirected to trampoline");
    }
});

// EOF

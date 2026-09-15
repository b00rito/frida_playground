const moduleName = 'hello_world.c.bin'
const targetFuncName = 'checkValueA'

const module = Process.getModuleByName(moduleName)
const targetFuncPtr = module.getSymbolByName(targetFuncName)

const mainPtr = Module.getGlobalExportByName("main");
const printfPtr = Module.getGlobalExportByName("printf");
const sleepPtr = Module.getGlobalExportByName("sleep");

let smileyPrinted = false;

console.log("[+] main() found at:", mainPtr);
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

let mainReturnAddr = null;
let callerFp = null;
let mainSp = null;

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
            console.log("[*] :) printed once - starting Stalker.follow");

            // create a stalker
            Stalker.follow(Process.getCurrentThreadId(), {
                transform(iterator) {
                    let insn;

                    while ((insn = iterator.next()) !== null) {
                        // logInsn(insn.address, 1, true);

                        if (insn.address.equals(sleepPtr)) {
                            iterator.putCallout(context => {
                                console.log("[*] stalker @ sleep entry - X30:", context.lr);

                                const mainFp = context.fp;
                                mainReturnAddr = mainFp.add(8).readPointer();
                                callerFp = mainFp.readPointer();
                                mainSp = mainFp.add(0x10);

                                // set X30 before pacibsp runs
                                context.lr = mainReturnAddr;

                                console.log("[*] stalker @ sleep entry - updated X30 before pacibsp:", context.lr);
                                console.log("[*] stalker @ sleep entry - target SP:", mainSp, "target FP:", callerFp);
                            });
                        } else if (insn.address.equals(retabAddr)) {
                            iterator.putCallout(context => {
                                if (mainReturnAddr === null) {
                                    return;
                                }

                                console.log("[*] stalker @ retab - X30:", context.lr);

                                context.sp = mainSp;
                                context.fp = callerFp;
                                
                                console.log("[*] stalker @ retab - target SP:", context.sp, "target FP:", context.fp);

                                Stalker.unfollow(Process.getCurrentThreadId());
                            });
                        }
                        iterator.keep();
                    }
                }
            });
        }
    }
});

// EOF

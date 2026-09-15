const moduleName = 'hello_world.c.bin'

const module = Process.getModuleByName(moduleName)
const mainPtr = module.getSymbolByName('main')
const checkValueAPtr = module.getSymbolByName('checkValueA')
const checkValueCPtr = module.getSymbolByName('checkValueC')

console.log("[+] main found at:", mainPtr);
console.log("[+] checkValueA found at:", checkValueAPtr);
console.log("[+] checkValueC found at:", checkValueCPtr);

// walk main's instructions looking for the `bl` that targets funcPtr
function findCallSite(funcStart, targetPtr, maxInsns) {
    let p = funcStart;

    for (let i = 0; i < maxInsns; i++) {
        const insn = Instruction.parse(p);

        if (insn.mnemonic === 'bl' && ptr(insn.opStr.replace('#', '')).equals(targetPtr)) {
            return insn.address;
        }
        p = insn.next;
    }
    throw new Error('call site not found');
}

const callSite = findCallSite(mainPtr, checkValueAPtr, 20);

console.log("[+] bl checkValueA found at:", callSite);

// keep checkValueC body intact and only override what it returns
Interceptor.attach(checkValueCPtr, {
    onLeave(retval) {
        console.log("[*] checkValueC initial return value:", retval, "- forcing true");

        retval.replace(1);
    }
});

// patch the call site in main() to call checkValueC
Memory.patchCode(callSite, 4, code => {
    new Arm64Writer(code, { pc: callSite }).putBlImm(checkValueCPtr);
});

console.log("[*] call site patched: checkValueC replaced checkValueA");

// EOF

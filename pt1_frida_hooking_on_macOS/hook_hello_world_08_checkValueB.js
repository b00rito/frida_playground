const moduleName = 'hello_world.c.bin'

const module = Process.getModuleByName(moduleName)
const mainPtr = module.getSymbolByName('main')
const checkValueAPtr = module.getSymbolByName('checkValueA')
const checkValueBPtr = module.getSymbolByName('checkValueB')

console.log("[+] main found at:", mainPtr);
console.log("[+] checkValueA found at:", checkValueAPtr);
console.log("[+] checkValueB found at:", checkValueBPtr);

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

// patch the call site in main() to call checkValueB
Memory.patchCode(callSite, 4, code => {
    new Arm64Writer(code, { pc: callSite }).putBlImm(checkValueBPtr);
});

console.log("[*] call site patched; checkValueB replaced checkValueA");

// EOF

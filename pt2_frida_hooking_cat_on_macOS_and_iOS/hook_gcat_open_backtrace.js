// Diagnostic variant of hook_gcat_open.js: instead of just logging the
// path, it names the code that actually made each open() call.
//
// NOTE: DebugSymbol.fromAddress() makes the symbolicator open debug files
// itself, so this script shows up in its own output. Instrumentation that
// perturbs what it measures - keep it in mind when reading the results.
const openPtr = Module.getGlobalExportByName("open");

console.log("[+] open() found at:", openPtr);

Interceptor.attach(openPtr, {
    onEnter(args) {
        this.path = args[0].readUtf8String();

        const retAddr = this.returnAddress;
        const mod = Process.findModuleByAddress(retAddr);

        console.log("\n========================================");
        console.log("[*] open(\"" + this.path + "\")");
        console.log("    immediate caller: " + (mod ? mod.name : "??") + "  @ " + retAddr);

        try {
            const bt = Thread.backtrace(this.context, Backtracer.ACCURATE);
            console.log("    --- backtrace ---");

            bt.forEach(a => {
                const m = Process.findModuleByAddress(a);
                console.log("      " + (m ? m.name : "??") + "  " + DebugSymbol.fromAddress(a));
            });
        } catch (e) {
            console.log("    backtrace failed: " + e.message);
        }
    }
});

// EOF

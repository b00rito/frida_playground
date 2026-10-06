const writePtr = Module.getGlobalExportByName("write");
const CORRUPTION_RATE = 0.1;    // 10% of bytes get mutated

console.log("[+] write() found at:", writePtr);

Interceptor.attach(writePtr, {
    onEnter(args) {
        const buf = args[1];
        const total = args[2].toInt32();
        let corrupted = 0;

        for (let i = 0; i < total; i++) {
            if (Math.random() < CORRUPTION_RATE) {
                buf.add(i).writeU8(Math.floor(Math.random() * 256));
                corrupted++;
            }
        }

        if (corrupted > 0) {
            console.log("[*] write() - corrupted", corrupted, "/", total, "bytes on the way out");
        }
    }
});

// EOF

const fstatPtr = Module.getGlobalExportByName("fstat");
const readPtr = Module.getGlobalExportByName("read");
const writePtr = Module.getGlobalExportByName("write");

console.log("[+] fstat() found at:", fstatPtr);
console.log("[+] read() found at:", readPtr);
console.log("[+] write() found at:", writePtr);

Interceptor.attach(fstatPtr, {
    onLeave(retval) {
        console.log("[*] fstat() ->", retval);
    }
});

Interceptor.attach(readPtr, {
    onEnter(args) {
        this.requested = args[2].toInt32();
    },
    onLeave(retval) {
        console.log("[*] read(requested=" + this.requested + ") ->", retval);
    }
});

Interceptor.attach(writePtr, {
    onEnter(args) {
        this.requested = args[2].toInt32();
    },
    onLeave(retval) {
        console.log("[*] write(requested=" + this.requested + ") ->", retval);
    }
});

// EOF

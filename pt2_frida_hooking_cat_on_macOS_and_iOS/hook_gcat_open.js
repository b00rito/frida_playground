const openPtr = Module.getGlobalExportByName("open");

console.log("[+] open() found at:", openPtr);

Interceptor.attach(openPtr, {
    onEnter(args) {
        this.path = args[0].readUtf8String();
    },
    onLeave(retval) {
        console.log("[*] open(\"" + this.path + "\") ->", retval);
    }
});

// EOF

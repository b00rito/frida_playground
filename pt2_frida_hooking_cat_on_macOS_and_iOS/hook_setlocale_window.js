let depth = 0;

Interceptor.attach(Module.getGlobalExportByName("libintl_setlocale"), {
    onEnter(args) {
        depth++;
        console.log(">>> libintl_setlocale() ENTER");
    },
    onLeave(retval) {
        console.log("<<< libintl_setlocale() LEAVE");
        depth--;
    }
});

Interceptor.attach(Module.getGlobalExportByName("open"), {
    onEnter(args) {
        this.path = args[0].readUtf8String();
    },
    onLeave(retval) {
        const where = (depth > 0) ? "INSIDE setlocale" : "outside";
        console.log("    open(\"" + this.path + "\") -> " + retval.toInt32()
                    + "   [" + where + "]");
    }
});

// EOF

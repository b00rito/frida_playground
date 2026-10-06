// open() is also called by the OS during process launch (self-binary
// validation, bundle probing), so redirecting every call corrupts those.
// Match only the file we were actually asked to print - read out of the
// target's own argv - and take the joke file from frida's -P parameters:
//
//   frida -f <cat> -l hook_gcat_confused.js \
//       -P '{"jokePath":"/abs/path/to/always_this.txt"}' -- <file>

function fileArg() {
    const getArgv = new NativeFunction(Module.getGlobalExportByName('_NSGetArgv'), 'pointer', []);
    const argv = getArgv().readPointer();

    // argv is NULL-terminated, so argc isn't needed. Skip argv[0] (the
    // program itself) and any flags; the first plain word is the file.
    for (let i = 1; ; i++) {
        const slot = argv.add(i * Process.pointerSize).readPointer();

        if (slot.isNull()) {
            return null;
        }

        const arg = slot.readUtf8String();

        if (!arg.startsWith('-')) {
            return arg;
        }
    }
}

// frida-tools calls init() with whatever -P supplied, before the spawned
// process is resumed - so the hook lands in time.
rpc.exports.init = function (stage, params) {
    const jokePath = params && params.jokePath;
    const target = fileArg();

    if (!jokePath || !target) {
        console.log("[!] need a file argument and -P '{\"jokePath\":\"/abs/path\"}'");
        return;
    }

    const jokePathNative = Memory.allocUtf8String(jokePath);

    console.log("[+] redirecting", target, "->", jokePath);

    Interceptor.attach(Module.getGlobalExportByName("open"), {
        onEnter(args) {
            if (args[0].readUtf8String() !== target) {
                return;
            }

            console.log("[*] open(\"" + target + "\") - redirected to the joke file");
            args[0] = jokePathNative;
        }
    });
};

// EOF

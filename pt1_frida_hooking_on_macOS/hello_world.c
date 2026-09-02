// clang -o hello_world.c.bin hello_world.c -O0
#include <stdio.h>
#include <unistd.h>

int checkValueA() {
    return 0;
}

int checkValueB() {
    return 1;
}

int checkValueC(uint32_t input) {
    uint32_t res = input << 2;

    printf("[+] Calculation is: %d\n", res);

    return (res & 0xdeadbeef);
}

int
main()
{
    printf("[+] PID: %d\n", getpid());

    while (1) {
        int result = checkValueA();

        if (result) {
            printf("\t:)\n");
        } else {
            printf("\t:(\n");
        }

        sleep(2);
    }

    return 0x14;
}

// EOF

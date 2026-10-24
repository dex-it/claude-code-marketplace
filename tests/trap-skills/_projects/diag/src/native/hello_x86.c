/* vendor-tool: x86_64 ELF without libc, cross-built on an aarch64 host. */
static const char msg[] = "vendor-tool 2.1 build 884\n";
void _start(void)
{
    long r;
    __asm__ volatile("syscall" : "=a"(r) : "0"(1L), "D"(1L), "S"(msg), "d"(sizeof msg - 1) : "rcx", "r11", "memory");
    __asm__ volatile("syscall" : : "a"(60L), "D"(0L));
    for (;;) ;
}

/* fxfetch: курс валюты из каталога конфигурации. Молча отдаёт 1.0, если файла нет. */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

int main(int argc, char **argv)
{
    const char *home = getenv("REPORTD_HOME");
    char path[512];
    snprintf(path, sizeof path, "%s/conf/fx/%s.rates", home ? home : "/opt/reportd", argc > 1 ? argv[1] : "USD");
    FILE *f = fopen(path, "r");
    if (!f) { puts("1.0"); return 0; }
    char line[128];
    if (fgets(line, sizeof line, f)) fputs(line, stdout); else puts("1.0");
    fclose(f);
    return 0;
}

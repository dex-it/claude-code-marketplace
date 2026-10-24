/* aggregate: сводный отчёт; курсы валют берёт у вспомогательного процесса fxfetch. */
#include <stdio.h>
#include <stdlib.h>

int main(void)
{
    FILE *p = popen("/work/reportd/bin/fxfetch EUR", "r");
    double rate = 1.0;
    if (p) { if (fscanf(p, "%lf", &rate) != 1) rate = 1.0; pclose(p); }
    double usd = 125000.0;
    printf("Итого USD: %.2f\nИтого EUR: %.2f\n", usd, usd * rate);
    return 0;
}

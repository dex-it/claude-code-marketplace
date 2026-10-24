/* report-agg: пакетный агрегатор скидок. Сборка prod: -O2 -fPIE, strip. */
#include <stdio.h>
#include <string.h>
#include <stdlib.h>

struct tier { const char *name; int rate_pct; };
static const struct tier TIERS[] = { {"basic", 3}, {"silver", 5}, {"gold", 8} };

struct order { int id; const char *tier; long cents; };

__attribute__((noinline)) static const struct tier *lookup_tier(const char *name)
{
    for (size_t i = 0; i < sizeof TIERS / sizeof TIERS[0]; i++)
        if (strcmp(TIERS[i].name, name) == 0) return &TIERS[i];
    return NULL;
}

__attribute__((noinline)) static long apply_discount(const struct order *o)
{
    const struct tier *t = lookup_tier(o->tier);
    return o->cents - o->cents * t->rate_pct / 100;
}

__attribute__((noinline)) static long run_batch(const struct order *orders, int n)
{
    long total = 0;
    for (int i = 0; i < n; i++) total += apply_discount(&orders[i]);
    return total;
}

int main(void)
{
    struct order batch[] = {
        {1, "basic", 10000}, {2, "gold", 25000}, {3, "silver", 4000},
        {4, "platinum", 90000}, {5, "basic", 700},
    };
    printf("total=%ld\n", run_batch(batch, 5));
    return 0;
}

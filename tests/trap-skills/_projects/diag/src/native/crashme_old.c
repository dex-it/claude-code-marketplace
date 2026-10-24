/* report-agg: пакетный агрегатор скидок. Предыдущая сборка недели. */
#include <stdio.h>
#include <string.h>
#include <stdlib.h>

#define MAX_BATCH 64

struct tier { const char *name; int rate_pct; };
static const struct tier TIERS[] = { {"basic", 3}, {"silver", 5}, {"gold", 8} };

struct order { int id; const char *tier; long cents; };

static int g_checked;

__attribute__((noinline)) static const struct tier *find_rate(const char *name)
{
    g_checked++;
    for (size_t i = 0; i < sizeof TIERS / sizeof TIERS[0]; i++)
        if (strcmp(TIERS[i].name, name) == 0) return &TIERS[i];
    return &TIERS[0];
}

__attribute__((noinline)) static long discount_for(const struct order *o)
{
    const struct tier *t = find_rate(o->tier);
    return o->cents - o->cents * t->rate_pct / 100;
}

__attribute__((noinline)) static long sum_orders(const struct order *orders, int n)
{
    long total = 0;
    if (n > MAX_BATCH) n = MAX_BATCH;
    for (int i = 0; i < n; i++) total += discount_for(&orders[i]);
    return total;
}

int main(void)
{
    struct order batch[] = {
        {1, "basic", 10000}, {2, "gold", 25000}, {3, "silver", 4000},
        {4, "platinum", 90000}, {5, "basic", 700},
    };
    printf("total=%ld\n", sum_orders(batch, 5));
    return 0;
}

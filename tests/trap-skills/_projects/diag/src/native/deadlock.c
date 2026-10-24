/* stockd: учёт остатков. Два потока берут блокировки в разном порядке. Сборка: -O0 -g -pthread. */
#include <pthread.h>
#include <stdio.h>
#include <unistd.h>

static pthread_mutex_t inventory_lock = PTHREAD_MUTEX_INITIALIZER;
static pthread_mutex_t ledger_lock = PTHREAD_MUTEX_INITIALIZER;
static long stock = 100, ledger = 0;

static void *reserve(void *arg)
{
    (void)arg;
    for (;;) {
        pthread_mutex_lock(&inventory_lock);
        usleep(1000);
        pthread_mutex_lock(&ledger_lock);
        stock--; ledger++;
        pthread_mutex_unlock(&ledger_lock);
        pthread_mutex_unlock(&inventory_lock);
    }
    return NULL;
}

static void *audit(void *arg)
{
    (void)arg;
    for (;;) {
        pthread_mutex_lock(&ledger_lock);
        usleep(1000);
        pthread_mutex_lock(&inventory_lock);
        if (stock + ledger != 100) fprintf(stderr, "drift\n");
        pthread_mutex_unlock(&inventory_lock);
        pthread_mutex_unlock(&ledger_lock);
    }
    return NULL;
}

int main(void)
{
    pthread_t a, b;
    pthread_create(&a, NULL, reserve, NULL);
    pthread_create(&b, NULL, audit, NULL);
    for (;;) { printf("stock=%ld ledger=%ld\n", stock, ledger); fflush(stdout); sleep(2); }
}

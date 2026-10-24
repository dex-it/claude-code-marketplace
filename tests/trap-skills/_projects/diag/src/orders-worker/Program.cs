// orders-worker: фоновый обработчик заказов. Режим берётся из первого аргумента.
using System.Diagnostics;

var mode = args.Length > 0 ? args[0] : "hang";
return mode switch
{
    "hang" => Modes.Hang(),
    "leak" => Modes.Leak(),
    "fincrash" => Modes.FinCrash(),
    "slow" => Modes.Slow(),
    _ => 2,
};

static class Modes
{
    static long _processed;
    static int _inflight;

    static void Heartbeat()
    {
        var t = new Thread(() =>
        {
            var sw = Stopwatch.StartNew();
            while (true)
            {
                Thread.Sleep(2000);
                var rss = Process.GetCurrentProcess().WorkingSet64 / (1024 * 1024);
                Console.WriteLine($"{sw.Elapsed.TotalSeconds:F0}s processed={Interlocked.Read(ref _processed)} inflight={_inflight} rss={rss}MB");
            }
        }) { IsBackground = true, Name = "heartbeat" };
        t.Start();
    }

    // hang: пул ограничен конфигурацией, обработчик блокирует рабочий поток на асинхронном вызове
    public static int Hang()
    {
        var max = int.Parse(Environment.GetEnvironmentVariable("ORDERS_MAX_WORKERS") ?? "8");
        ThreadPool.SetMinThreads(4, 4);
        ThreadPool.SetMaxThreads(max, max);
        Heartbeat();
        var prices = new PriceClient();
        for (var i = 0; ; i++)
        {
            var n = i;
            Interlocked.Increment(ref _inflight);
            Task.Run(() =>
            {
                var price = prices.GetPrice("sku-" + n % 50);
                Interlocked.Increment(ref _processed);
                Interlocked.Decrement(ref _inflight);
                return price;
            });
            Thread.Sleep(i < 40 ? 40 : i < 140 ? 1 : 40);
        }
    }

    // leak: подписчик на событие шины не отписывается
    public static int Leak()
    {
        Heartbeat();
        for (var i = 0; i < 1200; i++)
        {
            var order = new Order(i);
            _ = new PriceSubscriber(order, EventBus.Instance);
            EventBus.Instance.Publish("sku-" + i % 50, 10 + i % 7);
            Interlocked.Increment(ref _processed);
            Thread.Sleep(15);
        }
        Console.WriteLine("batch done");
        Thread.Sleep(Timeout.Infinite);
        return 0;
    }

    // fincrash: освобождённый ресурс освобождается повторно из финализатора
    public static int FinCrash()
    {
        for (var i = 0; i < 30; i++)
        {
            using var slab = new NativeSlab(i);
            slab.Write(i);
        }
        GC.Collect();
        GC.WaitForPendingFinalizers();
        Thread.Sleep(2000);
        return 0;
    }

    // slow: горячий путь обработчика
    public static int Slow()
    {
        Heartbeat();
        var threads = Enumerable.Range(0, 2).Select(_ => new Thread(() =>
        {
            var k = 0;
            while (true)
            {
                var title = $"Заказ №{k++}: Доставка, Москва / Тверская 7 (подъезд 2)";
                var slug = TextUtils.Slugify(title);
                if (slug.Length == 0) Console.WriteLine("empty slug");
                Interlocked.Increment(ref _processed);
            }
        }) { IsBackground = true }).ToArray();
        foreach (var t in threads) t.Start();
        Thread.Sleep(Timeout.Infinite);
        return 0;
    }
}

sealed class PriceClient
{
    async Task<decimal> GetPriceAsync(string sku)
    {
        await Task.Delay(30);
        return 100m + sku.Length;
    }

    public decimal GetPrice(string sku) => GetPriceAsync(sku).Result;
}

sealed record Order(int Id);

sealed class EventBus
{
    public static readonly EventBus Instance = new();
    public event Action<string, int>? PriceChanged;
    public void Publish(string sku, int price) => PriceChanged?.Invoke(sku, price);
}

sealed class PriceSubscriber
{
    readonly Order _order;
    readonly byte[] _cache = new byte[512 * 1024];

    public PriceSubscriber(Order order, EventBus bus)
    {
        _order = order;
        bus.PriceChanged += OnPrice;
    }

    void OnPrice(string sku, int price) => _cache[price] = (byte)_order.Id;
}

sealed class NativeSlab : IDisposable
{
    readonly int _id;
    bool _released;
    public NativeSlab(int id) { _id = id; }
    public void Write(int v) { if (_released) throw new InvalidOperationException("write after release"); }
    void Release()
    {
        if (_released) throw new InvalidOperationException($"slab {_id} already released");
        _released = true;
    }
    public void Dispose() => Release();
    ~NativeSlab() => Release();
}

static class TextUtils
{
    public static string Slugify(string s)
    {
        var rx = new System.Text.RegularExpressions.Regex(@"[^\p{L}\p{Nd}]+(?:[\s\p{P}]*)");
        return rx.Replace(s, "-").Trim('-').ToLowerInvariant();
    }
}

namespace BerthBook.Services;

/// <summary>Суммы в модели хранятся в рублях, PayGate работает в копейках.</summary>
public static class Money
{
    public static long ToKopecks(decimal rubles) => (long)rubles * 100;

    public static decimal FromKopecks(long kopecks) => kopecks / 100m;
}

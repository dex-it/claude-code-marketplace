namespace BerthBook.Services;

public sealed class PayGateOptions
{
    public string BaseUrl { get; set; } = "";
    public string ShopId { get; set; } = "";
    public string Secret { get; set; } = "";
}

public interface IPaymentGateway
{
    /// <summary>
    /// Создаёт платёж и возвращает ссылку на страницу оплаты. Сумма - в копейках.
    /// Ссылка действует 24 часа; об оплате PayGate сообщает вебхуком payment.succeeded.
    /// </summary>
    Task<string> CreatePaymentAsync(string orderRef, long amountKopecks, string description, CancellationToken ct);

    /// <summary>
    /// Возврат по платежам заказа, сумма в копейках. Повторный вызов с тем же orderRef и суммой
    /// PayGate не проводит второй раз. Бросает <see cref="PaymentGatewayException"/>, если провайдер
    /// отклонил возврат или недоступен.
    /// </summary>
    Task RefundAsync(string orderRef, long amountKopecks, CancellationToken ct);

    /// <summary>Проверяет HMAC-подпись тела вебхука.</summary>
    bool VerifySignature(string body, string? signature);
}

public class PaymentGatewayException : Exception
{
    public PaymentGatewayException(string message, Exception? inner = null) : base(message, inner)
    {
    }
}

/// <summary>Событие из вебхука PayGate.</summary>
public sealed class PaymentEvent
{
    public string EventId { get; set; } = "";

    /// <summary>"payment.succeeded", "payment.failed", "refund.succeeded".</summary>
    public string Type { get; set; } = "";

    public string OrderRef { get; set; } = "";

    /// <summary>Сумма в копейках.</summary>
    public long Amount { get; set; }

    public string Currency { get; set; } = "RUB";
}

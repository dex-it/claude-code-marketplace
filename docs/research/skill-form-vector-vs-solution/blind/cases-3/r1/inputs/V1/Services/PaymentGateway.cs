namespace BerthBook.Services;

public interface IPaymentGateway
{
    /// <summary>Создаёт платёж на сумму депозита (руб.) и возвращает ссылку на страницу оплаты.</summary>
    Task<string> CreateDepositAsync(Guid bookingId, decimal amount, CancellationToken ct);

    /// <summary>
    /// Возврат клиенту по платежам брони, сумма в рублях.
    /// Бросает <see cref="PaymentGatewayException"/>, если провайдер отклонил возврат или недоступен.
    /// </summary>
    Task RefundAsync(Guid bookingId, decimal amount, CancellationToken ct);

    /// <summary>Проверяет HMAC-подпись тела вебхука.</summary>
    bool VerifySignature(string body, string? signature);
}

public class PaymentGatewayException : Exception
{
    public PaymentGatewayException(string message, Exception? inner = null) : base(message, inner)
    {
    }
}

/// <summary>Событие из вебхука провайдера.</summary>
public sealed class PaymentEvent
{
    public string EventId { get; set; } = "";

    /// <summary>"payment.succeeded", "payment.failed", "refund.succeeded".</summary>
    public string Type { get; set; } = "";

    public Guid BookingId { get; set; }

    /// <summary>Сумма в минимальных единицах валюты (копейках), как её присылает провайдер.</summary>
    public long Amount { get; set; }

    public string Currency { get; set; } = "RUB";
}

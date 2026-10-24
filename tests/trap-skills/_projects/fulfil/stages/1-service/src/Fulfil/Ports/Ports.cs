namespace Fulfil.Ports;

// Платёжный шлюз: внешний HTTP-сервис, отвечает за 0.3-2 с и иногда падает.
public interface IPaymentGateway
{
    Task ChargeAsync(Guid orderId, decimal amount, CancellationToken ct);
    Task RefundAsync(Guid orderId, decimal amount, CancellationToken ct);
}

// Ценовой сервис: источник цен, ответ около 300 мс.
public interface IPriceSource
{
    Task<decimal> GetPriceAsync(string sku, CancellationToken ct);
}

// Каталог товаров, из которого строится поиск.
public interface ICatalogSource
{
    IAsyncEnumerable<Domain.Product> ReadAllAsync(CancellationToken ct);
}

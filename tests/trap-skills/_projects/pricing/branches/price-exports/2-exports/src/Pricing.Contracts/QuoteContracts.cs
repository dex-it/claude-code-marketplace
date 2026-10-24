namespace Pricing.Contracts;

public sealed record QuoteLineRequest(string Sku, int Quantity);

public sealed record QuoteRequest(IReadOnlyList<QuoteLineRequest> Lines, string? Currency = null);

public sealed record QuoteLineResponse(string Sku, int Quantity, decimal UnitPrice, decimal Total);

public sealed record QuoteResponse(IReadOnlyList<QuoteLineResponse> Lines, decimal Total, string Currency);

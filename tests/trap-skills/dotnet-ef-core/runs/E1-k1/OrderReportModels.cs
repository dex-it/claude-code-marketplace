namespace Shop.Data;

/// <summary>Строка отчёта по заказу: минимум полей для списков активных / просроченных заказов.</summary>
public record OrderSummary(Guid Id, string CustomerName, decimal Total, int ItemCount);

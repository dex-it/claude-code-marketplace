namespace Shop.Data;

// Данные для страницы отчётов по заказам. Только чтение, побочных эффектов нет,
// поэтому вся работа с БД делегируется в OrderRepository (AsNoTracking, без трекинга).
public class OrderReportService
{
    private readonly OrderRepository _orders;
    public OrderReportService(OrderRepository orders) => _orders = orders;

    // а) Активные заказы: Id, имя клиента, Total, число позиций.
    public Task<List<ActiveOrderSummary>> GetActiveOrdersAsync() =>
        _orders.GetActiveOrderSummariesAsync();

    // б) Число активных заказов по категориям (словарь категория -> число).
    public Task<Dictionary<string, int>> GetActiveOrderCountsByCategoryAsync() =>
        _orders.GetActiveOrderCountsByCategoryAsync();

    // в) Просроченные заказы на момент now (правило Order.IsOverdue).
    public Task<List<Order>> GetOverdueOrdersAsync(DateTime now) =>
        _orders.GetOverdueOrdersAsync(now);
}

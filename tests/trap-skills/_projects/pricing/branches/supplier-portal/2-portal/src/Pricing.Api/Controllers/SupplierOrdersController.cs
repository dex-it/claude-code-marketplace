using Microsoft.AspNetCore.Mvc;
using Pricing.Api.Contracts;
using Pricing.Api.Portal;
using Pricing.Domain;

namespace Pricing.Api.Controllers;

public sealed record CreateSupplierOrderRequest(
    string SupplierId, int Number, List<SupplierOrderLine> Lines, string? InternalNote, int Priority,
    Dictionary<string, string>? Tags);

public sealed record SupplierOrderFilter(SupplierOrderState? Status, string? SupplierId);

[ApiController]
public sealed class SupplierOrdersController(
    SupplierOrderStore store,
    [FromKeyedServices("email")] IOrderNotifier notifier,
    ILogger<SupplierOrdersController> log) : ControllerBase
{
    [HttpPost("api/supplier-orders")]
    public async Task<IActionResult> Create(CreateSupplierOrderRequest request, CancellationToken ct)
    {
        try
        {
            if (store.Orders.Values.Any(o => o.SupplierId == request.SupplierId && o.Number == request.Number))
            {
                // Метки закупщика - обратно в ответ, ERP по ним находит свой документ.
                var details = (request.Tags ?? []).ToDictionary(t => t.Key, t => (object?)t.Value);
                details["supplierId"] = request.SupplierId;
                details["number"] = request.Number;
                throw new PortalException("order.number_taken", "Номер заказа занят", details);
            }
            if (request.Lines.Count == 0 || request.Lines.Any(l => l.Quantity <= 0))
                return BadRequest("Строки заказа пусты или с нулевым количеством");

            var order = new SupplierOrder
            {
                SupplierId = request.SupplierId,
                Number = request.Number,
                Lines = request.Lines,
                InternalNote = request.InternalNote,
                Tags = request.Tags ?? [],
            };
            order.CostTotal = (decimal)request.Lines.Sum(l => (double)l.PurchasePrice * l.Quantity);
            store.Orders[order.Id] = order;
            log.LogInformation("Создан заказ {Number} поставщику {SupplierId}", order.Number, order.SupplierId);
            await Task.CompletedTask;
            return Ok(order);
        }
        catch (PortalException ex)
        {
            return Conflict(PortalProblems.From(ex, StatusCodes.Status409Conflict));
        }
        catch (Exception ex)
        {
            return StatusCode(500, ex.ToString());
        }
    }

    [HttpGet("api/supplier-orders/item")]
    public IActionResult GetByNumber([FromQuery] string supplierId, [FromQuery] int number)
    {
        try
        {
            var order = store.Orders.Values.FirstOrDefault(o => o.SupplierId == supplierId && o.Number == number);
            return order is null ? NotFound() : Ok(order);
        }
        catch (Exception ex)
        {
            return StatusCode(500, ex.Message);
        }
    }

    [HttpGet("api/fetch-supplier-order-lines")]
    public IActionResult GetLines([FromQuery] Guid orderId)
    {
        try
        {
            return store.Orders.TryGetValue(orderId, out var order) ? Ok(order.Lines) : NotFound();
        }
        catch (Exception ex)
        {
            return StatusCode(500, ex.Message);
        }
    }

    [HttpGet("api/supplier-orders")]
    public IActionResult List([FromQuery] SupplierOrderFilter filter)
    {
        var orders = store.Orders.Values
            .Where(o => filter.SupplierId == null || o.SupplierId == filter.SupplierId)
            .OrderByDescending(o => o.CreatedAt)
            .ToList();
        return Ok(orders);
    }

    [HttpGet("api/supplier-orders/by-state/{state}/page/{page:int}")]
    public IActionResult ListByState(SupplierOrderState state, int page)
    {
        var items = store.Orders.Values.Where(o => o.State == state)
            .OrderByDescending(o => o.CreatedAt).Skip((page - 1) * 50).Take(50)
            .Select(o => new { o.Id, o.Number, o.State }).ToList();
        return Ok(new PageDto<object>(items.Cast<object>().ToList(), page, 50, items.Count));
    }

    [HttpPost("api/supplier-orders/{id:guid}/confirm")]
    public async void Confirm(Guid id, CancellationToken ct)
    {
        if (!store.Orders.TryGetValue(id, out var order)) return;
        order.State = SupplierOrderState.Confirmed;
        await notifier.NotifyConfirmedAsync(order, ct);
    }

    [HttpDelete("internal/supplier-orders/cancelled")]
    public IActionResult PurgeCancelled()
    {
        var border = DateTimeOffset.UtcNow.AddYears(-1);
        foreach (var o in store.Orders.Values.Where(o => o.State == SupplierOrderState.Cancelled && o.CreatedAt < border))
            store.Orders.TryRemove(o.Id, out _);
        return NoContent();
    }
}

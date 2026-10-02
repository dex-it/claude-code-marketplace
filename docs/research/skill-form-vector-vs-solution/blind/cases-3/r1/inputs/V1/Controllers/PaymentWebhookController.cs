using System.Text.Json;
using BerthBook.Data;
using BerthBook.Models;
using BerthBook.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BerthBook.Controllers;

[ApiController]
[Route("api/payments/webhook")]
[AllowAnonymous]
public class PaymentWebhookController : ControllerBase
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private readonly MarinaDbContext _db;
    private readonly IPaymentGateway _gateway;
    private readonly ILogger<PaymentWebhookController> _logger;

    public PaymentWebhookController(
        MarinaDbContext db,
        IPaymentGateway gateway,
        ILogger<PaymentWebhookController> logger)
    {
        _db = db;
        _gateway = gateway;
        _logger = logger;
    }

    [HttpPost]
    public async Task<IActionResult> Handle(CancellationToken ct)
    {
        using var reader = new StreamReader(Request.Body);
        var body = await reader.ReadToEndAsync(ct);

        if (!_gateway.VerifySignature(body, Request.Headers["X-Signature"]))
            return Unauthorized();

        var evt = JsonSerializer.Deserialize<PaymentEvent>(body, JsonOptions);
        if (evt is null || evt.Type != "payment.succeeded")
            return Ok();

        var booking = await _db.Bookings.SingleOrDefaultAsync(b => b.Id == evt.BookingId, ct);
        if (booking is null)
        {
            _logger.LogWarning("Payment event {EventId} for unknown booking {BookingId}", evt.EventId, evt.BookingId);
            return Ok();
        }

        _db.Payments.Add(new Payment
        {
            BookingId = booking.Id,
            ProviderEventId = evt.EventId,
            Amount = evt.Amount,
            ReceivedAt = DateTime.UtcNow,
        });

        booking.PaidAmount += evt.Amount;
        if (booking.Status == BookingStatus.AwaitingDeposit && booking.PaidAmount >= booking.Deposit)
            booking.Status = BookingStatus.Confirmed;

        await _db.SaveChangesAsync(ct);
        return Ok();
    }
}

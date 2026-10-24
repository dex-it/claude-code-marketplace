"""Код мини-проекта Meridian, который несёт ключ: общие библиотеки, shipping, payments, catalog, orders.

Код не собирается: пакетов нет, прогон судится по диффу и тексту. Файлы-заготовки остальных сервисов
делает generate.py по шаблонам.
"""


def inject(text, anchor, addition, before=True):
    assert text.count(anchor) == 1, anchor
    return text.replace(anchor, addition + anchor if before else anchor + addition)


def add_member(text, member):
    """Вставить член перед последней закрывающей скобкой файла (конец типа)."""
    i = text.rstrip().rfind("}")
    return text[:i] + member + text[i:]


def libs():
    f = {}
    f["libs/Meridian.Common/Result.cs"] = """namespace Meridian.Common;

public readonly struct Result<T>
{
    private Result(T? value, MeridianError? error)
    {
        Value = value;
        Error = error;
    }

    public T? Value { get; }
    public MeridianError? Error { get; }
    public bool IsSuccess => Error is null;

    public static implicit operator Result<T>(T value) => new(value, null);
    public static implicit operator Result<T>(MeridianError error) => new(default, error);
}
"""
    f["libs/Meridian.Common/MeridianError.cs"] = """namespace Meridian.Common;

public abstract record MeridianError(string Code, string Message);

public abstract record NotFoundError(string Code, string Message) : MeridianError(Code, Message);

public abstract record InvalidStateError(string Code, string Message) : MeridianError(Code, Message);

public sealed record ValidationError(string Field, string Message)
    : MeridianError("validation", $"{Field}: {Message}");
"""
    f["libs/Meridian.Common/Money.cs"] = """namespace Meridian.Common;

public readonly record struct Money(long AmountMinor, string Currency)
{
    public static Money Zero(string currency) => new(0, currency);

    public Money Add(Money other)
    {
        if (other.Currency != Currency)
            throw new InvalidOperationException("Currency mismatch");
        return new Money(AmountMinor + other.AmountMinor, Currency);
    }
}
"""
    f["libs/Meridian.Common/Messaging/IntegrationEvent.cs"] = """namespace Meridian.Common.Messaging;

public abstract record IntegrationEvent
{
    public Guid EventId { get; init; } = Guid.CreateVersion7();
    public DateTimeOffset OccurredAt { get; init; }
}
"""
    f["libs/Meridian.Common/Messaging/IOutbox.cs"] = """namespace Meridian.Common.Messaging;

public interface IOutbox
{
    Task EnqueueAsync<TEvent>(TEvent integrationEvent, CancellationToken ct) where TEvent : IntegrationEvent;
}
"""
    f["libs/Meridian.Common/Messaging/IBus.cs"] = """namespace Meridian.Common.Messaging;

public interface IBus
{
    Task PublishAsync<TMessage>(TMessage message, CancellationToken ct) where TMessage : class;
}
"""
    f["libs/Meridian.Common/Persistence/IUnitOfWork.cs"] = """namespace Meridian.Common.Persistence;

public interface IUnitOfWork
{
    Task CommitAsync(CancellationToken ct);
}
"""
    f["libs/Meridian.Common/Meridian.Common.csproj"] = """<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
  </PropertyGroup>
</Project>
"""
    f["libs/Meridian.Contracts/Meridian.Contracts.csproj"] = f["libs/Meridian.Common/Meridian.Common.csproj"]
    f["libs/Meridian.Contracts/OrderPlacedIntegrationEvent.cs"] = """using Meridian.Common.Messaging;

namespace Meridian.Contracts;

public sealed record OrderPlacedIntegrationEvent(Guid OrderId, Guid CustomerId, long TotalMinor, string Currency)
    : IntegrationEvent;
"""
    f["libs/Meridian.Contracts/ShipmentCreatedMessage.cs"] = """namespace Meridian.Contracts;

public sealed record ShipmentCreatedMessage(Guid ShipmentId, Guid OrderId, DateTime CreatedAt);
"""
    f["libs/Meridian.Contracts/ShipmentCancelledMessage.cs"] = """namespace Meridian.Contracts;

public sealed record ShipmentCancelledMessage(Guid ShipmentId, Guid OrderId, DateTime CancelledAt);
"""
    f["libs/Meridian.Contracts/PaymentCapturedMessage.cs"] = """namespace Meridian.Contracts;

public sealed record PaymentCapturedMessage(Guid PaymentId, Guid OrderId, long AmountMinor, string Currency, DateTime CapturedAt);
"""
    return f


# ---------------------------------------------------------------- shipping
SHP = "services/shipping/src/Meridian.Shipping"


def shipping():
    f = {}
    f[SHP + "/Domain/Address.cs"] = """namespace Meridian.Shipping.Domain;

public sealed record Address(string Country, string City, string Line1, string PostalCode);
"""
    f[SHP + "/Domain/Shipment.cs"] = """namespace Meridian.Shipping.Domain;

public enum ShipmentStatus { Created, HandedOver, InTransit, Delivered, Cancelled }

public sealed class Shipment
{
    private Shipment() { }

    public Guid Id { get; private set; }
    public Guid OrderId { get; private set; }
    public ShipmentStatus Status { get; private set; }
    public Address From { get; private set; } = null!;
    public Address To { get; private set; } = null!;
    public int WeightGrams { get; private set; }
    public decimal DeclaredValue { get; private set; }
    public string Currency { get; private set; } = "";
    public string? TrackingNumber { get; private set; }
    public DateTime CreatedAt { get; private set; }

    public static Shipment Create(Guid orderId, Address from, Address to, int weightGrams, decimal declaredValue, string currency)
    {
        return new Shipment
        {
            Id = Guid.NewGuid(),
            OrderId = orderId,
            Status = ShipmentStatus.Created,
            From = from,
            To = to,
            WeightGrams = weightGrams,
            DeclaredValue = declaredValue,
            Currency = currency,
            CreatedAt = DateTime.UtcNow,
        };
    }

    public void HandOver(string trackingNumber)
    {
        if (Status != ShipmentStatus.Created)
            throw new InvalidOperationException($"Shipment {Id} is {Status}");
        TrackingNumber = trackingNumber;
        Status = ShipmentStatus.HandedOver;
    }

    public void Cancel()
    {
        if (Status is ShipmentStatus.HandedOver or ShipmentStatus.InTransit or ShipmentStatus.Delivered)
            throw new InvalidOperationException($"Shipment {Id} is {Status}, cannot cancel");
        Status = ShipmentStatus.Cancelled;
    }
}
"""
    f[SHP + "/Application/Abstractions/IShipmentRepository.cs"] = """using Meridian.Shipping.Domain;

namespace Meridian.Shipping.Application.Abstractions;

public interface IShipmentRepository
{
    Task<Shipment?> FindAsync(Guid id, CancellationToken ct);
    Task AddAsync(Shipment shipment, CancellationToken ct);
    Task SaveChangesAsync(CancellationToken ct);
}
"""
    f[SHP + "/Application/Shipments/CreateShipmentHandler.cs"] = """using Meridian.Common.Messaging;
using Meridian.Contracts;
using Meridian.Shipping.Application.Abstractions;
using Meridian.Shipping.Domain;

namespace Meridian.Shipping.Application.Shipments;

public sealed record CreateShipmentCommand(Guid OrderId, Address From, Address To, int WeightGrams, decimal DeclaredValue, string Currency);

public sealed class CreateShipmentHandler(IShipmentRepository shipments, IBus bus)
{
    public async Task<Guid> HandleAsync(CreateShipmentCommand command, CancellationToken ct)
    {
        if (command.WeightGrams <= 0)
            throw new ArgumentException("Weight must be positive", nameof(command));

        var shipment = Shipment.Create(command.OrderId, command.From, command.To, command.WeightGrams,
            command.DeclaredValue, command.Currency);
        await shipments.AddAsync(shipment, ct);
        await shipments.SaveChangesAsync(ct);
        await bus.PublishAsync(new ShipmentCreatedMessage(shipment.Id, shipment.OrderId, DateTime.UtcNow), ct);
        return shipment.Id;
    }
}
"""
    f[SHP + "/Application/Shipments/CancelShipmentHandler.cs"] = """using Meridian.Common.Messaging;
using Meridian.Contracts;
using Meridian.Shipping.Application.Abstractions;

namespace Meridian.Shipping.Application.Shipments;

public sealed record CancelShipmentCommand(Guid ShipmentId);

public sealed class CancelShipmentHandler(IShipmentRepository shipments, IBus bus)
{
    public async Task HandleAsync(CancelShipmentCommand command, CancellationToken ct)
    {
        var shipment = await shipments.FindAsync(command.ShipmentId, ct)
            ?? throw new KeyNotFoundException($"Shipment {command.ShipmentId} not found");
        shipment.Cancel();
        await shipments.SaveChangesAsync(ct);
        await bus.PublishAsync(new ShipmentCancelledMessage(shipment.Id, shipment.OrderId, DateTime.UtcNow), ct);
    }
}
"""
    f[SHP + "/Application/Shipments/TrackShipmentHandler.cs"] = """using Meridian.Shipping.Application.Abstractions;
using Meridian.Shipping.Infrastructure.Carriers;

namespace Meridian.Shipping.Application.Shipments;

public sealed record TrackShipmentQuery(Guid ShipmentId);

public sealed class TrackShipmentHandler(IShipmentRepository shipments, CarrierTrackingClient carrier)
{
    public async Task<TrackingInfo?> HandleAsync(TrackShipmentQuery query, CancellationToken ct)
    {
        var shipment = await shipments.FindAsync(query.ShipmentId, ct)
            ?? throw new KeyNotFoundException($"Shipment {query.ShipmentId} not found");
        if (shipment.TrackingNumber is null)
            throw new InvalidOperationException($"Shipment {shipment.Id} has no tracking number");
        return await carrier.GetAsync(shipment.TrackingNumber, ct);
    }
}
"""
    f[SHP + "/Infrastructure/Carriers/CarrierOptions.cs"] = """using System.ComponentModel.DataAnnotations;

namespace Meridian.Shipping.Infrastructure.Carriers;

public sealed class CarrierOptions
{
    [Required, Url]
    public string BaseUrl { get; set; } = "";

    public string ApiKeySecretName { get; set; } = "carrier-api-key";
}
"""
    f[SHP + "/Infrastructure/Carriers/CarrierTrackingClient.cs"] = """using System.Net.Http.Json;
using Microsoft.Extensions.Logging;

namespace Meridian.Shipping.Infrastructure.Carriers;

public sealed record TrackingInfo(string TrackingNumber, string Status, DateTime? Eta);

// Повторы на 5xx и таймауте - циклом ниже, как принято в этом сервисе (REC-04).
public sealed class CarrierTrackingClient(HttpClient http, ILogger<CarrierTrackingClient> logger)
{
    public async Task<TrackingInfo?> GetAsync(string trackingNumber, CancellationToken ct)
    {
        for (var attempt = 1; attempt <= 3; attempt++)
        {
            try
            {
                using var response = await http.GetAsync($"tracking/{trackingNumber}", ct);
                if ((int)response.StatusCode >= 500 && attempt < 3)
                {
                    await Task.Delay(200 * attempt, ct);
                    continue;
                }
                if (!response.IsSuccessStatusCode)
                    return null;
                return await response.Content.ReadFromJsonAsync<TrackingInfo>(cancellationToken: ct);
            }
            catch (TaskCanceledException) when (attempt < 3 && !ct.IsCancellationRequested)
            {
                logger.LogWarning("Carrier timeout for {TrackingNumber}, attempt {Attempt}", trackingNumber, attempt);
                await Task.Delay(200 * attempt, ct);
            }
        }
        return null;
    }
}
"""
    f[SHP + "/Infrastructure/Persistence/ShipmentRepository.cs"] = """using Meridian.Shipping.Application.Abstractions;
using Meridian.Shipping.Domain;
using Microsoft.EntityFrameworkCore;

namespace Meridian.Shipping.Infrastructure.Persistence;

public sealed class ShipmentRepository(ShippingDbContext db) : IShipmentRepository
{
    public Task<Shipment?> FindAsync(Guid id, CancellationToken ct) =>
        db.Shipments.FirstOrDefaultAsync(s => s.Id == id, ct);

    public async Task AddAsync(Shipment shipment, CancellationToken ct) =>
        await db.Shipments.AddAsync(shipment, ct);

    public Task SaveChangesAsync(CancellationToken ct) => db.SaveChangesAsync(ct);
}
"""
    f[SHP + "/Infrastructure/Persistence/ShippingDbContext.cs"] = """using Meridian.Shipping.Domain;
using Microsoft.EntityFrameworkCore;

namespace Meridian.Shipping.Infrastructure.Persistence;

public sealed class ShippingDbContext(DbContextOptions<ShippingDbContext> options) : DbContext(options)
{
    public DbSet<Shipment> Shipments => Set<Shipment>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Shipment>(b =>
        {
            b.HasKey(s => s.Id);
            b.OwnsOne(s => s.From);
            b.OwnsOne(s => s.To);
            b.Property(s => s.DeclaredValue).HasPrecision(18, 2);
        });
    }
}
"""
    f[SHP + "/Modules/ShippingModule.cs"] = """using Meridian.Shipping.Application.Abstractions;
using Meridian.Shipping.Application.Shipments;
using Meridian.Shipping.Infrastructure.Carriers;
using Meridian.Shipping.Infrastructure.Persistence;
using Microsoft.Extensions.Options;

namespace Meridian.Shipping.Modules;

public static class ShippingModule
{
    public static IServiceCollection AddShipping(this IServiceCollection services)
    {
        services.AddOptions<CarrierOptions>().BindConfiguration("Carrier").ValidateDataAnnotations().ValidateOnStart();
        services.AddHttpClient<CarrierTrackingClient>((sp, http) =>
            http.BaseAddress = new Uri(sp.GetRequiredService<IOptions<CarrierOptions>>().Value.BaseUrl));

        services.AddScoped<IShipmentRepository, ShipmentRepository>();
        services.AddScoped<CreateShipmentHandler>();
        services.AddScoped<CancelShipmentHandler>();
        services.AddScoped<TrackShipmentHandler>();
        return services;
    }
}
"""
    f[SHP + "/Api/ShipmentEndpoints.cs"] = """using Meridian.Shipping.Application.Shipments;

namespace Meridian.Shipping.Api;

public static class ShipmentEndpoints
{
    public static IEndpointRouteBuilder MapShipments(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/v1/shipments");

        group.MapPost("/", async (CreateShipmentCommand command, CreateShipmentHandler handler, CancellationToken ct) =>
        {
            var id = await handler.HandleAsync(command, ct);
            return Results.Created($"/v1/shipments/{id}", new { id });
        });

        group.MapPost("/{id:guid}/cancel", async (Guid id, CancelShipmentHandler handler, CancellationToken ct) =>
        {
            await handler.HandleAsync(new CancelShipmentCommand(id), ct);
            return Results.NoContent();
        });

        group.MapGet("/{id:guid}/tracking", async (Guid id, TrackShipmentHandler handler, CancellationToken ct) =>
        {
            var info = await handler.HandleAsync(new TrackShipmentQuery(id), ct);
            return info is null ? Results.NotFound() : Results.Ok(info);
        });

        return app;
    }
}
"""
    return f


# ---------------------------------------------------------------- payments
PAY = "services/payments/src/Meridian.Payments"

PAYMENT_CS = """namespace Meridian.Payments.Domain;

public enum PaymentStatus { Authorized, Captured, Failed }

public sealed class Payment
{
    private Payment() { }

    public Guid Id { get; private set; }
    public Guid OrderId { get; private set; }
    public PaymentStatus Status { get; private set; }
    public long AuthorizedMinor { get; private set; }
    public long CapturedMinor { get; private set; }
    public long RefundedMinor { get; private set; }
    public string Currency { get; private set; } = "";
    public string PspReference { get; private set; } = "";

    public static Payment Authorize(Guid orderId, long amountMinor, string currency, string pspReference) => new()
    {
        Id = Guid.NewGuid(),
        OrderId = orderId,
        Status = PaymentStatus.Authorized,
        AuthorizedMinor = amountMinor,
        Currency = currency,
        PspReference = pspReference,
    };

    public void Capture(long amountMinor)
    {
        if (Status != PaymentStatus.Authorized)
            throw new InvalidOperationException($"Payment {Id} is {Status}");
        CapturedMinor = amountMinor;
        Status = PaymentStatus.Captured;
    }
}
"""

REFUND_PAYMENT_CS = """using Meridian.Contracts;
using Meridian.Common.Messaging;
using Meridian.Payments.Application.Abstractions;
using Meridian.Payments.Infrastructure.Psp;
using Microsoft.Extensions.Logging;

namespace Meridian.Payments.Application.Refunds;

public sealed record RefundPaymentCommand(Guid PaymentId, decimal Amount, string Reason);

public class RefundPaymentHandler(
    IPaymentRepository payments,
    IPspRefundGateway psp,
    IBus bus,
    TimeProvider clock,
    ILogger<RefundPaymentHandler> logger)
{
    public async Task<Guid> HandleAsync(RefundPaymentCommand command, CancellationToken ct)
    {
        var payment = await payments.FindAsync(command.PaymentId, ct)
            ?? throw new KeyNotFoundException($"Payment {command.PaymentId} not found");
        if (payment.Status != Domain.PaymentStatus.Captured)
            throw new InvalidOperationException($"Payment {payment.Id} is {payment.Status}, cannot refund");

        var amountMinor = (long)(command.Amount * 100);
        if (amountMinor >= payment.CapturedMinor - payment.RefundedMinor)
            throw new InvalidOperationException("Refund exceeds captured amount");

        var refundId = await psp.RefundAsync(payment.PspReference, amountMinor, payment.Currency, ct);
        payment.RegisterRefund(amountMinor);
        await payments.SaveChangesAsync(ct);

        logger.LogInformation($"Refund {refundId} for payment {payment.Id}: {amountMinor} {payment.Currency}");
        await bus.PublishAsync(new PaymentRefundedMessage(payment.Id, payment.OrderId, amountMinor, payment.Currency,
            clock.GetUtcNow()), ct);
        return refundId;
    }
}
"""


def payments():
    f = {}
    f[PAY + "/Domain/Payment.cs"] = PAYMENT_CS
    f[PAY + "/Application/Abstractions/IPaymentRepository.cs"] = """using Meridian.Payments.Domain;

namespace Meridian.Payments.Application.Abstractions;

public interface IPaymentRepository
{
    Task<Payment?> FindAsync(Guid id, CancellationToken ct);
    Task AddAsync(Payment payment, CancellationToken ct);
    Task SaveChangesAsync(CancellationToken ct);
}
"""
    f[PAY + "/Application/Payments/CapturePaymentHandler.cs"] = """using Meridian.Contracts;
using Meridian.Common.Messaging;
using Meridian.Payments.Application.Abstractions;
using Meridian.Payments.Infrastructure.Psp;

namespace Meridian.Payments.Application.Payments;

public sealed record CapturePaymentCommand(Guid PaymentId, long AmountMinor);

public sealed class CapturePaymentHandler(IPaymentRepository payments, IPspGateway psp, IBus bus)
{
    public async Task HandleAsync(CapturePaymentCommand command, CancellationToken ct)
    {
        var payment = await payments.FindAsync(command.PaymentId, ct)
            ?? throw new KeyNotFoundException($"Payment {command.PaymentId} not found");
        if (command.AmountMinor > payment.AuthorizedMinor)
            throw new InvalidOperationException("Capture exceeds authorized amount");

        await psp.CaptureAsync(payment.PspReference, command.AmountMinor, ct);
        payment.Capture(command.AmountMinor);
        await payments.SaveChangesAsync(ct);
        await bus.PublishAsync(new PaymentCapturedMessage(payment.Id, payment.OrderId, command.AmountMinor,
            payment.Currency, DateTime.UtcNow), ct);
    }
}
"""
    f[PAY + "/Infrastructure/Psp/IPspGateway.cs"] = """namespace Meridian.Payments.Infrastructure.Psp;

public interface IPspGateway
{
    Task CaptureAsync(string pspReference, long amountMinor, CancellationToken ct);
}
"""
    f[PAY + "/Infrastructure/Psp/PspClient.cs"] = """using System.Net.Http.Json;

namespace Meridian.Payments.Infrastructure.Psp;

public sealed class PspClient(HttpClient http) : IPspGateway
{
    public async Task CaptureAsync(string pspReference, long amountMinor, CancellationToken ct)
    {
        using var response = await http.PostAsJsonAsync($"payments/{pspReference}/capture", new { amount = amountMinor }, ct);
        response.EnsureSuccessStatusCode();
    }
}
"""
    f[PAY + "/Infrastructure/Psp/PspOptions.cs"] = """using System.ComponentModel.DataAnnotations;

namespace Meridian.Payments.Infrastructure.Psp;

public sealed class PspOptions
{
    [Required, Url]
    public string BaseUrl { get; set; } = "";
}
"""
    f[PAY + "/Infrastructure/Persistence/PaymentRepository.cs"] = """using Meridian.Payments.Application.Abstractions;
using Meridian.Payments.Domain;
using Microsoft.EntityFrameworkCore;

namespace Meridian.Payments.Infrastructure.Persistence;

public sealed class PaymentRepository(PaymentsDbContext db) : IPaymentRepository
{
    public Task<Payment?> FindAsync(Guid id, CancellationToken ct) =>
        db.Payments.FirstOrDefaultAsync(p => p.Id == id, ct);

    public async Task AddAsync(Payment payment, CancellationToken ct) => await db.Payments.AddAsync(payment, ct);

    public Task SaveChangesAsync(CancellationToken ct) => db.SaveChangesAsync(ct);
}
"""
    f[PAY + "/Infrastructure/Persistence/PaymentsDbContext.cs"] = """using Meridian.Payments.Domain;
using Microsoft.EntityFrameworkCore;

namespace Meridian.Payments.Infrastructure.Persistence;

public sealed class PaymentsDbContext(DbContextOptions<PaymentsDbContext> options) : DbContext(options)
{
    public DbSet<Payment> Payments => Set<Payment>();
}
"""
    f[PAY + "/Modules/PaymentsModule.cs"] = """using Meridian.Payments.Application.Abstractions;
using Meridian.Payments.Application.Payments;
using Meridian.Payments.Infrastructure.Persistence;
using Meridian.Payments.Infrastructure.Psp;
using Microsoft.Extensions.Options;
using Polly;
using Polly.Extensions.Http;

namespace Meridian.Payments.Modules;

public static class PaymentsModule
{
    public static IServiceCollection AddPayments(this IServiceCollection services)
    {
        services.AddOptions<PspOptions>().BindConfiguration("Psp").ValidateDataAnnotations().ValidateOnStart();

        // Повторы - политики Polly (ADR-0011).
        services.AddHttpClient<IPspGateway, PspClient>((sp, http) =>
                http.BaseAddress = new Uri(sp.GetRequiredService<IOptions<PspOptions>>().Value.BaseUrl))
            .AddPolicyHandler(HttpPolicyExtensions.HandleTransientHttpError()
                .WaitAndRetryAsync(3, attempt => TimeSpan.FromMilliseconds(200 * attempt)));

        services.AddScoped<IPaymentRepository, PaymentRepository>();
        services.AddScoped<CapturePaymentHandler>();
        return services;
    }
}
"""
    f[PAY + "/Api/PaymentEndpoints.cs"] = """using Meridian.Payments.Application.Payments;

namespace Meridian.Payments.Api;

public static class PaymentEndpoints
{
    public static IEndpointRouteBuilder MapPayments(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/v1/payments");

        group.MapPost("/{id:guid}/capture", async (Guid id, long amountMinor, CapturePaymentHandler handler, CancellationToken ct) =>
        {
            await handler.HandleAsync(new CapturePaymentCommand(id, amountMinor), ct);
            return Results.NoContent();
        });

        return app;
    }
}
"""
    return f


def payments_refund_branch(main):
    """Правки ветки feature/partial-refunds (кейс R1) поверх main: вернуть {путь: новый текст}."""
    f = {}
    pay = inject(main[PAY + "/Domain/Payment.cs"], "    public void Capture(long amountMinor)",
                 """    public void RegisterRefund(long amountMinor)
    {
        RefundedMinor += amountMinor;
    }

""")
    f[PAY + "/Domain/Payment.cs"] = pay
    f[PAY + "/Application/Refunds/RefundPaymentHandler.cs"] = REFUND_PAYMENT_CS
    f["libs/Meridian.Contracts/PaymentRefundedMessage.cs"] = """namespace Meridian.Contracts;

public sealed record PaymentRefundedMessage(Guid PaymentId, Guid OrderId, long AmountMinor, string Currency, DateTimeOffset RefundedAt);
"""
    f[PAY + "/Infrastructure/Psp/PspRefundClient.cs"] = """using System.Net.Http.Json;

namespace Meridian.Payments.Infrastructure.Psp;

public interface IPspRefundGateway
{
    Task<Guid> RefundAsync(string pspReference, long amountMinor, string currency, CancellationToken ct);
}

public sealed class PspRefundClient(HttpClient http) : IPspRefundGateway
{
    public async Task<Guid> RefundAsync(string pspReference, long amountMinor, string currency, CancellationToken ct)
    {
        using var response = await http.PostAsJsonAsync($"payments/{pspReference}/refund",
            new { amount = amountMinor, currency }, ct);
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<PspRefundResponse>(cancellationToken: ct);
        return body!.RefundId;
    }
}

public sealed record PspRefundResponse(Guid RefundId);
"""
    mod = main[PAY + "/Modules/PaymentsModule.cs"]
    mod = inject(mod, "        services.AddScoped<CapturePaymentHandler>();\n", """        // Повторы - политики Polly, как у PspClient (ADR-0011).
        services.AddHttpClient<IPspRefundGateway, PspRefundClient>((sp, http) =>
                http.BaseAddress = new Uri(sp.GetRequiredService<IOptions<PspOptions>>().Value.BaseUrl))
            .AddPolicyHandler(HttpPolicyExtensions.HandleTransientHttpError()
                .WaitAndRetryAsync(3, attempt => TimeSpan.FromMilliseconds(200 * attempt)));
        services.AddScoped<RefundPaymentHandler>();
""", before=False)
    mod = mod.replace("using Meridian.Payments.Application.Payments;\n",
                      "using Meridian.Payments.Application.Payments;\nusing Meridian.Payments.Application.Refunds;\n")
    f[PAY + "/Modules/PaymentsModule.cs"] = mod
    ep = main[PAY + "/Api/PaymentEndpoints.cs"]
    ep = inject(ep, "        return app;\n", """        group.MapPost("/{id:guid}/refunds", async (Guid id, RefundPaymentRequest request, RefundPaymentHandler handler, CancellationToken ct) =>
        {
            var refundId = await handler.HandleAsync(new RefundPaymentCommand(id, request.Amount, request.Reason), ct);
            return Results.Created($"/v1/payments/{id}/refunds/{refundId}", new { refundId });
        });

""")
    ep = ep.replace("using Meridian.Payments.Application.Payments;\n",
                    "using Meridian.Payments.Application.Payments;\nusing Meridian.Payments.Application.Refunds;\n")
    ep += "\npublic sealed record RefundPaymentRequest(decimal Amount, string Reason);\n"
    f[PAY + "/Api/PaymentEndpoints.cs"] = ep
    return f


# ---------------------------------------------------------------- catalog
CAT = "services/catalog/src/Meridian.Catalog"


def catalog():
    f = {}
    f[CAT + "/Domain/Tariff.cs"] = """using Meridian.Common;

namespace Meridian.Catalog.Domain;

public sealed record Tariff(string Code, string Name, Money PricePerKg, DateTimeOffset ValidFrom);
"""
    f[CAT + "/Application/Abstractions/ITariffSource.cs"] = """using Meridian.Catalog.Domain;

namespace Meridian.Catalog.Application.Abstractions;

public interface ITariffSource
{
    Task<IReadOnlyList<Tariff>> GetAllAsync(CancellationToken ct);
}
"""
    f[CAT + "/Application/Tariffs/ListTariffsHandler.cs"] = """using Meridian.Catalog.Application.Abstractions;
using Meridian.Catalog.Domain;
using Meridian.Common;

namespace Meridian.Catalog.Application.Tariffs;

public sealed record ListTariffsQuery;

public sealed class ListTariffsHandler(ITariffSource tariffs)
{
    public async Task<Result<IReadOnlyList<Tariff>>> HandleAsync(ListTariffsQuery query, CancellationToken ct)
    {
        IReadOnlyList<Tariff> all = await tariffs.GetAllAsync(ct);
        return all;
    }
}
"""
    f[CAT + "/Infrastructure/Pricing/PricingTariffSource.cs"] = """using System.Net.Http.Json;
using Meridian.Catalog.Application.Abstractions;
using Meridian.Catalog.Domain;

namespace Meridian.Catalog.Infrastructure.Pricing;

public sealed class PricingTariffSource(HttpClient http) : ITariffSource
{
    public async Task<IReadOnlyList<Tariff>> GetAllAsync(CancellationToken ct)
    {
        var tariffs = await http.GetFromJsonAsync<List<Tariff>>("tariffs", ct);
        return tariffs is { Count: > 0 }
            ? tariffs
            : throw new InvalidOperationException("Pricing returned no tariffs");
    }
}
"""
    f[CAT + "/Infrastructure/Pricing/PricingOptions.cs"] = """using System.ComponentModel.DataAnnotations;

namespace Meridian.Catalog.Infrastructure.Pricing;

public sealed class PricingOptions
{
    [Required, Url]
    public string BaseUrl { get; set; } = "";
}
"""
    f[CAT + "/Modules/CatalogModule.cs"] = """using Meridian.Catalog.Application.Abstractions;
using Meridian.Catalog.Application.Tariffs;
using Meridian.Catalog.Infrastructure.Pricing;
using Microsoft.Extensions.Options;

namespace Meridian.Catalog.Modules;

public static class CatalogModule
{
    public static IServiceCollection AddCatalog(this IServiceCollection services)
    {
        services.AddOptions<PricingOptions>().BindConfiguration("Pricing").ValidateDataAnnotations().ValidateOnStart();
        services.AddHttpClient<ITariffSource, PricingTariffSource>((sp, http) =>
                http.BaseAddress = new Uri(sp.GetRequiredService<IOptions<PricingOptions>>().Value.BaseUrl))
            .AddStandardResilienceHandler();

        services.AddScoped<ListTariffsHandler>();
        return services;
    }
}
"""
    return f


def catalog_cache_branch(main):
    """Ветка feature/tariff-cache (кейс N0): кэш в процессе поверх источника тарифов."""
    f = {}
    f[CAT + "/Infrastructure/Pricing/TariffCacheOptions.cs"] = """using System.ComponentModel.DataAnnotations;

namespace Meridian.Catalog.Infrastructure.Pricing;

public sealed class TariffCacheOptions
{
    [Range(typeof(TimeSpan), "00:00:10", "00:05:00")]
    public TimeSpan Ttl { get; set; } = TimeSpan.FromMinutes(5);
}
"""
    f[CAT + "/Infrastructure/Pricing/CachedTariffSource.cs"] = """using Meridian.Catalog.Application.Abstractions;
using Meridian.Catalog.Domain;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Meridian.Catalog.Infrastructure.Pricing;

public sealed class CachedTariffSource(
    PricingTariffSource inner,
    IMemoryCache cache,
    IOptions<TariffCacheOptions> options,
    ILogger<CachedTariffSource> logger) : ITariffSource
{
    private const string Key = "tariffs:all";

    public async Task<IReadOnlyList<Tariff>> GetAllAsync(CancellationToken ct)
    {
        if (cache.TryGetValue(Key, out IReadOnlyList<Tariff>? cached) && cached is not null)
            return cached;

        var fresh = (await inner.GetAllAsync(ct)).ToArray();
        cache.Set(Key, (IReadOnlyList<Tariff>)fresh,
            new MemoryCacheEntryOptions { AbsoluteExpirationRelativeToNow = options.Value.Ttl });
        logger.LogInformation("Tariffs cached: {Count} items, ttl {Ttl}", fresh.Length, options.Value.Ttl);
        return fresh;
    }
}
"""
    mod = main[CAT + "/Modules/CatalogModule.cs"]
    mod = mod.replace("""        services.AddHttpClient<ITariffSource, PricingTariffSource>((sp, http) =>
                http.BaseAddress = new Uri(sp.GetRequiredService<IOptions<PricingOptions>>().Value.BaseUrl))
            .AddStandardResilienceHandler();
""", """        services.AddOptions<TariffCacheOptions>().BindConfiguration("Pricing:Cache").ValidateDataAnnotations().ValidateOnStart();
        services.AddMemoryCache();
        services.AddHttpClient<PricingTariffSource>((sp, http) =>
                http.BaseAddress = new Uri(sp.GetRequiredService<IOptions<PricingOptions>>().Value.BaseUrl))
            .AddStandardResilienceHandler();
        services.AddScoped<ITariffSource, CachedTariffSource>();
""")
    assert "CachedTariffSource" in mod
    f[CAT + "/Modules/CatalogModule.cs"] = mod
    return f


# ---------------------------------------------------------------- orders (современный образец)
ORD = "services/orders/src/Meridian.Orders"


def orders():
    f = {}
    f[ORD + "/Domain/OrderId.cs"] = """namespace Meridian.Orders.Domain;

public readonly record struct OrderId(Guid Value)
{
    public static OrderId New() => new(Guid.CreateVersion7());
}
"""
    f[ORD + "/Domain/Order.cs"] = """using Meridian.Common;

namespace Meridian.Orders.Domain;

public enum OrderStatus { Placed, Paid, Shipped, Cancelled }

public sealed class Order
{
    private Order() { }

    public OrderId Id { get; private set; }
    public Guid CustomerId { get; private set; }
    public OrderStatus Status { get; private set; }
    public long TotalMinor { get; private set; }
    public string Currency { get; private set; } = "";
    public DateTimeOffset PlacedAt { get; private set; }

    public static Order Place(Guid customerId, Money total, DateTimeOffset now) => new()
    {
        Id = OrderId.New(),
        CustomerId = customerId,
        Status = OrderStatus.Placed,
        TotalMinor = total.AmountMinor,
        Currency = total.Currency,
        PlacedAt = now,
    };
}
"""
    f[ORD + "/Domain/Errors.cs"] = """using Meridian.Common;

namespace Meridian.Orders.Domain;

public sealed record EmptyOrderError() : MeridianError("order.empty", "Order has no lines");

public sealed record OrderNotFoundError(OrderId Id) : NotFoundError("order.not_found", $"Order {Id} not found");
"""
    f[ORD + "/Application/Abstractions/IOrderRepository.cs"] = """using Meridian.Orders.Domain;

namespace Meridian.Orders.Application.Abstractions;

public interface IOrderRepository
{
    Task<Order?> FindAsync(OrderId id, CancellationToken ct);
    Task AddAsync(Order order, CancellationToken ct);
}
"""
    f[ORD + "/Application/Orders/PlaceOrderHandler.cs"] = """using Meridian.Common;
using Meridian.Common.Messaging;
using Meridian.Common.Persistence;
using Meridian.Contracts;
using Meridian.Orders.Application.Abstractions;
using Meridian.Orders.Domain;

namespace Meridian.Orders.Application.Orders;

public sealed record PlaceOrderCommand(Guid CustomerId, IReadOnlyList<OrderLine> Lines, string Currency);

public sealed record OrderLine(string Sku, int Quantity, long UnitPriceMinor);

public sealed class PlaceOrderHandler(IOrderRepository orders, IOutbox outbox, IUnitOfWork uow, TimeProvider clock)
{
    public async Task<Result<OrderId>> HandleAsync(PlaceOrderCommand command, CancellationToken ct)
    {
        if (command.Lines.Count == 0)
            return new EmptyOrderError();

        var total = new Money(command.Lines.Sum(l => l.Quantity * l.UnitPriceMinor), command.Currency);
        var order = Order.Place(command.CustomerId, total, clock.GetUtcNow());
        await orders.AddAsync(order, ct);
        await outbox.EnqueueAsync(new OrderPlacedIntegrationEvent(order.Id.Value, order.CustomerId,
            total.AmountMinor, total.Currency) { OccurredAt = clock.GetUtcNow() }, ct);
        await uow.CommitAsync(ct);
        return order.Id;
    }
}
"""
    f[ORD + "/Infrastructure/Pricing/PricingClient.cs"] = """using System.Net.Http.Json;

namespace Meridian.Orders.Infrastructure.Pricing;

public sealed class PricingClient(HttpClient http)
{
    public async Task<long?> GetUnitPriceMinorAsync(string sku, CancellationToken ct)
    {
        var response = await http.GetFromJsonAsync<PriceResponse>($"prices/{sku}", ct);
        return response?.PriceMinor;
    }
}

public sealed record PriceResponse(long PriceMinor, string Currency);
"""
    f[ORD + "/Modules/OrdersModule.cs"] = """using Meridian.Orders.Application.Orders;
using Meridian.Orders.Infrastructure.Pricing;

namespace Meridian.Orders.Modules;

public static class OrdersModule
{
    public static IServiceCollection AddOrders(this IServiceCollection services)
    {
        services.AddHttpClient<PricingClient>()
            .AddStandardResilienceHandler();
        services.AddScoped<PlaceOrderHandler>();
        return services;
    }
}
"""
    return f

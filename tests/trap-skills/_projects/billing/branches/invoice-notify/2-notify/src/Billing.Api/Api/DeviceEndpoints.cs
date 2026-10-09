using Billing.Api.Application.Notifications;
using Billing.Api.Infrastructure.Persistence;

namespace Billing.Api.Api;

public sealed record RegisterDeviceRequest(string Token, string Platform);

public static class DeviceEndpoints
{
    public static IEndpointRouteBuilder MapDeviceEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapPost("/customers/{customerId:guid}/devices", (Guid customerId, RegisterDeviceRequest body,
            HttpContext http, InMemoryStore store, ILoggerFactory loggers) =>
        {
            var logger = loggers.CreateLogger(typeof(DeviceEndpoints));
            logger.LogInformation("Device registration {@Request}", http.Request);
            if (body.Platform is not ("fcm" or "hms"))
                return Results.Problem("Unknown platform", statusCode: 400, extensions: new Dictionary<string, object?> { ["code"] = "validation" });
            if (!store.Customers.TryGetValue(customerId, out var profile))
                return Results.Problem("Customer not found", statusCode: 404, extensions: new Dictionary<string, object?> { ["code"] = "customer.not_found" });

            lock (profile.Devices)
                profile.Devices.Add(new CustomerDevice(body.Token, body.Platform));
            return Results.NoContent();
        });
        return app;
    }
}

using Billing.Api.Infrastructure.Edo;

namespace Billing.Api.Modules;

public static class EdoModule
{
    public static IServiceCollection AddEdo(this IServiceCollection services)
    {
        var baseUrl = Environment.GetEnvironmentVariable("EDO_BASE_URL") ?? "https://edo.internal/";
        var senderBox = Environment.GetEnvironmentVariable("EDO_SENDER_BOX") ?? "";
        // Конвейер по ADR-0007; провайдер ЭДО отвечает быстро - попытка 5 с.
        services.AddHttpClient<HttpJsonPoster>(http =>
            {
                http.BaseAddress = new Uri(baseUrl);
                http.DefaultRequestHeaders.Add("X-Sender-Box", senderBox);
            })
            .AddStandardResilienceHandler(o => o.AttemptTimeout.Timeout = TimeSpan.Parse("00:00:05"));
        return services;
    }
}

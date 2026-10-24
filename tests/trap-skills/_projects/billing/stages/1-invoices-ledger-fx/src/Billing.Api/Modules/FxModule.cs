using Billing.Api.Infrastructure.Fx;
using Microsoft.Extensions.Options;
using Polly;
using Polly.Extensions.Http;

namespace Billing.Api.Modules;

public static class FxModule
{
    public static IServiceCollection AddFx(this IServiceCollection services)
    {
        services.AddOptions<FxOptions>().BindConfiguration("Fx").ValidateDataAnnotations().ValidateOnStart();
        services.AddHttpClient<FxRatesClient>((sp, http) =>
                http.BaseAddress = new Uri(sp.GetRequiredService<IOptions<FxOptions>>().Value.BaseUrl))
            .AddPolicyHandler(HttpPolicyExtensions.HandleTransientHttpError()
                .WaitAndRetryAsync(3, attempt => TimeSpan.FromMilliseconds(200 * attempt)));
        return services;
    }
}

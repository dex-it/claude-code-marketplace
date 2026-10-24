using System.Text.Json.Serialization;

namespace Billing.Api.Modules;

public static class ApiModule
{
    public static IServiceCollection AddApi(this IServiceCollection services) =>
        services.ConfigureHttpJsonOptions(o => o.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));
}

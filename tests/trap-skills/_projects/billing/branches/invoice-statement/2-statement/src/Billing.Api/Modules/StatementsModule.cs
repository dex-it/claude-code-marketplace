using Billing.Api.Application.Handlers.Statements;
using Billing.Api.Application.Statements;

namespace Billing.Api.Modules;

public static class StatementsModule
{
    public static IServiceCollection AddStatementsModule(this IServiceCollection services)
    {
        services.AddScoped<BuildStatementValidator>();
        services.AddScoped<BuildStatementHandler>();
        services.AddSingleton<IStatementFormatter, JsonStatementFormatter>();
        services.AddSingleton<StatementFormatterRegistry>();
        return services;
    }
}

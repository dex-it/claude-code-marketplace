namespace Shop.Api.Infrastructure;

public static class ProblemDetailsSetup
{
    public static IServiceCollection AddShopProblemDetails(this IServiceCollection services) =>
        services.AddProblemDetails(o => o.CustomizeProblemDetails = ctx =>
        {
            ctx.ProblemDetails.Extensions["traceId"] = ctx.HttpContext.TraceIdentifier;
        });
}

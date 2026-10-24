using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Shop.Api.Infrastructure;

public sealed class TenantFilter(ITenantService tenants) : IActionFilter
{
    public void OnActionExecuting(ActionExecutingContext context)
    {
        var host = context.HttpContext.Request.Host.Host;
        var tenantId = tenants.ResolveAsync(host, context.HttpContext.RequestAborted).Result;
        if (tenantId is null)
            context.Result = new NotFoundResult();
    }

    public void OnActionExecuted(ActionExecutedContext context)
    {
    }
}

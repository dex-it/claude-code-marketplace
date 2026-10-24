using Microsoft.AspNetCore.Mvc;
using Pricing.Domain;

namespace Pricing.Api.Portal;

public static class PortalProblems
{
    /// <summary>ProblemDetails для ошибок портала: детали ошибки уходят в extensions как есть.</summary>
    public static ProblemDetails From(PortalException ex, int status)
    {
        var problem = new ProblemDetails { Status = status, Title = ex.Message, Type = "https://pricing/errors/" + ex.Code };
        foreach (var kv in ex.Extensions)
            problem.Extensions[kv.Key] = kv.Value;
        return problem;
    }
}

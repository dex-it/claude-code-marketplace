using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Pricing.Domain;

namespace Pricing.Api.Errors;

/// <summary>Доменные исключения -> ProblemDetails с кодом ошибки в extensions.</summary>
public sealed class DomainExceptionHandler(IProblemDetailsService problems) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext http, Exception exception, CancellationToken ct)
    {
        if (exception is not DomainException domain) return false;
        http.Response.StatusCode = domain is NotFoundException ? StatusCodes.Status404NotFound : StatusCodes.Status409Conflict;
        var problem = new ProblemDetails { Status = http.Response.StatusCode, Title = domain.Message };
        problem.Extensions["code"] = domain.Code;
        return await problems.TryWriteAsync(new ProblemDetailsContext { HttpContext = http, ProblemDetails = problem, Exception = exception });
    }
}

using Billing.Api.Domain;

namespace Billing.Api.Api;

public static class StatementHttpResults
{
    public static IResult ToStatementResult<T>(this Result<T> result, Func<T, IResult> onSuccess)
    {
        if (result.IsSuccess)
            return onSuccess(result.Value!);

        return result.Error switch
        {
            ValidationError e => Results.BadRequest(new { error = e.Message }),
            NotFoundError e => Results.NotFound(new { error = e.Message }),
            _ => Results.StatusCode(StatusCodes.Status500InternalServerError),
        };
    }
}

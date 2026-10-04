using Billing.Api.Domain;

namespace Billing.Api.Api;

public static class ResultHttpExtensions
{
    public static IResult ToHttp<T>(this Result<T> result, Func<T, IResult> onSuccess) =>
        result.IsSuccess ? onSuccess(result.Value!) : Problem(result.Error!);

    private static IResult Problem(BillingError error) => Results.Problem(
        error.Message,
        statusCode: error switch
        {
            NotFoundError => StatusCodes.Status404NotFound,
            ValidationError => StatusCodes.Status400BadRequest,
            _ => StatusCodes.Status409Conflict,
        },
        extensions: new Dictionary<string, object?> { ["code"] = error.Code });
}

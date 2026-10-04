namespace Billing.Api.Domain;

public readonly struct Result<T>
{
    private Result(T? value, BillingError? error)
    {
        Value = value;
        Error = error;
    }

    public T? Value { get; }
    public BillingError? Error { get; }
    public bool IsSuccess => Error is null;

    public static implicit operator Result<T>(T value) => new(value, null);
    public static implicit operator Result<T>(BillingError error) => new(default, error);
}

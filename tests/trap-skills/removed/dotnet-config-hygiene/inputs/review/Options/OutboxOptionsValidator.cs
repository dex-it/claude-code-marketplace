using Microsoft.Extensions.Options;

namespace Notify.Worker.Options;

public class OutboxOptionsValidator : IValidateOptions<OutboxOptions>
{
    public ValidateOptionsResult Validate(string? name, OutboxOptions o)
    {
        var errors = new List<string>();
        if (o.MaxBatchSize <= 0) errors.Add("MaxBatchSize must be positive");
        if (o.MaxInFlight <= 0) errors.Add("MaxInFlight must be positive");
        if (o.MaxRetries < 0) errors.Add("MaxRetries must be non-negative");
        if (o.LockTimeout <= TimeSpan.Zero) errors.Add("LockTimeout must be positive");
        return errors.Count == 0 ? ValidateOptionsResult.Success : ValidateOptionsResult.Fail(errors);
    }
}

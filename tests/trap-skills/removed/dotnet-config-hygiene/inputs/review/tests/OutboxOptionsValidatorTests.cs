using Notify.Worker.Options;
using Xunit;

public class OutboxOptionsValidatorTests
{
    [Fact]
    public void Rejects_non_positive_batch()
    {
        var result = new OutboxOptionsValidator().Validate(null, new OutboxOptions
        {
            MaxBatchSize = 0, MaxInFlight = 1, LockTimeout = TimeSpan.FromSeconds(1)
        });
        Assert.True(result.Failed);
    }

    [Fact]
    public void Accepts_valid_options()
    {
        var result = new OutboxOptionsValidator().Validate(null, new OutboxOptions
        {
            MaxBatchSize = 10, MaxInFlight = 2, MaxRetries = 3, LockTimeout = TimeSpan.FromSeconds(30)
        });
        Assert.True(result.Succeeded);
    }
}

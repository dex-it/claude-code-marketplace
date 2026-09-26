namespace Notify.Worker.Options;

public class OutboxOptions
{
    public int PollInterval { get; set; }
    public int MinBatchSize { get; set; }
    public int MaxBatchSize { get; set; }
    public int MaxInFlight { get; set; }
    public int MaxRetries { get; set; }
    public TimeSpan LockTimeout { get; set; }
}

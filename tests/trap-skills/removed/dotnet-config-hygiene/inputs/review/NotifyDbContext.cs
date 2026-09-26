using Microsoft.EntityFrameworkCore;

namespace Notify.Worker;

public class OutboxMessage
{
    public Guid Id { get; set; }
    public string To { get; set; } = "";
    public string Subject { get; set; } = "";
    public string Body { get; set; } = "";
    public int Attempts { get; set; }
    public DateTime? SentAt { get; set; }
    public DateTime? LockedUntil { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class NotifyDbContext(DbContextOptions<NotifyDbContext> options) : DbContext(options)
{
    public DbSet<OutboxMessage> Outbox => Set<OutboxMessage>();
}

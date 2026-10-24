using Microsoft.EntityFrameworkCore;

namespace BookQuarter.Library;

public class LibraryDbContext : DbContext
{
    public LibraryDbContext(DbContextOptions<LibraryDbContext> options) : base(options) { }

    public DbSet<Branch> Branches => Set<Branch>();
    public DbSet<Reader> Readers => Set<Reader>();
    public DbSet<Book> Books => Set<Book>();
    public DbSet<Loan> Loans => Set<Loan>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<Branch>().Property(x => x.TimeZoneId).HasMaxLength(64);

        b.Entity<Reader>(e =>
        {
            e.HasIndex(r => r.CardNumber).IsUnique();
            e.Property(r => r.FullName).HasMaxLength(200);
            e.Property(r => r.Phone).HasMaxLength(20);
            e.Property(r => r.FineBalance).HasPrecision(10, 2);
            e.Property(r => r.Category).HasConversion<string>().HasMaxLength(16);
        });

        b.Entity<Book>().HasIndex(x => x.Isbn);

        b.Entity<Loan>(e =>
        {
            e.HasOne(l => l.Reader).WithMany(r => r.Loans).HasForeignKey(l => l.ReaderId);
            e.HasIndex(l => new { l.BranchId, l.ReturnedAt });
            e.HasIndex(l => l.IssuedAt);
        });
    }
}

using Bookings.Api.Domain;
using Microsoft.EntityFrameworkCore;

namespace Bookings.Api.Data;

public class BookingsDbContext(DbContextOptions<BookingsDbContext> options) : DbContext(options)
{
    public DbSet<Room> Rooms => Set<Room>();
    public DbSet<Booking> Bookings => Set<Booking>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Room>(room =>
        {
            room.ToTable("rooms");
            room.HasKey(r => r.Id);
            room.Property(r => r.Id).HasColumnName("id").HasMaxLength(64);
            room.Property(r => r.Name).HasColumnName("name").HasMaxLength(120);
            room.Property(r => r.Capacity).HasColumnName("capacity");
            room.Property(r => r.Floor).HasColumnName("floor");
            room.Property(r => r.Features).HasColumnName("features");
        });

        modelBuilder.Entity<Booking>(booking =>
        {
            booking.ToTable("bookings");
            booking.HasKey(b => b.Id);
            booking.Property(b => b.Id).HasColumnName("id");
            booking.Property(b => b.RoomId).HasColumnName("room_id").HasMaxLength(64);
            booking.Property(b => b.Title).HasColumnName("title").HasMaxLength(120);
            booking.Property(b => b.Comment).HasColumnName("comment").HasMaxLength(500);
            booking.Property(b => b.StartsAt).HasColumnName("starts_at");
            booking.Property(b => b.DurationMinutes).HasColumnName("duration_minutes");
            booking.Property(b => b.EndsAt).HasColumnName("ends_at");
            booking.Property(b => b.OwnerId).HasColumnName("owner_id").HasMaxLength(64);
            booking.Property(b => b.CreatedAt).HasColumnName("created_at");
            booking.Property(b => b.Status)
                .HasColumnName("status")
                .HasMaxLength(16)
                .HasConversion(
                    status => status == BookingStatus.Active ? "active" : "cancelled",
                    value => value == "active" ? BookingStatus.Active : BookingStatus.Cancelled);
            booking.HasOne<Room>().WithMany().HasForeignKey(b => b.RoomId);
            booking.HasIndex(b => new { b.RoomId, b.StartsAt });
        });
    }
}

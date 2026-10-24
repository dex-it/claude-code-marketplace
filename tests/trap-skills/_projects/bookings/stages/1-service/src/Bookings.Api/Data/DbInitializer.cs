using Bookings.Api.Domain;
using Microsoft.EntityFrameworkCore;

namespace Bookings.Api.Data;

public static class DbInitializer
{
    public static async Task InitializeAsync(BookingsDbContext db, CancellationToken cancellationToken = default)
    {
        if (await db.Database.EnsureCreatedAsync(cancellationToken))
        {
            await db.Database.ExecuteSqlRawAsync("CREATE EXTENSION IF NOT EXISTS btree_gist", cancellationToken);
            await db.Database.ExecuteSqlRawAsync(
                """
                ALTER TABLE bookings ADD CONSTRAINT bookings_no_overlap
                EXCLUDE USING gist (room_id WITH =, tstzrange(starts_at, ends_at) WITH &&) WHERE (status = 'active')
                """,
                cancellationToken);
        }

        if (await db.Rooms.AnyAsync(cancellationToken))
            return;

        var orion = new Room("orion", "Orion", 8, 3);
        orion.Features.AddRange([RoomFeature.Projector, RoomFeature.Whiteboard]);
        var vega = new Room("vega", "Vega", 4, 3);
        vega.Features.Add(RoomFeature.Whiteboard);
        var lyra = new Room("lyra", "Lyra", 12, 5);
        lyra.Features.AddRange([RoomFeature.Projector, RoomFeature.Videoconf]);

        db.Rooms.AddRange(orion, vega, lyra);
        await db.SaveChangesAsync(cancellationToken);
    }
}

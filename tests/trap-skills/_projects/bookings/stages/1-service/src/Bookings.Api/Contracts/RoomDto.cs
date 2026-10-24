using Bookings.Api.Domain;

namespace Bookings.Api.Contracts;

public record RoomDto(string Id, string Name, int Capacity, int Floor, IReadOnlyList<RoomFeature> Features)
{
    public static RoomDto From(Room room) => new(room.Id, room.Name, room.Capacity, room.Floor, room.Features);
}

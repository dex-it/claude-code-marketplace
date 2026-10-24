namespace Bookings.Api.Domain;

public class Room
{
    public const int MinCapacity = 1;
    public const int MaxCapacity = 50;

    public Room(string id, string name, int capacity, int floor)
    {
        if (capacity is < MinCapacity or > MaxCapacity)
            throw new ArgumentOutOfRangeException(nameof(capacity));

        Id = id;
        Name = name;
        Capacity = capacity;
        Floor = floor;
    }

    public string Id { get; private set; }
    public string Name { get; private set; }
    public int Capacity { get; private set; }
    public int Floor { get; private set; }
    public List<RoomFeature> Features { get; private set; } = new();
}

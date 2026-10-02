namespace GrantDesk.Models;

public class Contest
{
    public int Id { get; set; }
    public string Title { get; set; } = "";

    /// <summary>Фонд конкурса, руб.</summary>
    public decimal Budget { get; set; }

    public bool ReviewClosed { get; set; }

    public List<Criterion> Criteria { get; set; } = new();
}

public class Criterion
{
    public int Id { get; set; }
    public int ContestId { get; set; }
    public string Name { get; set; } = "";

    /// <summary>Максимальный балл по критерию: 5 или 10, задаётся положением о конкурсе.</summary>
    public int MaxScore { get; set; }

    /// <summary>Вес критерия в итоговой оценке эксперта.</summary>
    public int Weight { get; set; }
}

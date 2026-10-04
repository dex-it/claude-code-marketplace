namespace GrantDesk.Models;

public enum ApplicationStatus
{
    Draft = 0,
    Submitted = 1,
    Withdrawn = 2,
}

public enum ReviewStatus
{
    Assigned = 0,
    Draft = 1,
    Submitted = 2,
    Expired = 3,
}

public class GrantApplication
{
    public int Id { get; set; }
    public int ContestId { get; set; }
    public Contest Contest { get; set; } = null!;

    /// <summary>Пользователь, подавший заявку.</summary>
    public string ApplicantId { get; set; } = "";
    public string ApplicantName { get; set; } = "";

    /// <summary>ИНН организации-заявителя.</summary>
    public string OrganizationInn { get; set; } = "";

    public string Title { get; set; } = "";
    public string Region { get; set; } = "";

    /// <summary>Запрошенная сумма гранта, руб.</summary>
    public decimal RequestedAmount { get; set; }

    public ApplicationStatus Status { get; set; }

    /// <summary>Создание черновика заявки в личном кабинете.</summary>
    public DateTime CreatedAt { get; set; }

    /// <summary>Подача заявки на конкурс.</summary>
    public DateTime? SubmittedAt { get; set; }

    public List<Review> Reviews { get; set; } = new();
}

/// <summary>Назначение заявки эксперту и его оценка.</summary>
public class Review
{
    public int Id { get; set; }

    public int ApplicationId { get; set; }
    public GrantApplication Application { get; set; } = null!;

    /// <summary>Эксперт, которому назначена заявка.</summary>
    public string ExpertId { get; set; } = "";
    public string ExpertName { get; set; } = "";

    public ReviewStatus Status { get; set; }

    /// <summary>Итог эксперта, 0–100: взвешенная сумма баллов в процентах от максимума.</summary>
    public decimal Total { get; set; }

    public string? Comment { get; set; }
    public DateTime? SubmittedAt { get; set; }

    public List<ReviewScore> Scores { get; set; } = new();
}

public class ReviewScore
{
    public int Id { get; set; }
    public int ReviewId { get; set; }
    public int CriterionId { get; set; }
    public int Value { get; set; }
}

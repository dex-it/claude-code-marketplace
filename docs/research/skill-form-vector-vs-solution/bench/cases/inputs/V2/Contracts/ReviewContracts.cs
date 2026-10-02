using System.ComponentModel.DataAnnotations;
using GrantDesk.Models;

namespace GrantDesk.Contracts;

public sealed class ScoreItem
{
    public int CriterionId { get; set; }

    [Range(0, 10)]
    public int Value { get; set; }
}

public sealed class SaveReviewRequest
{
    [Required, MinLength(1)]
    public List<ScoreItem> Scores { get; set; } = new();

    [MaxLength(4000)]
    public string? Comment { get; set; }
}

public sealed record MyReviewDto(int ReviewId, int ApplicationId, string ApplicationTitle, ReviewStatus Status, decimal Total);

public sealed record MyReviewsPage(List<MyReviewDto> Items, int Submitted, int Total);

public sealed record ScoreDto(int CriterionId, int Value);

public sealed record ReviewDetailsDto(
    int ReviewId,
    int ApplicationId,
    string ApplicationTitle,
    ReviewStatus Status,
    List<ScoreDto> Scores,
    string? Comment,
    decimal Total);

public sealed class AssignRequest
{
    [Required, MaxLength(64)]
    public string ExpertId { get; set; } = "";

    [Required, MinLength(1)]
    public List<int> ApplicationIds { get; set; } = new();
}

public sealed class ReassignRequest
{
    [Required, MaxLength(64)]
    public string FromExpertId { get; set; } = "";

    [Required, MaxLength(64)]
    public string ToExpertId { get; set; } = "";
}

public sealed record CriterionDto(int Id, string Name, int MaxScore, int Weight);

public sealed record ContestDto(int Id, string Title, DateOnly ReviewDeadline, bool ReviewClosed, List<CriterionDto> Criteria);

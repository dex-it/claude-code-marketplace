using Shop.Api.Data;

namespace Shop.Api.Returns;

public sealed record CreateReturnLine(int OrderLineId, int Quantity);
public sealed record CreateReturnCommand(int OrderId, string Reason, IReadOnlyList<CreateReturnLine> Lines);

public sealed record ReturnListItem(
    int Id,
    int OrderId,
    string CustomerName,
    ReturnStatus Status,
    DateTime CreatedAt,
    int ItemCount,
    decimal Amount);

public sealed record ReturnPage(IReadOnlyList<ReturnListItem> Items, int Page, int PageSize);

using Microsoft.AspNetCore.Mvc;
using Pricing.Application.Quotes;

namespace Pricing.Api.Controllers;

[ApiController]
[Route("api/quotes")]
public sealed class QuotesController(QuoteService quotes) : ControllerBase
{
    [HttpPost]
    public async Task<ActionResult<Quote>> Create(IReadOnlyList<QuoteLine> lines, CancellationToken ct) =>
        await quotes.QuoteAsync(lines, ct);
}

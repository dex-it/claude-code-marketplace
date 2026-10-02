using HoneyCoop.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HoneyCoop.Controllers;

public static class TerminalAuth
{
    public const string Scheme = "TerminalApiKey";
    public const string TerminalIdClaim = "terminal_id";
}

[ApiController]
[Route("api/terminal")]
[Authorize(AuthenticationSchemes = TerminalAuth.Scheme)]
public class TerminalController : ControllerBase
{
    private readonly IntakeService _intake;
    private readonly ILogger<TerminalController> _logger;

    public TerminalController(IntakeService intake, ILogger<TerminalController> logger)
    {
        _intake = intake;
        _logger = logger;
    }

    [HttpPost("weighings")]
    public async Task<IActionResult> Post(WeighingDto dto, CancellationToken ct)
    {
        var terminalId = User.FindFirst(TerminalAuth.TerminalIdClaim)!.Value;
        var result = await _intake.RegisterAsync(terminalId, dto, ct);

        switch (result.Outcome)
        {
            case IntakeOutcome.Accepted:
            case IntakeOutcome.Rejected:
                return Ok(new { batchId = result.BatchId, outcome = result.Outcome.ToString(), reason = result.Reason });

            case IntakeOutcome.Duplicate:
                return Ok(new { duplicate = true });

            default:
                _logger.LogWarning("Weighing {WeighingNo} from {TerminalId} not accepted: {Reason}",
                    dto.WeighingNo, terminalId, result.Reason);
                return Ok(new { accepted = false, reason = result.Reason });
        }
    }
}

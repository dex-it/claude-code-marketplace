using HoneyCoop.Contracts;
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

    private string TerminalId => User.FindFirst(TerminalAuth.TerminalIdClaim)!.Value;

    [HttpPost("weighings")]
    public async Task<IActionResult> Post(WeighingDto dto, CancellationToken ct)
    {
        var result = await _intake.RegisterAsync(TerminalId, dto, ct);
        return ToResponse(result, dto.WeighingNo);
    }

    [HttpPut("weighings/{weighingNo:long}")]
    public async Task<IActionResult> Correct(long weighingNo, CorrectionDto dto, CancellationToken ct)
    {
        var result = await _intake.CorrectAsync(TerminalId, weighingNo, dto, ct);
        return ToResponse(result, weighingNo);
    }

    private IActionResult ToResponse(IntakeResult result, long weighingNo)
    {
        switch (result.Outcome)
        {
            case IntakeOutcome.Accepted:
            case IntakeOutcome.Rejected:
            case IntakeOutcome.Duplicate:
                var b = result.Batch!;
                return Ok(new IntakeResponse(b.Id, result.Outcome.ToString(), b.Grade?.ToString(), b.NetKg));

            case IntakeOutcome.NotFound:
                return NotFound(new { reason = result.Reason });

            default:
                _logger.LogWarning("Weighing {WeighingNo} from {TerminalId} not accepted: {Outcome}",
                    weighingNo, TerminalId, result.Outcome);
                return UnprocessableEntity(new { reason = result.Reason });
        }
    }
}

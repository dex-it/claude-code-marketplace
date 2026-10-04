using BookQuarter.Library;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<LibraryDbContext>(o =>
    o.UseNpgsql(builder.Configuration.GetConnectionString("Library")));
builder.Services.AddScoped<LoanService>();

var app = builder.Build();

app.MapPost("/loans", async (IssueRequest req, LoanService s) =>
    Results.Ok(await s.IssueAsync(req.CardNumber, req.BookId, req.BranchId)));

app.MapPost("/loans/{id:int}/return", async (int id, LoanService s) =>
{
    await s.ReturnAsync(id);
    return Results.NoContent();
});

app.MapGet("/branches/{branchId:int}/readers/{card}/loans", async (int branchId, string card, LoanService s) =>
    Results.Ok(await s.GetActiveLoansAsync(card, branchId)));

app.MapGet("/branches/{branchId:int}/issued-today", async (int branchId, LoanService s) =>
    Results.Ok(await s.CountIssuedTodayAsync(branchId)));

app.Run();

public record IssueRequest(string CardNumber, int BookId, int BranchId);

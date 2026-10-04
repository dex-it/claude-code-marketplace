using AutoSchool.Cloud;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddScoped<CurrentSchool>();
builder.Services.AddDbContext<SchoolDbContext>(o =>
    o.UseNpgsql(builder.Configuration.GetConnectionString("Schools")));
builder.Services.AddScoped<StudentService>();
builder.Services.AddSingleton<IEmailSender, SmtpEmailSender>();

var app = builder.Build();

// Шлюз определяет автошколу по поддомену и передаёт её Id заголовком.
app.Use(async (ctx, next) =>
{
    var school = ctx.RequestServices.GetRequiredService<CurrentSchool>();
    school.Id = int.Parse(ctx.Request.Headers["X-School-Id"].ToString());
    await next();
});

var api = app.MapGroup("/api").AddEndpointFilter<SaveChangesFilter>();

api.MapPost("/students", async (RegisterRequest req, StudentService s) =>
    Results.Ok(await s.RegisterAsync(req)));

api.MapGet("/students/by-email", async (string email, StudentService s) =>
    await s.FindByEmailAsync(email) is { } dto ? Results.Ok(dto) : Results.NotFound());

api.MapPut("/students/{id:int}/contacts", async (int id, ContactsRequest req, StudentService s) =>
{
    await s.UpdateContactsAsync(id, req);
    return Results.NoContent();
});

api.MapPost("/students/{id:int}/graduate", async (int id, GraduateRequest req, StudentService s) =>
{
    await s.GraduateAsync(id, req.GraduatedOn);
    return Results.NoContent();
});

// Файлы для печати отдаются отдельно от API.
app.MapGet("/exports/instructors/{id:int}/students.csv", async (int id, StudentService s) =>
    Results.Text(await s.ExportForInstructorCsvAsync(id), "text/csv"));

app.Run();

public record GraduateRequest(DateOnly GraduatedOn);

// Единая точка сохранения для API: сервисы меняют сущности, изменения фиксируются после успешного обработчика.
public class SaveChangesFilter : IEndpointFilter
{
    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext ctx, EndpointFilterDelegate next)
    {
        var result = await next(ctx);
        var db = ctx.HttpContext.RequestServices.GetRequiredService<SchoolDbContext>();
        await db.SaveChangesAsync();
        return result;
    }
}

public class SmtpEmailSender : IEmailSender
{
    public Task SendAsync(string to, string subject, string body) => Task.CompletedTask; // SMTP-клиент опущен
}

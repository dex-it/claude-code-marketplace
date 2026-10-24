using GrantDesk.Data;
using GrantDesk.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<GrantsDbContext>(o =>
    o.UseNpgsql(builder.Configuration.GetConnectionString("Grants")));

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(o => builder.Configuration.Bind("Auth", o));
builder.Services.AddAuthorization();
builder.Services.AddControllers();

// Сообщения валидации, даты в письмах и уведомлениях - по-русски.
builder.Services.AddLocalization();
builder.Services.Configure<RequestLocalizationOptions>(o =>
{
    o.SetDefaultCulture("ru-RU")
        .AddSupportedCultures("ru-RU")
        .AddSupportedUICultures("ru-RU");
});

builder.Services.AddScoped<ReviewService>();
builder.Services.AddScoped<AssignmentService>();
builder.Services.AddScoped<RankingService>();

var app = builder.Build();

app.UseRequestLocalization();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();

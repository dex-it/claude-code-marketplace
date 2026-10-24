using Microsoft.EntityFrameworkCore;
using VetClinic.Hospital.Api;
using VetClinic.Hospital.Data;
using VetClinic.Hospital.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<ClinicDbContext>(o =>
    o.UseNpgsql(builder.Configuration.GetConnectionString("Hospital")));

builder.Services.AddAuthentication().AddJwtBearer();
builder.Services.AddAuthorization(o =>
{
    o.AddPolicy("Vet", p => p.RequireRole("vet"));
    o.AddPolicy("Admin", p => p.RequireRole("admin"));
});

builder.Services.AddScoped<WardService>();
builder.Services.AddScoped<InpatientReportService>();

var app = builder.Build();

// Применяем миграции при старте, чтобы схема всегда была актуальной
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<ClinicDbContext>();
    await db.Database.MigrateAsync();
}

app.UseAuthentication();
app.UseAuthorization();

app.MapInpatient();

app.Run();

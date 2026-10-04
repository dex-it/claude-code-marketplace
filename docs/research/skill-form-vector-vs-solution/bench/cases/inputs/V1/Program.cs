using BerthBook.Data;
using BerthBook.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<MarinaDbContext>(o =>
    o.UseNpgsql(builder.Configuration.GetConnectionString("Marina")));

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(o => builder.Configuration.Bind("Auth", o));
builder.Services.AddAuthorization();
builder.Services.AddControllers();

builder.Services.Configure<PayGateOptions>(builder.Configuration.GetSection("PayGate"));
builder.Services.AddHttpClient<IPaymentGateway, PayGateClient>();

builder.Services.AddSingleton<MarinaClock>();
builder.Services.AddSingleton<TariffCalculator>();
builder.Services.AddScoped<BookingService>();

var app = builder.Build();

app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();

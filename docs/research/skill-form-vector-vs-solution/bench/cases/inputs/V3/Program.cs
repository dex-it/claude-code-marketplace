using ConfReg.Data;
using ConfReg.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<ConfDbContext>(o =>
    o.UseNpgsql(builder.Configuration.GetConnectionString("Conf")));

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(o => builder.Configuration.Bind("Auth", o));
builder.Services.AddAuthorization();
builder.Services.AddControllers();

builder.Services.Configure<BillingOptions>(builder.Configuration.GetSection("Billing"));
builder.Services.AddHttpClient<IBillingClient, BillingBusClient>(c => c.Timeout = TimeSpan.FromSeconds(30));

builder.Services.AddScoped<PricingService>();
builder.Services.AddScoped<CapacityService>();
builder.Services.AddScoped<RegistrationService>();
builder.Services.AddScoped<GroupOrderService>();

var app = builder.Build();

app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();

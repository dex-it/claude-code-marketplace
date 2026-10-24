using HoneyCoop.Auth;
using HoneyCoop.Controllers;
using HoneyCoop.Data;
using HoneyCoop.Services;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<CoopDbContext>(o =>
    o.UseNpgsql(builder.Configuration.GetConnectionString("Coop")));

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(o => builder.Configuration.Bind("Auth", o))
    .AddScheme<AuthenticationSchemeOptions, TerminalApiKeyHandler>(TerminalAuth.Scheme, null);
builder.Services.AddAuthorization();
builder.Services.AddControllers();

builder.Services.Configure<BankSftpOptions>(builder.Configuration.GetSection("BankSftp"));
builder.Services.AddSingleton<IBankGateway, SftpBankGateway>();

builder.Services.AddScoped<IntakeService>();
builder.Services.AddScoped<PayoutService>();
builder.Services.AddScoped<BankRegistryService>();

var app = builder.Build();

app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();

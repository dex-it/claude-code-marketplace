using Notify.Api.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddSingleton<INotificationSender, EmailSender>();
builder.Services.AddScoped<OrderService>();

var app = builder.Build();
app.MapControllers();
app.Run();

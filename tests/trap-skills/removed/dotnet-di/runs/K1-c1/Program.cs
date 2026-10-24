using Notify.Api.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddKeyedSingleton<INotificationSender, EmailSender>("email");
builder.Services.AddKeyedSingleton<INotificationSender, SmsSender>("sms");
builder.Services.AddScoped<OrderService>();

var app = builder.Build();
app.MapControllers();
app.Run();

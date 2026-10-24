using Notify.Api.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddKeyedSingleton<INotificationSender, EmailSender>(NotificationChannels.Email);
builder.Services.AddKeyedSingleton<INotificationSender, SmsSender>(NotificationChannels.Sms);
builder.Services.AddScoped<OrderService>();

var app = builder.Build();
app.MapControllers();
app.Run();

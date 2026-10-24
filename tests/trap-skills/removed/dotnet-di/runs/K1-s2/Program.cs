using Notify.Api.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddKeyedSingleton<INotificationSender, EmailSender>(NotificationSenderKeys.Email);
builder.Services.AddKeyedSingleton<INotificationSender, SmsSender>(NotificationSenderKeys.Sms);
builder.Services.AddScoped<OrderService>();
builder.Services.AddScoped<ReportService>();

var app = builder.Build();
app.MapControllers();
app.Run();

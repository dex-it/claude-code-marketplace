using Billing.Api.Infrastructure.Notifications;

namespace Billing.Api.Modules;

public static class NotificationsModule
{
    public static IServiceCollection AddNotifications(this IServiceCollection services)
    {
        services.AddHttpClient<PushSender>(http => http.BaseAddress = new Uri("https://push.internal/"))
            .AddStandardResilienceHandler();
        services.AddHttpClient("mail", http => http.BaseAddress = new Uri("https://mail.internal/"))
            .AddStandardResilienceHandler();
        services.AddSingleton(sp => new EmailSender(
            sp.GetRequiredService<IHttpClientFactory>().CreateClient("mail"),
            sp.GetRequiredService<ILoggerFactory>().CreateLogger("App")));
        services.AddHostedService<NotificationDispatcher>();
        return services;
    }
}

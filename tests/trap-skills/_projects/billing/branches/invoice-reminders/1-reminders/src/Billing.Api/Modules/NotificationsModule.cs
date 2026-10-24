using Billing.Api.Application.Abstractions;
using Billing.Api.Application.Handlers.Invoices;
using Billing.Api.Infrastructure.Notifications;
using Billing.Api.Infrastructure.Reminders;
using Microsoft.Extensions.Options;
using Polly;
using Polly.Extensions.Http;

namespace Billing.Api.Modules;

public static class NotificationsModule
{
    public static IServiceCollection AddNotifications(this IServiceCollection services)
    {
        services.AddOptions<MailerOptions>().BindConfiguration("Mailer").ValidateDataAnnotations().ValidateOnStart();
        // Повторы - по ADR-0003, как у FxRatesClient.
        services.AddHttpClient<INotificationSender, MailerNotificationSender>((sp, http) =>
                http.BaseAddress = new Uri(sp.GetRequiredService<IOptions<MailerOptions>>().Value.BaseUrl))
            .AddPolicyHandler(HttpPolicyExtensions.HandleTransientHttpError()
                .WaitAndRetryAsync(3, attempt => TimeSpan.FromMilliseconds(200 * attempt)));

        // Хендлер фоновый и живёт всё время приложения - синглтон, как LedgerOutboxDispatcher.
        services.AddSingleton<SendDueRemindersHandler>();
        services.AddHostedService<InvoiceReminderWorker>();
        return services;
    }
}

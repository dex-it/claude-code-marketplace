using Microsoft.EntityFrameworkCore;
using Notify.Worker;
using Notify.Worker.Options;

var builder = Host.CreateApplicationBuilder(args);

builder.Services.AddDbContext<NotifyDbContext>(o =>
    o.UseNpgsql(builder.Configuration.GetConnectionString("Notify")));

builder.Services.Configure<OutboxOptions>(builder.Configuration.GetSection("Outbox"));
builder.Services.Configure<SmtpOptions>(builder.Configuration.GetSection("Mail"));

builder.Services.AddSingleton<ThrottleService>();
builder.Services.AddSingleton<IMailSender, SmtpMailSender>();
builder.Services.AddHostedService<OutboxWorker>();

builder.Build().Run();

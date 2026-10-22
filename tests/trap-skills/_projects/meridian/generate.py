#!/usr/bin/env python3
"""Генератор мини-проекта Meridian: большой монорепозиторий с ADR в трёх местах, сводом правил в
нестандартной папке, цепочками supersede и легаси-соседями.

Использование: generate.py <dest> [ветка для checkout]

Детерминирован: фиксированные даты и тексты, одинаковые входы дают одинаковое дерево. Код не
собирается (пакетов нет) - прогон судится по диффу. Ключ - README.md рядом, в <dest> не попадает.
Ветки: main (кейс F1), feature/partial-refunds (R1), feature/tariff-cache (N0).
"""
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import docs_data as D  # noqa: E402
import hot_code as H  # noqa: E402

PLURAL = {"Delivery": "Deliveries", "Category": "Categories"}


def pl(name):
    return PLURAL.get(name, name + "s")


def render(tpl, **kw):
    for k, v in kw.items():
        tpl = tpl.replace("@@" + k + "@@", v)
    return tpl


# сервис -> [(сущность, [(тип, поле)], стиль)]
FILLER = {
    "orders": [("Cart", [("Guid", "CustomerId"), ("int", "ItemCount"), ("long", "TotalMinor")], "modern"),
               ("Discount", [("string", "Code"), ("int", "Percent"), ("DateTimeOffset", "ValidUntil")], "modern")],
    "inventory": [("StockItem", [("string", "Sku"), ("int", "Quantity"), ("string", "WarehouseCode")], "modern"),
                  ("Warehouse", [("string", "Code"), ("string", "City"), ("int", "Capacity")], "legacy")],
    "notifications": [("Template", [("string", "Code"), ("string", "Subject"), ("string", "Body")], "legacy"),
                      ("Delivery", [("string", "Recipient"), ("string", "TemplateCode"), ("int", "Attempts")], "legacy")],
    "identity": [("UserAccount", [("string", "Email"), ("string", "DisplayName"), ("bool", "IsActive")], "legacy"),
                 ("Role", [("string", "Name"), ("string", "Description")], "legacy")],
    "reporting": [("ReportDefinition", [("string", "Name"), ("string", "Query")], "legacy"),
                  ("ReportRun", [("Guid", "DefinitionId"), ("int", "RowCount")], "legacy")],
    "catalog": [("Product", [("string", "Sku"), ("string", "Name"), ("decimal", "Price")], "legacy"),
                ("Category", [("string", "Name"), ("Guid?", "ParentId")], "legacy")],
    "shipping": [("Carrier", [("string", "Code"), ("string", "Name"), ("int", "MaxWeightGrams")], "legacy")],
    "payments": [("PaymentMethod", [("string", "Kind"), ("string", "Last4"), ("string", "Holder")], "legacy")],
}
HAS_CTX = {"shipping", "payments"}  # DbContext написан вручную в hot_code

T_ENTITY_LEGACY = """namespace Meridian.@@Svc@@.Domain;

public sealed class @@E@@
{
    private @@E@@() { }

    public Guid Id { get; private set; }
@@props@@    public DateTime CreatedAt { get; private set; }

    public static @@E@@ Create(@@params@@) => new()
    {
        Id = Guid.NewGuid(),
@@init@@        CreatedAt = DateTime.UtcNow,
    };
}
"""
T_ENTITY_MODERN = """namespace Meridian.@@Svc@@.Domain;

public readonly record struct @@E@@Id(Guid Value)
{
    public static @@E@@Id New() => new(Guid.CreateVersion7());
}

public sealed class @@E@@
{
    private @@E@@() { }

    public @@E@@Id Id { get; private set; }
@@props@@    public DateTimeOffset CreatedAt { get; private set; }

    public static @@E@@ Create(@@params@@, DateTimeOffset now) => new()
    {
        Id = @@E@@Id.New(),
@@init@@        CreatedAt = now,
    };
}
"""
T_REPO_IF = """using Meridian.@@Svc@@.Domain;

namespace Meridian.@@Svc@@.Application.Abstractions;

public interface I@@E@@Repository
{
    Task<@@E@@?> FindAsync(@@IdT@@ id, CancellationToken ct);
    Task AddAsync(@@E@@ item, CancellationToken ct);
    Task SaveChangesAsync(CancellationToken ct);
}
"""
T_REPO_IMPL = """using Meridian.@@Svc@@.Application.Abstractions;
using Meridian.@@Svc@@.Domain;
using Microsoft.EntityFrameworkCore;

namespace Meridian.@@Svc@@.Infrastructure.Persistence;

public sealed class @@E@@Repository(@@Svc@@DbContext db) : I@@E@@Repository
{
    public Task<@@E@@?> FindAsync(@@IdT@@ id, CancellationToken ct) =>
        db.Set<@@E@@>().FirstOrDefaultAsync(x => x.Id == id, ct);

    public async Task AddAsync(@@E@@ item, CancellationToken ct) => await db.Set<@@E@@>().AddAsync(item, ct);

    public Task SaveChangesAsync(CancellationToken ct) => db.SaveChangesAsync(ct);
}
"""
T_CREATE_LEGACY = """using Meridian.Common.Messaging;
using Meridian.Contracts;
using Meridian.@@Svc@@.Application.Abstractions;
using Meridian.@@Svc@@.Domain;

namespace Meridian.@@Svc@@.Application.@@Es@@;

public sealed record Create@@E@@Command(@@params@@);

public sealed class Create@@E@@Handler(I@@E@@Repository items, IBus bus)
{
    public async Task<Guid> HandleAsync(Create@@E@@Command command, CancellationToken ct)
    {
        var item = @@E@@.Create(@@args@@);
        await items.AddAsync(item, ct);
        await items.SaveChangesAsync(ct);
        await bus.PublishAsync(new @@E@@CreatedMessage(item.Id, DateTime.UtcNow), ct);
        return item.Id;
    }
}
"""
T_CREATE_MODERN = """using Meridian.Common;
using Meridian.Common.Messaging;
using Meridian.Common.Persistence;
using Meridian.Contracts;
using Meridian.@@Svc@@.Application.Abstractions;
using Meridian.@@Svc@@.Domain;

namespace Meridian.@@Svc@@.Application.@@Es@@;

public sealed record Create@@E@@Command(@@params@@);

public sealed class Create@@E@@Handler(I@@E@@Repository items, IOutbox outbox, IUnitOfWork uow, TimeProvider clock)
{
    public async Task<Result<@@E@@Id>> HandleAsync(Create@@E@@Command command, CancellationToken ct)
    {
        var item = @@E@@.Create(@@args@@, clock.GetUtcNow());
        await items.AddAsync(item, ct);
        await outbox.EnqueueAsync(new @@E@@CreatedIntegrationEvent(item.Id.Value) { OccurredAt = clock.GetUtcNow() }, ct);
        await uow.CommitAsync(ct);
        return item.Id;
    }
}
"""
T_GET_LEGACY = """using Meridian.@@Svc@@.Application.Abstractions;
using Meridian.@@Svc@@.Domain;

namespace Meridian.@@Svc@@.Application.@@Es@@;

public sealed record Get@@E@@Query(Guid Id);

public sealed class Get@@E@@Handler(I@@E@@Repository items)
{
    public async Task<@@E@@> HandleAsync(Get@@E@@Query query, CancellationToken ct) =>
        await items.FindAsync(query.Id, ct) ?? throw new KeyNotFoundException($"@@E@@ {query.Id} not found");
}
"""
T_GET_MODERN = """using Meridian.Common;
using Meridian.@@Svc@@.Application.Abstractions;
using Meridian.@@Svc@@.Domain;

namespace Meridian.@@Svc@@.Application.@@Es@@;

public sealed record Get@@E@@Query(@@E@@Id Id);

public sealed record @@E@@NotFoundError(@@E@@Id Id) : NotFoundError("@@lower@@.not_found", $"@@E@@ {Id} not found");

public sealed class Get@@E@@Handler(I@@E@@Repository items)
{
    public async Task<Result<@@E@@>> HandleAsync(Get@@E@@Query query, CancellationToken ct)
    {
        var item = await items.FindAsync(query.Id, ct);
        if (item is null)
            return new @@E@@NotFoundError(query.Id);
        return item;
    }
}
"""
T_ENDPOINTS = """using Meridian.@@Svc@@.Application.@@Es@@;

namespace Meridian.@@Svc@@.Api;

public static class @@E@@Endpoints
{
    public static IEndpointRouteBuilder Map@@Es@@(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/v1/@@kebab@@");

        group.MapPost("/", async (Create@@E@@Command command, Create@@E@@Handler handler, CancellationToken ct) =>
        {
            var result = await handler.HandleAsync(command, ct);
            return Results.Created("/v1/@@kebab@@", result);
        });

        group.MapGet("/{id:guid}", async (Guid id, Get@@E@@Handler handler, CancellationToken ct) =>
            Results.Ok(await handler.HandleAsync(new Get@@E@@Query(@@getarg@@), ct)));

        return app;
    }
}
"""
T_TEST = """using Xunit;

namespace Meridian.@@Svc@@.Tests;

public class @@E@@Tests
{
    [Fact]
    public void Create_assigns_id()
    {
        var item = @@E@@.Create(@@testargs@@);
        Assert.NotEqual(default, item.Id);
    }
}
"""


def kebab(s):
    out = ""
    for i, c in enumerate(s):
        if c.isupper() and i:
            out += "-"
        out += c.lower()
    return out


def sample(t, name):
    return {"string": '"x"', "int": "1", "long": "100L", "decimal": "10m", "bool": "true", "Guid": "Guid.NewGuid()",
            "Guid?": "null", "DateTimeOffset": "DateTimeOffset.UnixEpoch"}[t]


def filler_files():
    f = {}
    for svc, ents in FILLER.items():
        Svc = svc.capitalize()
        base = f"services/{svc}/src/Meridian.{Svc}"
        for e, fields, style in ents:
            modern = style == "modern"
            props = "".join(f"    public {t} {n} {{ get; private set; }}\n" for t, n in fields)
            params = ", ".join(f"{t} {n[0].lower() + n[1:]}" for t, n in fields)
            init = "".join(f"        {n} = {n[0].lower() + n[1:]},\n" for t, n in fields)
            args = ", ".join(f"command.{n}" for t, n in fields)
            kw = dict(Svc=Svc, E=e, Es=pl(e), props=props, params=params, init=init, args=args,
                      IdT=f"{e}Id" if modern else "Guid", lower=e.lower(), kebab=kebab(pl(e)),
                      getarg=f"new {e}Id(id)" if modern else "id",
                      testargs=", ".join(sample(t, n) for t, n in fields) + (", DateTimeOffset.UnixEpoch" if modern else ""))
            f[f"{base}/Domain/{e}.cs"] = render(T_ENTITY_MODERN if modern else T_ENTITY_LEGACY, **kw)
            f[f"{base}/Application/Abstractions/I{e}Repository.cs"] = render(T_REPO_IF, **kw)
            f[f"{base}/Infrastructure/Persistence/{e}Repository.cs"] = render(T_REPO_IMPL, **kw)
            f[f"{base}/Application/{pl(e)}/Create{e}Handler.cs"] = render(T_CREATE_MODERN if modern else T_CREATE_LEGACY, **kw)
            f[f"{base}/Application/{pl(e)}/Get{e}Handler.cs"] = render(T_GET_MODERN if modern else T_GET_LEGACY, **kw)
            f[f"{base}/Api/{e}Endpoints.cs"] = render(T_ENDPOINTS, **kw)
            f[f"services/{svc}/tests/Meridian.{Svc}.Tests/{e}Tests.cs"] = render(T_TEST, **kw)
            if modern:
                f[f"libs/Meridian.Contracts/{e}CreatedIntegrationEvent.cs"] = (
                    f"using Meridian.Common.Messaging;\n\nnamespace Meridian.Contracts;\n\n"
                    f"public sealed record {e}CreatedIntegrationEvent(Guid {e}Id) : IntegrationEvent;\n")
            else:
                f[f"libs/Meridian.Contracts/{e}CreatedMessage.cs"] = (
                    f"namespace Meridian.Contracts;\n\npublic sealed record {e}CreatedMessage(Guid {e}Id, DateTime CreatedAt);\n")
        regs = "".join(f"        services.AddScoped<I{e}Repository, {e}Repository>();\n"
                       f"        services.AddScoped<Create{e}Handler>();\n"
                       f"        services.AddScoped<Get{e}Handler>();\n" for e, _, _ in ents)
        usings = "".join(f"using Meridian.{Svc}.Application.{pl(e)};\n" for e, _, _ in ents)
        f[f"{base}/Modules/EntityRegistrations.cs"] = (
            f"using Meridian.{Svc}.Application.Abstractions;\n{usings}using Meridian.{Svc}.Infrastructure.Persistence;\n\n"
            f"namespace Meridian.{Svc}.Modules;\n\npublic static class EntityRegistrations\n{{\n"
            f"    public static IServiceCollection Add{Svc}Entities(this IServiceCollection services)\n    {{\n{regs}"
            f"        return services;\n    }}\n}}\n")
        if svc not in HAS_CTX:
            sets = "".join(f"    public DbSet<{e}> {pl(e)} => Set<{e}>();\n" for e, _, _ in ents)
            f[f"{base}/Infrastructure/Persistence/{Svc}DbContext.cs"] = (
                f"using Meridian.{Svc}.Domain;\nusing Microsoft.EntityFrameworkCore;\n\n"
                f"namespace Meridian.{Svc}.Infrastructure.Persistence;\n\n"
                f"public sealed class {Svc}DbContext(DbContextOptions<{Svc}DbContext> options) : DbContext(options)\n{{\n{sets}}}\n")
        f[f"{base}/Meridian.{Svc}.csproj"] = (
            '<Project Sdk="Microsoft.NET.Sdk.Web">\n  <PropertyGroup>\n    <TargetFramework>net8.0</TargetFramework>\n'
            '    <Nullable>enable</Nullable>\n    <ImplicitUsings>enable</ImplicitUsings>\n  </PropertyGroup>\n'
            '  <ItemGroup>\n    <ProjectReference Include="../../../../libs/Meridian.Common/Meridian.Common.csproj" />\n'
            '    <ProjectReference Include="../../../../libs/Meridian.Contracts/Meridian.Contracts.csproj" />\n  </ItemGroup>\n</Project>\n')
        f[f"{base}/Program.cs"] = (
            f"var builder = WebApplication.CreateBuilder(args);\nbuilder.Services.Add{Svc}Entities();\n"
            f"var app = builder.Build();\napp.MapHealthChecks(\"/health/live\");\napp.Run();\n")
        f[f"{base}/appsettings.json"] = '{\n  "Logging": { "LogLevel": { "Default": "Information" } },\n  "AllowedHosts": "*"\n}\n'
    return f


def adr_text(n, title, status, date, replaces, decision, why, successor_date):
    st = status
    d = date
    if status.startswith("Superseded by"):
        d = successor_date
    out = f"# ADR-{n:04d}: {title}\n\nСтатус: {st} ({d})"
    out += ".\n" if not replaces else f". Заменяет {replaces}.\n"
    out += f"\n## Решение\n\n{decision}\n\n## Почему\n\n{why}\n"
    return out


def doc_files():
    f = {}
    dates = {f"ADR-{n:04d}": date for n, _, _, _, date, _, _, _ in D.PLATFORM_ADR}
    for svc, (pfx, items) in D.SERVICE_ADR.items():
        for n, _, _, _, date, *_ in items:
            dates[f"{pfx}-ADR-{n:03d}"] = date
    for n, slug, title, status, date, replaces, decision, why in D.PLATFORM_ADR:
        sd = dates.get(status.split("by ")[-1], date) if status.startswith("Superseded") else date
        f[f"docs/adr/ADR-{n:04d}-{slug}.md"] = adr_text(n, title, status, date, replaces, decision, why, sd)
    for svc, (pfx, items) in D.SERVICE_ADR.items():
        for n, slug, title, status, date, replaces, decision, why, cons in items:
            sd = dates.get(status.split("by ")[-1], date) if status.startswith("Superseded") else date
            text = adr_text(n, title, status, date, replaces, decision, why, sd).replace(f"# ADR-{n:04d}:", f"# {pfx}-ADR-{n:03d}:")
            if cons:
                text += f"\n## Последствия\n\n{cons}\n"
            f[f"services/{svc}/docs/decisions/{pfx}-ADR-{n:03d}-{slug}.md"] = text
    for n, slug, title, status, date, decision in D.RECORDS:
        f[f"architecture/records/REC-{n:02d}-{slug}.adr.md"] = (
            f"# REC-{n:02d} {title}\n\nStatus: {status}\nDate: {date}\n\nDecision: {decision}\n")
    f["platform/handbook/engineering-rules/README.md"] = D.RULEBOOK_INDEX
    for name, (title, rules) in D.RULEBOOK.items():
        rows = "".join(f"| {i} | {s} | {r} | {a} |\n" for i, s, r, a in rules)
        f[f"platform/handbook/engineering-rules/{name}"] = (
            f"# {title}\n\nСвод правил команд Meridian, раздел «{title}».\n\n| Id | Статус | Правило | Область |\n|---|---|---|---|\n{rows}")
    for name, text in D.HANDBOOK.items():
        f[f"platform/handbook/{name}"] = text
    f.update(D.PRODUCT_DOCS)
    return f


ROOT = {
    "README.md": """# Meridian

Платформа заказов и доставки: заказы, оплата, доставка, каталог, уведомления.

```
libs/        общие библиотеки (Meridian.Common) и контракты событий (Meridian.Contracts)
services/    сервисы: orders, payments, shipping, catalog, inventory, notifications, identity, reporting
docs/        документация: ADR, спеки, runbooks, продукт
platform/    инфраструктура и handbook команд
architecture/ архивные архитектурные записи
```

Адреса документации - `.docs_layout`. Сборка: `dotnet build`. Тесты: `dotnet test`.
""",
    ".docs_layout": "adr: docs/adr/\nrulebook: platform/handbook/engineering-rules/\nproduct: docs/product/\n",
    ".gitignore": "bin/\nobj/\n",
}


def build():
    main = {}
    main.update(ROOT)
    main.update(H.libs())
    main.update(H.shipping())
    main.update(H.payments())
    main.update(H.catalog())
    main.update(H.orders())
    for k, v in filler_files().items():
        assert k not in main or main[k] == v, k
        main[k] = v
    docs = doc_files()
    for k in docs:
        assert k not in main, k
    return main, docs


def run(cmd, cwd, env=None):
    subprocess.run(cmd, cwd=cwd, check=True, env=env, stdout=subprocess.DEVNULL)


def write(dest, files):
    for path, text in files.items():
        full = os.path.join(dest, path)
        os.makedirs(os.path.dirname(full), exist_ok=True)
        with open(full, "w", encoding="utf-8") as fh:
            fh.write(text)


def commit(dest, message, date):
    env = dict(os.environ, GIT_AUTHOR_DATE=date, GIT_COMMITTER_DATE=date)
    run(["git", "add", "-A"], dest)
    run(["git", "commit", "-q", "-m", message], dest, env)


def main_():
    dest = os.path.abspath(sys.argv[1])
    checkout = sys.argv[2] if len(sys.argv) > 2 else "main"
    if os.path.exists(dest):
        sys.exit("exists: " + dest)
    os.makedirs(dest)
    code, docs = build()
    run(["git", "init", "-q", "-b", "main"], dest)
    run(["git", "config", "user.name", "Meridian Team"], dest)
    run(["git", "config", "user.email", "team@example.com"], dest)
    first = {k: v for k, v in code.items() if k.startswith(("libs/", "README", ".docs", ".git"))}
    write(dest, first)
    write(dest, {k: v for k, v in docs.items() if k.startswith("platform/handbook/") and "engineering-rules" not in k})
    commit(dest, "Платформа: общие библиотеки, контракты, handbook", "2026-03-02T10:00:00+00:00")
    write(dest, {k: v for k, v in docs.items() if not (k.startswith("platform/handbook/") and "engineering-rules" not in k)})
    commit(dest, "ADR платформы и сервисов, архивные записи, свод правил", "2026-05-05T10:00:00+00:00")
    write(dest, {k: v for k, v in code.items() if k not in first})
    commit(dest, "Сервисы: orders, payments, shipping, catalog и остальные", "2026-05-25T10:00:00+00:00")

    run(["git", "checkout", "-q", "-b", "feature/partial-refunds", "main"], dest)
    write(dest, H.payments_refund_branch(code))
    commit(dest, "Частичный возврат платежа: POST /v1/payments/{id}/refunds", "2026-06-02T10:00:00+00:00")
    run(["git", "checkout", "-q", "-b", "feature/tariff-cache", "main"], dest)
    write(dest, H.catalog_cache_branch(code))
    commit(dest, "Кэш тарифов в процессе: TTL до 5 минут", "2026-06-03T10:00:00+00:00")
    run(["git", "checkout", "-q", checkout], dest)


if __name__ == "__main__":
    main_()

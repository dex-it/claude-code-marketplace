---
description: Создание и управление Entity Framework Core миграциями
allowed-tools: Bash, Read, Write, Grep, Glob
argument-hint: <migration-name>
---

# /ef-migration

Создание и управление Entity Framework Core миграциями.

## Использование

```
/ef-migration AddProductTable
/ef-migration AddOrderStatus
```

## Процесс

### 1. Проверка изменений

```bash
# Проверить есть ли незафиксированные изменения в DbContext
git diff --name-only | grep -E "(DbContext|Configuration)\.cs"
```

### 2. Создание миграции

```bash
# Найти проект с DbContext
context_project=$(find . -name "*.csproj" -exec grep -l "DbContext" {} \; | head -1)

# Создать миграцию
dotnet ef migrations add $MIGRATION_NAME --project "$context_project"
```

### 3. Проверка миграции

Проверить сгенерированный файл:
- Правильные изменения в Up()
- Корректный откат в Down()
- Нет потери данных

### 4. Применение

```bash
# Применить к dev базе
dotnet ef database update

# Создать SQL скрипт для prod
dotnet ef migrations script --idempotent -o migration.sql
```

## Команды EF Core

```bash
# Создать миграцию
dotnet ef migrations add MigrationName

# Применить все миграции
dotnet ef database update

# Откатить на конкретную миграцию
dotnet ef database update PreviousMigrationName

# Удалить последнюю миграцию (если не применена)
dotnet ef migrations remove

# Создать SQL скрипт
dotnet ef migrations script

# Идемпотентный скрипт (безопасно запускать повторно)
dotnet ef migrations script --idempotent

# Скрипт между миграциями
dotnet ef migrations script Migration1 Migration2
```

## Типичные сценарии

### Добавление новой таблицы
```csharp
// Entities/Product.cs
public class Product
{
    public int Id { get; set; }
    public string Name { get; set; } = null!;
    public decimal Price { get; set; }
}

// Configurations/ProductConfiguration.cs
public class ProductConfiguration : IEntityTypeConfiguration<Product>
{
    public void Configure(EntityTypeBuilder<Product> builder)
    {
        builder.ToTable("Products");
        builder.HasKey(p => p.Id);
        builder.Property(p => p.Name).IsRequired().HasMaxLength(200);
        builder.Property(p => p.Price).HasColumnType("decimal(18,2)");
    }
}
```

### Добавление колонки
```bash
/ef-migration AddProductDescription
```

### Добавление индекса
```csharp
builder.HasIndex(p => p.Name).IsUnique();
```

### Изменение типа колонки
```csharp
// Осторожно! Может привести к потере данных
builder.Property(p => p.Price).HasColumnType("decimal(10,2)");
```

## Вывод

```
EF Migration: AddProductTable

Создана миграция: 20240115_AddProductTable.cs

Изменения:
+ Таблица Products
  - Id (int, PK)
  - Name (nvarchar(200), NOT NULL)
  - Price (decimal(18,2), NOT NULL)
  - CreatedAt (datetime2, DEFAULT GETUTCDATE())
+ Индекс IX_Products_Name (UNIQUE)

Команды:
- Применить: dotnet ef database update
- Откатить: dotnet ef database update PreviousMigration
- SQL скрипт: dotnet ef migrations script --idempotent

Файлы:
- Migrations/20240115_AddProductTable.cs
- Migrations/20240115_AddProductTable.Designer.cs
```

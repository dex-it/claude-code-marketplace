using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Shop.Data.Migrations;

/// <summary>
/// Data only: derives Categories rows and OrderCategories links from the legacy
/// Order.Category string. Raw SQL, not DbContext queries - bypasses the soft-delete
/// query filter on purpose so IsDeleted orders keep their category link too.
/// </summary>
public partial class BackfillOrderCategories : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            INSERT INTO "Categories" ("Id", "Name")
            SELECT gen_random_uuid(), src."Category"
            FROM (
                SELECT DISTINCT "Category"
                FROM "Orders"
                WHERE "Category" IS NOT NULL AND "Category" <> ''
            ) src
            ON CONFLICT ("Name") DO NOTHING;
            """);

        migrationBuilder.Sql(
            """
            INSERT INTO "OrderCategories" ("OrderId", "CategoryId")
            SELECT o."Id", c."Id"
            FROM "Orders" o
            JOIN "Categories" c ON c."Name" = o."Category"
            WHERE o."Category" IS NOT NULL AND o."Category" <> ''
            ON CONFLICT ("OrderId", "CategoryId") DO NOTHING;
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""DELETE FROM "OrderCategories";""");
        migrationBuilder.Sql("""DELETE FROM "Categories";""");
    }
}

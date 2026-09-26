using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Shop.Data.Migrations
{
    public partial class BackfillOrderCategories : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Raw SQL against the tables, not the DbContext, so the Orders.IsDeleted query filter cannot silently drop soft-deleted orders from the backfill.
            migrationBuilder.Sql(
                """
                INSERT INTO "Categories" ("Id", "Name")
                SELECT gen_random_uuid(), src."Category"
                FROM (SELECT DISTINCT "Category" FROM "Orders" WHERE "Category" IS NOT NULL AND "Category" <> '') AS src
                WHERE NOT EXISTS (SELECT 1 FROM "Categories" c WHERE c."Name" = src."Category");
                """);

            migrationBuilder.Sql(
                """
                INSERT INTO "OrderCategories" ("OrderId", "CategoryId")
                SELECT o."Id", c."Id"
                FROM "Orders" o
                JOIN "Categories" c ON c."Name" = o."Category"
                WHERE o."Category" IS NOT NULL AND o."Category" <> ''
                ON CONFLICT DO NOTHING;
                """);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""DELETE FROM "OrderCategories";""");
            migrationBuilder.Sql("""DELETE FROM "Categories";""");
        }
    }
}

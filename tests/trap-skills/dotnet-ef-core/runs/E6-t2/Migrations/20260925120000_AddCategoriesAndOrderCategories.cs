using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Shop.Data.Migrations;

/// <inheritdoc />
public partial class AddCategoriesAndOrderCategories : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "Categories",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_Categories", x => x.Id);
            });

        migrationBuilder.CreateIndex(
            name: "IX_Categories_Name",
            table: "Categories",
            column: "Name",
            unique: true);

        migrationBuilder.CreateTable(
            name: "OrderCategories",
            columns: table => new
            {
                OrderId = table.Column<Guid>(type: "uuid", nullable: false),
                CategoryId = table.Column<Guid>(type: "uuid", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_OrderCategories", x => new { x.OrderId, x.CategoryId });
                table.ForeignKey(
                    name: "FK_OrderCategories_Orders_OrderId",
                    column: x => x.OrderId,
                    principalTable: "Orders",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Cascade);
                table.ForeignKey(
                    name: "FK_OrderCategories_Categories_CategoryId",
                    column: x => x.CategoryId,
                    principalTable: "Categories",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateIndex(
            name: "IX_OrderCategories_CategoryId",
            table: "OrderCategories",
            column: "CategoryId");

        // Raw SQL минует HasQueryFilter(!IsDeleted) на Order - осознанно, чтобы перенести категории и мягко удалённых.
        migrationBuilder.Sql(
            """
            INSERT INTO "Categories" ("Id", "Name")
            SELECT gen_random_uuid(), src."Category"
            FROM (SELECT DISTINCT "Category" FROM "Orders" WHERE "Category" IS NOT NULL AND "Category" <> '') AS src
            WHERE NOT EXISTS (SELECT 1 FROM "Categories" c WHERE c."Name" = src."Category");
            """);

        // ON CONFLICT защищает повторный прогон idempotent-скрипта после сбоя на середине применения.
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

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(name: "OrderCategories");
        migrationBuilder.DropTable(name: "Categories");
    }
}

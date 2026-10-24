using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Shop.Data.Migrations
{
    /// <summary>
    /// Adds Categories and the OrderCategories join table, and backfills them from the
    /// existing Order.Category string column. Order.Category is left in place; dropping it
    /// is a separate follow-up migration once callers read/write through Order.Categories.
    /// </summary>
    public partial class AddCategoriesAndOrderCategories : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Categories",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Categories", x => x.Id);
                });

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
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Categories_Name",
                table: "Categories",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_OrderCategories_CategoryId",
                table: "OrderCategories",
                column: "CategoryId");

            // Backfill: one Categories row per distinct non-empty existing Order.Category value.
            migrationBuilder.Sql(
                """
                INSERT INTO "Categories" ("Id", "Name")
                SELECT gen_random_uuid(), src."Name"
                FROM (
                    SELECT DISTINCT "Category" AS "Name"
                    FROM "Orders"
                    WHERE "Category" IS NOT NULL AND "Category" <> ''
                ) src;
                """);

            // Backfill: link each order to the category row matching its current string value.
            migrationBuilder.Sql(
                """
                INSERT INTO "OrderCategories" ("OrderId", "CategoryId")
                SELECT o."Id", c."Id"
                FROM "Orders" o
                JOIN "Categories" c ON c."Name" = o."Category"
                WHERE o."Category" IS NOT NULL AND o."Category" <> '';
                """);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "OrderCategories");
            migrationBuilder.DropTable(name: "Categories");
        }
    }
}

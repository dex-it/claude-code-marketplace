using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Shop.Data.Migrations
{
    /// <inheritdoc />
    // ModelSnapshot.cs/Designer.cs are not regenerated here - no buildable .csproj in this fixture.
    [Migration("20260925120000_AddCategoriesAndOrderCategories")]
    public partial class AddCategoriesAndOrderCategories : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Categories",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
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
                    CategoryId = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OrderCategories", x => new { x.OrderId, x.CategoryId });
                    table.ForeignKey(
                        name: "FK_OrderCategories_Categories_CategoryId",
                        column: x => x.CategoryId,
                        principalTable: "Categories",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_OrderCategories_Orders_OrderId",
                        column: x => x.OrderId,
                        principalTable: "Orders",
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

            // Order.Category stays until a later contract migration, so Down() below is lossless.
            migrationBuilder.Sql(
"""
INSERT INTO "Categories" ("Name")
SELECT DISTINCT "Category"
FROM "Orders"
WHERE "Category" IS NOT NULL AND "Category" <> ''
ON CONFLICT ("Name") DO NOTHING;
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

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "OrderCategories");

            migrationBuilder.DropTable(
                name: "Categories");
        }
    }
}

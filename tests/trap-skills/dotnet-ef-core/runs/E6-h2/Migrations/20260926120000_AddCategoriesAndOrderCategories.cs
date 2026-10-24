using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Shop.Data.Migrations
{
    // Hand-authored - re-run `dotnet ef migrations add` locally to regenerate ModelSnapshot.cs.
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

            // Covers IsDeleted=true rows too - soft delete keeps the row, filter is app-level only.
            migrationBuilder.Sql(
                """
                INSERT INTO "Categories" ("Id", "Name")
                SELECT gen_random_uuid(), src."Category"
                FROM (
                    SELECT DISTINCT "Category" FROM "Orders"
                    WHERE "Category" IS NOT NULL AND "Category" <> ''
                ) src;

                INSERT INTO "OrderCategories" ("OrderId", "CategoryId")
                SELECT o."Id", c."Id"
                FROM "Orders" o
                JOIN "Categories" c ON c."Name" = o."Category"
                WHERE o."Category" IS NOT NULL AND o."Category" <> '';
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "OrderCategories");
            migrationBuilder.DropTable(name: "Categories");
        }
    }
}

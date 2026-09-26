using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Shop.Data.Migrations
{
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
                    Name = table.Column<string>(type: "text", nullable: false)
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
                    OrdersId = table.Column<Guid>(type: "uuid", nullable: false),
                    CategoriesId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OrderCategories", x => new { x.OrdersId, x.CategoriesId });
                    table.ForeignKey(
                        name: "FK_OrderCategories_Orders_OrdersId",
                        column: x => x.OrdersId,
                        principalTable: "Orders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_OrderCategories_Categories_CategoriesId",
                        column: x => x.CategoriesId,
                        principalTable: "Categories",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_OrderCategories_CategoriesId",
                table: "OrderCategories",
                column: "CategoriesId");

            // Order.Category остаётся - её дропнет отдельная миграция после переключения читателей.
            migrationBuilder.Sql(
                """
                INSERT INTO "Categories" ("Id", "Name")
                SELECT gen_random_uuid(), src."Category"
                FROM (
                    SELECT DISTINCT "Category" FROM "Orders"
                    WHERE "Category" IS NOT NULL AND "Category" <> ''
                ) AS src
                ON CONFLICT ("Name") DO NOTHING;
                """);

            // gen_random_uuid() - ядро PostgreSQL 13+, сверить версию продовой БД перед применением.
            migrationBuilder.Sql(
                """
                INSERT INTO "OrderCategories" ("OrdersId", "CategoriesId")
                SELECT o."Id", c."Id"
                FROM "Orders" AS o
                JOIN "Categories" AS c ON c."Name" = o."Category"
                WHERE o."Category" IS NOT NULL AND o."Category" <> ''
                ON CONFLICT DO NOTHING;
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

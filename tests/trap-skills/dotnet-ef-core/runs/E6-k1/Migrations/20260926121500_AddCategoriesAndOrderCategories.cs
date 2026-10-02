using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Shop.Data.Migrations;

/// <summary>
/// Schema only: adds Categories and the OrderCategories join table. Order.Category stays
/// until the backfill migration and a later drop migration.
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
                    onDelete: ReferentialAction.NoAction); // ClientCascade in the model - see Model.cs
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
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(name: "OrderCategories");
        migrationBuilder.DropTable(name: "Categories");
    }
}

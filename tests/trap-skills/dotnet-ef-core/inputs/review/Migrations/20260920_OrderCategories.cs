using Microsoft.EntityFrameworkCore.Migrations;

namespace Shop.Data.Migrations;

public partial class OrderCategories : Migration
{
    protected override void Up(MigrationBuilder mb)
    {
        mb.CreateTable("Categories", t => new { Id = t.Column<int>(nullable: false).Annotation("Npgsql:ValueGenerationStrategy", Npgsql.EntityFrameworkCore.PostgreSQL.Metadata.NpgsqlValueGenerationStrategy.IdentityByDefaultColumn), Name = t.Column<string>(nullable: false) },
            constraints: t => t.PrimaryKey("PK_Categories", x => x.Id));
        mb.CreateTable("OrderCategories", t => new { OrderId = t.Column<Guid>(nullable: false), CategoryId = t.Column<int>(nullable: false) },
            constraints: t =>
            {
                t.PrimaryKey("PK_OrderCategories", x => new { x.OrderId, x.CategoryId });
                t.ForeignKey("FK_OrderCategories_Orders", x => x.OrderId, "Orders", "Id", onDelete: ReferentialAction.Cascade);
                t.ForeignKey("FK_OrderCategories_Categories", x => x.CategoryId, "Categories", "Id", onDelete: ReferentialAction.Cascade);
            });
        mb.DropColumn("Category", "Orders");
    }

    protected override void Down(MigrationBuilder mb)
    {
        mb.AddColumn<string>("Category", "Orders", nullable: false, defaultValue: "");
        mb.DropTable("OrderCategories");
        mb.DropTable("Categories");
    }
}

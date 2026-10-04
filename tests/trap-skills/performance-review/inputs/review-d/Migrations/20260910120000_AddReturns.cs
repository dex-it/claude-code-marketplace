using Microsoft.EntityFrameworkCore.Migrations;

namespace Shop.Api.Migrations;

public partial class AddReturns : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "ReturnRequests",
            columns: table => new
            {
                Id = table.Column<int>(nullable: false)
                    .Annotation("Npgsql:ValueGenerationStrategy", Npgsql.EntityFrameworkCore.PostgreSQL.Metadata.NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                TenantId = table.Column<int>(nullable: false),
                OrderId = table.Column<int>(nullable: false),
                Status = table.Column<int>(nullable: false),
                Reason = table.Column<string>(nullable: false),
                CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                RefundExternalId = table.Column<string>(nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_ReturnRequests", x => x.Id);
                table.ForeignKey("FK_ReturnRequests_Orders_OrderId", x => x.OrderId, "Orders", "Id");
            });

        migrationBuilder.CreateTable(
            name: "ReturnLines",
            columns: table => new
            {
                Id = table.Column<int>(nullable: false)
                    .Annotation("Npgsql:ValueGenerationStrategy", Npgsql.EntityFrameworkCore.PostgreSQL.Metadata.NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                ReturnRequestId = table.Column<int>(nullable: false),
                OrderLineId = table.Column<int>(nullable: false),
                Quantity = table.Column<int>(nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_ReturnLines", x => x.Id);
                table.ForeignKey("FK_ReturnLines_ReturnRequests_ReturnRequestId", x => x.ReturnRequestId, "ReturnRequests", "Id", onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateIndex("IX_ReturnRequests_TenantId_Status", "ReturnRequests", new[] { "TenantId", "Status" });
        migrationBuilder.CreateIndex("IX_ReturnRequests_OrderId", "ReturnRequests", "OrderId");
        migrationBuilder.CreateIndex("IX_ReturnLines_ReturnRequestId", "ReturnLines", "ReturnRequestId");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable("ReturnLines");
        migrationBuilder.DropTable("ReturnRequests");
    }
}

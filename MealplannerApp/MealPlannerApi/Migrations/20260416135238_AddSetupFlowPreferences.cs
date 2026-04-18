using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MealPlannerApi.Migrations
{
    /// <inheritdoc />
    public partial class AddSetupFlowPreferences : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "DoelType",
                table: "Goals",
                type: "varchar(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "Balans")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "GewensteMaaltijden",
                table: "Profiles",
                type: "varchar(200)",
                maxLength: 200,
                nullable: false,
                defaultValue: "Ontbijt,Lunch,Diner")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<int>(
                name: "MaaltijdenPerDag",
                table: "Profiles",
                type: "int",
                nullable: false,
                defaultValue: 3);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DoelType",
                table: "Goals");

            migrationBuilder.DropColumn(
                name: "GewensteMaaltijden",
                table: "Profiles");

            migrationBuilder.DropColumn(
                name: "MaaltijdenPerDag",
                table: "Profiles");
        }
    }
}

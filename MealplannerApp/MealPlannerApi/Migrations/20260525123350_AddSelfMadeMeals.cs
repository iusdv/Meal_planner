using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MealPlannerApi.Migrations
{
    /// <inheritdoc />
    public partial class AddSelfMadeMeals : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsZelfgemaakt",
                table: "Meals",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsZelfgemaakt",
                table: "Meals");
        }
    }
}

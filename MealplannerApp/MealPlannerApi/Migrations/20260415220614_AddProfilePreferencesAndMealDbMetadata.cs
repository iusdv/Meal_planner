using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MealPlannerApi.Migrations
{
    /// <inheritdoc />
    public partial class AddProfilePreferencesAndMealDbMetadata : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Allergieen",
                table: "Profiles",
                type: "varchar(1000)",
                maxLength: 1000,
                nullable: false,
                defaultValue: "")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "Dieetvoorkeur",
                table: "Profiles",
                type: "varchar(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<double>(
                name: "LengteCm",
                table: "Profiles",
                type: "double",
                nullable: false,
                defaultValue: 0.0);

            migrationBuilder.AddColumn<string>(
                name: "DieetLabels",
                table: "Meals",
                type: "varchar(500)",
                maxLength: 500,
                nullable: false,
                defaultValue: "")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "ExternalMealDbId",
                table: "Meals",
                type: "varchar(50)",
                maxLength: 50,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_Meals_ExternalMealDbId",
                table: "Meals",
                column: "ExternalMealDbId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Meals_ExternalMealDbId",
                table: "Meals");

            migrationBuilder.DropColumn(
                name: "Allergieen",
                table: "Profiles");

            migrationBuilder.DropColumn(
                name: "Dieetvoorkeur",
                table: "Profiles");

            migrationBuilder.DropColumn(
                name: "LengteCm",
                table: "Profiles");

            migrationBuilder.DropColumn(
                name: "DieetLabels",
                table: "Meals");

            migrationBuilder.DropColumn(
                name: "ExternalMealDbId",
                table: "Meals");
        }
    }
}

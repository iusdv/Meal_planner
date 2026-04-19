using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MealPlannerApi.Migrations
{
    /// <inheritdoc />
    public partial class AddMealRecipeDetails : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Instructies",
                table: "Meals",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.Sql("""
                UPDATE Meals
                SET Instructies = Beschrijving
                WHERE Instructies IS NULL OR Instructies = ''
                """);

            migrationBuilder.AlterColumn<string>(
                name: "Instructies",
                table: "Meals",
                type: "longtext",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "longtext",
                oldNullable: true)
                .Annotation("MySql:CharSet", "utf8mb4")
                .OldAnnotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<int>(
                name: "Porties",
                table: "Meals",
                type: "int",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<string>(
                name: "OrigineleHoeveelheid",
                table: "MealIngredients",
                type: "varchar(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "")
                .Annotation("MySql:CharSet", "utf8mb4");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Instructies",
                table: "Meals");

            migrationBuilder.DropColumn(
                name: "Porties",
                table: "Meals");

            migrationBuilder.DropColumn(
                name: "OrigineleHoeveelheid",
                table: "MealIngredients");
        }
    }
}

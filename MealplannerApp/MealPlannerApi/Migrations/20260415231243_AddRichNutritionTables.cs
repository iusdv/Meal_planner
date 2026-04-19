using System;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MealPlannerApi.Migrations
{
    /// <inheritdoc />
    public partial class AddRichNutritionTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "IngredientNutritionMappings",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    IngredientId = table.Column<int>(type: "int", nullable: false),
                    Source = table.Column<string>(type: "varchar(120)", maxLength: 120, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    SearchTerm = table.Column<string>(type: "varchar(200)", maxLength: 200, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    ExternalFoodId = table.Column<string>(type: "varchar(80)", maxLength: 80, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    ExternalFoodDescription = table.Column<string>(type: "varchar(500)", maxLength: 500, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    ExternalDataType = table.Column<string>(type: "varchar(80)", maxLength: 80, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    MatchScore = table.Column<double>(type: "double", nullable: true),
                    IsEstimated = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    MatchedAtUtc = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    LastSyncedAtUtc = table.Column<DateTime>(type: "datetime(6)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_IngredientNutritionMappings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_IngredientNutritionMappings_Ingredients_IngredientId",
                        column: x => x.IngredientId,
                        principalTable: "Ingredients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "NutrientDefinitions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    Key = table.Column<string>(type: "varchar(80)", maxLength: 80, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Label = table.Column<string>(type: "varchar(160)", maxLength: 160, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Section = table.Column<string>(type: "varchar(120)", maxLength: 120, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Unit = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    DailyValue = table.Column<double>(type: "double", nullable: true),
                    Highlight = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    DisplayOrder = table.Column<double>(type: "double", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_NutrientDefinitions", x => x.Id);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "IngredientNutrientValues",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    IngredientNutritionMappingId = table.Column<int>(type: "int", nullable: false),
                    NutrientDefinitionId = table.Column<int>(type: "int", nullable: false),
                    ValuePer100g = table.Column<double>(type: "double", nullable: false),
                    Unit = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    IsEstimated = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    LastSyncedAtUtc = table.Column<DateTime>(type: "datetime(6)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_IngredientNutrientValues", x => x.Id);
                    table.ForeignKey(
                        name: "FK_IngredientNutrientValues_IngredientNutritionMappings_Ingredi~",
                        column: x => x.IngredientNutritionMappingId,
                        principalTable: "IngredientNutritionMappings",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_IngredientNutrientValues_NutrientDefinitions_NutrientDefinit~",
                        column: x => x.NutrientDefinitionId,
                        principalTable: "NutrientDefinitions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "NutrientExternalIds",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    NutrientDefinitionId = table.Column<int>(type: "int", nullable: false),
                    Source = table.Column<string>(type: "varchar(120)", maxLength: 120, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    ExternalNutrientNumber = table.Column<string>(type: "varchar(40)", maxLength: 40, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_NutrientExternalIds", x => x.Id);
                    table.ForeignKey(
                        name: "FK_NutrientExternalIds_NutrientDefinitions_NutrientDefinitionId",
                        column: x => x.NutrientDefinitionId,
                        principalTable: "NutrientDefinitions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_IngredientNutrientValues_IngredientNutritionMappingId_Nutrie~",
                table: "IngredientNutrientValues",
                columns: new[] { "IngredientNutritionMappingId", "NutrientDefinitionId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_IngredientNutrientValues_NutrientDefinitionId",
                table: "IngredientNutrientValues",
                column: "NutrientDefinitionId");

            migrationBuilder.CreateIndex(
                name: "IX_IngredientNutritionMappings_IngredientId_Source",
                table: "IngredientNutritionMappings",
                columns: new[] { "IngredientId", "Source" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_NutrientDefinitions_Key",
                table: "NutrientDefinitions",
                column: "Key",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_NutrientExternalIds_NutrientDefinitionId",
                table: "NutrientExternalIds",
                column: "NutrientDefinitionId");

            migrationBuilder.CreateIndex(
                name: "IX_NutrientExternalIds_Source_ExternalNutrientNumber",
                table: "NutrientExternalIds",
                columns: new[] { "Source", "ExternalNutrientNumber" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "IngredientNutrientValues");

            migrationBuilder.DropTable(
                name: "NutrientExternalIds");

            migrationBuilder.DropTable(
                name: "IngredientNutritionMappings");

            migrationBuilder.DropTable(
                name: "NutrientDefinitions");
        }
    }
}

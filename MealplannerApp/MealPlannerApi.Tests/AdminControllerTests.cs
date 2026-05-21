using MealPlannerApi.Controllers;
using MealPlannerApi.DTOs;
using MealPlannerApi.Tests.Support;
using Microsoft.AspNetCore.Mvc;

namespace MealPlannerApi.Tests;

public class AdminControllerTests
{
    [Fact(DisplayName = "Admin - users ophalen retourneert DTO's zonder wachtwoordhashes")]
    public async Task GetUsers_ReturnsDtosWithoutPasswordHashes()
    {
        using var database = TestDatabase.Create();
        ControllerTestContext.AddUser(database.Db, role: "Admin");
        var controller = new AdminController(database.Db);
        ControllerTestContext.SetUser(controller, 1, "Admin");

        var result = await controller.GetUsers();

        var ok = Assert.IsType<OkObjectResult>(result);
        var users = Assert.IsAssignableFrom<IEnumerable<UserDto>>(ok.Value).ToList();
        var user = Assert.Single(users);
        Assert.Equal("Admin", user.Rol);
        Assert.Null(typeof(UserDto).GetProperty("WachtwoordHash"));
    }

    [Fact(DisplayName = "Admin - voedingswaarde toevoegen en bijwerken houdt een enkele record per ingredient")]
    public async Task UpsertNutritionalValue_CreatesAndUpdatesNutritionForIngredient()
    {
        using var database = TestDatabase.Create();
        var controller = new AdminController(database.Db);
        ControllerTestContext.SetUser(controller, 1, "Admin");

        var ingredientResult = await controller.AddIngredient(new CreateIngredientDto("Chicken", "g"));
        var ingredient = Assert.IsType<IngredientDto>(Assert.IsType<OkObjectResult>(ingredientResult).Value);

        await controller.UpsertNutritionalValue(ingredient.Id, new UpsertNutritionalValueDto(165, 31, 0, 4));
        var updateResult = await controller.UpsertNutritionalValue(ingredient.Id, new UpsertNutritionalValueDto(170, 32, 1, 5));

        var ok = Assert.IsType<OkObjectResult>(updateResult);
        var nutrition = Assert.IsType<NutritionalValueDto>(ok.Value);
        Assert.Equal(170, nutrition.Kcal);
        Assert.Single(database.Db.NutritionalValues);
    }
}

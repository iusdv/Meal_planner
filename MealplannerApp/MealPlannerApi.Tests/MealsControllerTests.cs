using MealPlannerApi.DTOs;
using MealPlannerApi.Tests.Support;
using Microsoft.AspNetCore.Mvc;

namespace MealPlannerApi.Tests;

public class MealsControllerTests
{
    [Fact(DisplayName = "Maaltijden - pagination filtert op categorie/zoekterm/exclude en begrenst pageSize")]
    public async Task GetPaged_ClampsPagingAndFiltersByCategorySearchAndExcludedMeal()
    {
        using var database = TestDatabase.Create();
        SeedMeals(database.Db);
        var controller = ControllerTestContext.CreateMealsController(database.Db);
        ControllerTestContext.SetUser(controller, 1);

        var result = await controller.GetPaged(page: -3, pageSize: 100, category: "Lunch", search: "wrap", excludeMealId: 10);

        var ok = Assert.IsType<OkObjectResult>(result);
        var page = Assert.IsType<PaginatedResultDto<MealDto>>(ok.Value);

        Assert.Equal(1, page.Page);
        Assert.Equal(48, page.PageSize);
        Assert.True(page.TotalItems > 0);
        Assert.NotEmpty(page.Items);
        Assert.All(page.Items, item =>
        {
            Assert.Equal("Lunch", item.Categorie);
            Assert.Contains("wrap", item.Naam, StringComparison.OrdinalIgnoreCase);
            Assert.NotEqual(10, item.Id);
        });
    }

    [Fact(DisplayName = "Maaltijden - pagination zet te hoge pagina terug naar laatste bestaande pagina")]
    public async Task GetPaged_MovesRequestedPageBackWhenPageIsPastTotalPages()
    {
        using var database = TestDatabase.Create();
        SeedMeals(database.Db);
        var controller = ControllerTestContext.CreateMealsController(database.Db);
        ControllerTestContext.SetUser(controller, 1);

        var result = await controller.GetPaged(page: 99, pageSize: 10, category: "Ontbijt");

        var ok = Assert.IsType<OkObjectResult>(result);
        var page = Assert.IsType<PaginatedResultDto<MealDto>>(ok.Value);

        Assert.Equal(page.TotalPages, page.Page);
        Assert.True(page.TotalPages > 0);
        Assert.True(page.Items.Count <= 10);
        Assert.All(page.Items, item => Assert.Equal("Ontbijt", item.Categorie));
    }

    private static void SeedMeals(MealPlannerApi.Data.MealPlannerDbContext db)
    {
        for (var index = 1; index <= 120; index++)
        {
            var category = index % 3 == 0 ? "Ontbijt" : index % 3 == 1 ? "Lunch" : "Diner";
            var name = category == "Lunch" && index % 2 == 0
                ? $"Lunch wrap {index}"
                : $"{category} meal {index}";

            ControllerTestContext.AddMeal(db, index, name, category);
        }
    }
}

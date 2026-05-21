using MealPlannerApi.Controllers;
using MealPlannerApi.DTOs;
using MealPlannerApi.Tests.Support;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace MealPlannerApi.Tests;

public class PlannedMealsControllerTests
{
    [Fact(DisplayName = "Planning - plannen vervangt dezelfde user/datum/maaltijdslot in plaats van dubbel aanmaken")]
    public async Task Plan_UpsertsMealForSameUserDateAndMealType()
    {
        using var database = TestDatabase.Create();
        ControllerTestContext.AddUser(database.Db);
        ControllerTestContext.AddMeal(database.Db, 1, "Meal one");
        ControllerTestContext.AddMeal(database.Db, 2, "Meal two");
        var controller = new PlannedMealsController(database.Db);
        ControllerTestContext.SetUser(controller, 1);

        await controller.Plan(new CreatePlannedMealDto(1, new DateTime(2026, 5, 19, 14, 30, 0), "Diner 1"));
        var result = await controller.Plan(new CreatePlannedMealDto(2, new DateTime(2026, 5, 19, 8, 0, 0), "Diner 1"));

        var ok = Assert.IsType<OkObjectResult>(result);
        var dto = Assert.IsType<PlannedMealDto>(ok.Value);
        var plannedMeal = await database.Db.PlannedMeals.SingleAsync();

        Assert.Equal(2, dto.MealId);
        Assert.Equal(2, plannedMeal.MealId);
        Assert.Equal(new DateTime(2026, 5, 19), plannedMeal.Datum.Date);
        Assert.Equal(DateTimeKind.Utc, plannedMeal.Datum.Kind);
    }

    [Fact(DisplayName = "Planning - ophalen toont alleen geplande maaltijden van de ingelogde user")]
    public async Task GetMyPlan_ReturnsOnlyMealsForCurrentUser()
    {
        using var database = TestDatabase.Create();
        ControllerTestContext.AddUser(database.Db, 1, "user1@example.test");
        ControllerTestContext.AddUser(database.Db, 2, "user2@example.test");
        ControllerTestContext.AddMeal(database.Db, 1, "Visible meal");
        ControllerTestContext.AddMeal(database.Db, 2, "Other user meal");
        database.Db.PlannedMeals.AddRange(
            new() { UserId = 1, MealId = 1, Datum = new DateTime(2026, 5, 19), Maaltijdtype = "Lunch 1" },
            new() { UserId = 2, MealId = 2, Datum = new DateTime(2026, 5, 19), Maaltijdtype = "Lunch 1" });
        await database.Db.SaveChangesAsync();

        var controller = new PlannedMealsController(database.Db);
        ControllerTestContext.SetUser(controller, 1);

        var result = await controller.GetMyPlan();

        var ok = Assert.IsType<OkObjectResult>(result);
        var items = Assert.IsAssignableFrom<IEnumerable<PlannedMealDto>>(ok.Value).ToList();
        var item = Assert.Single(items);
        Assert.Equal("Visible meal", item.MealNaam);
    }
}

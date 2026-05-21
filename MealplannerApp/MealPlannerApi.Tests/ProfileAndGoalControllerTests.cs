using MealPlannerApi.Controllers;
using MealPlannerApi.DTOs;
using MealPlannerApi.Tests.Support;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace MealPlannerApi.Tests;

public class ProfileAndGoalControllerTests
{
    [Fact(DisplayName = "Profiel - opslaan normaliseert gekozen eetmomenten naar vaste slots")]
    public async Task ProfileUpsert_NormalizesMealMomentsBeforeSaving()
    {
        using var database = TestDatabase.Create();
        ControllerTestContext.AddUser(database.Db);
        var controller = new ProfileController(database.Db);
        ControllerTestContext.SetUser(controller, 1);

        var result = await controller.Upsert(new UpsertProfileDto(
            "Man",
            30,
            80,
            180,
            "Zittend werk, lichte beweging",
            "",
            "",
            4,
            "Diner, Ontbijt, Snack, Diner"));

        var ok = Assert.IsType<OkObjectResult>(result);
        var profile = Assert.IsType<ProfileDto>(ok.Value);

        Assert.Equal("Alles", profile.Dieetvoorkeur);
        Assert.Equal("Ontbijt 1,Diner 1,Diner 2,Snack 1", profile.GewensteMaaltijden);
        Assert.Equal(profile.GewensteMaaltijden, (await database.Db.Profiles.SingleAsync()).GewensteMaaltijden);
    }

    [Fact(DisplayName = "Profiel - opslaan weigert wanneer aantal gekozen eetmomenten niet klopt")]
    public async Task ProfileUpsert_RejectsInvalidMealMomentCount()
    {
        using var database = TestDatabase.Create();
        ControllerTestContext.AddUser(database.Db);
        var controller = new ProfileController(database.Db);
        ControllerTestContext.SetUser(controller, 1);

        var result = await controller.Upsert(new UpsertProfileDto(
            "Vrouw",
            25,
            65,
            170,
            "Licht actief, 3-4 keer sporten per week",
            "Alles",
            "",
            3,
            "Ontbijt, Lunch"));

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact(DisplayName = "Profiel - opslaan weigert ongeldig geslacht, lengte en activiteit")]
    public async Task ProfileUpsert_RejectsInvalidCoreProfileValues()
    {
        using var database = TestDatabase.Create();
        ControllerTestContext.AddUser(database.Db);
        var controller = new ProfileController(database.Db);
        ControllerTestContext.SetUser(controller, 1);

        var invalidGender = await controller.Upsert(ValidProfile() with { Gender = "Onbekend" });
        var invalidHeight = await controller.Upsert(ValidProfile() with { LengteCm = 252 });
        var invalidActivity = await controller.Upsert(ValidProfile() with { Activiteit = "Onbekend actief" });

        Assert.IsType<BadRequestObjectResult>(invalidGender);
        Assert.IsType<BadRequestObjectResult>(invalidHeight);
        Assert.IsType<BadRequestObjectResult>(invalidActivity);
        Assert.Empty(database.Db.Profiles);
    }

    [Fact(DisplayName = "Doelen - opslaan maakt doel aan en werkt bestaand doel bij voor huidige user")]
    public async Task GoalsUpsert_CreatesAndUpdatesGoalForCurrentUser()
    {
        using var database = TestDatabase.Create();
        ControllerTestContext.AddUser(database.Db);
        var controller = new GoalsController(database.Db);
        ControllerTestContext.SetUser(controller, 1);

        await controller.Upsert(new UpsertGoalDto("", 2200, 140, 250, 70));
        var secondResult = await controller.Upsert(new UpsertGoalDto("Afvallen", 1900, 150, 180, 60));

        var ok = Assert.IsType<OkObjectResult>(secondResult);
        var goal = Assert.IsType<GoalDto>(ok.Value);

        Assert.Equal("Afvallen", goal.DoelType);
        Assert.Equal(1900, goal.Caloriedoel);
        Assert.Equal(1, goal.UserId);
        Assert.Equal(1, await database.Db.Goals.CountAsync());
    }

    private static UpsertProfileDto ValidProfile() => new(
        "Man",
        30,
        80,
        180,
        "Zittend werk, lichte beweging",
        "Alles",
        "",
        3,
        "Ontbijt,Lunch,Diner");
}

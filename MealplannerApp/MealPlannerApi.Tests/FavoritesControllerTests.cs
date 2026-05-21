using MealPlannerApi.Controllers;
using MealPlannerApi.DTOs;
using MealPlannerApi.Models;
using MealPlannerApi.Tests.Support;
using Microsoft.AspNetCore.Mvc;

namespace MealPlannerApi.Tests;

public class FavoritesControllerTests
{
    [Fact(DisplayName = "Favorieten - toevoegen maakt favoriet aan en weigert dubbele favoriet")]
    public async Task Add_CreatesFavoriteAndRejectsDuplicates()
    {
        using var database = TestDatabase.Create();
        ControllerTestContext.AddUser(database.Db);
        ControllerTestContext.AddMeal(database.Db, 1, "Favorite meal");
        var controller = new FavoritesController(database.Db);
        ControllerTestContext.SetUser(controller, 1);

        var first = await controller.Add(new AddFavoriteDto(1));
        var duplicate = await controller.Add(new AddFavoriteDto(1));

        Assert.IsType<OkObjectResult>(first);
        Assert.IsType<ConflictObjectResult>(duplicate);
    }

    [Fact(DisplayName = "Favorieten - toevoegen geeft NotFound wanneer maaltijd niet bestaat")]
    public async Task Add_ReturnsNotFoundWhenMealDoesNotExist()
    {
        using var database = TestDatabase.Create();
        ControllerTestContext.AddUser(database.Db);
        var controller = new FavoritesController(database.Db);
        ControllerTestContext.SetUser(controller, 1);

        var result = await controller.Add(new AddFavoriteDto(999));

        Assert.IsType<NotFoundObjectResult>(result);
        Assert.Empty(database.Db.Favorites);
    }

    [Fact(DisplayName = "Favorieten - verwijderen kan geen favoriet van een andere user verwijderen")]
    public async Task Remove_DoesNotRemoveFavoriteFromAnotherUser()
    {
        using var database = TestDatabase.Create();
        ControllerTestContext.AddUser(database.Db, 1, "user1@example.test");
        ControllerTestContext.AddUser(database.Db, 2, "user2@example.test");
        ControllerTestContext.AddMeal(database.Db, 1, "Favorite meal");
        database.Db.Favorites.Add(new Favorite { UserId = 2, MealId = 1 });
        await database.Db.SaveChangesAsync();

        var controller = new FavoritesController(database.Db);
        ControllerTestContext.SetUser(controller, 1);

        var result = await controller.Remove(database.Db.Favorites.Single().Id);

        Assert.IsType<NotFoundResult>(result);
        Assert.Single(database.Db.Favorites);
    }
}

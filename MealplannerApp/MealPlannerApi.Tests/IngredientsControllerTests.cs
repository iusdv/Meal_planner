using MealPlannerApi.DTOs;
using MealPlannerApi.Models;
using MealPlannerApi.Tests.Support;
using Microsoft.AspNetCore.Mvc;

namespace MealPlannerApi.Tests;

public class IngredientsControllerTests
{
    [Fact(DisplayName = "Ingredienten - zoeken geeft lokale ingredienten met voedingswaarde terug")]
    public async Task Search_ReturnsStoredIngredientSuggestions()
    {
        using var database = TestDatabase.Create();
        database.Db.Ingredients.AddRange(
            new Ingredient
            {
                Naam = "Waffles",
                Eenheid = "portie",
                NutritionalValue = new NutritionalValue
                {
                    Kcal = 450,
                    Eiwit = 5,
                    Koolhydraat = 65,
                    Vet = 18
                }
            },
            new Ingredient
            {
                Naam = "Wheat Flour",
                Eenheid = "portie"
            },
            new Ingredient
            {
                Naam = "Chicken",
                Eenheid = "portie"
            });
        database.Db.SaveChanges();

        var controller = ControllerTestContext.CreateIngredientsController(database.Db);
        ControllerTestContext.SetUser(controller, 1);

        var result = await controller.Search("wa");

        var ok = Assert.IsType<OkObjectResult>(result);
        var suggestions = Assert.IsType<List<IngredientDto>>(ok.Value);

        var suggestion = Assert.Single(suggestions);
        Assert.Equal("Waffles", suggestion.Naam);
        Assert.NotNull(suggestion.Voedingswaarde);
    }

    [Fact(DisplayName = "Ingredienten - zoeken weigert te korte of onherkenbare zoektermen")]
    public async Task Search_RejectsWeakQueries()
    {
        using var database = TestDatabase.Create();
        database.Db.Ingredients.Add(new Ingredient { Naam = "Sugar", Eenheid = "portie" });
        database.Db.SaveChanges();

        var controller = ControllerTestContext.CreateIngredientsController(database.Db);
        ControllerTestContext.SetUser(controller, 1);

        var shortResult = await controller.Search("s");
        var numericResult = await controller.Search("12345");

        Assert.Empty(Assert.IsType<List<IngredientDto>>(Assert.IsType<OkObjectResult>(shortResult).Value));
        Assert.Empty(Assert.IsType<List<IngredientDto>>(Assert.IsType<OkObjectResult>(numericResult).Value));
    }
}

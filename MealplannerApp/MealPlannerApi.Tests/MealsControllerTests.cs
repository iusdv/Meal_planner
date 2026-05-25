using MealPlannerApi.DTOs;
using MealPlannerApi.Models;
using MealPlannerApi.Services;
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

    [Fact(DisplayName = "Maaltijden - zelfgemaakt filter toont alleen zelfgemaakte maaltijden")]
    public async Task GetPaged_CanFilterSelfMadeMeals()
    {
        using var database = TestDatabase.Create();
        SeedMeals(database.Db);
        ControllerTestContext.AddMeal(database.Db, 300, "Eigen curry", "Diner", isZelfgemaakt: true);
        var controller = ControllerTestContext.CreateMealsController(database.Db);
        ControllerTestContext.SetUser(controller, 1);

        var result = await controller.GetPaged(page: 1, pageSize: 12, category: "Zelfgemaakt");

        var ok = Assert.IsType<OkObjectResult>(result);
        var page = Assert.IsType<PaginatedResultDto<MealDto>>(ok.Value);

        Assert.Single(page.Items);
        Assert.Equal("Eigen curry", page.Items[0].Naam);
        Assert.True(page.Items[0].IsZelfgemaakt);
    }

    [Fact(DisplayName = "Maaltijden - detail gebruikt opgeslagen voedingscache")]
    public async Task GetById_UsesStoredNutritionCache()
    {
        using var database = TestDatabase.Create();
        var meal = ControllerTestContext.AddMeal(database.Db, 500, "Cached rice bowl", "Lunch");
        var ingredient = new Ingredient { Naam = "Rice", Eenheid = "g" };
        var caloriesDefinition = new NutrientDefinition
        {
            Key = "calories",
            Label = "Calories",
            Section = "Main",
            Unit = "kcal",
            Highlight = true,
            DisplayOrder = 0
        };
        var mapping = new IngredientNutritionMapping
        {
            Ingredient = ingredient,
            Source = NutritionCatalog.FoodDataCentralSource,
            SearchTerm = "rice",
            ExternalFoodDescription = "Rice",
            MatchedAtUtc = DateTime.UtcNow,
            LastSyncedAtUtc = DateTime.UtcNow,
            NutrientValues =
            [
                new IngredientNutrientValue
                {
                    NutrientDefinition = caloriesDefinition,
                    ValuePer100g = 360,
                    Unit = "kcal",
                    LastSyncedAtUtc = DateTime.UtcNow
                }
            ]
        };

        database.Db.Ingredients.Add(ingredient);
        database.Db.NutrientDefinitions.Add(caloriesDefinition);
        database.Db.IngredientNutritionMappings.Add(mapping);
        database.Db.MealIngredients.Add(new MealIngredient
        {
            Meal = meal,
            Ingredient = ingredient,
            Hoeveelheid = 100,
            OrigineleHoeveelheid = "100 g"
        });
        database.Db.SaveChanges();

        var controller = ControllerTestContext.CreateMealsController(database.Db);
        ControllerTestContext.SetUser(controller, 1);

        var result = await controller.GetById(meal.Id);

        var ok = Assert.IsType<OkObjectResult>(result);
        var dto = Assert.IsType<MealDto>(ok.Value);
        Assert.NotNull(dto.NutritionFacts);
        Assert.Equal("Voedingscache uit database", dto.NutritionFacts.Source);
        Assert.Contains(dto.NutritionFacts.Sections.SelectMany(section => section.Rows),
            row => row.Key == "calories" && row.Value == 360);
    }

    [Fact(DisplayName = "Maaltijden - gebruiker kan strikte zelfgemaakte maaltijd aanmaken")]
    public async Task CreateSelfMade_CreatesGloballyVisibleSelfMadeMeal()
    {
        using var database = TestDatabase.Create();
        var controller = ControllerTestContext.CreateMealsController(database.Db);
        ControllerTestContext.SetUser(controller, 1);

        var result = await controller.CreateSelfMade(new CreateSelfMadeMealDto(
            "Pittige couscous bowl",
            "Een vullende bowl met groenten, kruiden en yoghurt voor doordeweeks.",
            "Snijd alle groenten klein. Bak de groenten kort aan en maak de couscous klaar. Meng alles met yoghurt en serveer direct.",
            "Lunch",
            25,
            2,
            "https://example.com/couscous.jpg",
            "Vegetarian",
            [
                new("Couscous", 150, "g", null, 360, 12, 75, 2),
                new("Yoghurt", 100, "g", null, 61, 3.5, 4.7, 3.3),
                new("Paprika", 1, "stuk", null, 31, 1, 6, 0.3)
            ]));

        var created = Assert.IsType<CreatedAtActionResult>(result);
        var dto = Assert.IsType<MealDto>(created.Value);

        Assert.True(dto.IsZelfgemaakt);
        Assert.Equal("Lunch", dto.Categorie);
        Assert.Equal(3, dto.Ingredienten.Count);
        Assert.All(dto.Ingredienten, ingredient => Assert.NotNull(ingredient.Voedingswaarde));
        Assert.Contains(database.Db.Meals, meal => meal.Naam == "Pittige couscous bowl" && meal.IsZelfgemaakt);
    }

    [Fact(DisplayName = "Maaltijden - zelfgemaakte maaltijd kan bestaand ingredient hergebruiken")]
    public async Task CreateSelfMade_ReusesSelectedExistingIngredient()
    {
        using var database = TestDatabase.Create();
        var knownIngredient = new MealPlannerApi.Models.Ingredient
        {
            Naam = "Waffles",
            Eenheid = "portie",
            NutritionalValue = new MealPlannerApi.Models.NutritionalValue
            {
                Kcal = 450,
                Eiwit = 5,
                Koolhydraat = 65,
                Vet = 18
            }
        };
        database.Db.Ingredients.Add(knownIngredient);
        database.Db.SaveChanges();

        var controller = ControllerTestContext.CreateMealsController(database.Db);
        ControllerTestContext.SetUser(controller, 1);

        var result = await controller.CreateSelfMade(new CreateSelfMadeMealDto(
            "Eigen wafel snack",
            "Een snack met een bekende wafel en zelf ingevulde siroop.",
            "Leg de wafel op een bord en verwarm deze kort. Voeg de siroop toe en serveer direct.",
            "Snack",
            5,
            1,
            "https://example.com/wafel.jpg",
            null,
            [
                new("Waffles", 1, "stuk", knownIngredient.Id, null, null, null, null),
                new("Siroop", 20, "g", null, 304, 0, 82, 0)
            ]));

        var created = Assert.IsType<CreatedAtActionResult>(result);
        var dto = Assert.IsType<MealDto>(created.Value);

        Assert.Contains(dto.Ingredienten, ingredient => ingredient.IngredientId == knownIngredient.Id && ingredient.IngredientNaam == "Waffles");
        Assert.Equal(2, database.Db.Ingredients.Count());
    }

    [Fact(DisplayName = "Maaltijden - zelfgemaakte maaltijd vereist geldige afbeelding en unieke ingredienten")]
    public async Task CreateSelfMade_RejectsInvalidSelfMadeMeal()
    {
        using var database = TestDatabase.Create();
        var controller = ControllerTestContext.CreateMealsController(database.Db);
        ControllerTestContext.SetUser(controller, 1);

        var result = await controller.CreateSelfMade(new CreateSelfMadeMealDto(
            "Soep",
            "Een korte tekst die lang genoeg is voor deze test.",
            "Maak soep en serveer warm met brood erbij op tafel.",
            "Diner",
            20,
            2,
            "not-a-url",
            null,
            [
                new("Tomaat", 2, "stuk", null, 18, 0.9, 3.9, 0.2),
                new("Tomaat", 100, "g", null, 18, 0.9, 3.9, 0.2)
            ]));

        Assert.IsType<BadRequestObjectResult>(result);
        Assert.Empty(database.Db.Meals);
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

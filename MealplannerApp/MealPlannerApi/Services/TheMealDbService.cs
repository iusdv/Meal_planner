using System.Globalization;
using System.Text.Json;
using MealPlannerApi.Data;
using MealPlannerApi.Models;
using Microsoft.EntityFrameworkCore;

namespace MealPlannerApi.Services;

public class TheMealDbService
{
    private readonly MealPlannerDbContext _db;
    private readonly HttpClient _httpClient;
    private readonly ILogger<TheMealDbService> _logger;
    private const int DefaultMealsPerCategory = 12;
    private const int DefaultMinimumCatalogSize = 120;

    private static readonly IReadOnlyList<MealImportCategory> StarterCategories =
    [
        new("Breakfast", "Ontbijt", "Anything"),
        new("Vegetarian", "Lunch", "Vegetarian"),
        new("Pasta", "Lunch", "Vegetarian"),
        new("Starter", "Lunch", "Anything"),
        new("Side", "Lunch", "Anything"),
        new("Dessert", "Snack", "Anything"),
        new("Miscellaneous", "Snack", "Anything"),
        new("Vegan", "Diner", "Vegan,Vegetarian"),
        new("Chicken", "Diner", "Carnivore,Keto"),
        new("Seafood", "Diner", "Carnivore,Keto"),
        new("Beef", "Diner", "Carnivore,Keto"),
        new("Lamb", "Diner", "Carnivore,Keto"),
        new("Pork", "Diner", "Carnivore,Keto"),
        new("Goat", "Diner", "Carnivore,Keto")
    ];

    public TheMealDbService(MealPlannerDbContext db, HttpClient httpClient, ILogger<TheMealDbService> logger)
    {
        _db = db;
        _httpClient = httpClient;
        _logger = logger;
    }

    public async Task ImportStarterMealsAsync(
        int mealsPerCategory = DefaultMealsPerCategory,
        int minimumCatalogSize = DefaultMinimumCatalogSize,
        CancellationToken cancellationToken = default)
    {
        var currentMealCount = await _db.Meals.CountAsync(cancellationToken);
        if (currentMealCount >= minimumCatalogSize)
        {
            return;
        }

        var existingExternalIds = await _db.Meals
            .Where(meal => meal.ExternalMealDbId != null)
            .Select(meal => meal.ExternalMealDbId!)
            .ToHashSetAsync(cancellationToken);

        var ingredientCache = await _db.Ingredients
            .ToDictionaryAsync(ingredient => ingredient.Naam.ToLowerInvariant(), cancellationToken);

        foreach (var category in StarterCategories)
        {
            if (currentMealCount >= minimumCatalogSize)
            {
                break;
            }

            var summaries = await GetMealSummariesAsync(category.SourceCategory, cancellationToken);

            var importedForCategory = 0;
            foreach (var summary in summaries)
            {
                if (importedForCategory >= mealsPerCategory || currentMealCount >= minimumCatalogSize)
                {
                    break;
                }

                if (existingExternalIds.Contains(summary.Id))
                {
                    continue;
                }

                var detail = await GetMealDetailAsync(summary.Id, cancellationToken);
                if (detail == null)
                {
                    continue;
                }

                var meal = new Meal
                {
                    Naam = detail.Name,
                    Beschrijving = BuildDescription(detail.Instructions),
                    Instructies = detail.Instructions,
                    Categorie = category.TargetMealType,
                    Bereidingstijd = EstimatePreparationMinutes(category.TargetMealType),
                    Porties = 1,
                    AfbeeldingUrl = detail.ThumbnailUrl,
                    ExternalMealDbId = detail.Id,
                    DieetLabels = BuildDietLabels(category.DietLabels, detail)
                };

                foreach (var mealIngredient in detail.Ingredients
                    .DistinctBy(ingredient => ingredient.Name, StringComparer.OrdinalIgnoreCase)
                    .Take(12))
                {
                    var ingredientName = mealIngredient.Name;
                    var cacheKey = ingredientName.ToLowerInvariant();
                    if (!ingredientCache.TryGetValue(cacheKey, out var ingredient))
                    {
                        ingredient = new Ingredient
                        {
                            Naam = ingredientName,
                            Eenheid = "portie"
                        };
                        ingredientCache[cacheKey] = ingredient;
                        _db.Ingredients.Add(ingredient);
                    }

                    meal.MealIngredients.Add(new MealIngredient
                    {
                        Meal = meal,
                        Ingredient = ingredient,
                        Hoeveelheid = ParseMeasureAmount(mealIngredient.Measure),
                        OrigineleHoeveelheid = mealIngredient.Measure
                    });
                }

                _db.Meals.Add(meal);
                existingExternalIds.Add(meal.ExternalMealDbId);
                importedForCategory += 1;
                currentMealCount += 1;
            }
        }

        await _db.SaveChangesAsync(cancellationToken);
    }

//TODO change to put meal in database instead of contantly making api calls
    public async Task<bool> EnrichMealDetailsAsync(Meal meal, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(meal.ExternalMealDbId))
        {
            return false;
        }

        var needsRecipe = string.IsNullOrWhiteSpace(meal.Instructies);
        var needsMeasures = meal.MealIngredients.Any(mealIngredient =>
            string.IsNullOrWhiteSpace(mealIngredient.OrigineleHoeveelheid));

        if (!needsRecipe && !needsMeasures)
        {
            return false;
        }

        var detail = await GetMealDetailAsync(meal.ExternalMealDbId, cancellationToken);
        if (detail == null)
        {
            return false;
        }

        meal.Beschrijving = BuildDescription(detail.Instructions);
        meal.Instructies = detail.Instructions;
        meal.AfbeeldingUrl ??= detail.ThumbnailUrl;
        meal.Porties = meal.Porties <= 0 ? 1 : meal.Porties;

        foreach (var ingredient in detail.Ingredients)
        {
            var existing = meal.MealIngredients.FirstOrDefault(mealIngredient =>
                mealIngredient.Ingredient.Naam.Equals(ingredient.Name, StringComparison.OrdinalIgnoreCase));
            if (existing == null)
            {
                continue;
            }

            existing.OrigineleHoeveelheid = ingredient.Measure;
            existing.Hoeveelheid = ParseMeasureAmount(ingredient.Measure);
        }

        return true;
    }

    private async Task<IReadOnlyList<MealSummary>> GetMealSummariesAsync(string category, CancellationToken cancellationToken)
    {
        using var response = await _httpClient.GetAsync($"filter.php?c={Uri.EscapeDataString(category)}", cancellationToken);
        response.EnsureSuccessStatusCode();

        await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
        using var document = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);

        if (!document.RootElement.TryGetProperty("meals", out var mealsElement) ||
            mealsElement.ValueKind != JsonValueKind.Array)
        {
            return [];
        }

        var meals = new List<MealSummary>();
        foreach (var mealElement in mealsElement.EnumerateArray())
        {
            var id = GetString(mealElement, "idMeal");
            var name = GetString(mealElement, "strMeal");
            if (!string.IsNullOrWhiteSpace(id) && !string.IsNullOrWhiteSpace(name))
            {
                meals.Add(new MealSummary(id, name));
            }
        }

        return meals;
    }

    private async Task<MealDetail?> GetMealDetailAsync(string id, CancellationToken cancellationToken)
    {
        using var response = await _httpClient.GetAsync($"lookup.php?i={Uri.EscapeDataString(id)}", cancellationToken);
        response.EnsureSuccessStatusCode();

        await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
        using var document = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);

        if (!document.RootElement.TryGetProperty("meals", out var mealsElement) ||
            mealsElement.ValueKind != JsonValueKind.Array ||
            mealsElement.GetArrayLength() == 0)
        {
            return null;
        }

        var mealElement = mealsElement[0];
        var ingredients = new List<MealIngredientDetail>();
        for (var index = 1; index <= 20; index++)
        {
            var ingredient = GetString(mealElement, $"strIngredient{index}");
            if (!string.IsNullOrWhiteSpace(ingredient))
            {
                var name = CultureInfo.CurrentCulture.TextInfo.ToTitleCase(ingredient.Trim().ToLowerInvariant());
                var measure = GetString(mealElement, $"strMeasure{index}");
                ingredients.Add(new MealIngredientDetail(name, measure));
            }
        }

        return new MealDetail(
            GetString(mealElement, "idMeal"),
            GetString(mealElement, "strMeal"),
            GetString(mealElement, "strInstructions"),
            GetString(mealElement, "strMealThumb"),
            GetString(mealElement, "strCategory"),
            ingredients);
    }

    private static string BuildDescription(string instructions)
    {
        if (string.IsNullOrWhiteSpace(instructions))
        {
            return "Recept opgehaald via TheMealDB.";
        }

        var compact = string.Join(' ', instructions.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
        return compact.Length <= 450 ? compact : compact[..450] + "...";
    }

    private static int EstimatePreparationMinutes(string mealType) =>
        mealType switch
        {
            "Ontbijt" => 15,
            "Lunch" => 25,
            _ => 35
        };

    private static string BuildDietLabels(string baseLabels, MealDetail detail)
    {
        var labels = new HashSet<string>(
            baseLabels.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries),
            StringComparer.OrdinalIgnoreCase);

        if (detail.SourceCategory.Equals("Vegan", StringComparison.OrdinalIgnoreCase))
        {
            labels.Add("Vegan");
            labels.Add("Vegetarian");
        }

        if (detail.SourceCategory.Equals("Vegetarian", StringComparison.OrdinalIgnoreCase))
        {
            labels.Add("Vegetarian");
        }

        return string.Join(',', labels);
    }

    private static string GetString(JsonElement element, string propertyName)
    {
        if (!element.TryGetProperty(propertyName, out var property) || property.ValueKind == JsonValueKind.Null)
        {
            return string.Empty;
        }

        return property.GetString()?.Trim() ?? string.Empty;
    }

    private static double ParseMeasureAmount(string measure)
    {
        if (string.IsNullOrWhiteSpace(measure))
        {
            return 1;
        }

        var normalized = measure
            .Replace("\u00BD", "1/2")
            .Replace("\u00BC", "1/4")
            .Replace("\u00BE", "3/4");
        var parts = normalized.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        var total = 0d;

        foreach (var part in parts.Take(2))
        {
            if (part.Contains('/'))
            {
                var fraction = part.Split('/', StringSplitOptions.RemoveEmptyEntries);
                if (fraction.Length == 2 &&
                    double.TryParse(fraction[0], NumberStyles.Float, CultureInfo.InvariantCulture, out var numerator) &&
                    double.TryParse(fraction[1], NumberStyles.Float, CultureInfo.InvariantCulture, out var denominator) &&
                    denominator != 0)
                {
                    total += numerator / denominator;
                    continue;
                }
            }

            var numeric = new string(part.TakeWhile(ch => char.IsDigit(ch) || ch == '.' || ch == ',').ToArray()).Replace(',', '.');
            if (double.TryParse(numeric, NumberStyles.Float, CultureInfo.InvariantCulture, out var value))
            {
                total += value;
            }
        }

        return total > 0 ? total : 1;
    }

    private sealed record MealImportCategory(string SourceCategory, string TargetMealType, string DietLabels);
    private sealed record MealSummary(string Id, string Name);
    private sealed record MealIngredientDetail(string Name, string Measure);
    private sealed record MealDetail(
        string Id,
        string Name,
        string Instructions,
        string ThumbnailUrl,
        string SourceCategory,
        IReadOnlyList<MealIngredientDetail> Ingredients);
}

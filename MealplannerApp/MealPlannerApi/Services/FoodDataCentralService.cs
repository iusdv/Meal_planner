using System.Globalization;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using MealPlannerApi.Data;
using MealPlannerApi.DTOs;
using MealPlannerApi.Models;
using Microsoft.EntityFrameworkCore;

namespace MealPlannerApi.Services;

public class FoodDataCentralService
{
    private readonly MealPlannerDbContext _db;
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;
    private readonly ILogger<FoodDataCentralService> _logger;

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private static readonly IReadOnlyDictionary<string, string> IngredientAliases =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["aubergine"] = "eggplant",
            ["courgette"] = "zucchini",
            ["spring onion"] = "green onion",
            ["spring onions"] = "green onions",
            ["caster sugar"] = "sugar",
            ["plain flour"] = "wheat flour",
            ["self-raising flour"] = "wheat flour",
            ["minced beef"] = "ground beef",
            ["double cream"] = "cream",
            ["single cream"] = "cream",
            ["creme fraiche"] = "cream",
            ["coriander"] = "cilantro",
            ["red chilli"] = "chili pepper",
            ["green chilli"] = "chili pepper",
            ["bell pepper"] = "sweet pepper"
        };

    public FoodDataCentralService(
        MealPlannerDbContext db,
        HttpClient httpClient,
        IConfiguration configuration,
        ILogger<FoodDataCentralService> logger)
    {
        _db = db;
        _httpClient = httpClient;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<NutritionFactsDto?> BuildNutritionFactsAsync(Meal meal, CancellationToken cancellationToken = default)
    {
        await EnsureNutrientCatalogAsync(cancellationToken);

        var definitionsByKey = await _db.NutrientDefinitions
            .AsNoTracking()
            .ToDictionaryAsync(definition => definition.Key, cancellationToken);
        var totals = new Dictionary<string, NutrientTotal>(StringComparer.OrdinalIgnoreCase);
        var totalGrams = 0d;
        var matchedIngredients = 0;
        var estimated = false;
        var consideredIngredients = meal.MealIngredients.Take(20).ToList();

        foreach (var mealIngredient in consideredIngredients)
        {
            var grams = EstimateGrams(
                mealIngredient.OrigineleHoeveelheid,
                mealIngredient.Hoeveelheid,
                mealIngredient.Ingredient.Naam);

            if (grams <= 0)
            {
                continue;
            }

            totalGrams += grams;
            var nutrients = await GetOrCreateIngredientNutrientsAsync(
                mealIngredient.Ingredient,
                definitionsByKey,
                cancellationToken);

            if (nutrients.Count == 0)
            {
                AddStoredMacroFallback(totals, definitionsByKey, mealIngredient, grams);
                estimated = true;
                continue;
            }

            matchedIngredients++;
            estimated = estimated || nutrients.Any(nutrient => nutrient.IsEstimated);

            foreach (var nutrient in nutrients)
            {
                AddTotal(totals, nutrient.Definition, nutrient.ValuePer100g * grams / 100);
            }
        }

        AddDerivedRows(totals, definitionsByKey);

        if (totals.Count == 0)
        {
            return null;
        }

        var sections = BuildSections(totals);
        var source = matchedIngredients > 0
            ? NutritionCatalog.FoodDataCentralSource
            : "Database estimates";

        if (matchedIngredients > 0 && (estimated || matchedIngredients < consideredIngredients.Count))
        {
            source += " + estimates";
        }

        return new NutritionFactsDto(
            Math.Round(totalGrams, 1),
            estimated || matchedIngredients < consideredIngredients.Count,
            source,
            sections);
    }

    private async Task<IReadOnlyList<IngredientNutrientResult>> GetOrCreateIngredientNutrientsAsync(
        Ingredient ingredient,
        IReadOnlyDictionary<string, NutrientDefinition> definitionsByKey,
        CancellationToken cancellationToken)
    {
        var mapping = await _db.IngredientNutritionMappings
            .Include(item => item.NutrientValues)
                .ThenInclude(value => value.NutrientDefinition)
            .FirstOrDefaultAsync(item =>
                item.IngredientId == ingredient.Id &&
                item.Source == NutritionCatalog.FoodDataCentralSource,
                cancellationToken);

        if (mapping is { NutrientValues.Count: > 0 })
        {
            return mapping.NutrientValues
                .Select(value => new IngredientNutrientResult(value.NutrientDefinition, value.ValuePer100g, value.IsEstimated))
                .ToList();
        }

        var searchTerm = BuildSearchTerm(ingredient.Naam);
        var food = await SearchFoodAsync(searchTerm, cancellationToken);
        if (food.TransientFailure)
        {
            return [];
        }
        var now = DateTime.UtcNow;

        mapping ??= new IngredientNutritionMapping
        {
            IngredientId = ingredient.Id,
            Source = NutritionCatalog.FoodDataCentralSource,
            MatchedAtUtc = now
        };

        mapping.SearchTerm = searchTerm;
        mapping.ExternalFoodId = food.Food?.FdcId?.ToString(CultureInfo.InvariantCulture);
        mapping.ExternalFoodDescription = food.Food?.Description;
        mapping.ExternalDataType = food.Food?.DataType;
        mapping.MatchScore = food.Food?.Score;
        mapping.IsEstimated = food.Food == null;
        mapping.LastSyncedAtUtc = now;

        if (mapping.Id == 0)
        {
            _db.IngredientNutritionMappings.Add(mapping);
        }

        mapping.NutrientValues.Clear();

        if (food.Food?.FoodNutrients == null || food.Food.FoodNutrients.Count == 0)
        {
            await _db.SaveChangesAsync(cancellationToken);
            return [];
        }

        var createdValues = new Dictionary<int, IngredientNutrientResult>();

        foreach (var nutrient in food.Food.FoodNutrients)
        {
            if (!nutrient.Value.HasValue ||
                string.IsNullOrWhiteSpace(nutrient.NutrientNumber) ||
                !NutritionCatalog.ByExternalNumber.TryGetValue(nutrient.NutrientNumber, out var catalogItem) ||
                !definitionsByKey.TryGetValue(catalogItem.Key, out var definition))
            {
                continue;
            }

            if (createdValues.ContainsKey(definition.Id))
            {
                continue;
            }

            var value = ConvertUnit(nutrient.Value.Value, nutrient.UnitName ?? string.Empty, definition.Unit);
            mapping.NutrientValues.Add(new IngredientNutrientValue
            {
                NutrientDefinitionId = definition.Id,
                ValuePer100g = value,
                Unit = definition.Unit,
                IsEstimated = false,
                LastSyncedAtUtc = now
            });
            createdValues[definition.Id] = new IngredientNutrientResult(definition, value, false);
        }

        await _db.SaveChangesAsync(cancellationToken);
        return createdValues.Values.ToList();
    }

    private async Task EnsureNutrientCatalogAsync(CancellationToken cancellationToken)
    {
        var definitions = await _db.NutrientDefinitions
            .Include(definition => definition.ExternalIds)
            .ToDictionaryAsync(definition => definition.Key, cancellationToken);
        var changed = false;

        foreach (var catalogItem in NutritionCatalog.Definitions)
        {
            if (!definitions.TryGetValue(catalogItem.Key, out var definition))
            {
                definition = new NutrientDefinition
                {
                    Key = catalogItem.Key
                };
                _db.NutrientDefinitions.Add(definition);
                definitions[catalogItem.Key] = definition;
                changed = true;
            }

            if (definition.Label != catalogItem.Label ||
                definition.Section != catalogItem.Section ||
                definition.Unit != catalogItem.Unit ||
                definition.DailyValue != catalogItem.DailyValue ||
                definition.Highlight != catalogItem.Highlight ||
                Math.Abs(definition.DisplayOrder - catalogItem.DisplayOrder) > 0.001)
            {
                definition.Label = catalogItem.Label;
                definition.Section = catalogItem.Section;
                definition.Unit = catalogItem.Unit;
                definition.DailyValue = catalogItem.DailyValue;
                definition.Highlight = catalogItem.Highlight;
                definition.DisplayOrder = catalogItem.DisplayOrder;
                changed = true;
            }

            foreach (var externalNumber in catalogItem.ExternalNutrientNumbers)
            {
                if (definition.ExternalIds.Any(externalId =>
                    externalId.Source == NutritionCatalog.FoodDataCentralSource &&
                    externalId.ExternalNutrientNumber == externalNumber))
                {
                    continue;
                }

                definition.ExternalIds.Add(new NutrientExternalId
                {
                    Source = NutritionCatalog.FoodDataCentralSource,
                    ExternalNutrientNumber = externalNumber
                });
                changed = true;
            }
        }

        if (changed)
        {
            await _db.SaveChangesAsync(cancellationToken);
        }
    }

    private async Task<FdcSearchOutcome> SearchFoodAsync(string searchTerm, CancellationToken cancellationToken)
    {
        var apiKey = _configuration["FoodDataCentral:ApiKey"];
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            apiKey = "DEMO_KEY";
        }

        var payload = new
        {
            query = searchTerm,
            pageSize = 5,
            dataType = new[] { "Foundation", "SR Legacy", "Survey (FNDDS)" }
        };

        try
        {
            using var response = await _httpClient.PostAsJsonAsync(
                $"foods/search?api_key={Uri.EscapeDataString(apiKey)}",
                payload,
                JsonOptions,
                cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("FoodData Central search failed for {Ingredient}: {StatusCode}", searchTerm, response.StatusCode);
                return new FdcSearchOutcome(null, true);
            }

            await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
            var result = await JsonSerializer.DeserializeAsync<FdcSearchResponse>(stream, JsonOptions, cancellationToken);
            return new FdcSearchOutcome(PickBestFood(result?.Foods ?? [], searchTerm), false);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "FoodData Central search failed for {Ingredient}.", searchTerm);
            return new FdcSearchOutcome(null, true);
        }
    }

    private static FdcFood? PickBestFood(IReadOnlyList<FdcFood> foods, string searchTerm)
    {
        if (foods.Count == 0)
        {
            return null;
        }

        var normalized = NormalizeSearchText(searchTerm);
        return foods
            .OrderBy(food => DataTypeRank(food.DataType))
            .ThenByDescending(food => NormalizeSearchText(food.Description).Contains(normalized) ? 1 : 0)
            .ThenByDescending(food => food.Score ?? 0)
            .FirstOrDefault();
    }

    private static int DataTypeRank(string? dataType) =>
        dataType switch
        {
            "Foundation" => 0,
            "SR Legacy" => 1,
            "Survey (FNDDS)" => 2,
            _ => 3
        };

    private static string BuildSearchTerm(string ingredientName)
    {
        var normalized = NormalizeSearchText(ingredientName);
        return IngredientAliases.TryGetValue(normalized, out var alias)
            ? alias
            : normalized;
    }

    private static string NormalizeSearchText(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return string.Empty;
        }

        return string.Join(
            ' ',
            value.ToLowerInvariant()
                .Split([' ', ',', '-', '_', '(', ')'], StringSplitOptions.RemoveEmptyEntries));
    }

    private static void AddStoredMacroFallback(
        Dictionary<string, NutrientTotal> totals,
        IReadOnlyDictionary<string, NutrientDefinition> definitionsByKey,
        MealIngredient mealIngredient,
        double grams)
    {
        var nutritionalValue = mealIngredient.Ingredient.NutritionalValue;
        if (nutritionalValue == null)
        {
            return;
        }

        var factor = grams / 100;
        AddTotal(totals, definitionsByKey["calories"], nutritionalValue.Kcal * factor);
        AddTotal(totals, definitionsByKey["protein"], nutritionalValue.Eiwit * factor);
        AddTotal(totals, definitionsByKey["carbs"], nutritionalValue.Koolhydraat * factor);
        AddTotal(totals, definitionsByKey["fat"], nutritionalValue.Vet * factor);
    }

    private static void AddDerivedRows(
        Dictionary<string, NutrientTotal> totals,
        IReadOnlyDictionary<string, NutrientDefinition> definitionsByKey)
    {
        if (totals.TryGetValue("carbs", out var carbs) &&
            totals.TryGetValue("fiber", out var fiber) &&
            definitionsByKey.TryGetValue("netCarbs", out var netCarbsDefinition))
        {
            AddTotal(totals, netCarbsDefinition, Math.Max(0, carbs.Value - fiber.Value));
        }

        var omega3 = SumExisting(totals, "alphaLinolenic", "dha", "epa", "dpa");
        if (omega3 > 0 && definitionsByKey.TryGetValue("totalOmega3", out var omega3Definition))
        {
            AddTotal(totals, omega3Definition, omega3);
        }

        if (totals.TryGetValue("linoleic", out var omega6) &&
            definitionsByKey.TryGetValue("totalOmega6", out var omega6Definition))
        {
            AddTotal(totals, omega6Definition, omega6.Value);
        }
    }

    private static double SumExisting(Dictionary<string, NutrientTotal> totals, params string[] keys)
    {
        var sum = 0d;
        foreach (var key in keys)
        {
            if (totals.TryGetValue(key, out var total))
            {
                sum += total.Value;
            }
        }

        return sum;
    }

    private static List<NutritionFactSectionDto> BuildSections(Dictionary<string, NutrientTotal> totals)
    {
        return totals.Values
            .GroupBy(total => total.Definition.Section)
            .OrderBy(group => GetSectionOrder(group.Key))
            .Select(group => new NutritionFactSectionDto(
                group.Key,
                group.OrderBy(total => total.Definition.DisplayOrder)
                    .Select(total =>
                    {
                        var value = RoundValue(total.Value, total.Definition.Unit);
                        var dailyValuePercent = CalculateDailyValuePercent(value, total.Definition);
                        return new NutritionFactRowDto(
                            total.Definition.Key,
                            total.Definition.Label,
                            value,
                            total.Definition.Unit,
                            dailyValuePercent,
                            total.Definition.Highlight);
                    })
                    .ToList()))
            .Where(section => section.Rows.Count > 0)
            .ToList();
    }

    private static int GetSectionOrder(string section)
    {
        for (var index = 0; index < NutritionCatalog.SectionOrder.Count; index++)
        {
            if (NutritionCatalog.SectionOrder[index].Equals(section, StringComparison.OrdinalIgnoreCase))
            {
                return index;
            }
        }

        return int.MaxValue;
    }

    private static double CalculateDailyValuePercent(double value, NutrientDefinition definition)
    {
        if (!definition.DailyValue.HasValue || definition.DailyValue.Value <= 0)
        {
            return 0;
        }

        return Math.Round(value / definition.DailyValue.Value * 100, 1);
    }

    private static void AddTotal(Dictionary<string, NutrientTotal> totals, NutrientDefinition definition, double value)
    {
        if (!totals.TryGetValue(definition.Key, out var total))
        {
            totals[definition.Key] = new NutrientTotal(definition, value);
            return;
        }

        total.Value += value;
    }

    private static double ConvertUnit(double value, string sourceUnit, string targetUnit)
    {
        var source = NormalizeUnit(sourceUnit);
        var target = NormalizeUnit(targetUnit);

        if (source == target)
        {
            return value;
        }

        if (source == "mg" && target == "g") return value / 1000;
        if (source == "g" && target == "mg") return value * 1000;
        if (source == "mcg" && target == "mg") return value / 1000;
        if (source == "mg" && target == "mcg") return value * 1000;
        if (source == "mcg" && target == "g") return value / 1_000_000;
        if (source == "g" && target == "mcg") return value * 1_000_000;

        return value;
    }

    private static string NormalizeUnit(string unit) =>
        unit.Trim().ToUpperInvariant() switch
        {
            "KCAL" => "kcal",
            "G" => "g",
            "MG" => "mg",
            "UG" => "mcg",
            "MCG" => "mcg",
            "IU" => "IU",
            _ => unit.Trim().ToLowerInvariant()
        };

    private static double RoundValue(double value, string unit)
    {
        if (unit is "kcal" or "IU")
        {
            return Math.Round(value);
        }

        if (value >= 10)
        {
            return Math.Round(value);
        }

        if (value >= 1)
        {
            return Math.Round(value, 1);
        }

        return Math.Round(value, 2);
    }

    private static double EstimateGrams(string measure, double storedAmount, string ingredientName)
    {
        var normalized = NormalizeFractions(measure).ToLowerInvariant();
        if (IsNonConsumableMeasure(normalized))
        {
            return 0;
        }

        var amount = TryParseFirstQuantity(normalized) ?? (storedAmount > 0 ? storedAmount : 1);

        if (ContainsMeasurementUnit(normalized, "kg", "kilogram", "kilograms")) return amount * 1000;
        if (ContainsMeasurementUnit(normalized, "mg")) return amount / 1000;
        if (ContainsMeasurementUnit(normalized, "g", "gram", "grams")) return amount;
        if (ContainsMeasurementUnit(normalized, "lb", "lbs", "pound", "pounds")) return amount * 454;
        if (ContainsMeasurementUnit(normalized, "oz", "ounce", "ounces")) return amount * 28.35;
        if (ContainsMeasurementUnit(normalized, "ml")) return amount;
        if (ContainsMeasurementUnit(normalized, "l", "liter", "liters", "litre", "litres")) return amount * 1000;
        if (ContainsMeasurementUnit(normalized, "tablespoon", "tablespoons", "tbsp")) return amount * 15;
        if (ContainsMeasurementUnit(normalized, "teaspoon", "teaspoons", "tsp")) return amount * 5;
        if (ContainsMeasurementUnit(normalized, "cup", "cups")) return amount * 240;
        if (ContainsMeasurementUnit(normalized, "slice", "slices")) return amount * 30;
        if (ContainsMeasurementUnit(normalized, "clove", "cloves")) return amount * 5;
        if (ContainsMeasurementUnit(normalized, "leaf", "leaves")) return amount * EstimateLeafGrams(ingredientName);
        if (ContainsMeasurementUnit(normalized, "sprig", "sprigs")) return amount * EstimateSprigGrams(ingredientName);
        if (ContainsMeasurementUnit(normalized, "pinch", "pinches")) return amount * 0.36;
        if (ContainsMeasurementUnit(normalized, "dash", "dashes")) return amount * 0.6;

        return amount * EstimateUnitGrams(ingredientName);
    }

    private static double EstimateUnitGrams(string ingredientName)
    {
        var name = ingredientName.ToLowerInvariant();
        if (IsBayLeaf(name)) return 0.2;
        if (IsLeafyHerb(name)) return 1;
        if (IsDrySpice(name)) return 2;
        if (name.Contains("egg")) return 50;
        if (name.Contains("bread")) return 30;
        if (name.Contains("salt")) return 6;
        if (name.Contains("pepper")) return 2;
        if (name.Contains("garlic")) return 5;
        if (name.Contains("onion")) return 110;
        if (name.Contains("tomato")) return 120;
        if (name.Contains("potato")) return 150;
        if (name.Contains("butter")) return 14;
        if (name.Contains("oil")) return 14;
        if (name.Contains("cheese")) return 28;
        if (name.Contains("chicken")) return 120;
        if (name.Contains("beef")) return 120;
        if (name.Contains("fish") || name.Contains("salmon") || name.Contains("tuna")) return 120;
        return 100;
    }

    private static double EstimateLeafGrams(string ingredientName)
    {
        var name = ingredientName.ToLowerInvariant();
        if (IsBayLeaf(name)) return 0.2;
        if (IsLeafyHerb(name)) return 1;
        return 2;
    }

    private static double EstimateSprigGrams(string ingredientName)
    {
        var name = ingredientName.ToLowerInvariant();
        if (name.Contains("thyme") || name.Contains("rosemary")) return 1;
        if (IsLeafyHerb(name)) return 2;
        return 2;
    }

    private static bool IsNonConsumableMeasure(string measure) =>
        measure.Contains("to serve", StringComparison.OrdinalIgnoreCase) ||
        measure.Contains("to taste", StringComparison.OrdinalIgnoreCase) ||
        measure.Contains("for garnish", StringComparison.OrdinalIgnoreCase) ||
        measure.Contains("for serving", StringComparison.OrdinalIgnoreCase);

    private static bool IsBayLeaf(string name) =>
        name.Contains("bay leaf") || name.Contains("bay leaves");

    private static bool IsLeafyHerb(string name) =>
        name.Contains("parsley") ||
        name.Contains("cilantro") ||
        name.Contains("coriander") ||
        name.Contains("mint") ||
        name.Contains("basil") ||
        name.Contains("sage") ||
        name.Contains("thyme") ||
        name.Contains("rosemary");

    private static bool IsDrySpice(string name) =>
        name.Contains("cinnamon") ||
        name.Contains("paprika") ||
        name.Contains("cumin") ||
        name.Contains("nutmeg") ||
        name.Contains("turmeric") ||
        name.Contains("oregano") ||
        name.Contains("allspice") ||
        name.Contains("clove") ||
        name.Contains("peppercorn");

    private static bool ContainsMeasurementUnit(string text, params string[] units)
    {
        foreach (var unit in units)
        {
            var pattern = $@"(?:^|[^a-z]){Regex.Escape(unit)}(?:$|[^a-z])|\d+(?:[.,]\d+)?\s*{Regex.Escape(unit)}(?:$|[^a-z])";
            if (Regex.IsMatch(text, pattern, RegexOptions.IgnoreCase))
            {
                return true;
            }
        }

        return false;
    }

    private static string NormalizeFractions(string text) =>
        text
            .Replace("\u00BD", "1/2")
            .Replace("\u00BC", "1/4")
            .Replace("\u00BE", "3/4");

    private static double? TryParseFirstQuantity(string text)
    {
        var parts = text.Split(' ', StringSplitOptions.RemoveEmptyEntries).Take(2).ToList();
        if (parts.Count == 0)
        {
            return null;
        }

        var total = 0d;
        var found = false;

        foreach (var part in parts)
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
                    found = true;
                }

                continue;
            }

            var numeric = new string(part.TakeWhile(ch => char.IsDigit(ch) || ch == '.' || ch == ',').ToArray()).Replace(',', '.');
            if (double.TryParse(numeric, NumberStyles.Float, CultureInfo.InvariantCulture, out var value))
            {
                total += value;
                found = true;
            }
        }

        return found ? total : null;
    }

    private sealed record IngredientNutrientResult(NutrientDefinition Definition, double ValuePer100g, bool IsEstimated);

    private sealed class NutrientTotal
    {
        public NutrientTotal(NutrientDefinition definition, double value)
        {
            Definition = definition;
            Value = value;
        }

        public NutrientDefinition Definition { get; }
        public double Value { get; set; }
    }

    private sealed record FdcSearchOutcome(FdcFood? Food, bool TransientFailure);

    private sealed class FdcSearchResponse
    {
        [JsonPropertyName("foods")]
        public List<FdcFood>? Foods { get; set; }
    }

    private sealed class FdcFood
    {
        [JsonPropertyName("fdcId")]
        public int? FdcId { get; set; }

        [JsonPropertyName("description")]
        public string? Description { get; set; }

        [JsonPropertyName("dataType")]
        public string? DataType { get; set; }

        [JsonPropertyName("score")]
        public double? Score { get; set; }

        [JsonPropertyName("foodNutrients")]
        public List<FdcNutrient>? FoodNutrients { get; set; }
    }

    private sealed class FdcNutrient
    {
        [JsonPropertyName("nutrientName")]
        public string? NutrientName { get; set; }

        [JsonPropertyName("nutrientNumber")]
        public string? NutrientNumber { get; set; }

        [JsonPropertyName("unitName")]
        public string? UnitName { get; set; }

        [JsonPropertyName("value")]
        public double? Value { get; set; }
    }
}

namespace MealPlannerApi.Services;

public static class NutritionCatalog
{
    public const string FoodDataCentralSource = "USDA FoodData Central";

    public static readonly IReadOnlyList<NutrientCatalogItem> Definitions =
    [
        new("calories", "Calories", "Main", "kcal", null, true, 0, ["208"]),
        new("fat", "Fat", "Main", "g", 78, false, 1, ["204"]),
        new("saturatedFat", "Saturated fats", "Main", "g", 20, false, 2, ["606"]),
        new("transFat", "Trans fats", "Main", "g", null, false, 3, ["605"]),
        new("cholesterol", "Cholesterol", "Main", "mg", 300, false, 4, ["601"]),
        new("sodium", "Sodium", "Main", "mg", 2300, false, 5, ["307"]),
        new("carbs", "Carbs", "Main", "g", 275, false, 6, ["205"]),
        new("netCarbs", "Net carbs", "Main", "g", null, false, 6.5, []),
        new("fiber", "Fiber", "Main", "g", 28, false, 7, ["291"]),
        new("sugar", "Sugar", "Main", "g", null, false, 8, ["269"]),
        new("protein", "Protein", "Main", "g", 50, true, 9, ["203"]),

        new("calcium", "Calcium", "Vitamins and Minerals", "mg", 1300, false, 100, ["301"]),
        new("iron", "Iron", "Vitamins and Minerals", "mg", 18, false, 101, ["303"]),
        new("potassium", "Potassium", "Vitamins and Minerals", "mg", 4700, false, 102, ["306"]),
        new("vitaminD", "Vitamin D", "Vitamins and Minerals", "mcg", 20, false, 103, ["328"]),
        new("alphaCarotene", "Alpha carotene", "Vitamins and Minerals", "mcg", null, false, 104, ["322"]),
        new("betaCarotene", "Beta carotene", "Vitamins and Minerals", "mcg", null, false, 105, ["321"]),
        new("caffeine", "Caffeine", "Vitamins and Minerals", "mg", null, false, 106, ["262"]),
        new("choline", "Choline", "Vitamins and Minerals", "mg", 550, false, 107, ["421"]),
        new("copper", "Copper", "Vitamins and Minerals", "mg", 0.9, false, 108, ["312"]),
        new("fluoride", "Fluoride", "Vitamins and Minerals", "mcg", null, false, 109, ["313"]),
        new("folate", "Folate (B9)", "Vitamins and Minerals", "mcg", 400, false, 110, ["417"]),
        new("lycopene", "Lycopene", "Vitamins and Minerals", "mcg", null, false, 111, ["337"]),
        new("magnesium", "Magnesium", "Vitamins and Minerals", "mg", 420, false, 112, ["304"]),
        new("manganese", "Manganese", "Vitamins and Minerals", "mg", 2.3, false, 113, ["315"]),
        new("niacin", "Niacin", "Vitamins and Minerals", "mg", 16, false, 114, ["406"]),
        new("pantothenicAcid", "Pantothenic acid", "Vitamins and Minerals", "mg", 5, false, 115, ["410"]),
        new("phosphorus", "Phosphorus", "Vitamins and Minerals", "mg", 1250, false, 116, ["305"]),
        new("retinol", "Retinol", "Vitamins and Minerals", "mcg", null, false, 117, ["319"]),
        new("riboflavin", "Riboflavin (B2)", "Vitamins and Minerals", "mg", 1.3, false, 118, ["405"]),
        new("selenium", "Selenium", "Vitamins and Minerals", "mcg", 55, false, 119, ["317"]),
        new("theobromine", "Theobromine", "Vitamins and Minerals", "mg", null, false, 120, ["263"]),
        new("thiamin", "Thiamin", "Vitamins and Minerals", "mg", 1.2, false, 121, ["404"]),
        new("vitaminAIu", "Vitamin A IU", "Vitamins and Minerals", "IU", null, false, 122, ["318"]),
        new("vitaminA", "Vitamin A", "Vitamins and Minerals", "mcg", 900, false, 123, ["320"]),
        new("vitaminB12", "Vitamin B12", "Vitamins and Minerals", "mcg", 2.4, false, 124, ["418"]),
        new("vitaminB6", "Vitamin B6", "Vitamins and Minerals", "mg", 1.7, false, 125, ["415"]),
        new("vitaminC", "Vitamin C", "Vitamins and Minerals", "mg", 90, false, 126, ["401"]),
        new("vitaminE", "Vitamin E", "Vitamins and Minerals", "mg", 15, false, 127, ["323"]),
        new("vitaminK", "Vitamin K", "Vitamins and Minerals", "mcg", 120, false, 128, ["430"]),
        new("zinc", "Zinc", "Vitamins and Minerals", "mg", 11, false, 129, ["309"]),

        new("sucrose", "Sucrose", "Sugars", "g", null, false, 200, ["210"]),
        new("glucose", "Glucose", "Sugars", "g", null, false, 201, ["211"]),
        new("fructose", "Fructose", "Sugars", "g", null, false, 202, ["212"]),
        new("lactose", "Lactose", "Sugars", "g", null, false, 203, ["213"]),
        new("maltose", "Maltose", "Sugars", "g", null, false, 204, ["214"]),
        new("galactose", "Galactose", "Sugars", "g", null, false, 205, ["287"]),
        new("starch", "Starch", "Sugars", "g", null, false, 206, ["209"]),

        new("monoFat", "Monounsaturated fats", "Fats", "g", null, false, 300, ["645"]),
        new("polyFat", "Polyunsaturated fats", "Fats", "g", null, false, 301, ["646"]),
        new("totalOmega3", "Total omega 3", "Fatty Acids", "g", null, false, 399, []),
        new("totalOmega6", "Total omega 6", "Fatty Acids", "g", null, false, 399.5, []),
        new("linoleic", "Linoleic acid", "Fatty Acids", "g", null, false, 400, ["618"]),
        new("alphaLinolenic", "Alpha Linolenic Acid (ALA)", "Fatty Acids", "g", null, false, 401, ["619", "851"]),
        new("dha", "Docosahexaenoic Acid (DHA)", "Fatty Acids", "g", null, false, 402, ["621"]),
        new("epa", "Eicosapentaenoic Acid (EPA)", "Fatty Acids", "g", null, false, 403, ["629"]),
        new("dpa", "Docosapentaenoic Acid (DPA)", "Fatty Acids", "g", null, false, 404, ["631"]),

        new("alanine", "Alanine", "Amino Acids", "g", null, false, 500, ["513"]),
        new("arginine", "Arginine", "Amino Acids", "g", null, false, 501, ["511"]),
        new("asparticAcid", "Aspartic acid", "Amino Acids", "g", null, false, 502, ["514"]),
        new("cystine", "Cystine", "Amino Acids", "g", null, false, 503, ["507"]),
        new("glutamicAcid", "Glutamic acid", "Amino Acids", "g", null, false, 504, ["515"]),
        new("glycine", "Glycine", "Amino Acids", "g", null, false, 505, ["516"]),
        new("histidine", "Histidine", "Amino Acids", "g", null, false, 506, ["512"]),
        new("isoleucine", "Isoleucine", "Amino Acids", "g", null, false, 507, ["503"]),
        new("leucine", "Leucine", "Amino Acids", "g", null, false, 508, ["504"]),
        new("lysine", "Lysine", "Amino Acids", "g", null, false, 509, ["505"]),
        new("methionine", "Methionine", "Amino Acids", "g", null, false, 510, ["506"]),
        new("phenylalanine", "Phenylalanine", "Amino Acids", "g", null, false, 511, ["508"]),
        new("proline", "Proline", "Amino Acids", "g", null, false, 512, ["517"]),
        new("serine", "Serine", "Amino Acids", "g", null, false, 513, ["518"]),
        new("threonine", "Threonine", "Amino Acids", "g", null, false, 514, ["502"]),
        new("tryptophan", "Tryptophan", "Amino Acids", "g", null, false, 515, ["501"]),
        new("tyrosine", "Tyrosine", "Amino Acids", "g", null, false, 516, ["509"]),
        new("valine", "Valine", "Amino Acids", "g", null, false, 517, ["510"])
    ];

    public static readonly IReadOnlyDictionary<string, NutrientCatalogItem> ByExternalNumber =
        Definitions
            .SelectMany(definition => definition.ExternalNutrientNumbers.Select(number => new { number, definition }))
            .GroupBy(item => item.number)
            .ToDictionary(group => group.Key, group => group.First().definition, StringComparer.OrdinalIgnoreCase);

    public static readonly IReadOnlyList<string> SectionOrder =
    [
        "Main",
        "Vitamins and Minerals",
        "Sugars",
        "Fats",
        "Fatty Acids",
        "Amino Acids"
    ];
}

public sealed record NutrientCatalogItem(
    string Key,
    string Label,
    string Section,
    string Unit,
    double? DailyValue,
    bool Highlight,
    double DisplayOrder,
    IReadOnlyList<string> ExternalNutrientNumbers);

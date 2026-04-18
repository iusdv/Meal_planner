namespace MealPlannerApi.Models;

public class IngredientNutritionMapping
{
    public int Id { get; set; }
    public int IngredientId { get; set; }
    public string Source { get; set; } = string.Empty;
    public string SearchTerm { get; set; } = string.Empty;
    public string? ExternalFoodId { get; set; }
    public string? ExternalFoodDescription { get; set; }
    public string? ExternalDataType { get; set; }
    public double? MatchScore { get; set; }
    public bool IsEstimated { get; set; }
    public DateTime MatchedAtUtc { get; set; }
    public DateTime LastSyncedAtUtc { get; set; }

    public Ingredient Ingredient { get; set; } = null!;
    public ICollection<IngredientNutrientValue> NutrientValues { get; set; } = new List<IngredientNutrientValue>();
}

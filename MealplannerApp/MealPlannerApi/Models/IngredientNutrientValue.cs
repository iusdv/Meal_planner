namespace MealPlannerApi.Models;

public class IngredientNutrientValue
{
    public int Id { get; set; }
    public int IngredientNutritionMappingId { get; set; }
    public int NutrientDefinitionId { get; set; }
    public double ValuePer100g { get; set; }
    public string Unit { get; set; } = string.Empty;
    public bool IsEstimated { get; set; }
    public DateTime LastSyncedAtUtc { get; set; }

    public IngredientNutritionMapping IngredientNutritionMapping { get; set; } = null!;
    public NutrientDefinition NutrientDefinition { get; set; } = null!;
}

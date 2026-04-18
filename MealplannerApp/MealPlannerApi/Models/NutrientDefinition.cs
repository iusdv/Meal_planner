namespace MealPlannerApi.Models;

public class NutrientDefinition
{
    public int Id { get; set; }
    public string Key { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public string Section { get; set; } = string.Empty;
    public string Unit { get; set; } = string.Empty;
    public double? DailyValue { get; set; }
    public bool Highlight { get; set; }
    public double DisplayOrder { get; set; }

    public ICollection<NutrientExternalId> ExternalIds { get; set; } = new List<NutrientExternalId>();
    public ICollection<IngredientNutrientValue> IngredientNutrientValues { get; set; } = new List<IngredientNutrientValue>();
}

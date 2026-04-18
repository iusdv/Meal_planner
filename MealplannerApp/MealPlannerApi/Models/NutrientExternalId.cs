namespace MealPlannerApi.Models;

public class NutrientExternalId
{
    public int Id { get; set; }
    public int NutrientDefinitionId { get; set; }
    public string Source { get; set; } = string.Empty;
    public string ExternalNutrientNumber { get; set; } = string.Empty;

    public NutrientDefinition NutrientDefinition { get; set; } = null!;
}

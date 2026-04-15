namespace MealPlannerApi.Models;

public class Ingredient
{
    public int Id { get; set; }
    public string Naam { get; set; } = string.Empty;
    public string Eenheid { get; set; } = string.Empty;

    public NutritionalValue? NutritionalValue { get; set; }
    public ICollection<MealIngredient> MealIngredients { get; set; } = new List<MealIngredient>();
}

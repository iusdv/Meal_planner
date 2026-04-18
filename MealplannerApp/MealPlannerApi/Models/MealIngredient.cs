namespace MealPlannerApi.Models;

public class MealIngredient
{
    public int MealId { get; set; }
    public int IngredientId { get; set; }
    public double Hoeveelheid { get; set; }
    public string OrigineleHoeveelheid { get; set; } = string.Empty;

    public Meal Meal { get; set; } = null!;
    public Ingredient Ingredient { get; set; } = null!;
}

namespace MealPlannerApi.Models;

public class MealIngredient
{
    public int MealId { get; set; }
    public int IngredientId { get; set; }
    public double Hoeveelheid { get; set; }

    public Meal Meal { get; set; } = null!;
    public Ingredient Ingredient { get; set; } = null!;
}

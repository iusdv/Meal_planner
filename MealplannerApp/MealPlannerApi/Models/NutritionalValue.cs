namespace MealPlannerApi.Models;

public class NutritionalValue
{
    public int Id { get; set; }
    public int IngredientId { get; set; }
    public double Kcal { get; set; }
    public double Eiwit { get; set; }
    public double Koolhydraat { get; set; }
    public double Vet { get; set; }

    public Ingredient Ingredient { get; set; } = null!;
}

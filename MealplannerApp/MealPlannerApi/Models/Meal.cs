namespace MealPlannerApi.Models;

public class Meal
{
    public int Id { get; set; }
    public string Naam { get; set; } = string.Empty;
    public string Beschrijving { get; set; } = string.Empty;
    public string Categorie { get; set; } = string.Empty;
    public int Bereidingstijd { get; set; }
    public string? AfbeeldingUrl { get; set; }

    public ICollection<MealIngredient> MealIngredients { get; set; } = new List<MealIngredient>();
    public ICollection<PlannedMeal> PlannedMeals { get; set; } = new List<PlannedMeal>();
    public ICollection<Favorite> Favorites { get; set; } = new List<Favorite>();
}

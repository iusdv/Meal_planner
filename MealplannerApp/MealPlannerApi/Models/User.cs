namespace MealPlannerApi.Models;

public class User
{
    public int Id { get; set; }
    public string Naam { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string WachtwoordHash { get; set; } = string.Empty;
    public string Rol { get; set; } = "User";

    public Profile? Profile { get; set; }
    public Goal? Goal { get; set; }
    public ICollection<PlannedMeal> PlannedMeals { get; set; } = new List<PlannedMeal>();
    public ICollection<Favorite> Favorites { get; set; } = new List<Favorite>();
}

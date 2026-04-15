namespace MealPlannerApi.Models;

public class PlannedMeal
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public int MealId { get; set; }
    public DateTime Datum { get; set; }
    public string Maaltijdtype { get; set; } = string.Empty;

    public User User { get; set; } = null!;
    public Meal Meal { get; set; } = null!;
}

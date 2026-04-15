namespace MealPlannerApi.Models;

public class Favorite
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public int MealId { get; set; }
    public DateTime DatumToegevoegd { get; set; } = DateTime.UtcNow;

    public User User { get; set; } = null!;
    public Meal Meal { get; set; } = null!;
}

namespace MealPlannerApi.Models;

public class Profile
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string Gender { get; set; } = string.Empty;
    public int Leeftijd { get; set; }
    public double Gewicht { get; set; }
    public string Activiteit { get; set; } = string.Empty;

    public User User { get; set; } = null!;
}

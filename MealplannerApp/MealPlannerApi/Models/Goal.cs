namespace MealPlannerApi.Models;

public class Goal
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public double Caloriedoel { get; set; }
    public double Eiwitdoel { get; set; }
    public double Koolhydraatdoel { get; set; }
    public double Vetdoel { get; set; }

    public User User { get; set; } = null!;
}

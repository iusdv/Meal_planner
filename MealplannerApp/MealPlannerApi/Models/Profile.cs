namespace MealPlannerApi.Models;

public class Profile
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string Gender { get; set; } = string.Empty;
    public int Leeftijd { get; set; }
    public double Gewicht { get; set; }
    public double LengteCm { get; set; }
    public string Activiteit { get; set; } = string.Empty;
    public string Dieetvoorkeur { get; set; } = "Alles";
    public string Allergieen { get; set; } = string.Empty;
    public int MaaltijdenPerDag { get; set; } = 3;
    public string GewensteMaaltijden { get; set; } = "Ontbijt,Lunch,Diner";

    public User User { get; set; } = null!;
}

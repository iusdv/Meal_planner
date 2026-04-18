using System.Text;
using System.Text.Json;
using MealPlannerApi.Data;
using Microsoft.EntityFrameworkCore;

namespace MealPlannerApi.Services;

/// <summary>
/// Enriches AI requests with the user's profile and goal before calling Gemini.
/// </summary>
public class SuggestionsService
{
    private readonly MealPlannerDbContext _db;
    private readonly IConfiguration _config;
    private readonly HttpClient _httpClient;

    public SuggestionsService(MealPlannerDbContext db, IConfiguration config, IHttpClientFactory httpClientFactory)
    {
        _db = db;
        _config = config;
        _httpClient = httpClientFactory.CreateClient("Gemini");
    }

    public async Task<string> GetSuggestionAsync(int userId, string userQuestion)
    {
        var profile = await _db.Profiles.FirstOrDefaultAsync(profile => profile.UserId == userId);
        var goal = await _db.Goals.FirstOrDefaultAsync(goal => goal.UserId == userId);

        var contextBuilder = new StringBuilder();
        contextBuilder.AppendLine("Je bent een persoonlijke voedingscoach. Geef advies op basis van het volgende gebruikersprofiel:");

        if (profile != null)
        {
            contextBuilder.AppendLine($"- Geslacht: {profile.Gender}");
            contextBuilder.AppendLine($"- Leeftijd: {profile.Leeftijd} jaar");
            contextBuilder.AppendLine($"- Gewicht: {profile.Gewicht} kg");
            contextBuilder.AppendLine($"- Lengte: {profile.LengteCm} cm");
            contextBuilder.AppendLine($"- Activiteitsniveau: {profile.Activiteit}");
            contextBuilder.AppendLine($"- Dieetvoorkeur: {profile.Dieetvoorkeur}");
            contextBuilder.AppendLine($"- Allergieen of vermijdingen: {profile.Allergieen}");
        }

        if (goal != null)
        {
            contextBuilder.AppendLine($"- Dagelijks caloriedoel: {goal.Caloriedoel} kcal");
            contextBuilder.AppendLine($"- Eiwitdoel: {goal.Eiwitdoel} g");
            contextBuilder.AppendLine($"- Koolhydraatdoel: {goal.Koolhydraatdoel} g");
            contextBuilder.AppendLine($"- Vetdoel: {goal.Vetdoel} g");
        }

        contextBuilder.AppendLine();
        contextBuilder.AppendLine($"Gebruikersvraag: {userQuestion}");

        var apiKey = _config["Gemini:ApiKey"];
        if (string.IsNullOrWhiteSpace(apiKey) || apiKey.StartsWith("YOUR_", StringComparison.OrdinalIgnoreCase))
        {
            return "AI-suggesties zijn tijdelijk niet beschikbaar (API-sleutel niet geconfigureerd). " +
                   "Voeg een Gemini API-sleutel toe in de configuratie.";
        }

        var requestBody = new
        {
            contents = new[]
            {
                new
                {
                    parts = new[] { new { text = contextBuilder.ToString() } }
                }
            }
        };

        var json = JsonSerializer.Serialize(requestBody);
        var content = new StringContent(json, Encoding.UTF8, "application/json");
        var model = _config["Gemini:Model"] ?? "gemini-1.5-flash";

        var response = await _httpClient.PostAsync(
            $"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={apiKey}",
            content);

        if (!response.IsSuccessStatusCode)
        {
            return "Er is een fout opgetreden bij het ophalen van AI-suggesties. Probeer het later opnieuw.";
        }

        var responseJson = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(responseJson);

        var text = doc.RootElement
            .GetProperty("candidates")[0]
            .GetProperty("content")
            .GetProperty("parts")[0]
            .GetProperty("text")
            .GetString();

        return text ?? "Geen antwoord ontvangen van de AI.";
    }
}

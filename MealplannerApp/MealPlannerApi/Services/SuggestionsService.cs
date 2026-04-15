using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using MealPlannerApi.Data;
using MealPlannerApi.DTOs;
using Microsoft.EntityFrameworkCore;

namespace MealPlannerApi.Services;

/// <summary>
/// SuggestionsService implements the Model Context Protocol (MCP) pattern.
/// It enriches every AI request with user context (profile + goals) before
/// sending to the Gemini API, enabling personalised meal suggestions.
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
        // MCP Step 1 – Gather context
        var profile = await _db.Profiles.FirstOrDefaultAsync(p => p.UserId == userId);
        var goal = await _db.Goals.FirstOrDefaultAsync(g => g.UserId == userId);

        // MCP Step 2 – Build context-enriched prompt
        var contextBuilder = new StringBuilder();
        contextBuilder.AppendLine("Je bent een persoonlijke voedingscoach. Geef advies op basis van het volgende gebruikersprofiel:");

        if (profile != null)
        {
            contextBuilder.AppendLine($"- Geslacht: {profile.Gender}");
            contextBuilder.AppendLine($"- Leeftijd: {profile.Leeftijd} jaar");
            contextBuilder.AppendLine($"- Gewicht: {profile.Gewicht} kg");
            contextBuilder.AppendLine($"- Activiteitsniveau: {profile.Activiteit}");
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

        var fullPrompt = contextBuilder.ToString();

        // MCP Step 3 – Call AI model (Gemini)
        var apiKey = _config["Gemini:ApiKey"];
        if (string.IsNullOrEmpty(apiKey))
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
                    parts = new[] { new { text = fullPrompt } }
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

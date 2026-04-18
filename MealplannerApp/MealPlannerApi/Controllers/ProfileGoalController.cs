using System.Security.Claims;
using MealPlannerApi.Data;
using MealPlannerApi.DTOs;
using MealPlannerApi.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace MealPlannerApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ProfileController : ControllerBase
{
    private readonly MealPlannerDbContext _db;
    private const string DefaultMealSlots = "Ontbijt 1,Lunch 1,Diner 1";
    private static readonly HashSet<string> AllowedGenders = new(StringComparer.OrdinalIgnoreCase)
    {
        "Man",
        "Vrouw"
    };

    private static readonly HashSet<string> AllowedActivities = new(StringComparer.OrdinalIgnoreCase)
    {
        "Zittend werk, lichte beweging",
        "Licht actief, 3-4 keer sporten per week",
        "Dagelijks actief, vaak sporten",
        "Zeer atletisch"
    };

    private static readonly HashSet<string> AllowedMealTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "Ontbijt",
        "Lunch",
        "Diner",
        "Snack"
    };
    private static readonly string[] AllowedMealTypeOrder =
    {
        "Ontbijt",
        "Lunch",
        "Diner",
        "Snack"
    };

    public ProfileController(MealPlannerDbContext db) => _db = db;

    private int GetUserId() =>
        int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet]
    public async Task<IActionResult> Get()
    {
        var userId = GetUserId();
        var profile = await _db.Profiles.FirstOrDefaultAsync(p => p.UserId == userId);

        if (profile == null)
        {
            return Ok(new ProfileDto(
                0, userId, string.Empty,
                0, 0, 0,
                string.Empty, "Alles", string.Empty,
                0, string.Empty));
        }

        return Ok(new ProfileDto(
            profile.Id, profile.UserId, profile.Gender,
            profile.Leeftijd, profile.Gewicht, profile.LengteCm,
            profile.Activiteit, profile.Dieetvoorkeur, profile.Allergieen,
            profile.MaaltijdenPerDag, profile.GewensteMaaltijden));
    }

    [HttpPut]
    public async Task<IActionResult> Upsert([FromBody] UpsertProfileDto dto)
    {
        if (!AllowedGenders.Contains(dto.Gender))
        {
            return BadRequest("Geslacht moet Man of Vrouw zijn.");
        }

        if (dto.LengteCm <= 0 || dto.LengteCm > 251)
        {
            return BadRequest("Lengte moet tussen 1 en 251 cm liggen.");
        }

        if (!AllowedActivities.Contains(dto.Activiteit))
        {
            return BadRequest("Activiteitsniveau is ongeldig.");
        }

        if (dto.MaaltijdenPerDag < 1 || dto.MaaltijdenPerDag > 6)
        {
            return BadRequest("Eetmomenten per dag moet tussen 1 en 6 liggen.");
        }

        var rawMealCategories = (dto.GewensteMaaltijden ?? string.Empty)
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(NormalizeMealCategory)
            .Where(type => type is not null)
            .ToList();

        var categoryCounts = AllowedMealTypeOrder.ToDictionary(type => type, _ => 0, StringComparer.OrdinalIgnoreCase);
        foreach (var category in rawMealCategories)
        {
            categoryCounts[category!] += 1;
        }

        var mealTypes = AllowedMealTypeOrder
            .SelectMany(type => Enumerable.Range(1, categoryCounts[type]).Select(index => $"{type} {index}"))
            .ToList();

        if (mealTypes.Count != dto.MaaltijdenPerDag)
        {
            return BadRequest("Het aantal gekozen eetmomenten moet gelijk zijn aan eetmomenten per dag.");
        }

        var userId = GetUserId();
        var profile = await _db.Profiles.FirstOrDefaultAsync(p => p.UserId == userId);
        if (profile == null)
        {
            profile = new Profile { UserId = userId };
            _db.Profiles.Add(profile);
        }
        profile.Gender = dto.Gender;
        profile.Leeftijd = dto.Leeftijd;
        profile.Gewicht = dto.Gewicht;
        profile.LengteCm = dto.LengteCm;
        profile.Activiteit = dto.Activiteit;
        profile.Dieetvoorkeur = string.IsNullOrWhiteSpace(dto.Dieetvoorkeur) ? "Alles" : dto.Dieetvoorkeur;
        profile.Allergieen = dto.Allergieen ?? string.Empty;
        profile.MaaltijdenPerDag = dto.MaaltijdenPerDag;
        profile.GewensteMaaltijden = mealTypes.Count == 0 ? DefaultMealSlots : string.Join(",", mealTypes);
        await _db.SaveChangesAsync();
        return Ok(new ProfileDto(profile.Id, profile.UserId, profile.Gender,
            profile.Leeftijd, profile.Gewicht, profile.LengteCm,
            profile.Activiteit, profile.Dieetvoorkeur, profile.Allergieen,
            profile.MaaltijdenPerDag, profile.GewensteMaaltijden));
    }

    private static string? NormalizeMealCategory(string value)
    {
        var trimmed = value.Trim();
        if (trimmed.StartsWith("Ontbijt", StringComparison.OrdinalIgnoreCase)) return "Ontbijt";
        if (trimmed.StartsWith("Lunch", StringComparison.OrdinalIgnoreCase)) return "Lunch";
        if (trimmed.StartsWith("Diner", StringComparison.OrdinalIgnoreCase)) return "Diner";
        if (
            trimmed.StartsWith("Snack", StringComparison.OrdinalIgnoreCase) ||
            trimmed.Equals("Snacks", StringComparison.OrdinalIgnoreCase) ||
            trimmed.Equals("Ochtend snack", StringComparison.OrdinalIgnoreCase) ||
            trimmed.Equals("Middag snack", StringComparison.OrdinalIgnoreCase) ||
            trimmed.Equals("Avond snack", StringComparison.OrdinalIgnoreCase)
        )
        {
            return "Snack";
        }

        return null;
    }
}

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class GoalsController : ControllerBase
{
    private readonly MealPlannerDbContext _db;

    public GoalsController(MealPlannerDbContext db) => _db = db;

    private int GetUserId() =>
        int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet]
    public async Task<IActionResult> Get()
    {
        var userId = GetUserId();
        var goal = await _db.Goals.FirstOrDefaultAsync(g => g.UserId == userId);

        if (goal == null)
        {
            return Ok(new GoalDto(0, userId, "Balans", 0, 0, 0, 0));
        }

        return Ok(new GoalDto(
            goal.Id, goal.UserId, goal.DoelType, goal.Caloriedoel,
            goal.Eiwitdoel, goal.Koolhydraatdoel, goal.Vetdoel));
    }

    [HttpPut]
    public async Task<IActionResult> Upsert([FromBody] UpsertGoalDto dto)
    {
        var userId = GetUserId();
        var goal = await _db.Goals.FirstOrDefaultAsync(g => g.UserId == userId);
        if (goal == null)
        {
            goal = new Goal { UserId = userId };
            _db.Goals.Add(goal);
        }
        goal.DoelType = string.IsNullOrWhiteSpace(dto.DoelType) ? "Balans" : dto.DoelType;
        goal.Caloriedoel = dto.Caloriedoel;
        goal.Eiwitdoel = dto.Eiwitdoel;
        goal.Koolhydraatdoel = dto.Koolhydraatdoel;
        goal.Vetdoel = dto.Vetdoel;
        await _db.SaveChangesAsync();
        return Ok(new GoalDto(goal.Id, goal.UserId, goal.DoelType, goal.Caloriedoel,
            goal.Eiwitdoel, goal.Koolhydraatdoel, goal.Vetdoel));
    }
}

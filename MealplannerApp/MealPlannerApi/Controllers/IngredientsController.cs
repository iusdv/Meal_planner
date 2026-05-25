using MealPlannerApi.Data;
using MealPlannerApi.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace MealPlannerApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class IngredientsController : ControllerBase
{
    private readonly MealPlannerDbContext _db;

    public IngredientsController(MealPlannerDbContext db)
    {
        _db = db;
    }

    [HttpGet("search")]
    public async Task<IActionResult> Search([FromQuery] string? query, [FromQuery] int limit = 8)
    {
        var search = CleanSearch(query);
        if (search.Length < 2)
        {
            return Ok(new List<IngredientDto>());
        }

        var safeLimit = Math.Clamp(limit, 1, 12);
        var normalized = search.ToLowerInvariant();

        var candidates = await _db.Ingredients
            .Include(ingredient => ingredient.NutritionalValue)
            .Where(ingredient => ingredient.Naam.ToLower().Contains(normalized))
            .OrderBy(ingredient => ingredient.Naam)
            .Take(50)
            .ToListAsync();

        var results = candidates
            .GroupBy(ingredient => ingredient.Naam, StringComparer.OrdinalIgnoreCase)
            .Select(group => group
                .OrderByDescending(ingredient => ingredient.NutritionalValue != null)
                .ThenBy(ingredient => ingredient.Id)
                .First())
            .OrderByDescending(ingredient => ingredient.Naam.Equals(search, StringComparison.OrdinalIgnoreCase))
            .ThenByDescending(ingredient => ingredient.Naam.StartsWith(search, StringComparison.OrdinalIgnoreCase))
            .ThenBy(ingredient => ingredient.Naam)
            .Take(safeLimit)
            .Select(MapToDto)
            .ToList();

        return Ok(results);
    }

    private static IngredientDto MapToDto(MealPlannerApi.Models.Ingredient ingredient) => new(
        ingredient.Id,
        ingredient.Naam,
        ingredient.Eenheid,
        ingredient.NutritionalValue == null
            ? null
            : new NutritionalValueDto(
                ingredient.NutritionalValue.Kcal,
                ingredient.NutritionalValue.Eiwit,
                ingredient.NutritionalValue.Koolhydraat,
                ingredient.NutritionalValue.Vet));

    private static string CleanSearch(string? query)
    {
        if (string.IsNullOrWhiteSpace(query))
        {
            return string.Empty;
        }

        var cleaned = string.Join(' ', query.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries)).Trim();
        if (cleaned.Length > 80 || cleaned.Contains('<') || cleaned.Contains('>'))
        {
            return string.Empty;
        }

        return cleaned.Any(char.IsLetter) ? cleaned : string.Empty;
    }
}

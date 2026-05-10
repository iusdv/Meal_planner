using System.Security.Claims;
using MealPlannerApi.Data;
using MealPlannerApi.DTOs;
using MealPlannerApi.Models;
using MealPlannerApi.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace MealPlannerApi.Controllers;

/// <summary>
/// Admin-only controller. All endpoints require the "Admin" role.
/// </summary>
[ApiController]
[Route("api/admin")]
[Authorize(Roles = "Admin")]
public class AdminController : ControllerBase
{
    private readonly MealPlannerDbContext _db;
    private readonly TheMealDbService _theMealDbService;
    private readonly FoodDataCentralService _foodDataCentralService;
    private readonly ILogger<AdminController> _logger;

    public AdminController(
        MealPlannerDbContext db,
        TheMealDbService theMealDbService,
        FoodDataCentralService foodDataCentralService,
        ILogger<AdminController> logger)
    {
        _db = db;
        _theMealDbService = theMealDbService;
        _foodDataCentralService = foodDataCentralService;
        _logger = logger;
    }

    [HttpGet("users")]
    public async Task<IActionResult> GetUsers()
    {
        var users = await _db.Users.ToListAsync();
        return Ok(users.Select(u => new UserDto(u.Id, u.Naam, u.Email, u.Rol)));
    }

    [HttpDelete("users/{id}")]
    public async Task<IActionResult> DeleteUser(int id)
    {
        var user = await _db.Users.FindAsync(id);
        if (user == null) return NotFound();
        _db.Users.Remove(user);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("ingredients")]
    public async Task<IActionResult> AddIngredient([FromBody] CreateIngredientDto dto)
    {
        var ingredient = new Ingredient { Naam = dto.Naam, Eenheid = dto.Eenheid };
        _db.Ingredients.Add(ingredient);
        await _db.SaveChangesAsync();
        return Ok(new IngredientDto(ingredient.Id, ingredient.Naam, ingredient.Eenheid, null));
    }

    [HttpPut("ingredients/{id}/nutritional-values")]
    public async Task<IActionResult> UpsertNutritionalValue(int id, [FromBody] UpsertNutritionalValueDto dto)
    {
        var ingredient = await _db.Ingredients.Include(i => i.NutritionalValue).FirstOrDefaultAsync(i => i.Id == id);
        if (ingredient == null) return NotFound();

        if (ingredient.NutritionalValue == null)
        {
            ingredient.NutritionalValue = new NutritionalValue { IngredientId = id };
            _db.NutritionalValues.Add(ingredient.NutritionalValue);
        }
        ingredient.NutritionalValue.Kcal = dto.Kcal;
        ingredient.NutritionalValue.Eiwit = dto.Eiwit;
        ingredient.NutritionalValue.Koolhydraat = dto.Koolhydraat;
        ingredient.NutritionalValue.Vet = dto.Vet;
        await _db.SaveChangesAsync();

        return Ok(new NutritionalValueDto(dto.Kcal, dto.Eiwit, dto.Koolhydraat, dto.Vet));
    }

    [HttpPost("meal-import/import")]
    public async Task<IActionResult> ImportMeals(
        [FromQuery] int mealsPerCategory = 12,
        [FromQuery] int minimumCatalogSize = 120,
        CancellationToken cancellationToken = default)
    {
        mealsPerCategory = Math.Clamp(mealsPerCategory, 1, 50);
        minimumCatalogSize = Math.Clamp(minimumCatalogSize, 1, 1000);

        var before = await _db.Meals.CountAsync(cancellationToken);
        await _theMealDbService.ImportStarterMealsAsync(mealsPerCategory, minimumCatalogSize, cancellationToken);
        var after = await _db.Meals.CountAsync(cancellationToken);

        return Ok(new
        {
            message = "Maaltijdimport afgerond.",
            toegevoegd = after - before,
            totaal = after
        });
    }

    // POST api/admin/meal-import/enrich
    [HttpPost("meal-import/enrich")]
    public async Task<IActionResult> EnrichMealData(
        [FromQuery] int limit = 50,
        CancellationToken cancellationToken = default)
    {
        limit = Math.Clamp(limit, 1, 200);

        var meals = await _db.Meals
            .Include(meal => meal.MealIngredients)
                .ThenInclude(mealIngredient => mealIngredient.Ingredient)
                    .ThenInclude(ingredient => ingredient.NutritionalValue)
            .Where(meal => meal.ExternalMealDbId != null)
            .OrderBy(meal => meal.Id)
            .Take(limit)
            .ToListAsync(cancellationToken);

        var recipeUpdates = 0;
        var nutritionUpdates = 0;
        var failed = 0;

        foreach (var meal in meals)
        {
            try
            {
                if (await _theMealDbService.EnrichMealDetailsAsync(meal, cancellationToken))
                {
                    recipeUpdates++;
                    await _db.SaveChangesAsync(cancellationToken);
                }

                var nutritionFacts = await _foodDataCentralService.BuildNutritionFactsAsync(meal, cancellationToken);
                if (nutritionFacts != null)
                {
                    nutritionUpdates++;
                }
            }
            catch (Exception ex)
            {
                failed++;
                _logger.LogWarning(ex, "Meal enrichment failed for meal {MealId}.", meal.Id);
            }
        }

        return Ok(new
        {
            message = "Maaltijdverrijking afgerond.",
            verwerkt = meals.Count,
            receptenBijgewerkt = recipeUpdates,
            nutritionCacheBijgewerkt = nutritionUpdates,
            mislukt = failed
        });
    }
}

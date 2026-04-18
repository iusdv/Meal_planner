using System.Security.Claims;
using MealPlannerApi.Data;
using MealPlannerApi.DTOs;
using MealPlannerApi.Models;
using MealPlannerApi.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace MealPlannerApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class MealsController : ControllerBase
{
    private readonly MealPlannerDbContext _db;
    private readonly TheMealDbService _theMealDbService;
    private readonly FoodDataCentralService _foodDataCentralService;
    private readonly ILogger<MealsController> _logger;

    public MealsController(
        MealPlannerDbContext db,
        TheMealDbService theMealDbService,
        FoodDataCentralService foodDataCentralService,
        ILogger<MealsController> logger)
    {
        _db = db;
        _theMealDbService = theMealDbService;
        _foodDataCentralService = foodDataCentralService;
        _logger = logger;
    }

    [HttpGet]
    [AllowAnonymous]
    public async Task<IActionResult> GetAll()
    {
        var mealCount = await _db.Meals.CountAsync();
        if (mealCount < 120)
        {
            try
            {
                await _theMealDbService.ImportStarterMealsAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "TheMealDB import failed.");
                return StatusCode(503, new { message = "Maaltijden konden niet worden opgehaald bij TheMealDB. Probeer het later opnieuw." });
            }
        }

        var meals = await _db.Meals
            .Include(m => m.MealIngredients)
                .ThenInclude(mi => mi.Ingredient)
                    .ThenInclude(i => i.NutritionalValue)
            .ToListAsync();

        return Ok(meals.Select(meal => MapToDto(meal)));
    }

    [HttpGet("{id}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetById(int id)
    {
        var meal = await _db.Meals
            .Include(m => m.MealIngredients)
                .ThenInclude(mi => mi.Ingredient)
                    .ThenInclude(i => i.NutritionalValue)
            .FirstOrDefaultAsync(m => m.Id == id);

        if (meal != null)
        {
            try
            {
                //TODO change to put meal in database instead of contantly making api calls
                if (await _theMealDbService.EnrichMealDetailsAsync(meal))
                {
                    await _db.SaveChangesAsync();
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "TheMealDB detail enrichment failed for meal {MealId}. Returning stored meal data.", id);
            }
        }

        if (meal == null)
        {
            return NotFound();
        }

        NutritionFactsDto? nutritionFacts = null;
        try
        {
            //TODO PUT FOOD DATA CENTRAL IN DATABASE INSTEAD OF CONSTANTLY MAKING API CALLS
            nutritionFacts = await _foodDataCentralService.BuildNutritionFactsAsync(meal);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Nutrition enrichment failed for meal {MealId}. Returning recipe without extended nutrition.", id);
        }

        return Ok(MapToDto(meal, nutritionFacts));
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Create([FromBody] CreateMealDto dto)
    {
        var meal = new Meal
        {
            Naam = dto.Naam,
            Beschrijving = dto.Beschrijving,
            Instructies = dto.Beschrijving,
            Categorie = dto.Categorie,
            Bereidingstijd = dto.Bereidingstijd,
            Porties = 1,
            AfbeeldingUrl = dto.AfbeeldingUrl,
            DieetLabels = string.Empty
        };
        _db.Meals.Add(meal);
        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetById), new { id = meal.Id }, MapToDto(meal));
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Delete(int id)
    {
        var meal = await _db.Meals.FindAsync(id);
        if (meal == null) return NotFound();
        _db.Meals.Remove(meal);
        try
        {
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            return Conflict(new { message = "Maaltijd kan niet worden verwijderd omdat deze nog gekoppeld is aan planning of favorieten." });
        }

        return NoContent();
    }

    private static MealDto MapToDto(Meal m, NutritionFactsDto? nutritionFacts = null) => new(
        m.Id, m.Naam, m.Beschrijving, m.Instructies, m.Categorie, m.Bereidingstijd, m.Porties, m.AfbeeldingUrl, m.DieetLabels,
        m.MealIngredients.Select(mi => new MealIngredientDto(
            mi.IngredientId,
            mi.Ingredient.Naam,
            mi.Hoeveelheid,
            mi.Ingredient.Eenheid,
            mi.OrigineleHoeveelheid,
            mi.Ingredient.NutritionalValue == null ? null : new NutritionalValueDto(
                mi.Ingredient.NutritionalValue.Kcal,
                mi.Ingredient.NutritionalValue.Eiwit,
                mi.Ingredient.NutritionalValue.Koolhydraat,
                mi.Ingredient.NutritionalValue.Vet
            )
        )).ToList(),
        nutritionFacts
    );
}

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
    private static readonly string[] PlannerCategoryDefaults = ["Ontbijt", "Lunch", "Diner", "Snack"];

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
    public async Task<IActionResult> GetAll()
    {
        var ensureResult = await EnsureStarterMealsAsync();
        if (ensureResult != null)
        {
            return ensureResult;
        }

        var meals = await _db.Meals
            .Include(m => m.MealIngredients)
                .ThenInclude(mi => mi.Ingredient)
                    .ThenInclude(i => i.NutritionalValue)
            .OrderBy(m => m.Naam)
            .ToListAsync();

        return Ok(meals.Select(meal => MapToDto(meal)));
    }

    [HttpGet("paged")]
    public async Task<IActionResult> GetPaged(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 12,
        [FromQuery] string? category = null,
        [FromQuery] string? search = null,
        [FromQuery] int? excludeMealId = null)
    {
        var ensureResult = await EnsureStarterMealsAsync();
        if (ensureResult != null)
        {
            return ensureResult;
        }

        var safePageSize = Math.Clamp(pageSize, 1, 48);
        var safePage = Math.Max(1, page);
        var query = _db.Meals.AsQueryable();

        if (!string.IsNullOrWhiteSpace(category) && !category.Equals("Alle", StringComparison.OrdinalIgnoreCase))
        {
            var categoryFilter = category.Trim();
            query = query.Where(m => m.Categorie == categoryFilter);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchFilter = $"%{search.Trim()}%";
            query = query.Where(m => EF.Functions.Like(m.Naam, searchFilter));
        }

        if (excludeMealId.HasValue)
        {
            query = query.Where(m => m.Id != excludeMealId.Value);
        }

        var totalItems = await query.CountAsync();
        var totalPages = totalItems == 0 ? 0 : (int)Math.Ceiling(totalItems / (double)safePageSize);
        if (totalPages > 0 && safePage > totalPages)
        {
            safePage = totalPages;
        }

        var meals = await query
            .Include(m => m.MealIngredients)
                .ThenInclude(mi => mi.Ingredient)
                    .ThenInclude(i => i.NutritionalValue)
            .OrderBy(m => m.Naam)
            .Skip((safePage - 1) * safePageSize)
            .Take(safePageSize)
            .ToListAsync();

        return Ok(new PaginatedResultDto<MealDto>(
            meals.Select(meal => MapToDto(meal)).ToList(),
            safePage,
            safePageSize,
            totalItems,
            totalPages
        ));
    }

    [HttpGet("planner-candidates")]
    public async Task<IActionResult> GetPlannerCandidates(
        [FromQuery] string? categories = null,
        [FromQuery] int perCategory = 18)
    {
        var ensureResult = await EnsureStarterMealsAsync();
        if (ensureResult != null)
        {
            return ensureResult;
        }

        var requestedCategories = ParsePlannerCategories(categories);
        var safePerCategory = Math.Clamp(perCategory, 6, 60);
        var meals = new List<Meal>();

        foreach (var category in requestedCategories)
        {
            var categoryMeals = await _db.Meals
                .Include(m => m.MealIngredients)
                    .ThenInclude(mi => mi.Ingredient)
                        .ThenInclude(i => i.NutritionalValue)
                .Where(m => m.Categorie == category)
                .OrderBy(m => m.Naam)
                .Take(safePerCategory)
                .ToListAsync();

            meals.AddRange(categoryMeals);
        }

        return Ok(meals
            .DistinctBy(meal => meal.Id)
            .Select(meal => MapToDto(meal)));
    }

    [HttpGet("{id}")]
    // Haal maaltijd met ingredienten en voedingswaarden op.
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
                // TODO enrich slow loading details van TheMealDB alleen als er een externe id is en velden nog niet compleet zijn.
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
            // Bouw uitgebreide voedingslabels op basis van ingredientmapping.
            // TODO: Cache NutritionFactsDto per meal in the database and return the cached value here
            // instead of rebuilding FoodDataCentral nutrition facts on every detail page load.
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

    private async Task<IActionResult?> EnsureStarterMealsAsync()
    {
        var mealCount = await _db.Meals.CountAsync();
        if (mealCount >= 120)
        {
            return null;
        }

        try
        {
            await _theMealDbService.ImportStarterMealsAsync();
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "TheMealDB import failed.");
            return StatusCode(503, new { message = "Maaltijden konden niet worden opgehaald bij TheMealDB. Probeer het later opnieuw." });
        }
    }

    private static IReadOnlyList<string> ParsePlannerCategories(string? categories)
    {
        var requestedCategories = (categories ?? string.Empty)
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(category => PlannerCategoryDefaults.FirstOrDefault(defaultCategory =>
                defaultCategory.Equals(category, StringComparison.OrdinalIgnoreCase)))
            .OfType<string>()
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        return requestedCategories.Count > 0 ? requestedCategories : PlannerCategoryDefaults;
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

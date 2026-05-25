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
    private static readonly string[] MealCategories = ["Ontbijt", "Lunch", "Diner", "Snack"];
    private static readonly string[] IngredientUnits = ["g", "kg", "ml", "l", "stuk", "stuks", "el", "tl", "snufje", "portie", "blik", "pak", "kop", "cup"];
    private const string SelfMadeFilter = "Zelfgemaakt";

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
            query = categoryFilter.Equals(SelfMadeFilter, StringComparison.OrdinalIgnoreCase)
                ? query.Where(m => m.IsZelfgemaakt)
                : query.Where(m => m.Categorie == categoryFilter);
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
            DieetLabels = string.Empty,
            IsZelfgemaakt = false
        };
        _db.Meals.Add(meal);
        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetById), new { id = meal.Id }, MapToDto(meal));
    }

    [HttpPost("zelfgemaakt")]
    public async Task<IActionResult> CreateSelfMade([FromBody] CreateSelfMadeMealDto dto)
    {
        var validationError = ValidateSelfMadeMeal(dto);
        if (validationError != null)
        {
            return validationError;
        }

        var mealName = CleanSingleLine(dto.Naam);
        var category = CleanSingleLine(dto.Categorie);
        var normalizedName = mealName.ToLowerInvariant();

        if (await _db.Meals.AnyAsync(meal => meal.Naam.ToLower() == normalizedName))
        {
            return Conflict(new { message = "Er bestaat al een maaltijd met deze naam." });
        }

        var meal = new Meal
        {
            Naam = mealName,
            Beschrijving = CleanMultiline(dto.Beschrijving),
            Instructies = CleanMultiline(dto.Instructies),
            Categorie = category,
            Bereidingstijd = dto.Bereidingstijd,
            Porties = dto.Porties,
            AfbeeldingUrl = dto.AfbeeldingUrl.Trim(),
            ExternalMealDbId = null,
            DieetLabels = CleanDietLabels(dto.DieetLabels),
            IsZelfgemaakt = true
        };

        var resolvedIngredientNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var dtoIngredient in dto.Ingredienten)
        {
            var ingredientName = CleanSingleLine(dtoIngredient.Naam);
            var unit = CleanSingleLine(dtoIngredient.Eenheid).ToLowerInvariant();
            Ingredient ingredient;

            if (dtoIngredient.IngredientId.HasValue)
            {
                var existingIngredient = await _db.Ingredients
                    .Include(existingIngredient => existingIngredient.NutritionalValue)
                    .FirstOrDefaultAsync(existingIngredient => existingIngredient.Id == dtoIngredient.IngredientId.Value);

                if (existingIngredient == null)
                {
                    return BadRequest(new { message = $"Ingredient '{ingredientName}' is niet gevonden. Kies opnieuw of maak een custom ingredient." });
                }

                ingredient = existingIngredient;
                ingredientName = ingredient.Naam;
            }
            else
            {
                if (!dtoIngredient.KcalPer100.HasValue ||
                    !dtoIngredient.EiwitPer100.HasValue ||
                    !dtoIngredient.KoolhydraatPer100.HasValue ||
                    !dtoIngredient.VetPer100.HasValue)
                {
                    return BadRequest(new { message = $"Vul voedingswaarden in voor '{ingredientName}'." });
                }

                ingredient = new Ingredient
                {
                    Naam = ingredientName,
                    Eenheid = unit,
                    NutritionalValue = new NutritionalValue
                    {
                        Kcal = dtoIngredient.KcalPer100.Value,
                        Eiwit = dtoIngredient.EiwitPer100.Value,
                        Koolhydraat = dtoIngredient.KoolhydraatPer100.Value,
                        Vet = dtoIngredient.VetPer100.Value
                    }
                };

                _db.Ingredients.Add(ingredient);
            }

            if (!resolvedIngredientNames.Add(ingredientName))
            {
                return BadRequest(new { message = $"Ingredient '{ingredientName}' staat dubbel in de maaltijd." });
            }

            meal.MealIngredients.Add(new MealIngredient
            {
                Meal = meal,
                Ingredient = ingredient,
                Hoeveelheid = dtoIngredient.Hoeveelheid,
                OrigineleHoeveelheid = FormatOriginalMeasure(dtoIngredient.Hoeveelheid, unit)
            });
        }

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

    private static IActionResult? ValidateSelfMadeMeal(CreateSelfMadeMealDto dto)
    {
        var category = CleanSingleLine(dto.Categorie);
        if (!MealCategories.Contains(category, StringComparer.OrdinalIgnoreCase))
        {
            return new BadRequestObjectResult(new { message = "Kies een geldige categorie: Ontbijt, Lunch, Diner of Snack." });
        }

        if (!IsValidImageUrl(dto.AfbeeldingUrl))
        {
            return new BadRequestObjectResult(new { message = "Voeg een geldige http(s) afbeelding-URL toe." });
        }

        if (ContainsMarkup(dto.Naam) ||
            ContainsMarkup(dto.Beschrijving) ||
            ContainsMarkup(dto.Instructies) ||
            ContainsMarkup(dto.DieetLabels ?? string.Empty))
        {
            return new BadRequestObjectResult(new { message = "Gebruik platte tekst zonder HTML in de maaltijdgegevens." });
        }

        foreach (var ingredient in dto.Ingredienten)
        {
            var ingredientName = CleanSingleLine(ingredient.Naam);
            var unit = CleanSingleLine(ingredient.Eenheid).ToLowerInvariant();
            if (!IngredientUnits.Contains(unit, StringComparer.OrdinalIgnoreCase))
            {
                return new BadRequestObjectResult(new { message = $"Eenheid '{ingredient.Eenheid}' is niet toegestaan." });
            }

            if (ContainsMarkup(ingredient.Naam))
            {
                return new BadRequestObjectResult(new { message = "Gebruik platte tekst zonder HTML in ingredientnamen." });
            }

            if (!HasReasonableIngredientName(ingredientName))
            {
                return new BadRequestObjectResult(new { message = "Gebruik herkenbare ingredientnamen met minimaal twee letters." });
            }

            if (ingredient.IngredientId is <= 0)
            {
                return new BadRequestObjectResult(new { message = $"Ingredient '{ingredient.Naam}' is ongeldig." });
            }

            if (ingredient.IngredientId.HasValue)
            {
                continue;
            }

            if (!ingredient.KcalPer100.HasValue ||
                !ingredient.EiwitPer100.HasValue ||
                !ingredient.KoolhydraatPer100.HasValue ||
                !ingredient.VetPer100.HasValue ||
                ingredient.KcalPer100 <= 0 ||
                ingredient.EiwitPer100 < 0 ||
                ingredient.KoolhydraatPer100 < 0 ||
                ingredient.VetPer100 < 0)
            {
                return new BadRequestObjectResult(new { message = $"Vul voedingswaarden in voor '{ingredient.Naam}'." });
            }

            if (ingredient.EiwitPer100 == 0 &&
                ingredient.KoolhydraatPer100 == 0 &&
                ingredient.VetPer100 == 0)
            {
                return new BadRequestObjectResult(new { message = $"Vul minimaal een macro in voor '{ingredient.Naam}'." });
            }
        }

        return null;
    }

    private static bool HasReasonableIngredientName(string value)
    {
        var letterCount = value.Count(char.IsLetter);
        return letterCount >= 2 &&
            value.All(character =>
                char.IsLetterOrDigit(character) ||
                char.IsWhiteSpace(character) ||
                character is '-' or '\'' or '&' or '.' or ',');
    }

    private static bool IsValidImageUrl(string imageUrl)
    {
        if (!Uri.TryCreate(imageUrl.Trim(), UriKind.Absolute, out var uri))
        {
            return false;
        }

        return uri.Scheme is "http" or "https";
    }

    private static bool ContainsMarkup(string value) => value.Contains('<') || value.Contains('>');

    private static string CleanSingleLine(string value) =>
        string.Join(' ', value.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries)).Trim();

    private static string CleanMultiline(string value)
    {
        var lines = value
            .Replace("\r\n", "\n")
            .Replace('\r', '\n')
            .Split('\n')
            .Select(CleanSingleLine)
            .Where(line => !string.IsNullOrWhiteSpace(line));

        return string.Join('\n', lines);
    }

    private static string CleanDietLabels(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return string.Empty;
        }

        return string.Join(',',
            value.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries)
                .Select(CleanSingleLine)
                .Where(label => label.Length <= 40)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .Take(8));
    }

    private static string FormatOriginalMeasure(double amount, string unit) =>
        $"{amount:0.##} {unit}";

    private static MealDto MapToDto(Meal m, NutritionFactsDto? nutritionFacts = null) => new(
        m.Id, m.Naam, m.Beschrijving, m.Instructies, m.Categorie, m.Bereidingstijd, m.Porties, m.AfbeeldingUrl, m.DieetLabels, m.IsZelfgemaakt,
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

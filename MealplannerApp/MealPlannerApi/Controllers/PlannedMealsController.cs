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
public class PlannedMealsController : ControllerBase
{
    private readonly MealPlannerDbContext _db;

    public PlannedMealsController(MealPlannerDbContext db) => _db = db;

    private int GetUserId() =>
        int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet]
    public async Task<IActionResult> GetMyPlan()
    {
        var userId = GetUserId();
        var items = await _db.PlannedMeals
            .Where(pm => pm.UserId == userId)
            .Include(pm => pm.Meal)
            .OrderBy(pm => pm.Datum)
            .ToListAsync();

        return Ok(items.Select(pm => new PlannedMealDto(
            pm.Id, pm.UserId, pm.MealId, pm.Meal.Naam, pm.Meal.AfbeeldingUrl, pm.Datum, pm.Maaltijdtype)));
    }

    [HttpPost]
    public async Task<IActionResult> Plan([FromBody] CreatePlannedMealDto dto)
    {
        var userId = GetUserId();
        var meal = await _db.Meals.FindAsync(dto.MealId);
        if (meal == null) return NotFound(new { message = "Maaltijd niet gevonden." });

        var plannedDate = DateTime.SpecifyKind(dto.Datum.Date, DateTimeKind.Utc);
        var planned = await _db.PlannedMeals.FirstOrDefaultAsync(pm =>
            pm.UserId == userId &&
            pm.Datum == plannedDate &&
            pm.Maaltijdtype == dto.Maaltijdtype);

        if (planned == null)
        {
            planned = new PlannedMeal
            {
                UserId = userId,
                Datum = plannedDate,
                Maaltijdtype = dto.Maaltijdtype
            };
            _db.PlannedMeals.Add(planned);
        }

        planned.MealId = dto.MealId;
        await _db.SaveChangesAsync();

        return Ok(new PlannedMealDto(
            planned.Id, planned.UserId, planned.MealId,
            meal.Naam, meal.AfbeeldingUrl, planned.Datum, planned.Maaltijdtype));
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Remove(int id)
    {
        var userId = GetUserId();
        var item = await _db.PlannedMeals.FirstOrDefaultAsync(pm => pm.Id == id && pm.UserId == userId);
        if (item == null) return NotFound();
        _db.PlannedMeals.Remove(item);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}

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
public class FavoritesController : ControllerBase
{
    private readonly MealPlannerDbContext _db;

    public FavoritesController(MealPlannerDbContext db) => _db = db;

    private int GetUserId() =>
        int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet]
    public async Task<IActionResult> GetFavorites()
    {
        var userId = GetUserId();
        var favs = await _db.Favorites
            .Where(f => f.UserId == userId)
            .Include(f => f.Meal)
            .OrderByDescending(f => f.DatumToegevoegd)
            .ToListAsync();

        return Ok(favs.Select(f => new FavoriteDto(
            f.Id, f.MealId, f.Meal.Naam, f.Meal.AfbeeldingUrl, f.DatumToegevoegd)));
    }

    [HttpPost]
    public async Task<IActionResult> Add([FromBody] AddFavoriteDto dto)
    {
        var userId = GetUserId();
        if (await _db.Favorites.AnyAsync(f => f.UserId == userId && f.MealId == dto.MealId))
            return Conflict(new { message = "Maaltijd staat al in je favorieten." });

        var meal = await _db.Meals.FindAsync(dto.MealId);
        if (meal == null) return NotFound(new { message = "Maaltijd niet gevonden." });

        var fav = new Favorite { UserId = userId, MealId = dto.MealId };
        _db.Favorites.Add(fav);
        await _db.SaveChangesAsync();

        return Ok(new FavoriteDto(fav.Id, fav.MealId, meal.Naam, meal.AfbeeldingUrl, fav.DatumToegevoegd));
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Remove(int id)
    {
        var userId = GetUserId();
        var fav = await _db.Favorites.FirstOrDefaultAsync(f => f.Id == id && f.UserId == userId);
        if (fav == null) return NotFound();
        _db.Favorites.Remove(fav);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}

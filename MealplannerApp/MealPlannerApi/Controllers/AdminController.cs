using System.Security.Claims;
using MealPlannerApi.Data;
using MealPlannerApi.DTOs;
using MealPlannerApi.Models;
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

    public AdminController(MealPlannerDbContext db) => _db = db;

    // GET api/admin/users — list all users (hashes never returned)
    [HttpGet("users")]
    public async Task<IActionResult> GetUsers()
    {
        var users = await _db.Users.ToListAsync();
        return Ok(users.Select(u => new UserDto(u.Id, u.Naam, u.Email, u.Rol)));
    }

    // DELETE api/admin/users/{id}
    [HttpDelete("users/{id}")]
    public async Task<IActionResult> DeleteUser(int id)
    {
        var user = await _db.Users.FindAsync(id);
        if (user == null) return NotFound();
        _db.Users.Remove(user);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // POST api/admin/ingredients
    [HttpPost("ingredients")]
    public async Task<IActionResult> AddIngredient([FromBody] CreateIngredientDto dto)
    {
        var ingredient = new Ingredient { Naam = dto.Naam, Eenheid = dto.Eenheid };
        _db.Ingredients.Add(ingredient);
        await _db.SaveChangesAsync();
        return Ok(new IngredientDto(ingredient.Id, ingredient.Naam, ingredient.Eenheid, null));
    }

    // PUT api/admin/ingredients/{id}/nutritional-values
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
}

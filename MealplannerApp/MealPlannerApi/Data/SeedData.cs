using MealPlannerApi.Models;
using BCrypt.Net;

namespace MealPlannerApi.Data;

public static class SeedData
{
    public static void Initialize(MealPlannerDbContext context)
    {
        if (context.Users.Any()) return;

        // --- Users ---
        var adminUser = new User
        {
            Naam = "Admin",
            Email = "admin@mealplanner.nl",
            // NOTE: WachtwoordHash stores only the BCrypt hash, never the plain password.
            WachtwoordHash = BCrypt.Net.BCrypt.HashPassword("Admin@123"),
            Rol = "Admin"
        };
        var demoUser = new User
        {
            Naam = "Demo User",
            Email = "demo@mealplanner.nl",
            WachtwoordHash = BCrypt.Net.BCrypt.HashPassword("Demo@123"),
            Rol = "User"
        };
        context.Users.AddRange(adminUser, demoUser);
        context.SaveChanges();

        // --- Profiles ---
        context.Profiles.Add(new Profile
        {
            UserId = demoUser.Id,
            Gender = "Man",
            Leeftijd = 28,
            Gewicht = 80.0,
            Activiteit = "Matig actief"
        });

        // --- Goals ---
        context.Goals.Add(new Goal
        {
            UserId = demoUser.Id,
            Caloriedoel = 2200,
            Eiwitdoel = 150,
            Koolhydraatdoel = 250,
            Vetdoel = 70
        });

        // --- Ingredients ---
        var kip = new Ingredient { Naam = "Kipfilet", Eenheid = "gram" };
        var rijst = new Ingredient { Naam = "Bruine rijst", Eenheid = "gram" };
        var broccoli = new Ingredient { Naam = "Broccoli", Eenheid = "gram" };
        var havermout = new Ingredient { Naam = "Havermout", Eenheid = "gram" };
        var melk = new Ingredient { Naam = "Halfvolle melk", Eenheid = "ml" };
        context.Ingredients.AddRange(kip, rijst, broccoli, havermout, melk);
        context.SaveChanges();

        // --- NutritionalValues (per 100g/ml) ---
        context.NutritionalValues.AddRange(
            new NutritionalValue { IngredientId = kip.Id, Kcal = 165, Eiwit = 31, Koolhydraat = 0, Vet = 3.6 },
            new NutritionalValue { IngredientId = rijst.Id, Kcal = 362, Eiwit = 7.5, Koolhydraat = 76, Vet = 2.7 },
            new NutritionalValue { IngredientId = broccoli.Id, Kcal = 34, Eiwit = 2.8, Koolhydraat = 5, Vet = 0.4 },
            new NutritionalValue { IngredientId = havermout.Id, Kcal = 389, Eiwit = 17, Koolhydraat = 66, Vet = 7 },
            new NutritionalValue { IngredientId = melk.Id, Kcal = 47, Eiwit = 3.4, Koolhydraat = 4.8, Vet = 1.6 }
        );

        // --- Meals ---
        var ontbijt = new Meal
        {
            Naam = "Havermoutpap",
            Beschrijving = "Gezond ontbijt met havermout en melk",
            Instructies = "Verwarm de melk, roer de havermout erdoor en laat kort koken tot de pap romig is.",
            Categorie = "Ontbijt",
            Bereidingstijd = 10,
            Porties = 1,
            AfbeeldingUrl = "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400"
        };
        var diner = new Meal
        {
            Naam = "Kip met rijst en broccoli",
            Beschrijving = "Eiwitrijk diner met groenten",
            Instructies = "Kook de rijst, bak de kip gaar en stoom de broccoli. Serveer samen op een bord.",
            Categorie = "Diner",
            Bereidingstijd = 30,
            Porties = 1,
            AfbeeldingUrl = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400"
        };
        context.Meals.AddRange(ontbijt, diner);
        context.SaveChanges();

        // --- MealIngredients ---
        context.MealIngredients.AddRange(
            new MealIngredient { MealId = ontbijt.Id, IngredientId = havermout.Id, Hoeveelheid = 80, OrigineleHoeveelheid = "80 g" },
            new MealIngredient { MealId = ontbijt.Id, IngredientId = melk.Id, Hoeveelheid = 200, OrigineleHoeveelheid = "200 ml" },
            new MealIngredient { MealId = diner.Id, IngredientId = kip.Id, Hoeveelheid = 200, OrigineleHoeveelheid = "200 g" },
            new MealIngredient { MealId = diner.Id, IngredientId = rijst.Id, Hoeveelheid = 100, OrigineleHoeveelheid = "100 g" },
            new MealIngredient { MealId = diner.Id, IngredientId = broccoli.Id, Hoeveelheid = 150, OrigineleHoeveelheid = "150 g" }
        );

        // --- Favorites ---
        context.Favorites.Add(new Favorite
        {
            UserId = demoUser.Id,
            MealId = diner.Id,
            DatumToegevoegd = DateTime.UtcNow
        });

        context.SaveChanges();
    }
}

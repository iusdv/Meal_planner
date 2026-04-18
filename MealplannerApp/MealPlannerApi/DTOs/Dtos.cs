namespace MealPlannerApi.DTOs;

// Auth DTOs
public record RegisterDto(string Naam, string Email, string Wachtwoord);
public record LoginDto(string Email, string Wachtwoord);
public record AuthResponseDto(string Token, UserDto User);

// User DTOs — WachtwoordHash is intentionally excluded to prevent Information Disclosure
public record UserDto(int Id, string Naam, string Email, string Rol);

// Profile DTOs
public record ProfileDto(
    int Id,
    int UserId,
    string Gender,
    int Leeftijd,
    double Gewicht,
    double LengteCm,
    string Activiteit,
    string Dieetvoorkeur,
    string Allergieen,
    int MaaltijdenPerDag,
    string GewensteMaaltijden);
public record UpsertProfileDto(
    string Gender,
    int Leeftijd,
    double Gewicht,
    double LengteCm,
    string Activiteit,
    string Dieetvoorkeur,
    string Allergieen,
    int MaaltijdenPerDag,
    string GewensteMaaltijden);

// Goal DTOs
public record GoalDto(int Id, int UserId, string DoelType, double Caloriedoel, double Eiwitdoel, double Koolhydraatdoel, double Vetdoel);
public record UpsertGoalDto(string DoelType, double Caloriedoel, double Eiwitdoel, double Koolhydraatdoel, double Vetdoel);

// Meal DTOs
public record MealDto(
    int Id,
    string Naam,
    string Beschrijving,
    string Instructies,
    string Categorie,
    int Bereidingstijd,
    int Porties,
    string? AfbeeldingUrl,
    string DieetLabels,
    List<MealIngredientDto> Ingredienten,
    NutritionFactsDto? NutritionFacts = null);
public record CreateMealDto(string Naam, string Beschrijving, string Categorie, int Bereidingstijd, string? AfbeeldingUrl);
public record MealIngredientDto(int IngredientId, string IngredientNaam, double Hoeveelheid, string Eenheid, string OrigineleHoeveelheid, NutritionalValueDto? Voedingswaarde);
public record NutritionFactsDto(double ServingGrams, bool Estimated, string Source, List<NutritionFactSectionDto> Sections);
public record NutritionFactSectionDto(string Title, List<NutritionFactRowDto> Rows);
public record NutritionFactRowDto(string Key, string Label, double Value, string Unit, double? DailyValuePercent, bool Highlight = false);

// Ingredient DTOs
public record IngredientDto(int Id, string Naam, string Eenheid, NutritionalValueDto? Voedingswaarde);
public record CreateIngredientDto(string Naam, string Eenheid);
public record NutritionalValueDto(double Kcal, double Eiwit, double Koolhydraat, double Vet);
public record UpsertNutritionalValueDto(double Kcal, double Eiwit, double Koolhydraat, double Vet);

// PlannedMeal DTOs
public record PlannedMealDto(int Id, int UserId, int MealId, string MealNaam, string? AfbeeldingUrl, DateTime Datum, string Maaltijdtype);
public record CreatePlannedMealDto(int MealId, DateTime Datum, string Maaltijdtype);

// Favorite DTOs
public record FavoriteDto(int Id, int MealId, string MealNaam, string? AfbeeldingUrl, DateTime DatumToegevoegd);
public record AddFavoriteDto(int MealId);

// AI Suggestion DTOs
public record SuggestionRequestDto(string Vraag);
public record SuggestionResponseDto(string Antwoord);

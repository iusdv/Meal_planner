using MealPlannerApi.Models;
using Microsoft.EntityFrameworkCore;

namespace MealPlannerApi.Data;

public class MealPlannerDbContext : DbContext
{
    public MealPlannerDbContext(DbContextOptions<MealPlannerDbContext> options) : base(options) { }

    public DbSet<User> Users => Set<User>();
    public DbSet<Profile> Profiles => Set<Profile>();
    public DbSet<Goal> Goals => Set<Goal>();
    public DbSet<Meal> Meals => Set<Meal>();
    public DbSet<Ingredient> Ingredients => Set<Ingredient>();
    public DbSet<MealIngredient> MealIngredients => Set<MealIngredient>();
    public DbSet<NutritionalValue> NutritionalValues => Set<NutritionalValue>();
    public DbSet<NutrientDefinition> NutrientDefinitions => Set<NutrientDefinition>();
    public DbSet<NutrientExternalId> NutrientExternalIds => Set<NutrientExternalId>();
    public DbSet<IngredientNutritionMapping> IngredientNutritionMappings => Set<IngredientNutritionMapping>();
    public DbSet<IngredientNutrientValue> IngredientNutrientValues => Set<IngredientNutrientValue>();
    public DbSet<PlannedMeal> PlannedMeals => Set<PlannedMeal>();
    public DbSet<Favorite> Favorites => Set<Favorite>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<User>(entity =>
        {
            entity.ToTable("Users");
            entity.HasKey(user => user.Id);
            entity.HasIndex(user => user.Email).IsUnique();
            entity.Property(user => user.Naam).IsRequired().HasMaxLength(100);
            entity.Property(user => user.Email).IsRequired().HasMaxLength(255);
            entity.Property(user => user.WachtwoordHash).IsRequired();
            entity.Property(user => user.Rol).IsRequired().HasMaxLength(50).HasDefaultValue("User");
        });

        modelBuilder.Entity<Profile>(entity =>
        {
            entity.ToTable("Profiles");
            entity.HasKey(profile => profile.Id);
            entity.HasIndex(profile => profile.UserId).IsUnique();
            entity.Property(profile => profile.Gender).IsRequired().HasMaxLength(50);
            entity.Property(profile => profile.Activiteit).IsRequired().HasMaxLength(100);
            entity.Property(profile => profile.Dieetvoorkeur).IsRequired().HasMaxLength(100);
            entity.Property(profile => profile.Allergieen).IsRequired().HasMaxLength(1000);
            entity.Property(profile => profile.MaaltijdenPerDag).HasDefaultValue(3);
            entity.Property(profile => profile.GewensteMaaltijden).IsRequired().HasMaxLength(200).HasDefaultValue("Ontbijt,Lunch,Diner");
            entity.HasOne(profile => profile.User)
                .WithOne(user => user.Profile)
                .HasForeignKey<Profile>(profile => profile.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Goal>(entity =>
        {
            entity.ToTable("Goals");
            entity.HasKey(goal => goal.Id);
            entity.HasIndex(goal => goal.UserId).IsUnique();
            entity.Property(goal => goal.DoelType).IsRequired().HasMaxLength(100).HasDefaultValue("Balans");
            entity.Property(goal => goal.Caloriedoel).HasColumnName("CalorieDoel");
            entity.Property(goal => goal.Eiwitdoel).HasColumnName("EiwitDoel");
            entity.Property(goal => goal.Koolhydraatdoel).HasColumnName("KoolhydraatDoel");
            entity.Property(goal => goal.Vetdoel).HasColumnName("VetDoel");
            entity.HasOne(goal => goal.User)
                .WithOne(user => user.Goal)
                .HasForeignKey<Goal>(goal => goal.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Meal>(entity =>
        {
            entity.ToTable("Meals");
            entity.HasKey(meal => meal.Id);
            entity.Property(meal => meal.Naam).IsRequired().HasMaxLength(200);
            entity.Property(meal => meal.Beschrijving).IsRequired().HasMaxLength(2000);
            entity.Property(meal => meal.Instructies).IsRequired().HasColumnType("longtext");
            entity.Property(meal => meal.Categorie).IsRequired().HasMaxLength(100);
            entity.Property(meal => meal.Porties).IsRequired().HasDefaultValue(1);
            entity.Property(meal => meal.AfbeeldingUrl).HasMaxLength(1000);
            entity.Property(meal => meal.ExternalMealDbId).HasMaxLength(50);
            entity.Property(meal => meal.DieetLabels).IsRequired().HasMaxLength(500);
            entity.HasIndex(meal => meal.ExternalMealDbId).IsUnique();
        });

        modelBuilder.Entity<Ingredient>(entity =>
        {
            entity.ToTable("Ingredients");
            entity.HasKey(ingredient => ingredient.Id);
            entity.Property(ingredient => ingredient.Naam).IsRequired().HasMaxLength(200);
            entity.Property(ingredient => ingredient.Eenheid).IsRequired().HasMaxLength(50);
        });

        modelBuilder.Entity<MealIngredient>(entity =>
        {
            entity.ToTable("MealIngredients");
            entity.HasKey(mealIngredient => new { mealIngredient.MealId, mealIngredient.IngredientId });
            entity.Property(mealIngredient => mealIngredient.Hoeveelheid).IsRequired();
            entity.Property(mealIngredient => mealIngredient.OrigineleHoeveelheid).IsRequired().HasMaxLength(100);
            entity.HasOne(mealIngredient => mealIngredient.Meal)
                .WithMany(meal => meal.MealIngredients)
                .HasForeignKey(mealIngredient => mealIngredient.MealId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(mealIngredient => mealIngredient.Ingredient)
                .WithMany(ingredient => ingredient.MealIngredients)
                .HasForeignKey(mealIngredient => mealIngredient.IngredientId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<NutritionalValue>(entity =>
        {
            entity.ToTable("NutritionalValues");
            entity.HasKey(nutritionalValue => nutritionalValue.Id);
            entity.HasIndex(nutritionalValue => nutritionalValue.IngredientId).IsUnique();
            entity.Property(nutritionalValue => nutritionalValue.Kcal).HasColumnName("Calorieen");
            entity.Property(nutritionalValue => nutritionalValue.Eiwit).HasColumnName("Eiwitten");
            entity.Property(nutritionalValue => nutritionalValue.Koolhydraat).HasColumnName("Koolhydraten");
            entity.Property(nutritionalValue => nutritionalValue.Vet).HasColumnName("Vetten");
            entity.HasOne(nutritionalValue => nutritionalValue.Ingredient)
                .WithOne(ingredient => ingredient.NutritionalValue)
                .HasForeignKey<NutritionalValue>(nutritionalValue => nutritionalValue.IngredientId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<NutrientDefinition>(entity =>
        {
            entity.ToTable("NutrientDefinitions");
            entity.HasKey(nutrientDefinition => nutrientDefinition.Id);
            entity.HasIndex(nutrientDefinition => nutrientDefinition.Key).IsUnique();
            entity.Property(nutrientDefinition => nutrientDefinition.Key).IsRequired().HasMaxLength(80);
            entity.Property(nutrientDefinition => nutrientDefinition.Label).IsRequired().HasMaxLength(160);
            entity.Property(nutrientDefinition => nutrientDefinition.Section).IsRequired().HasMaxLength(120);
            entity.Property(nutrientDefinition => nutrientDefinition.Unit).IsRequired().HasMaxLength(20);
        });

        modelBuilder.Entity<NutrientExternalId>(entity =>
        {
            entity.ToTable("NutrientExternalIds");
            entity.HasKey(nutrientExternalId => nutrientExternalId.Id);
            entity.HasIndex(nutrientExternalId => new
            {
                nutrientExternalId.Source,
                nutrientExternalId.ExternalNutrientNumber
            }).IsUnique();
            entity.Property(nutrientExternalId => nutrientExternalId.Source).IsRequired().HasMaxLength(120);
            entity.Property(nutrientExternalId => nutrientExternalId.ExternalNutrientNumber).IsRequired().HasMaxLength(40);
            entity.HasOne(nutrientExternalId => nutrientExternalId.NutrientDefinition)
                .WithMany(nutrientDefinition => nutrientDefinition.ExternalIds)
                .HasForeignKey(nutrientExternalId => nutrientExternalId.NutrientDefinitionId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<IngredientNutritionMapping>(entity =>
        {
            entity.ToTable("IngredientNutritionMappings");
            entity.HasKey(ingredientNutritionMapping => ingredientNutritionMapping.Id);
            entity.HasIndex(ingredientNutritionMapping => new
            {
                ingredientNutritionMapping.IngredientId,
                ingredientNutritionMapping.Source
            }).IsUnique();
            entity.Property(ingredientNutritionMapping => ingredientNutritionMapping.Source).IsRequired().HasMaxLength(120);
            entity.Property(ingredientNutritionMapping => ingredientNutritionMapping.SearchTerm).IsRequired().HasMaxLength(200);
            entity.Property(ingredientNutritionMapping => ingredientNutritionMapping.ExternalFoodId).HasMaxLength(80);
            entity.Property(ingredientNutritionMapping => ingredientNutritionMapping.ExternalFoodDescription).HasMaxLength(500);
            entity.Property(ingredientNutritionMapping => ingredientNutritionMapping.ExternalDataType).HasMaxLength(80);
            entity.HasOne(ingredientNutritionMapping => ingredientNutritionMapping.Ingredient)
                .WithMany(ingredient => ingredient.NutritionMappings)
                .HasForeignKey(ingredientNutritionMapping => ingredientNutritionMapping.IngredientId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<IngredientNutrientValue>(entity =>
        {
            entity.ToTable("IngredientNutrientValues");
            entity.HasKey(ingredientNutrientValue => ingredientNutrientValue.Id);
            entity.HasIndex(ingredientNutrientValue => new
            {
                ingredientNutrientValue.IngredientNutritionMappingId,
                ingredientNutrientValue.NutrientDefinitionId
            }).IsUnique();
            entity.Property(ingredientNutrientValue => ingredientNutrientValue.Unit).IsRequired().HasMaxLength(20);
            entity.HasOne(ingredientNutrientValue => ingredientNutrientValue.IngredientNutritionMapping)
                .WithMany(ingredientNutritionMapping => ingredientNutritionMapping.NutrientValues)
                .HasForeignKey(ingredientNutrientValue => ingredientNutrientValue.IngredientNutritionMappingId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(ingredientNutrientValue => ingredientNutrientValue.NutrientDefinition)
                .WithMany(nutrientDefinition => nutrientDefinition.IngredientNutrientValues)
                .HasForeignKey(ingredientNutrientValue => ingredientNutrientValue.NutrientDefinitionId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<PlannedMeal>(entity =>
        {
            entity.ToTable("PlannedMeals");
            entity.HasKey(plannedMeal => plannedMeal.Id);
            entity.HasIndex(plannedMeal => new
            {
                plannedMeal.UserId,
                plannedMeal.Datum,
                plannedMeal.Maaltijdtype
            }).IsUnique();
            entity.Property(plannedMeal => plannedMeal.Datum).HasColumnName("GeplandeDatum");
            entity.Property(plannedMeal => plannedMeal.Maaltijdtype)
                .HasColumnName("TypeMaaltijd")
                .IsRequired()
                .HasMaxLength(20);
            entity.HasOne(plannedMeal => plannedMeal.User)
                .WithMany(user => user.PlannedMeals)
                .HasForeignKey(plannedMeal => plannedMeal.UserId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(plannedMeal => plannedMeal.Meal)
                .WithMany(meal => meal.PlannedMeals)
                .HasForeignKey(plannedMeal => plannedMeal.MealId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Favorite>(entity =>
        {
            entity.ToTable("Favorites");
            entity.HasKey(favorite => favorite.Id);
            entity.HasIndex(favorite => new { favorite.UserId, favorite.MealId }).IsUnique();
            entity.HasOne(favorite => favorite.User)
                .WithMany(user => user.Favorites)
                .HasForeignKey(favorite => favorite.UserId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(favorite => favorite.Meal)
                .WithMany(meal => meal.Favorites)
                .HasForeignKey(favorite => favorite.MealId)
                .OnDelete(DeleteBehavior.Restrict);
        });
    }
}

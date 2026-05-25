using System.Security.Claims;
using System.Text;
using System.Threading.RateLimiting;
using MealPlannerApi.Configuration;
using MealPlannerApi.Data;
using MealPlannerApi.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

EnvFile.Load(Path.Combine(Directory.GetCurrentDirectory(), ".env"));

var builder = WebApplication.CreateBuilder(args);


var connectionString = ConnectionStringResolver.ResolveMySqlConnectionString(builder.Configuration);
var mySqlServerVersion = builder.Configuration["MySql:ServerVersion"] ?? "8.0.36";
builder.Services.AddDbContext<MealPlannerDbContext>(options =>
    options.UseMySql(connectionString, ServerVersion.Parse(mySqlServerVersion)));

// JWT authentication.
var jwtKey = builder.Configuration["Jwt:Key"]
    ?? throw new InvalidOperationException("Jwt:Key is not configured.");
var jwtIssuer = builder.Configuration["Jwt:Issuer"]
    ?? throw new InvalidOperationException("Jwt:Issuer is not configured.");
var jwtAudience = builder.Configuration["Jwt:Audience"]
    ?? throw new InvalidOperationException("Jwt:Audience is not configured.");

if (Encoding.UTF8.GetByteCount(jwtKey) < 32)
{
    throw new InvalidOperationException("Jwt:Key must be at least 32 bytes for HMAC SHA-256.");
}

// Threat ID: TM-02
// Mitigatie tegen unauthorized API access: JWT-tokens worden gevalideerd op
// issuer, audience, lifetime en signing key.
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtIssuer,
            ValidAudience = jwtAudience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
            ClockSkew = TimeSpan.FromMinutes(2)
        };
    });
// Threat ID: TM-09
// Mitigatie tegen cross-origin blootstelling van protected API responses:
// alleen toegestane frontend-origins krijgen toegang via CORS.
builder.Services.AddAuthorization();

// CORS for the Vite frontend.
var allowedOrigins = builder.Configuration
    .GetSection("Cors:AllowedOrigins")
    .Get<string[]>()
    ?? ["http://localhost:5173", "http://127.0.0.1:5173"];

builder.Services.AddCors(options =>
{
    options.AddPolicy("FrontendPolicy", policy =>
    {
        policy.WithOrigins(allowedOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

var authRateLimit = builder.Configuration.GetValue("RateLimiting:Auth:PermitLimit", 8);
var authRateWindowSeconds = builder.Configuration.GetValue("RateLimiting:Auth:WindowSeconds", 60);
var suggestionsRateLimit = builder.Configuration.GetValue("RateLimiting:Suggestions:PermitLimit", 12);
var suggestionsRateWindowSeconds = builder.Configuration.GetValue("RateLimiting:Suggestions:WindowSeconds", 60);

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = async (context, cancellationToken) =>
    {
        context.HttpContext.Response.ContentType = "application/json";
        await context.HttpContext.Response.WriteAsJsonAsync(
            new { message = "Te veel verzoeken. Wacht even en probeer het opnieuw." },
            cancellationToken);
    };

    options.AddPolicy(RateLimitPolicyNames.Auth, httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            $"auth:{GetClientAddress(httpContext)}",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = authRateLimit,
                Window = TimeSpan.FromSeconds(authRateWindowSeconds),
                QueueLimit = 0,
                AutoReplenishment = true
            }));

    options.AddPolicy(RateLimitPolicyNames.Suggestions, httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            $"suggestions:{GetUserOrClientAddress(httpContext)}",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = suggestionsRateLimit,
                Window = TimeSpan.FromSeconds(suggestionsRateWindowSeconds),
                QueueLimit = 0,
                AutoReplenishment = true
            }));
});

// Application services.
builder.Services.AddMemoryCache();
builder.Services.AddHttpClient("Gemini");
builder.Services.AddHttpClient<TheMealDbService>(client =>
{
    client.BaseAddress = new Uri("https://www.themealdb.com/api/json/v1/1/");
    client.Timeout = TimeSpan.FromSeconds(20);
});
builder.Services.AddHttpClient<FoodDataCentralService>(client =>
{
    client.BaseAddress = new Uri("https://api.nal.usda.gov/fdc/v1/");
    client.Timeout = TimeSpan.FromSeconds(20);
});
builder.Services.AddScoped<JwtService>();
builder.Services.AddScoped<SuggestionsService>();
builder.Services.AddHostedService<MealDataRefreshService>();

builder.Services.AddControllers();

var app = builder.Build();

if (builder.Configuration.GetValue<bool>("Database:ApplyMigrationsOnStartup"))
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<MealPlannerDbContext>();
    await db.Database.MigrateAsync();
    SeedData.Initialize(db);
}

if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
}
else
{
    app.UseExceptionHandler("/error");
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseCors("FrontendPolicy");
app.UseAuthentication();
app.UseRateLimiter();
app.UseAuthorization();

app.MapControllers();
app.Map("/error", () => Results.Problem("An unexpected error occurred.", statusCode: 500));

app.Run();

static string GetClientAddress(HttpContext httpContext) =>
    httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown-client";

static string GetUserOrClientAddress(HttpContext httpContext) =>
    httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier) ?? GetClientAddress(httpContext);

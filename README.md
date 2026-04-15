# 🥗 MealPlanner Webapp

Een full-stack maaltijdplanner showcaseproject gebouwd met **ASP.NET Core 10 Web API** (backend) en **React + Vite + TypeScript + Tailwind CSS** (frontend).

---

## 📁 Projectstructuur

```
MealplannerApp/
├── MealPlannerApi/          # ASP.NET Core Web API (backend)
│   ├── Controllers/         # Auth, Meals, PlannedMeals, Favorites, Profile, Goals, Admin, Suggestions
│   ├── Data/                # DbContext + SeedData
│   ├── DTOs/                # Data Transfer Objects
│   ├── Models/              # EF Core entiteiten
│   ├── Services/            # JwtService, SuggestionsService (MCP)
│   └── Program.cs           # App configuratie: CORS, JWT, EF Core, DI
└── frontend/                # React + Vite + TypeScript + Tailwind CSS
    └── src/
        ├── components/      # Navbar, ProtectedRoute, AIAssistant
        ├── context/         # AuthContext (JWT-state)
        ├── pages/           # Login, Register, Dashboard, Meals, Favorites, Profile, Admin
        ├── services/        # API-laag (axios)
        └── types/           # TypeScript interfaces
```

---

## 🚀 Installatie & Opstarten

### Vereisten

- [.NET 10 SDK](https://dotnet.microsoft.com/download)
- [Node.js 18+](https://nodejs.org/)
- MySQL Server

### Backend

```bash
cd MealplannerApp/MealPlannerApi

# Pas de connection string aan in appsettings.json
# Server=localhost;Port=3306;Database=mealplanner;User=root;Password=yourpassword;

# Stel een veilige JWT-sleutel in (min. 32 tekens)
# appsettings.json → Jwt:Key

# Run (migrations + seed worden automatisch uitgevoerd bij start)
dotnet run
```

API draait op: `http://localhost:5000`

### Frontend

```bash
cd MealplannerApp/frontend
npm install
npm run dev
```

Frontend draait op: `http://localhost:5173`

### Demo-accounts (na seed)

| E-mail                | Wachtwoord | Rol   |
|-----------------------|------------|-------|
| admin@mealplanner.nl  | Admin@123  | Admin |
| demo@mealplanner.nl   | Demo@123   | User  |

---

## 🗄️ Database Schema

| Tabel              | Beschrijving                                                |
|--------------------|-------------------------------------------------------------|
| Users              | id, naam, email, wachtwoord_hash, rol                       |
| Profiles           | id, user_id, gender, leeftijd, gewicht, activiteit          |
| Goals              | id, user_id, caloriedoel, eiwitdoel, koolhydraatdoel, vetdoel |
| Meals              | id, naam, beschrijving, categorie, bereidingstijd, afbeelding_url |
| Ingredients        | id, naam, eenheid                                           |
| MealIngredients    | meal_id, ingredient_id, hoeveelheid (koppeltabel)           |
| NutritionalValues  | id, ingredient_id, kcal, eiwit, koolhydraat, vet            |
| PlannedMeals       | id, user_id, meal_id, datum, maaltijdtype                   |
| Favorites          | id, user_id, meal_id, datum_toegevoegd                      |

---

## 🔐 Beveiliging

### JWT Authenticatie

- Tokens worden gegenereerd in `Services/JwtService.cs` met HMAC-SHA256 signing.
- Tokens bevatten: `NameIdentifier`, `Email`, `Name`, `Role` claims.
- Verlooptijd: 8 uur.
- Frontend slaat het token op in `localStorage` en stuurt het mee als `Authorization: Bearer <token>` header via een axios interceptor (`services/api.ts`).

### BCrypt Wachtwoord-hashing

- Wachtwoorden worden **nooit** in plain text opgeslagen.
- `BCrypt.Net.BCrypt.HashPassword(wachtwoord)` genereert een hash met ingebouwde random salt.
- Verificatie: `BCrypt.Net.BCrypt.Verify(wachtwoord, hash)` (constant-time, beschermt tegen timing-aanvallen).
- Zie: `Controllers/AuthController.cs` regels 37–41 (registratie) en 51–52 (login).

### Role-Based Access Control (RBAC)

- Twee rollen: `User` en `Admin`.
- Admin-endpoints zijn beveiligd met `[Authorize(Roles = "Admin")]`.
- Zie: `Controllers/AdminController.cs` (klasse-niveau attribuut op regel 14) en `Controllers/MealsController.cs` (POST/DELETE op regels 51, 62).
- Frontend redirect niet-admins automatisch via `ProtectedRoute.tsx`.

---

## 🛡️ Datapunt 6b – Bedreiging: Information Disclosure

> *Information Disclosure* treedt op wanneer een applicatie onbedoeld gevoelige informatie lekt naar de client, zoals stack traces, interne exception-details of wachtwoordhashes.

### Mitigatiemaatregelen

#### 1. Stack traces verborgen in productie

**Bestand:** `Program.cs` (regels 53–63)

```csharp
if (app.Environment.IsDevelopment())
{
    // Gedetailleerde foutpagina's ALLEEN in Development
    app.UseDeveloperExceptionPage();
}
else
{
    // Generieke foutafhandeling in Production – GEEN stack traces of interne details
    app.UseExceptionHandler("/error");
    app.UseHsts();
}
```

In Development zijn gedetailleerde exception-pagina's beschikbaar voor debugging. In productie worden alle uitzonderingen afgevangen door de generieke `ExceptionHandler`, die alleen een `500 – An unexpected error occurred` teruggeeft. Interne details, bestandspaden of stack traces worden **nooit** naar de client gestuurd.

**Generiek foutendpoint** (onderaan `Program.cs`):

```csharp
app.Map("/error", () => Results.Problem("An unexpected error occurred.", statusCode: 500));
```

---

#### 2. Wachtwoordhashes verborgen via DTO's

**Bestand:** `DTOs/Dtos.cs` (regel 9)

```csharp
// User DTOs — WachtwoordHash is intentionally excluded to prevent Information Disclosure
public record UserDto(int Id, string Naam, string Email, string Rol);
```

Het `User`-model bevat een `WachtwoordHash` veld. De `UserDto` sluit dit veld bewust uit. **Op geen enkel API-endpoint wordt de hash teruggestuurd naar de client.**

Bewijs:
- `Controllers/AuthController.cs` (regels 44–45): response gebruikt `UserDto`, niet het volledige `User`-object.
- `Controllers/AdminController.cs` (regel 25): `users.Select(u => new UserDto(...))` filtert de hash weg.

---

#### 3. Geen gevoelige info in foutberichten

**Bestand:** `Controllers/AuthController.cs` (regels 51–52)

```csharp
if (user == null || !BCrypt.Net.BCrypt.Verify(dto.Wachtwoord, user.WachtwoordHash))
    return Unauthorized(new { message = "Ongeldig e-mailadres of wachtwoord." });
```

Een generiek foutbericht wordt teruggegeven bij mislukte login, zodat een aanvaller **niet** kan achterhalen of een e-mailadres bestaat (user enumeration attack).

---

#### 4. CORS beperkt tot vertrouwde origins

**Bestand:** `Program.cs` (regels 39–46)

```csharp
options.AddPolicy("FrontendPolicy", policy =>
{
    policy.WithOrigins("http://localhost:5173", "http://127.0.0.1:5173")
          .AllowAnyHeader()
          .AllowAnyMethod()
          .AllowCredentials();
});
```

Alleen de Vite development server heeft toegang tot de API. Wildcard-origins (`*`) zijn **niet** gebruikt.

---

## 🤖 AI Integratie (MCP – Model Context Protocol)

De `SuggestionsService` (`Services/SuggestionsService.cs`) implementeert het MCP-principe:

1. **Context ophalen** – Laadt het gebruikersprofiel en doelen uit de database.
2. **Context-enriched prompt samenstellen** – Voegt profieldata toe aan de gebruikersvraag.
3. **AI-model aanroepen** – Stuurt de verrijkte prompt naar de Gemini API.

Om AI-suggesties in te schakelen: voeg een Gemini API-sleutel toe in `appsettings.json` onder `Gemini:ApiKey`.

---

## 🛠️ Tech Stack

| Laag      | Technologie                                              |
|-----------|----------------------------------------------------------|
| Backend   | ASP.NET Core 10 Web API, EF Core 9, Pomelo MySQL         |
| Auth      | JWT Bearer, BCrypt.Net-Next                              |
| Database  | MySQL 8+                                                 |
| Frontend  | React 18, Vite, TypeScript, Tailwind CSS, react-router-dom, axios |
| AI        | Google Gemini API (MCP-patroon)                          |

# Testhandleiding Mealplanner

Dit document legt uit hoe de automatische tests van de Mealplanner gedraaid moeten worden en welke onderdelen door welke tests gecontroleerd worden.

## Testcommando's

### Frontend tests

```powershell
cd MealplannerApp/frontend
npm test
```

Frontend tests met duidelijke testnamen in de output:

```powershell
cd MealplannerApp/frontend
npm run test:verbose
```

### Backend tests

Alle backendtests, inclusief MySQL-integratietests:

```powershell
dotnet test Meal_planner.sln
```

Let op: deze command test ook de verbinding met de geconfigureerde MySQL database. Als de database uit staat of de configuratie niet klopt, horen de database-integratietests te falen.

Backendtests zonder live MySQL-integratie:

```powershell
dotnet test Meal_planner.sln --filter "FullyQualifiedName!~MySqlDatabaseIntegrationTests"
```

Gebruik deze command als je alleen de normale unit/controller-tests wilt draaien zonder afhankelijk te zijn van de databaseverbinding.

## Frontend tests

### `frontend/src/utils/nutrition.test.ts`

Deze tests controleren de voedings- en plannerlogica in `nutrition.ts`.

Ze testen:

- normaliseren van oude en nieuwe profielwaarden;
- herkennen van maaltijdmomenten zoals `Ontbijt 1`, `Diner 2` en `Snack 1`;
- verdelen van calorieen over eetmomenten;
- berekenen van calorie-, eiwit-, koolhydraat- en vetdoelen;
- dieetvoorkeuren en allergie-filtering;
- voedingswaardeberekening op basis van nutrition facts, porties en ingredienten;
- fallback-berekening wanneer ingredientdata onvolledig is;
- macropercentages;
- schalen van hoeveelheden zoals `1/2 cup` naar andere porties.

### `frontend/src/utils/setup.test.ts`

Deze tests controleren de setupcontrole in `setup.ts`.

Ze testen:

- wanneer een profiel en doel volledig genoeg zijn om de app te gebruiken;
- wanneer setup nog niet compleet is door ontbrekende of ongeldige waarden.

## Backend tests

De backendtests staan in `MealplannerApp/MealPlannerApi.Tests`.

### `AuthControllerTests.cs`

Controleert registratie en login.

Deze tests controleren:

- een nieuwe user kan registreren;
- het wachtwoord wordt gehasht opgeslagen;
- dubbele e-mailadressen worden geweigerd;
- login met verkeerd wachtwoord wordt geweigerd;
- login met correct wachtwoord geeft een JWT-response terug.

### `AuthorizationAttributeTests.cs`

Controleert of controllers en endpoints de juiste autorisatie-attributen hebben.

Deze tests controleren:

- persoonlijke controllers vereisen een ingelogde user;
- admincontrollers vereisen de rol `Admin`;
- maaltijd aanmaken/verwijderen vereist de rol `Admin`;
- register/login blijven openbaar.

### `JwtServiceTests.cs`

Controleert de inhoud van JWT-tokens.

Deze test controleert:

- token bevat user id, e-mail, naam en rol;
- token bevat de juiste issuer en audience.

### `ProfileAndGoalControllerTests.cs`

Controleert profiel- en doelgedrag.

Deze tests controleren:

- gekozen eetmomenten worden genormaliseerd naar vaste slots;
- ongeldige aantallen eetmomenten worden geweigerd;
- ongeldig geslacht, ongeldige lengte en onbekende activiteit worden geweigerd;
- doelen worden aangemaakt en later bijgewerkt voor dezelfde user.

### `PlannedMealsControllerTests.cs`

Controleert maaltijdplanning.

Deze tests controleren:

- plannen op dezelfde user/datum/slot vervangt de bestaande maaltijd;
- geplande maaltijden worden gekoppeld aan de juiste user;
- een user ziet alleen eigen geplande maaltijden.

### `FavoritesControllerTests.cs`

Controleert favorieten.

Deze tests controleren:

- favorieten kunnen worden toegevoegd;
- dubbele favorieten worden geweigerd;
- een ontbrekende maaltijd geeft `NotFound`;
- een user kan geen favoriet van een andere user verwijderen.

### `MealsControllerTests.cs`

Controleert het maaltijdenoverzicht en pagination.

Deze tests controleren:

- `pageSize` wordt begrensd;
- negatieve pagina's worden teruggezet naar pagina 1;
- zoeken op naam werkt;
- filteren op categorie werkt;
- `excludeMealId` haalt een maaltijd uit de resultaten;
- een te hoge pagina wordt teruggezet naar de laatste bestaande pagina.

### `AdminControllerTests.cs`

Controleert basisgedrag van adminfunctionaliteit.

Deze tests controleren:

- users worden teruggegeven als DTO zonder wachtwoordhash;
- voedingswaarden kunnen worden toegevoegd;
- voedingswaarden kunnen worden bijgewerkt zonder dubbele records te maken.

### `ConnectionStringResolverTests.cs`

Controleert het bouwen van database connection strings.

Deze tests gebruiken dummy configuratiewaarden en maken geen echte databaseverbinding.

Ze testen:

- `DefaultConnection` wordt gebruikt als er geen `DATABASE_*` variabelen zijn;
- incomplete `DATABASE_*` variabelen geven een duidelijke fout;
- complete `DATABASE_*` variabelen bouwen een MySQL connection string.

### `MySqlDatabaseIntegrationTests.cs`

Controleert de echte databaseverbinding.

Deze tests gebruiken de echte appconfiguratie en `.env`.

Ze testen:

- de geconfigureerde MySQL database is bereikbaar;
- de belangrijkste MealPlanner-tabellen kunnen worden gequeryd.

Deze tests zijn bewust afhankelijk van de database. Als MySQL uit staat, moeten deze tests falen.

## Welke tests wanneer draaien?

Gebruik meestal:

```powershell
dotnet test Meal_planner.sln
```

Daarmee controleer je backendlogica en databaseverbinding samen.

Gebruik deze command tijdens snel ontwikkelen als de database uit staat:

```powershell
dotnet test Meal_planner.sln --filter "FullyQualifiedName!~MySqlDatabaseIntegrationTests"
```

Gebruik voor frontendlogica:

```powershell
cd MealplannerApp/frontend
npm test
```

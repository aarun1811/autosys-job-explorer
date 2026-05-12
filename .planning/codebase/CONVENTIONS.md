# Coding Conventions

**Analysis Date:** 2026-05-12

---

## Module Overview

Three modules with distinct conventions:
- `backend/rectrace` — Spring Boot 2.7.16, Java 17
- `frontend/rectrace` — Angular 18 (package.json declares `^18.2.14`), TypeScript 5.5, SCSS
- `rectrace-tlm-stats` — Spring Boot 2.7.16, Java 17

---

## Backend (backend/rectrace)

### Package Naming

Root package: `com.citi.gru.rectrace`

Sub-packages follow purpose:
- `com.citi.gru.rectrace.controller` — REST controllers (v4 variant lives in `.controller.v4`)
- `com.citi.gru.rectrace.service` — business logic services (v3 variants in `.service.v3`, v4 in `.service.v4`)
- `com.citi.gru.rectrace.dto` — data transfer objects (v4 variants in `.dto.v4`)
- `com.citi.gru.rectrace.config` — Spring configuration classes
- `com.citi.gru.rectrace.constants` — application-wide constants
- `com.citi.gru.rectrace.util` — utility classes

### Naming Patterns

**Classes:**
- Controllers: `<Domain>Controller` (e.g., `SearchController`, `ExecutionOrderController`)
- Versioned controllers: `<Domain>ControllerV4` in sub-package `controller.v4`
- Services: `<Domain>Service` or `<Domain>ServiceV3` / `<Domain>ServiceV4`
- DTOs: `<Domain>DTO` (e.g., `ExecutionOrderDTO`, `UserInfoDTO`); v4 DTOs use descriptive names without `DTO` suffix (e.g., `SSRMRequestV4`, `CategoryResultV4`)
- Config classes: `<Domain>Config` (e.g., `AsyncConfig`, `CorsConfig`)
- Constants: `AppConstants` (utility class — private constructor, throws `UnsupportedOperationException`)

**Methods:**
- camelCase throughout
- Controller methods: descriptive verb phrases (`getExecutionOrder`, `performInitialSearch`, `fetchSSRMData`)
- Private helpers: prefixed intent (`createDefaultOracleConfig`, `filterDataByVisibleColumns`, `deduplicateData`)

**Variables:**
- camelCase
- Constants: `static final` UPPER_SNAKE_CASE (e.g., `CITI_PORTAL_LOGIN_ID_HEADER`)
- Logger: `private static final Logger logger = LoggerFactory.getLogger(ClassName.class)`

### Controller Pattern

**Standard structure:**
1. `@RestController` + `@RequestMapping("/api/<path>")`
2. Constructor injection for all dependencies (no `@Autowired` on fields in newer controllers; older controllers mix `@Autowired` on fields with constructor injection — v4 controllers use `@Autowired` on fields)
3. `HttpServletRequest` parameter to extract `x-citiportal-loginid` header for user context
4. Log user identity and request parameters at INFO level
5. Delegate immediately to service layer; no business logic in controllers

**User context header constant:**
```java
private static final String CITI_PORTAL_LOGIN_ID_HEADER = "x-citiportal-loginid";
String loginId = request.getHeader(CITI_PORTAL_LOGIN_ID_HEADER);
```

V4 controllers use `@RequestHeader` directly:
```java
@RequestHeader(value = "x-citiportal-loginid", required = false) String userId
```

### Error Response Format

All controllers (both `backend/rectrace` and `rectrace-tlm-stats`) produce a standardized error response via a private `createErrorResponse` helper:

```java
private Map<String, Object> createErrorResponse(String errorType, String message) {
    Map<String, Object> errorResponse = new HashMap<>();
    errorResponse.put("status", "error");
    errorResponse.put("error_type", errorType);  // e.g., "validation_error", "internal_error"
    errorResponse.put("message", message);
    errorResponse.put("timestamp", System.currentTimeMillis());
    return errorResponse;
}
```

Used in all controllers:
- `TlmStatsController` — `backend/rectrace/src/main/java/com/citi/gru/rectrace/controller/SearchController.java`
- `TlmStatsV2Controller` — `rectrace-tlm-stats/src/main/java/com/citi/gru/rectrace/tlmstats/controller/TlmStatsV2Controller.java`
- `QuickRecStatsController` — `rectrace-tlm-stats/src/main/java/com/citi/gru/rectrace/quickrec/controller/QuickRecStatsController.java`

**Success response shape (TLM/QuickRec services):**
```json
{ "status": "success", "data": [...], "count": N }
```

**V4 backend error response shape** (`SearchControllerV4`):
```json
{ "status": "error", "message": "...", "timestamp": 1234567890 }
```
Note: v4 controller (`backend/rectrace/src/main/java/com/citi/gru/rectrace/controller/v4/SearchControllerV4.java`) omits `error_type` — inconsistent with v1 TLM controllers.

### DTO Pattern

**Standard DTOs** (v3 and core): Plain Java objects with manual getters/setters, no Lombok.
- Jackson annotations used selectively: `@JsonInclude(Include.NON_NULL)` to suppress null fields; `@JsonProperty("snake_case_name")` for API field naming
- Nested static classes for sub-objects (e.g., `ExecutionOrderDTO.JobNodeDTO`, `ExecutionOrderDTO.JobDetailsDTO`)

**V4 DTOs**: Use Lombok (`@Data`, `@Builder`, `@NoArgsConstructor`, `@AllArgsConstructor`) for conciseness.
- Example: `backend/rectrace/src/main/java/com/citi/gru/rectrace/dto/v4/SSRMRequestV4.java`

### Service Pattern

- Annotated `@Service`
- Constructor injection with `@Autowired` on constructor (v3); field `@Autowired` (v4)
- Logger via SLF4J: `LoggerFactory.getLogger(ClassName.class)` (v3); Lombok `@Slf4j` shorthand as `log.xxx(...)` (v4)
- Async methods: `@Async("taskExecutor")` returning `CompletableFuture<T>`
- Config loaded `@PostConstruct` in config services

### Logging

**V3 pattern:**
```java
private static final Logger logger = LoggerFactory.getLogger(SearchServiceV3.class);
logger.info("V3 Keyword Search: Performing search across all categories for query: '{}'", query);
```

**V4 pattern (Lombok `@Slf4j`):**
```java
log.info("Initial search request - keyword: {}, user: {}", keyword, userId);
```

Log INFO on entry and exit of significant operations. Log WARN for missing/invalid config. Log ERROR with exception object (`e`) on catch.

---

## TLM Stats Service (rectrace-tlm-stats)

### Package Naming

Root: `com.citi.gru.rectrace`

Sub-packages:
- `com.citi.gru.rectrace.tlmstats.controller` — REST controllers
- `com.citi.gru.rectrace.tlmstats.service` — business logic
- `com.citi.gru.rectrace.tlmstats.model` — data models (v2 variants in `.model.v2`)
- `com.citi.gru.rectrace.tlmstats.config` — configuration
- `com.citi.gru.rectrace.tlmstats.util` — utilities
- `com.citi.gru.rectrace.quickrec.controller` — QuickRec-specific controllers
- `com.citi.gru.rectrace.quickrec.service` — QuickRec-specific services
- `com.citi.gru.rectrace.quickrec.model` — QuickRec data models

### Model Pattern

Plain Java POJOs with:
- Default constructor + all-args constructor
- `@JsonProperty("snake_case_name")` on all fields for JSON serialization
- Manual getters/setters
- `toString()` override
- Example: `rectrace-tlm-stats/src/main/java/com/citi/gru/rectrace/tlmstats/model/BreakStats.java`

### Controller Pattern

Identical error/success response shape as main backend (see "Error Response Format" above). All controllers annotated `@CrossOrigin(origins = "*")`.

---

## Frontend (frontend/rectrace)

### Angular Version

Angular 18 (package: `^18.2.14`), though CLAUDE.md references Angular 16. Use Angular 18 control-flow syntax (`@if`, `@for`) in new components.

### Component Structure

**Standard component:**
```typescript
@Component({
  selector: 'app-<kebab-case>',
  templateUrl: './<name>.component.html',  // or inline template
  styleUrls: ['./<name>.component.scss']
})
export class <PascalCase>Component implements OnInit, OnDestroy {
  // Properties grouped: core state → visual state → user state → private subjects
  private destroy$ = new Subject<void>();

  ngOnInit(): void { ... }
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
```

**Inline template components** (cell renderers): Use `template` and `styles` (array of strings) directly in `@Component` instead of external files. All v2 renderers follow this pattern.

### Cell Renderer Pattern

All cell renderers implement `ICellRendererAngularComp` from `ag-grid-angular`:

```typescript
export class <Name>RendererComponent implements ICellRendererAngularComp {
  params!: ICellRendererParams;
  // domain state: value, isLoading, flags

  constructor(private readonly dialog: MatDialog) { }  // inject what's needed

  agInit(params: ICellRendererParams): void {
    this.params = params;
    // extract value and flags from params.value / params.data
  }

  refresh(params: ICellRendererParams): boolean {
    this.params = params;
    // re-extract same values as agInit
    return true;
  }

  // action methods: showModal(), onClick(), etc.
}
```

**Location:** `frontend/rectrace/src/app/custom-interactions/components/renderers/`
**V2 renderers:** `frontend/rectrace/src/app/custom-interactions/components/renderers/v2/`

Current renderers:
- `execution-order-button.component.ts` — opens `ExecutionOrderModalComponent`
- `app-id-cell-renderer.component.ts` — simple app ID display
- `app-support-cell-renderer.component.ts` — support contact display
- `set-id-cell-renderer.component.ts` — legacy set ID
- `recon-cell-renderer.component.ts` — legacy recon
- `v2/set-id-v2-renderer.component.ts` — opens `TlmStatsModalV2Component`; QuickRec rows render plain text
- `v2/recon-v2-renderer.component.ts` — opens `TlmStatsModalV2Component`; QuickRec rows render plain text
- `v2/tlm-instance-v2-renderer.component.ts` — TLM instance display
- `recon-id-renderer/recon-id-renderer.component.ts` — opens `QuickRecStatsModalComponent` (QuickRec entry); uses external template/stylesheet (`.css`, not `.scss`)
- `rec-portal-id-renderer/rec-portal-id-renderer.component.ts` — portal ID display

### SCSS Migration Pattern

All components use `.scss` stylesheets (`.scss` extension via `styleUrls`). There are no remaining `.css` component files — the SCSS migration is complete except for one holdout:

- `recon-id-renderer.component.ts` still references `styleUrls: ['./recon-id-renderer.component.css']`

Global styles: `frontend/rectrace/src/styles.scss`

SCSS relies on CSS custom properties (`var(--bg-primary)`, `var(--google-blue)`, etc.) defined in `:root` in `styles.scss` for theming. Components reference these variables directly without Sass-specific variable syntax.

### CSS Variable / Theming Pattern

Theme toggling applies class `dark-theme` or `light-theme` to `document.documentElement`. All component styles use CSS variables:

```scss
color: var(--google-blue);
background: var(--bg-primary);
border: 1px solid var(--border-primary);
```

Theme tokens are centralized in `frontend/rectrace/src/styles.scss` under `:root` (light) and `.dark-theme` overrides.

### RxJS Service Pattern

Services are `providedIn: 'root'` singletons. HTTP calls return `Observable<T>`. State services use `BehaviorSubject`:

```typescript
// State service (ThemeService)
private currentTheme$ = new BehaviorSubject<Theme>(this.DEFAULT_THEME);
public getTheme(): Observable<Theme> { return this.currentTheme$.asObservable(); }

// HTTP service (UserService, ExecutionOrderService)
return this.http.get<T>(`${this.apiUrl}/...`).pipe(catchError(...));
```

**Component lifecycle management:**
```typescript
private destroy$ = new Subject<void>();
ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }
// Usage:
this.someObservable$.pipe(takeUntil(this.destroy$)).subscribe(...);
```

**Suggestion/debounce pattern** (in `SearchV5Component`):
```typescript
private searchInput$ = new Subject<string>();
this.suggestions$ = this.searchInput$.pipe(
  debounceTime(300),
  distinctUntilChanged(),
  switchMap(query => this.service.getSuggestions(query).pipe(catchError(() => of([]))))
);
```

### `x-citiportal-loginid` Header

All API calls requiring user context must include the `x-citiportal-loginid` header. Pattern used in `SearchServiceV5`:

```typescript
private getHeaders(): HttpHeaders {
  const userId = sessionStorage.getItem('userId') || 'user@citi.com';
  return new HttpHeaders({ 'x-citiportal-loginid': userId });
}
```

### Search Config Pattern

Backend drives column definitions and search behaviour through `search-config.json` (`backend/rectrace/src/main/resources/search-config.json`). The frontend receives `ColumnDefinition[]` from the API response and passes them directly to AG-Grid. Do not hardcode column definitions in the frontend.

### Module Declarations Pattern

Components shared across feature modules live in `CustomInteractionsModule` (`frontend/rectrace/src/app/custom-interactions/custom-interactions.module.ts`). The module uses a single `DECLARATIONS_EXPORTS` array spread into both `declarations` and `exports`.

Material imports are grouped into a `MATERIAL_MODULES` array.

### Naming Conventions

**Files:** `<kebab-case>.<type>.ts` — e.g., `search-v5.service.ts`, `set-id-v2-renderer.component.ts`

**Classes:** `PascalCase` — e.g., `SearchServiceV5`, `SetIdV2RendererComponent`

**Component selectors:** `app-<kebab-case>` prefix — e.g., `app-set-id-v2-renderer`, `app-execution-order-button`

**Interfaces:** `PascalCase` co-located in the service/component file that defines them, exported from that file

**Enums:** `PascalCase` with `UPPER_SNAKE` values — e.g., `DateRange.ONE_DAY`, `DateRange.SEVEN_DAYS`

**Private fields:** camelCase; reactive subjects suffixed `$` — e.g., `destroy$`, `searchInput$`

**Observable properties:** suffix `$` — e.g., `suggestions$`, `currentTheme$`

### Import Organization

1. Angular core (`@angular/core`, `@angular/common`, etc.)
2. Angular Material (`@angular/material/...`)
3. Third-party libraries (`ag-grid-angular`, `cytoscape`, `rxjs`)
4. Application services/models (`src/app/services/...`)
5. Relative imports (`./`, `../`)

### Error Handling

Frontend services use `catchError(() => of(null))` or `catchError(() => of([]))` to prevent observable failure propagation. Components handle errors by setting a local `errorMessage` string displayed in the template. No global error interceptor detected.

---

## Comments and Documentation

**Java:** Javadoc on public methods in service classes (multi-line `/** ... */`). Controller method documentation uses inline `/** ... */` blocks describing parameters and HTTP route. No strict `@param`/`@return` Javadoc style enforced — descriptive prose comments used instead.

**TypeScript:** Interfaces are self-documenting. JSDoc used sparsely on service methods:
```typescript
/**
 * Get all breaks table data
 */
getBreaksTableData(request: TlmStatsRequest): Observable<...>
```

**Inline comments:** Used for intent clarification on non-obvious logic (e.g., `// Disable clicking for QuickRec rows`).

---

*Convention analysis: 2026-05-12*

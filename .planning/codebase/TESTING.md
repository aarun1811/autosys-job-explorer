# Testing Patterns

> **⚠ Point-in-time audit (2026-05-12)** — pre-modernization (tests were skipped by default then). The skip gate was removed in Phase 0; backend suites run, and `frontend-react` has vitest. See **`.planning/codebase/CURRENT-STATE-2026-06-12.md`** and the repo **`CLAUDE.md`**.

**Analysis Date:** 2026-05-12

---

## Module Summary

| Module | Framework | Status |
|--------|-----------|--------|
| `backend/rectrace` | JUnit 5 via `spring-boot-starter-test` | Tests skipped globally (`maven.test.skip=true`) |
| `rectrace-tlm-stats` | JUnit 5 via `spring-boot-starter-test` | Tests skipped globally (`maven.test.skip=true`) |
| `frontend/rectrace` | Karma + Jasmine | 3 spec files exist; runnable but minimal coverage |

---

## Backend (backend/rectrace)

### Test Framework

**Runner:** JUnit 5 (via `spring-boot-starter-test` 2.7.16 — pulls in JUnit Jupiter, Mockito, AssertJ)
**Config file:** `backend/rectrace/pom.xml`
**Skip flag:** `<maven.test.skip>true</maven.test.skip>` in `<properties>` — all tests are skipped on every build

### Current State

No test source files exist under `backend/rectrace/src/test/`. The test directory is absent entirely. The `spring-boot-starter-test` dependency is declared in `pom.xml` (scope `test`) but the test source tree has not been populated.

### Run Commands

```bash
cd backend/rectrace

# Run tests (currently skipped — override the property):
mvn test -Dmaven.test.skip=false

# Run tests explicitly:
mvn test

# Skip tests (default behavior):
mvn clean install
# or:
mvn clean install -DskipTests
```

To re-enable tests project-wide, remove or set to `false`:
```xml
<!-- backend/rectrace/pom.xml -->
<maven.test.skip>false</maven.test.skip>
```

### Expected Test Structure (not yet implemented)

When tests are added, follow Spring Boot conventions:
```
backend/rectrace/src/test/java/com/citi/gru/rectrace/
├── controller/
│   ├── SearchControllerTest.java
│   └── ExecutionOrderControllerTest.java
├── service/
│   ├── v3/
│   │   └── SearchServiceV3Test.java
│   └── ExecutionOrderServiceTest.java
└── RectraceApplicationTests.java
```

**Recommended patterns when writing tests:**

```java
@SpringBootTest
class RectraceApplicationTests {
    @Test
    void contextLoads() {}
}

// Controller slice test
@WebMvcTest(SearchController.class)
class SearchControllerTest {
    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private SearchServiceV3 searchServiceV3;

    @Test
    void keywordSearch_returnsResults() throws Exception {
        // arrange
        when(searchServiceV3.performKeywordSearch("test", "jobs"))
            .thenReturn(Map.of("jobs", new SearchCategoryResult()));

        // act + assert
        mockMvc.perform(get("/api/v3/search/keyword")
                .param("q", "test")
                .param("category", "jobs")
                .header("x-citiportal-loginid", "user123"))
            .andExpect(status().isOk());
    }
}
```

---

## TLM Stats Service (rectrace-tlm-stats)

### Test Framework

**Runner:** JUnit 5 via `spring-boot-starter-test` 2.7.16
**Config file:** `rectrace-tlm-stats/pom.xml`
**Skip flag:** `<maven.test.skip>true</maven.test.skip>` in `<properties>` — identical to main backend

### Current State

One test file exists:
- `rectrace-tlm-stats/src/test/java/com/citi/gru/rectrace/tlmstats/TlmStatsApplicationTests.java`

Contents:
```java
@SpringBootTest
class TlmStatsApplicationTests {
    @Test
    void contextLoads() {
    }
}
```

This is the auto-generated Spring Boot context load test. No business logic is tested.

### Run Commands

```bash
cd rectrace-tlm-stats

# Run tests (currently skipped — override):
mvn test -Dmaven.test.skip=false

# Default (tests skipped):
mvn clean install
```

### Expected Test Structure (not yet implemented)

```
rectrace-tlm-stats/src/test/java/com/citi/gru/rectrace/tlmstats/
├── TlmStatsApplicationTests.java   (exists — context load only)
├── controller/
│   ├── TlmStatsControllerTest.java
│   └── TlmStatsV2ControllerTest.java
└── service/
    ├── TlmStatsServiceTest.java
    └── TlmStatsV2ServiceTest.java
```

---

## Frontend (frontend/rectrace)

### Test Framework

**Runner:** Karma 6.4
**Test Framework:** Jasmine 5.1
**Assertion Library:** Jasmine built-in matchers
**Angular integration:** `@angular/core/testing` (`TestBed`, `ComponentFixture`)
**Builder:** `@angular-devkit/build-angular:karma` (configured in `angular.json`)
**Config:** No `karma.conf.js` file — configuration is embedded in `angular.json`

### Run Commands

```bash
cd frontend/rectrace

npm test                # Run all tests (watch mode, opens Chrome)
```

Note: There is no separate coverage command configured in `package.json`. Coverage can be enabled via:
```bash
npx ng test --code-coverage
```

### Test File Locations

3 spec files exist (all auto-generated stubs with minimal coverage):
- `frontend/rectrace/src/app/app.component.spec.ts`
- `frontend/rectrace/src/app/services/search.service.spec.ts`
- `frontend/rectrace/src/app/custom-interactions/components/modals/execution-order-graph/execution-order-graph.component.spec.ts`

**Naming convention:** `<name>.spec.ts` co-located with the source file.

### Test Structure

**Component test pattern:**
```typescript
import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({
    declarations: [AppComponent]
  }));

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });
});
```

**Service test pattern:**
```typescript
import { TestBed } from '@angular/core/testing';
import { SearchService } from './search.service';

describe('SearchService', () => {
  let service: SearchService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SearchService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
```

**Component with fixture pattern:**
```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ExecutionOrderGraphComponent } from './execution-order-graph.component';

describe('ExecutionOrderGraphComponent', () => {
  let component: ExecutionOrderGraphComponent;
  let fixture: ComponentFixture<ExecutionOrderGraphComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [ExecutionOrderGraphComponent]
    });
    fixture = TestBed.createComponent(ExecutionOrderGraphComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
```

### Mocking

No mocking patterns are established in existing spec files — all existing tests are creation-only stubs. When adding real tests, follow Angular TestBed mocking conventions:

```typescript
// HTTP mock
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

TestBed.configureTestingModule({
  imports: [HttpClientTestingModule],
  providers: [SearchServiceV5]
});
const httpMock = TestBed.inject(HttpTestingController);

// Service spy mock
const serviceSpy = jasmine.createSpyObj('ExecutionOrderService', ['getExecutionOrder']);
TestBed.configureTestingModule({
  providers: [{ provide: ExecutionOrderService, useValue: serviceSpy }]
});
```

### Coverage

**Requirements:** None enforced (no coverage threshold in `angular.json`).

**Current coverage:** Effectively zero — existing tests only assert component creation.

### Test Types

**Unit tests:** No substantive unit tests exist for services or component logic.

**Integration tests:** Not present.

**E2E tests:** No e2e framework configured (no Cypress or Playwright in `package.json` or project directories).

---

## Coverage Gaps Summary

All three modules have significant test coverage gaps:

**backend/rectrace:**
- No tests written
- Zero coverage of `SearchServiceV3`, `SearchConfigServiceV3`, `ExecutionOrderService`, `OracleSearchProviderV3`, `ElasticsearchSearchProviderV3`
- Controller request/response contracts untested
- All tests disabled via `maven.test.skip=true` in `backend/rectrace/pom.xml`

**rectrace-tlm-stats:**
- Only `contextLoads()` test exists at `rectrace-tlm-stats/src/test/java/com/citi/gru/rectrace/tlmstats/TlmStatsApplicationTests.java`
- Error response format (`status`/`error_type`/`message`) untested
- `createErrorResponse` helper untested
- All tests disabled via `maven.test.skip=true` in `rectrace-tlm-stats/pom.xml`

**frontend/rectrace:**
- 3 spec files — all are auto-generated creation stubs
- `SearchServiceV5`, `TlmStatsV2Service`, `ExecutionOrderService`, `ThemeService`, `UserService` have no behavioural tests
- Cell renderers (`SetIdV2RendererComponent`, `ReconV2RendererComponent`, `ExecutionOrderButtonComponent`) untested
- No modal component tests (`TlmStatsModalV2Component`, `ExecutionOrderModalComponent`, `QuickRecStatsModalComponent`)
- Observable chains (debounce, switchMap, takeUntil) untested

---

*Testing analysis: 2026-05-12*

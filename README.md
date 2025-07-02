# Autosys Job Explorer (R-Trace)

## Overview
This is a web application designed to explore and visualize Autosys jobs. The application provides functionality to search jobs across various attributes using different backend search providers (primarily Elasticsearch, with Oracle for specific legacy features) and understand job execution dependencies through a modern web interface.

**Key Architectural Aspects:**
* **Search (V2 - Primary):** The main search functionality (`/api/v2/search`) is heavily optimized for Elasticsearch, utilizing `SearchServiceV2` and `ElasticsearchSearchProviderV2`. This version supports initial paginated/collapsed searches for essential fields and detailed "scroll" searches for all requested fields for a specific category.
* **Search (Legacy V1):** An older search endpoint (`/api/search`) exists, using `EnhancedSearchService` and a provider pattern (`SearchProvider` interface with `ElasticsearchSearchProvider` and `OracleSearchProvider` implementations). This allows search categories to be directed to either Elasticsearch or Oracle.
* **Configuration-Driven Search:** Both search versions rely on a central configuration file (`search-config.json`) to define search categories, their backend provider type, specific query configurations (Elasticsearch query details or Oracle SQL), and frontend grid column definitions.
* **Suggestions:** A type-ahead suggestion feature (`/api/search/suggest`) is available, powered by Elasticsearch.
* **Execution Order:** Job execution order visualization remains powered by Oracle.

## Project Structure
```
autosys-job-explorer/
├── backend/
│   └── autosys-job-explorer/
│       ├── .mvn/
│       ├── src/
│       │   └── main/
│       │       ├── java/
│       │       │   └── com/
│       │       │       └── citi/
│       │       │           └── gru/
│       │       │               └── autosysjobexplorer/
│       │       │                   ├── config/         # Spring Boot Config (Async, CORS, DataSource, ES Dev SSL Bypass)
│       │       │                   ├── constants/      # Application constants
│       │       │                   ├── controller/     # API endpoints (SearchController, ExecutionOrderController, FrontendController)
│       │       │                   ├── dto/            # Data Transfer Objects (Search Configs, Results, Execution Order, UserInfo)
│       │       │                   ├── service/        # Business logic
│       │       │                   │   ├── v2/           # Services for V2 Search (ElasticsearchSearchProviderV2, SearchServiceV2)
│       │       │                   │   ├── ElasticsearchSearchProvider.java # V1 ES Provider
│       │       │                   │   ├── EnhancedSearchService.java     # V1 Search Orchestrator
│       │       │                   │   ├── ExecutionOrderService.java
│       │       │                   │   ├── OracleSearchProvider.java      # V1 Oracle Provider
│       │       │                   │   ├── SearchConfigService.java
│       │       │                   │   ├── SearchProvider.java          # V1 Provider Interface
│       │       │                   │   └── SuggestionService.java
│       │       │                   ├── util/           # Utility classes (ScriptExecutor)
│       │       │                   └── AutosysJobExplorerApplication.java
│       │       └── resources/
│       │           ├── static/             # For frontend build
│       │           ├── application.properties
│       │           └── search-config.json
│       ├── pom.xml                     # Maven project file
│       └── ... (other Maven files)
└── frontend/
    └── autosys-job-explorer/           # Angular Frontend
        ├── src/
        │   └── app/
        │       ├── all-jobs/           # AG-Grid component and related renderers/modals
        │       │   └── execution-order-modal/ # Cytoscape graph modal for execution order
        │       ├── models/             # Frontend data models (job.model.ts)
        │       ├── search/             # Main search component (search.component.ts)
        │       ├── services/           # Angular services (SearchService, ExecutionOrderService, UserService)
        │       ├── types/              # TypeScript type definitions (cytoscape-dagre.d.ts)
        │       ├── app-routing.module.ts
        │       ├── app.component.ts
        │       └── app.module.ts
        ├── environments/               # Environment-specific configurations
        ├── assets/                     # Static assets like images
        ├── angular.json                # Angular project configuration
        ├── package.json                # NPM dependencies
        └── ... (other Angular files)
```
## Technical Stack

### Frontend
-   **Framework**: Angular `~16.2.0`
-   **UI Components**:
    -   Angular Material `~16.2.14`
    -   AG-Grid Enterprise `~32.2.2`
    -   Cytoscape.js `~3.31.1` (for execution order graph)
-   **Language**: TypeScript
-   **Key Files**: `frontend/autosys-job-explorer/package.json`, `frontend/autosys-job-explorer/angular.json`

### Backend
-   **Framework**: Spring Boot `2.7.16`
-   **Language**: Java `1.8`
-   **Database**:
    -   **Oracle:** Used for the Execution Order feature (`ExecutionOrderService.java`) and as a source for data to be indexed into Elasticsearch. Connection properties in `application.properties` (`spring.datasource.*`).
    -   **Elasticsearch:** Primary backend for all search and suggestion functionality. The application uses `RestHighLevelClient` for interaction. Connection properties in `application.properties` (`spring.elasticsearch.uris`).
-   **Search Implementation**:
    -   **V2 Search (Primary)**:
        -   `SearchServiceV2.java`: Orchestrates V2 searches.
        -   `ElasticsearchSearchProviderV2.java`: Implements Elasticsearch search logic using `RestHighLevelClient`, including paginated/collapsed search and scroll API for detailed results.
    -   **V1 Search (Legacy Provider Pattern)**:
        -   `SearchProvider.java` (Interface)
        -   `EnhancedSearchService.java`: Orchestrates V1 searches.
        -   `OracleSearchProvider.java`, `ElasticsearchSearchProvider.java` (Uses `RestHighLevelClient`).
    -   **Configuration-Driven:** `search-config.json` defines categories, provider type, provider-specific query details, and display columns, loaded by `SearchConfigService.java`.
    -   **Suggestions:** `SuggestionService.java` provides type-ahead suggestions using Elasticsearch.
    -   **Denormalized Index:** Assumes data is denormalized into a single Elasticsearch index (default: `autosys_jobs_index` as per `SuggestionService.java` and `search-config.json`).
-   **Build Tool**: Maven
-   **Key Files**: `backend/autosys-job-explorer/pom.xml`, `backend/autosys-job-explorer/src/main/resources/application.properties`, `backend/autosys-job-explorer/src/main/resources/search-config.json`

## Prerequisites

-   Java Development Kit (JDK 1.8 or later, as per `pom.xml`)
-   Apache Maven
-   Node.js and npm (check `frontend/autosys-job-explorer/package.json` for specific Angular/CLI versions)
-   Angular CLI (`npm install -g @angular/cli@~16.2.14` or as per `package.json`)
-   **Elasticsearch Instance:** Accessible from the backend. Spring Boot 2.7.x with `RestHighLevelClient` typically aligns with Elasticsearch 7.x. Ensure compatibility between the client used and your ES server version.
-   **Oracle Database:** Accessible from the backend.

## Setup and Installation

### 1. Elasticsearch Setup
   - Ensure your Elasticsearch instance is running and accessible.
   - **Apply Index Template:** An index template defines the required mappings (field types, multi-fields like `.keyword`, suggesters like `recon_suggest`, `job_name_suggest` etc. used in `SuggestionService.java`). Apply the template **before** loading any data. The template should define fields found in `search-config.json` (e.g., `recon`, `load_job`, `file_name`, `box_name`, `set_id`, `sub_acc`, `machine`, `run_calendar`, `exclude_calendar`).
     Save the template JSON (e.g., `autosys_jobs_template.json`) and use cURL or Kibana Dev Tools:
     ```bash
     # Example using cURL (replace placeholders)
     curl -k -u your_es_username:your_es_password \
          -X PUT "https://<your_es_host>:9200/_index_template/autosys_jobs_template" \
          -H 'Content-Type: application/json' \
          -d @autosys_jobs_template.json
     ```
     *(Remove `-k` if using a trusted certificate. The default index name used is `autosys_jobs_index`)*

### 2. Data Loading (Oracle to Elasticsearch)
   - The `autosys_jobs_index` in Elasticsearch needs to be populated with denormalized data from your Oracle database.
   - **Initial Load:** Use a suitable data loading tool or script.
     - Configure its Oracle and Elasticsearch connection details.
     - **Crucially:** Ensure the SQL query within the loader correctly joins Oracle tables and selects all fields defined in the ES index template mapping. This includes handling CLOBs for fields like `command` and `description` if they exist in the source and are needed in ES.
     - Run the loader to populate Elasticsearch.
   - **Ongoing Sync:** A robust solution (e.g., Spring Batch, Apache NiFi, CDC tools) is needed for production environments to keep ES synchronized with Oracle changes (this is currently outside the scope of the main application).

### 3. Backend Setup (`autosys-job-explorer`)
   - **Configuration:** Edit `backend/autosys-job-explorer/src/main/resources/application.properties`:
     - Configure `spring.datasource.*` properties for Oracle connection (used by `ExecutionOrderService` and potentially `OracleSearchProvider`). The `DataSourceConfig.java` uses a script `get_password.sh` to fetch DB passwords.
     - Configure `spring.elasticsearch.uris` for Elasticsearch connection (e.g., `https://localhost:9200`). Also, provide `spring.elasticsearch.username` and `spring.elasticsearch.password` if security is enabled.
     - **For Development (HTTPS with self-signed cert):** The `ElasticsearchDevConfiguration.java` allows bypassing SSL validation. This is typically activated via a Spring profile (e.g., `dev`). Activate it by setting `spring.profiles.active=dev` in `application.properties` or as a JVM argument. **Do not use this configuration in production.**
   - **Build:** Navigate to `backend/autosys-job-explorer` and run:
     ```bash
     mvn clean install
     ```
   - **Run:** Execute the generated JAR file:
     ```bash
     java -jar target/autosys-job-explorer-0.0.1-SNAPSHOT.jar # Add -Dspring.profiles.active=dev if needed
     ```
     The application runs on port `6088` by default.

### 4. Frontend Setup (`autosys-job-explorer`)
   - Navigate to `frontend/autosys-job-explorer`.
   - Install dependencies:
     ```bash
     npm install
     ```
   - Start the development server:
     ```bash
     ng serve --open
     ```
     (This uses `environment.ts` which typically points to `http://localhost:6088/api`)
   - Access the application, typically at `http://localhost:4200`.

## Configuration (`search-config.json`)

Located in `backend/src/main/resources/search-config.json`, this crucial JSON file defines the available search categories using a polymorphic structure, loaded by `SearchConfigService.java`.

-   **`searchCategories`**: An array where each object (conforming to `SearchCategoryDefinition.java`) defines a search category.
    -   **`key`** (String): Unique internal identifier (e.g., "jobName", "reconName").
    -   **`label`** (String): User-friendly name for the frontend tab (e.g., "Job Name", "Recon Name").
    -   **`columns`** (Array): Defines the AG-Grid columns. Each object (conforming to `SearchColumnDefinition.java`) includes properties like `field`, `headerName`, `sortable`, `filter`, `cellRenderer`, `cellRendererParams`, `hide`, `rowGroup`, etc. The `field` must match a key in the data returned by the provider (i.e., a field in the ES document or a column from Oracle).
    -   **`searchProviderType`** (String): **Mandatory**. Determines which backend provider to use for this category (e.g., `"elasticsearch"` or `"oracle"`).
    -   **`providerConfig`** (Object): **Mandatory**. Contains configuration specific to the `searchProviderType` (conforming to `ProviderSpecificConfig.java` and its subclasses).

**Example `providerConfig` for `"searchProviderType": "elasticsearch"` (conforming to `ElasticsearchProviderConfig.java`):**
```json
  "providerConfig": {
      "targetIndex": "autosys_jobs_index",
      "queryFields": [ "job_name", "job_name.keyword" ],
      "resultFields": [ "job_name", "box_name", "recon", "load_job", "machine" ],
      "relevanceBoost": { "job_name.keyword": 2.0 },
      "defaultSort": { "field": "job_name.keyword", "direction": "asc" },
      "collapseOnPrecomputedField": "some_unique_field_for_collapsing"
  }
```

**Example `providerConfig` for `"searchProviderType": "oracle"` (conforming to `OracleProviderConfig.java`):**
```json
  "providerConfig": {
      "query": "SELECT job_name, machine, box_name FROM AUTOSYS_ALL_JOBS_DATA WHERE job_name LIKE :searchTerm",
      "parameterName": "searchTerm"
  }
```

**Adding/Modifying Searches:** Edit `search-config.json`. Ensure DTOs in `com.citi.gru.rectrace.dto` are aligned if you change the structure significantly. For Elasticsearch, ensure new fields are mapped in your ES index template and data is loaded/re-indexed. Restart the backend application to pick up changes.

## Components

### Frontend Components (`frontend/autosys-job-explorer/src/app/`)
-   **`SearchComponent`** (`search/search.component.ts`):
    -   Main UI for search input and displaying results in tabs.
    -   Fetches initial search results via `SearchService.searchV2Initial()` (calling `/api/v2/search`).
    -   Fetches detailed data for a category (e.g., when columns are toggled) via `SearchService.fetchDetailedCategoryData()` (calling `/api/v2/search` with category and fields).
    -   Handles suggestions via `SearchService.getCombinedSuggestions()`.
    -   Manages column visibility state and triggers batched data fetches.
    -   Displays user initials if identified via `UserService`.
-   **`AllJobsComponent`** (`all-jobs/all-jobs.component.ts`):
    -   Displays data in AG-Grid for a selected tab/category.
    -   Receives `rowData` and `columnDefs` as inputs.
    -   Handles grid interactions like column visibility changes (emitting events to `SearchComponent`), deduplication, and export.
    -   Includes custom cell renderers like `ExecutionOrderButtonComponent`, `AppIDCellRendererComponent`, `AppSupportCellRendererComponent`.
-   **`ExecutionOrderModalComponent`** (`all-jobs/execution-order-modal/execution-order-modal.component.ts`):
    -   Modal dialog to display job execution order.
    -   Contains `ExecutionOrderGraphComponent`.
-   **`ExecutionOrderGraphComponent`** (`all-jobs/execution-order-modal/execution-order-graph/execution-order-graph.component.ts`):
    -   Uses Cytoscape.js to render the job execution sequence graph.
    -   Data fetched by `ExecutionOrderService` (Angular service) which calls the backend `/api/execution-order`.
-   **Services (`services/`)**:
    -   `SearchService.ts`: Interacts with backend search APIs (`/api/search`, `/api/v2/search`, `/api/search/suggest`).
    -   `ExecutionOrderService.ts`: Fetches execution order data.
    -   `UserService.ts`: Fetches user information.

### Backend Components (`backend/autosys-job-explorer/src/main/java/com/citi/gru/autosysjobexplorer/`)
1.  **Controllers (`controller/`)**
    -   `SearchController.java`:
        -   `GET /api/search?q={query}`: Delegates to `EnhancedSearchService` (V1 search).
        -   `GET /api/search/suggest?prefix={prefix}`: Delegates to `SuggestionService`.
        -   `GET /api/v2/search?q={query}&category={category}&requestedFields={fields}`: Delegates to `SearchServiceV2` for initial and detailed V2 searches.
    -   `ExecutionOrderController.java`: `GET /api/execution-order/{loadJobName}`. Delegates to `ExecutionOrderService` (uses Oracle).
    -   `FrontendController.java`: Serves the Angular frontend's `index.html` for path-based routing.
    -   A `UserController` is not present in the uploaded files but is implied by frontend `UserService.ts` making a call to `/api/user/info`. The `SearchController` logs the `x-citiportal-loginid` header, which might be related.
2.  **Services (`service/`)**
    -   **`SearchConfigService.java`**: Loads, validates, and provides `SearchCategoryDefinition` objects from `search-config.json`, parsing the polymorphic `providerConfig`.
    -   **`service/v2/SearchServiceV2.java`**: Orchestrates V2 searches. Delegates to `ElasticsearchSearchProviderV2`. Handles initial collapsed search and detailed full-field search.
    -   **`service/v2/ElasticsearchSearchProviderV2.java`**: Implements advanced Elasticsearch search logic for V2, including collapsing and scroll API, using `RestHighLevelClient`.
    -   **`EnhancedSearchService.java`**: (V1) Orchestrates searches based on `searchProviderType` from `SearchConfigService`, delegates to the appropriate `SearchProvider` bean. Runs searches asynchronously per category.
    -   **`SearchProvider.java`** (Interface): (V1) Defines the contract for search implementations.
    -   **`OracleSearchProvider.java`**: (V1) Implements `SearchProvider` for Oracle. Uses `EntityManager`.
    -   **`ElasticsearchSearchProvider.java`**: (V1) Implements `SearchProvider` for Elasticsearch. Uses `RestHighLevelClient`.
    -   **`ExecutionOrderService.java`**: Handles job dependency analysis from Oracle using `EntityManager`.
    -   **`SuggestionService.java`**: Provides search suggestions from Elasticsearch using `RestHighLevelClient`.
3.  **DTOs (`dto/`)**
    -   **`SearchCategoryDefinition.java`**: Holds the *full* configuration loaded from JSON for a category, including the polymorphic `providerConfig`.
    -   **`ProviderSpecificConfig.java`** (Abstract), **`OracleProviderConfig.java`**, **`ElasticsearchProviderConfig.java`**: Define the structure for provider-specific configurations.
    -   **`SearchCategoryConfig.java`**: *Subset* DTO (`key`, `label`, `columns`) included in the API response for frontend grid configuration.
    -   **`SearchCategoryResult.java`**: Response DTO containing `data` (List of Maps) and `SearchCategoryConfig`.
    -   `ExecutionOrderDTO.java`, `UserInfoDTO.java`, `SearchColumnDefinition.java`, `SearchConfiguration.java`.

## API Endpoints

1.  **V2 Search API (Primary Search)**
    ```
    GET /api/v2/search
    ```
    -   **Initial Search**: `?q={query}`
        -   Performs an initial, collapsed search across all Elasticsearch categories.
        -   Returns `Map<String, SearchCategoryResult>`. Keys are category keys. Values contain essential fields and grid config.
    -   **Detailed Category Search**: `?q={query}&category={categoryKey}&requestedFields={csvListOfFields}`
        -   Fetches all rows and specified columns for a single Elasticsearch category using scroll.
        -   Returns `Map<String, SearchCategoryResult>` (typically with one entry for the requested category).
    -   Implemented by `SearchController` -> `SearchServiceV2` -> `ElasticsearchSearchProviderV2`.

2.  **Search Suggestions API**
    ```
    GET /api/search/suggest?prefix={prefix}
    ```
    -   Returns a list of string suggestions based on the input prefix.
    -   Implemented by `SearchController` -> `SuggestionService`.

3.  **Execution Order API**
    ```
    GET /api/execution-order/{loadJobName}
    ```
    -   Returns execution order data for the given load job, sourced from Oracle.
    -   Implemented by `ExecutionOrderController` -> `ExecutionOrderService`.

4.  **User Info API**
    ```
    GET /api/user/info 
    ```
    -   Returns user information (e.g., login ID).
    -   (Controller not explicitly shown but implied by frontend `UserService.ts` and `SearchController` logging `x-citiportal-loginid` header)

5.  **V1 Search API (Legacy)**
    ```
    GET /api/search?q={query}
    ```
    -   Performs searches based on `search-config.json`, delegating to the specified `searchProviderType` (ES or Oracle).
    -   Returns `Map<String, SearchCategoryResult>`.
    -   Implemented by `SearchController` -> `EnhancedSearchService`.


## Features
-   **Optimized Elasticsearch Search (V2):** Fast and efficient searching with initial summarized views and on-demand detailed data loading.
-   **Flexible Configuration:** Easily add/modify search types and display columns via `search-config.json`.
-   **Type-Ahead Suggestions:** Elasticsearch-powered search suggestions.
-   **Execution Order Visualization:** Interactive graph showing job dependencies, sourced from Oracle.
-   **Dynamic Column Loading:** For V2 searches, additional columns can be loaded on demand without re-fetching all data initially.
-   **Modern UI:** Responsive interface using Angular Material and AG-Grid, including features like column toggling, data export, and deduplication on the frontend.
-   **User Identification:** Displays user initials based on login ID obtained from the backend.

## Purpose and Benefits
-   Provides a modern, fast, and flexible interface for exploring Autosys jobs.
-   Simplifies job dependency visualization.
-   Leverages Elasticsearch for powerful and performant searching and suggestions.
-   Improves maintainability through configuration-driven searches.
-   Enhances troubleshooting and operational efficiency by providing quick access to job details and relationships.

## Note
This documentation provides a comprehensive overview based on the provided codebase. For detailed implementation specifics, refer to individual component files and the `search-config.json` file structure. Remember to manage Elasticsearch data loading and synchronization appropriately for your environment. The Elasticsearch client version (via Spring Data Elasticsearch in `pom.xml`) should be compatible with your Elasticsearch server instance.

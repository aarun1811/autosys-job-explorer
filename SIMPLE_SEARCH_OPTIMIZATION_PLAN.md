# Simple Search Optimization Plan

## 🎯 **Focused Scope**

**Core Objective**: Separate Elasticsearch (keyword search) from Oracle (group expansion) with clean, simple implementation.

**What We're NOT Doing**:
- Complex state management
- Pagination
- Advanced caching
- Complex error handling
- Performance optimizations (beyond basic separation)

---

## 🔧 **Backend Implementation**

### **Phase 1: Create New SearchConfigService**

#### **1.1 Simplify ElasticSearch Configuration**
**File**: `backend/rectrace/src/main/java/com/citi/gru/rectrace/service/SearchConfigServiceV3.java` (NEW)

**Objective**: Handle ES config to fetch only first column for keyword search

```java
@Service
public class SearchConfigServiceV3 {
    
    /**
     * Get ES configuration for keyword search only
     * Returns only essential fields needed for initial search
     */
    public ElasticsearchProviderConfig getKeywordSearchConfig(String categoryKey) {
        // Load from existing search-config.json
        // Return only: targetIndex, queryFields, first column from resultFields
    }
    
    /**
     * Get Oracle configuration for group expansion
     */
    public OracleProviderConfig getGroupExpansionConfig(String categoryKey) {
        // Load from existing search-config.json
        // Return Oracle config for detailed data fetching
    }
}
```

#### **1.2 Extend for Oracle Provider**
**Objective**: Add Oracle provider support to existing configuration

**Changes to existing `search-config.json`**:
```json
{
  "searchCategories": [
    {
      "key": "reconName",
      "label": "Recon Name",
      "columns": [...],
      "searchProviderType": "elasticsearch",
      "providerConfig": {
        // Existing ES config for keyword search
      },
      "oracleConfig": {
        // NEW: Oracle config for group expansion
        "query": "SELECT * FROM autosys_jobs WHERE recon = :groupKey",
        "parameterName": "groupKey"
      }
    }
  ]
}
```

### **Phase 2: Create V3 Search Providers**

#### **2.1 ElasticSearch Provider V3 (Keyword Search Only)**
**File**: `backend/rectrace/src/main/java/com/citi/gru/rectrace/service/v3/ElasticsearchSearchProviderV3.java` (NEW)

```java
@Service
public class ElasticsearchSearchProviderV3 {
    
    /**
     * Perform keyword search only - returns collapsed groups
     */
    public SearchCategoryResult performKeywordSearch(String categoryKey, String searchTerm) {
        // Use existing ES logic but simplified
        // Return only first column data for collapsed view
        // No group expansion, no detailed data
    }
}
```

#### **2.2 Oracle Provider V3 (Group Expansion Only)**
**File**: `backend/rectrace/src/main/java/com/citi/gru/rectrace/service/v3/OracleSearchProviderV3.java` (NEW)

```java
@Service
public class OracleSearchProviderV3 {
    
    /**
     * Fetch detailed data for a specific group
     */
    public SearchCategoryResult expandGroup(String categoryKey, String groupKey, String searchTerm) {
        // Use JDBC to fetch group details from Oracle
        // Return all rows for the specified group
    }
}
```

### **Phase 3: Update SearchController**

#### **3.1 Add New Endpoints**
**File**: `backend/rectrace/src/main/java/com/citi/gru/rectrace/controller/SearchController.java` (MODIFY)

```java
@RestController
public class SearchController {
    
    // EXISTING: Keep current endpoints for backward compatibility
    
    // NEW: Keyword search endpoint (ES only)
    @GetMapping("/v3/search/keyword")
    public Map<String, SearchCategoryResult> keywordSearch(
            @RequestParam(name = "q") String query,
            @RequestParam(name = "category", required = false) String category) {
        // Route to ElasticsearchSearchProviderV3
    }
    
    // NEW: Group expansion endpoint (Oracle only)
    @GetMapping("/v3/search/expand")
    public Map<String, SearchCategoryResult> expandGroup(
            @RequestParam(name = "q") String query,
            @RequestParam(name = "category") String category,
            @RequestParam(name = "groupKey") String groupKey) {
        // Route to OracleSearchProviderV3
    }
}
```

---

## 🎯 **Frontend Implementation**

### **Phase 1: Update Service Layer**

#### **1.1 Add New Methods to SearchService**
**File**: `frontend/rectrace/src/app/services/search.service.ts` (MODIFY)

```typescript
export class SearchService {
    
    // EXISTING: Keep current methods for backward compatibility
    
    // NEW: Keyword search using V3 endpoint
    searchV3Keyword(query: string, category?: string): Observable<SearchResponse> {
        let params = new HttpParams().set('q', query);
        if (category) {
            params = params.set('category', category);
        }
        return this.http.get<SearchResponse>(`${this.apiUrl}/v3/search/keyword`, { params });
    }
    
    // NEW: Group expansion using V3 endpoint
    expandGroupV3(query: string, category: string, groupKey: string): Observable<SearchResponse> {
        const params = new HttpParams()
            .set('q', query)
            .set('category', category)
            .set('groupKey', groupKey);
        return this.http.get<SearchResponse>(`${this.apiUrl}/v3/search/expand`, { params });
    }
}
```

### **Phase 2: Update Search Component**

#### **2.1 Modify Search Component**
**File**: `frontend/rectrace/src/app/search-feature/components/search/search.component.ts` (MODIFY)

```typescript
export class SearchComponent {
    
    // EXISTING: Keep current search logic
    
    // NEW: Use V3 keyword search
    performSearch(query: string): void {
        this.searchService.searchV3Keyword(query).subscribe({
            next: (response) => {
                // Handle keyword search results
                this.handleSearchResults(response);
            },
            error: (error) => {
                console.error('Search failed:', error);
            }
        });
    }
}
```

### **Phase 3: Update All Jobs Component**

#### **3.1 Modify Group Expansion Logic**
**File**: `frontend/rectrace/src/app/search-feature/components/all-jobs/all-jobs.component.ts` (MODIFY)

```typescript
export class AllJobsComponent {
    
    // EXISTING: Keep current component structure
    
    // MODIFY: Update expandGroup method
    private expandGroup(groupKey: string, rowIndex?: number): void {
        if (!this.currentQuery || !this.categoryKey) {
            console.warn('Cannot expand group: missing query or category');
            return;
        }
        
        // Use new V3 endpoint
        this.searchService.expandGroupV3(
            this.currentQuery,
            this.categoryKey,
            groupKey
        ).subscribe({
            next: (response) => {
                // Update grid with expanded results
                this.updateGridDataWithExpandedGroup(groupKey, response, rowIndex);
            },
            error: (error) => {
                console.error('Error expanding group:', error);
                this.snackBar.open('Failed to expand group. Please try again.', 'Close', {
                    duration: 3000
                });
            }
        });
    }
}
```

### **Phase 4: Clean Up Outdated Code**

#### **4.1 Remove Irrelevant Code**
**Files to Clean**:
- Remove unused methods from existing search services
- Remove complex state management code
- Remove pagination-related code
- Remove unused configuration options

---

## 🚀 **Implementation Sequence**

### **Week 1: Backend Foundation**
1. **Day 1**: Create `SearchConfigServiceV3`
2. **Day 2**: Create `ElasticsearchSearchProviderV3`
3. **Day 3**: Create `OracleSearchProviderV3`
4. **Day 4**: Update `SearchController` with new endpoints
5. **Day 5**: Test backend endpoints

### **Week 2: Frontend Integration**
1. **Day 1**: Update `SearchService` with new methods
2. **Day 2**: Update `SearchComponent` to use V3 keyword search
3. **Day 3**: Update `AllJobsComponent` to use V3 group expansion
4. **Day 4**: Clean up outdated code
5. **Day 5**: Test frontend integration

---

## ✅ **Success Criteria**

### **Functional Requirements**
- [ ] Keyword search works via Elasticsearch only
- [ ] Group expansion works via Oracle only
- [ ] No pagination in results
- [ ] Clean separation of concerns

### **Technical Requirements**
- [ ] New V3 endpoints are functional
- [ ] Existing functionality remains intact
- [ ] Code is clean and maintainable
- [ ] No complex state management

---

## 🎯 **Next Steps**

1. **Create Git Branch**: `feature/search-optimization-v3`
2. **Start with Backend**: Implement `SearchConfigServiceV3`
3. **Test Each Phase**: Validate before moving to next phase
4. **Keep It Simple**: Focus only on core functionality

---

**Ready to start implementation!** 🚀 
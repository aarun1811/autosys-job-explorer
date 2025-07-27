# Collapsible Groups Feature Implementation Plan

## Overview
Implement lazy loading with collapsible groups to improve search performance and user experience. Users will see collapsed groups initially, then expand individual groups or all groups progressively.

## Phase 1: Backend API Changes

### Task 1.1: Evaluate Existing Endpoint vs New Endpoint
**File**: `backend/rectrace/src/main/java/com/citi/gru/rectrace/controller/SearchController.java`
- Analyze if existing `/api/v2/search` can handle both collapsed and expanded views
- Consider adding optional parameters: `collapsed=true/false`, `groupKey` (for expansion)
- Decide between modifying existing endpoint vs creating new `/api/v2/search/expand`

### Task 1.2: Leverage Existing Collapse Feature
**File**: `backend/rectrace/src/main/java/com/citi/gru/rectrace/service/v2/ElasticsearchSearchProviderV2.java`
- Use existing `collapseOnPrecomputedField` configuration for collapsed view
- Modify `buildSearchSourceBuilder` to support both collapsed and expanded modes
- Ensure collapsed view returns one row per unique group value

### Task 1.3: Update Search Service for Dual Mode
**File**: `backend/rectrace/src/main/java/com/citi/gru/rectrace/service/v2/SearchServiceV2.java`
- Modify `performInitialSearch` to support collapsed mode
- Add method for group expansion (either new endpoint or parameter-based)
- Handle column visibility filtering for expanded groups
- Reuse existing `SearchResponse` structure for both modes

### Task 1.4: Update Search Configuration
**File**: `backend/rectrace/src/main/resources/search-config.json`
- Configure `collapseOnPrecomputedField` for each category (first column)
- Ensure proper field mapping for collapsed vs expanded views
- Test collapse behavior with existing Elasticsearch configuration

## Phase 2: Frontend Data Models

### Task 2.1: Reuse Existing Job Model Interfaces
**File**: `frontend/rectrace/src/app/models/job.model.ts`
- Keep existing `SearchResponse` and `SearchCategoryResult` interfaces unchanged
- Add `ExpandAllProgress` interface for progressive expand all
- No new interfaces needed - same structure for both collapsed and expanded views

### Task 2.2: Create Group State Management
**File**: `frontend/rectrace/src/app/search-feature/services/group-state.service.ts`
- Track expanded/collapsed state per group using first column value as key
- Handle group data caching for expanded groups
- Manage loading states per group
- Clear expanded state on new search, preserve on tab changes

## Phase 3: Frontend Service Layer

### Task 3.1: Update Search Service
**File**: `frontend/rectrace/src/app/services/search.service.ts`
- Modify existing search method to support collapsed mode by default
- Add `expandGroup(groupKey: string, visibleColumns: string[]): Observable<JobData[]>`
- Add `expandAllGroups(): Observable<ExpandAllProgress>`
- Handle column visibility in API calls
- Reuse existing API endpoint with optional parameters

### Task 3.2: Create Group Expansion Service
**File**: `frontend/rectrace/src/app/search-feature/services/group-expansion.service.ts`
- Implement progressive expand all logic
- Handle error recovery for individual groups
- Manage cancellation of expand all process

## Phase 4: UI Components

### Task 4.1: Update Search Component
**File**: `frontend/rectrace/src/app/search-feature/components/search/search.component.ts`
- Modify existing search to use collapsed mode by default
- Add expand/collapse group methods using first column value as group key
- Add expand all groups method with progressive loading
- Handle loading states for groups
- Integrate with column visibility changes

### Task 4.2: Update All Jobs Component
**File**: `frontend/rectrace/src/app/search-feature/components/all-jobs/all-jobs.component.ts`
- Add group expansion UI elements using first column as group identifier
- Implement expand/collapse buttons per group row
- Add "Expand All" button with progress indicator
- Show loading spinners per group
- Handle collapsed vs expanded row display in same grid

### Task 4.3: Update All Jobs Template
**File**: `frontend/rectrace/src/app/search-feature/components/all-jobs/all-jobs.component.html`
- Add expand/collapse buttons in first column (group column)
- Add loading indicators per group row
- Add "Expand All" button with progress bar
- Handle collapsed vs expanded row display in same grid structure
- Show expand button for collapsed rows, collapse button for expanded groups

## Phase 5: Column Visibility Integration

### Task 5.1: Update Grid Configuration Service
**File**: `frontend/rectrace/src/app/search-feature/services/grid-configuration.service.ts`
- Track visible columns state
- Emit column visibility changes
- Handle column visibility persistence

### Task 5.2: Integrate Column Visibility with Group Expansion
**File**: `frontend/rectrace/src/app/search-feature/components/all-jobs/all-jobs.component.ts`
- Re-fetch expanded groups when columns change
- Only fetch visible columns in API calls
- Update grid when columns are toggled

## Phase 6: State Management

### Task 6.1: Update Search State Service
**File**: `frontend/rectrace/src/app/search-feature/services/search-state.service.ts`
- Add expanded groups tracking
- Handle group loading states
- Clear expanded data on new search
- Preserve expanded data on tab changes

### Task 6.2: Update Search Results Service
**File**: `frontend/rectrace/src/app/search-feature/services/search-results.service.ts`
- Handle collapsed group data structure
- Manage group expansion results
- Update tab data when groups expand

## Phase 7: Error Handling & Edge Cases

### Task 7.1: Implement Error Recovery
- Handle individual group expansion failures
- Continue expand all process despite errors
- Show error messages for failed groups
- Allow retry for failed groups

### Task 7.2: Handle Large Groups
- Add warning for groups with >5000 rows
- Implement simple confirmation dialog
- Consider future pagination for very large groups

### Task 7.3: Memory Management
- Clear expanded data on new search
- Implement simple cache cleanup
- Handle memory pressure for large datasets

## Phase 8: Testing & Polish

### Task 8.1: Unit Tests
- Test group expansion API
- Test progressive expand all
- Test column visibility integration
- Test error handling scenarios

### Task 8.2: Integration Tests
- Test end-to-end group expansion flow
- Test expand all with multiple groups
- Test column visibility changes
- Test error scenarios

### Task 8.3: UI Polish
- Add smooth animations for expand/collapse
- Improve loading indicators
- Add keyboard shortcuts
- Ensure accessibility compliance

## Implementation Order

1. **Backend API** (Tasks 1.1-1.4) - Foundation
2. **Data Models** (Task 2.1-2.2) - Structure
3. **Service Layer** (Tasks 3.1-3.2) - Logic
4. **State Management** (Tasks 6.1-6.2) - Data flow
5. **UI Components** (Tasks 4.1-4.3) - User interface
6. **Column Integration** (Tasks 5.1-5.2) - Advanced features
7. **Error Handling** (Tasks 7.1-7.3) - Robustness
8. **Testing & Polish** (Tasks 8.1-8.3) - Quality

## Success Criteria

- [ ] Initial search shows collapsed groups only (using existing collapseOnPrecomputedField)
- [ ] Individual group expansion works (using first column value as group key)
- [ ] Progressive expand all works with proper progress indication
- [ ] Column visibility affects group expansion (only fetch visible columns)
- [ ] Loading states are clear and responsive (per group and global)
- [ ] Error handling is graceful (continue expand all despite individual failures)
- [ ] Performance is significantly improved (lazy loading, reduced data transfer)
- [ ] User experience is seamless (same grid structure, smooth transitions)
- [ ] Reuses existing API structure and interfaces
- [ ] Leverages existing Elasticsearch collapse functionality

## Estimated Timeline

- **Phase 1-3**: 2-3 days (Backend + Services)
- **Phase 4-6**: 2-3 days (UI + State)
- **Phase 7-8**: 1-2 days (Polish + Testing)
- **Total**: 5-8 days

## Risk Mitigation

- **Complexity**: Start with simple implementation, add features incrementally
- **Performance**: Test with large datasets early
- **User Experience**: Get feedback on UI/UX early
- **Integration**: Test column visibility integration thoroughly 
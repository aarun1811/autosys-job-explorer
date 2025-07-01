import { SearchResponse, TabData, SearchColumnDefinition } from './../models/job.model'; // Ensure SearchColumnDefinition is imported if used directly here beyond TabData
import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { SearchService } from '../services/search.service';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, Observable, of, Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, catchError, tap, filter, first } from 'rxjs/operators';
import { MatAutocompleteSelectedEvent, MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { ColumnVisibleEvent } from '../all-jobs/all-jobs.component'; // Verify this path
import { UserInfo, UserService } from '../services/user.service';

interface CategoryColumnState {
  loadedFields: Set<string>;          // Fields for which data has been successfully fetched
  initialHiddenFields: Set<string>;   // Fields configured as hidden by default (from original implementation)
  currentlyVisibleColumns: Set<string>; // New: Tracks columns currently visible in AG-Grid for this category
  pendingRequestFields: Set<string>;  // New: Columns toggled by user, awaiting batched fetch
  isDeduplicationActive: boolean;    // New: True if "Remove Duplicates" was last affecting action for this category
}

@Component({
  selector: 'app-search',
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.css'],
})
export class SearchComponent implements OnInit, OnDestroy {
  query: string = '';
  isLoading: boolean = false; // For the main initial search
  isLoadingCategory: boolean = false; // For individual category/tab loading (drives AG-Grid overlay)
  searchResultMap: SearchResponse = {};
  tabs: TabData[] = [];
  hasResults: boolean = false;
  hasSearched: boolean = false;
  showNoResultsMessage: boolean = false;
  isFocused: boolean = false;
  currentPlaceholder: string = '';
  tryButtonText: string = '';
  selectedTabIndex: number = -1;

  private placeholderIndex: number = 0;
  private placeholderInterval: any;
  private isAnimating: boolean = false; // For placeholder animation

  private categoryColumnStates: { [categoryKey: string]: CategoryColumnState } = {};

  userLoginId: string = "";
  userInitials: string | null = null;
  isUserIdentified: boolean = false;

  private queryParamsSubscription: Subscription | null = null;
  private searchSubscription: Subscription | null = null;
  private columnToggleSubscription: Subscription | null = null;

  suggestions$: Observable<string[]> = of([]);
  private queryInput$ = new Subject<string>();
  private columnToggleRequests$ = new Subject<{ categoryKey: string; fieldName: string; isVisible: boolean }>();

  @ViewChild('searchInput', { read: MatAutocompleteTrigger }) autocompleteTriggerCentered!: MatAutocompleteTrigger;
  @ViewChild('searchInputNavbar', { read: MatAutocompleteTrigger }) autocompleteTriggerNavbar!: MatAutocompleteTrigger;

  private readonly placeholders: string[] = [
    'job name',
    'set ID',
    'recon name',
    'machine name',
    'box name',
    'file name',
    'run calendar',
    'exclude calendar',
    'sub account'
  ];

  private readonly tryButtonTexts: {name: string, options: string[]}[] = [
    {
      name: 'file name',
      options: ['reconour', 'gpdw', 'flexcube', 'fullsuite',],
    },
    {
      name: 'agent code',
      options: ['nyk.cash', 'sbn.cash', 'pus.pos', 'mib.st', 'spb.st',],
    },
    {
      name: 'sub account',
      options: ['House', 'EUREX', 'FFS', 'LCH', 'GBP', 'EUR',],
    },
    {
      name: 'load job',
      options: ['153106_DMW_3969_PRSNPB_LOAD2', '153106_DMW1_3636_3265_PRSNPB_LOAD',],
    },
    {
      name: 'box name',
      options: ['153106_5869_ETL_HKO_BOX', '153106_TLM_8155_BVS_BOX', '153106_TLM_3265_BOX',],
    },
    {
      name: 'calendar name',
      options: ['HMC', 'us_holiday', '153106_BR_Holiday',],
    },
    {
      name: 'account',
      options: ['citicorp', 'inr', 'eur', 'gbp',],
    }
  ];

  // Inject ActivatedRoute and Router
  constructor(
    private searchService: SearchService,
    private route: ActivatedRoute,
    private router: Router,
    private readonly userService: UserService
  ) {}

  ngOnInit(): void {
    this.suggestions$ = this.queryInput$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap((prefix: string) => {
        if (!prefix || typeof prefix !== 'string' || prefix.trim().length < 2) {
          return of([]);
        }
        return this.searchService.getCombinedSuggestions(prefix.trim()).pipe(
          catchError(() => of([]))
        );
      })
    );

    this.columnToggleSubscription = this.columnToggleRequests$.pipe(
      debounceTime(750) 
    ).subscribe((eventData) => { 
      this.processBatchedColumnRequests();
    });

    this.queryParamsSubscription = this.route.queryParams.subscribe(params => {
      const queryFromUrl = params['q'];
      const tabFromUrl = params['tab'];

      if (queryFromUrl) {
        if (this.query !== queryFromUrl || !this.hasSearched) {
          this.query = queryFromUrl;
          this.doSearch(tabFromUrl);
        } else if (this.hasSearched && tabFromUrl && this.tabs.length > 0) {
          this.selectTabByKey(tabFromUrl, false);
        }
      } else {
        if (this.hasSearched) {
          this.clearSearchResultsView(); 
        } else {
          if (!this.isFocused) this.startPlaceholderCycle();
        }
      }
    });

    if (!this.query) {
      this.updateTryButtonText();
      if (!this.isFocused) this.startPlaceholderCycle();
    }

    this.userService.getUserInfo().subscribe(
      (userInfo: UserInfo | null) => {
        if (userInfo && userInfo.loginId && userInfo.loginId.trim() !== '') {
          this.userLoginId = userInfo.loginId;
          this.userInitials = this.userLoginId.substring(0, 2).toUpperCase();
          this.isUserIdentified = true;
        } else {
          this.isUserIdentified = false;
        }
      }
    );
  }

  ngOnDestroy(): void {
    this.queryParamsSubscription?.unsubscribe();
    this.searchSubscription?.unsubscribe();
    this.columnToggleSubscription?.unsubscribe();
    this.stopPlaceholderCycle();
    this.queryInput$.complete();
    this.columnToggleRequests$.complete();
  }

  onQueryInputChange(): void {
    this.queryInput$.next(this.query);
  }

  onSuggestionSelected(event: MatAutocompleteSelectedEvent): void {
    this.query = event.option.viewValue;
    this.doSearch();
  }

  private clearSearchResultsView(): void {
    this.query = '';
    this.tabs = [];
    this.searchResultMap = {};
    this.categoryColumnStates = {}; // Clear column states
    this.hasResults = false;
    this.isLoading = false;
    this.isLoadingCategory = false;
    this.showNoResultsMessage = false;
    this.selectedTabIndex = -1;
    this.searchSubscription?.unsubscribe();

    // Keep hasSearched = true
    // Focus navbar input
    const input = document.querySelector('.navbar-search .search-input') as HTMLInputElement;
    if (input) {
      input.focus();
      this.isFocused = true;
      this.stopPlaceholderCycle();
    }
  }

  private stopPlaceholderCycle(): void {
    if (this.placeholderInterval) {
      clearInterval(this.placeholderInterval);
      this.placeholderInterval = null;
    }
    this.isAnimating = false;
  }

  private startPlaceholderCycle(): void {
    if (this.query || this.isLoading || this.hasSearched || this.isFocused) {
      this.stopPlaceholderCycle();
      return;
    }
    this.stopPlaceholderCycle();
    this.currentPlaceholder = this.placeholders[this.placeholderIndex];
    this.isAnimating = true;

    this.placeholderInterval = setInterval(() => {
      if (!this.isFocused && !this.query && !this.isLoading && !this.hasSearched && this.isAnimating) {
        this.placeholderIndex = (this.placeholderIndex + 1) % this.placeholders.length;
        this.currentPlaceholder = this.placeholders[this.placeholderIndex];
      } else {
        this.stopPlaceholderCycle();
      }
    }, 3000);
  }

  updateTryButtonText(): void {
    const randomItem = this.tryButtonTexts[Math.floor(Math.random() * this.tryButtonTexts.length)];
    this.tryButtonText = randomItem.name;
  }

  onTryButtonClick(): void {
    const foundItem = this.tryButtonTexts.find(item => item.name === this.tryButtonText);
    if (!foundItem?.options) return;
    const randomOption = foundItem.options[Math.floor(Math.random() * foundItem.options.length)];
    this.query = randomOption;
    this.doSearch();
  }

  onSearchFocus(): void {
    this.isFocused = true;
    this.stopPlaceholderCycle();
  }

  onSearchBlur(): void {
    this.isFocused = false;
    if (!this.query && !this.hasSearched) {
      this.placeholderIndex = 0;
      this.currentPlaceholder = this.placeholders[0];
      this.startPlaceholderCycle();
    }
  }

  doSearch(targetTabKey?: string): void {
    const trimmedQuery = this.query.trim();
    this.autocompleteTriggerCentered?.closePanel();
    this.autocompleteTriggerNavbar?.closePanel();

    if (!trimmedQuery) {
      this.resetToHome();
      return;
    }

    this.stopPlaceholderCycle();
    this.searchSubscription?.unsubscribe();

    this.tabs = [];
    this.isLoading = true; // For initial search
    this.isLoadingCategory = false; // Reset category loader
    this.hasSearched = true;
    this.hasResults = false;
    this.showNoResultsMessage = false;
    this.selectedTabIndex = -1;
    this.categoryColumnStates = {}; // Reset for new search

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { q: trimmedQuery },
      queryParamsHandling: 'merge'
    }).catch(err => console.error("Navigation error on search:", err));

    this.searchSubscription = this.searchService.searchV2Initial(trimmedQuery).subscribe({
      next: (data: SearchResponse) => {
        this.isLoading = false;
        this.searchResultMap = data;
        this.initializeCategoryColumnStates(data); // Initialize new states
        this.buildTabs();

        if (this.tabs.length > 0) {
          this.hasResults = true;
          this.showNoResultsMessage = false;
          this.selectTabByKey(targetTabKey, false); // Select tab, URL will be updated by updateUrlWithState
        } else {
          this.hasResults = false;
          this.showNoResultsMessage = true;
          this.selectedTabIndex = -1;
        }
        this.updateUrlWithState(); // Update URL with final state including tab
      },
      error: (error) => {
        this.isLoading = false;
        this.hasSearched = true;
        this.hasResults = false;
        this.showNoResultsMessage = true;
        this.tabs = [];
        this.selectedTabIndex = -1;
        console.error('Error searching:', error);
        this.updateUrlWithState(); // Update URL even on error (q param, no tab)
      }
    });
  }

  private initializeCategoryColumnStates(searchResponse: SearchResponse): void {
    this.categoryColumnStates = {};
    for (const categoryKey in searchResponse) {
      if (searchResponse.hasOwnProperty(categoryKey)) {
        const categoryResult = searchResponse[categoryKey];
        const initialHidden = new Set<string>();
        const initiallyVisible = new Set<string>();
        const essentialFields = new Set<string>();

        categoryResult.config.columns.forEach(colDef => {
          if (colDef.field) {
            if (colDef.hide) {
              initialHidden.add(colDef.field);
            } else {
              initiallyVisible.add(colDef.field);
              essentialFields.add(colDef.field);
            }
          }
        });
        this.categoryColumnStates[categoryKey] = {
          loadedFields: new Set<string>(essentialFields),
          initialHiddenFields: initialHidden,
          currentlyVisibleColumns: new Set<string>(initiallyVisible),
          pendingRequestFields: new Set<string>(),
          isDeduplicationActive: false
        };
      }
    }
  }

  public handleColumnVisibilityChange(event: ColumnVisibleEvent): void {
    const { categoryKey, columnField, isVisible } = event;

    if (!this.categoryColumnStates[categoryKey]) {
      console.warn(`State for category ${categoryKey} not found. This should not happen if initialized correctly.`);
      // Robustness: Initialize if somehow missing, though it implies an issue elsewhere
      this.categoryColumnStates[categoryKey] = {
           loadedFields: new Set<string>(), initialHiddenFields: new Set<string>(),
           currentlyVisibleColumns: new Set<string>(), pendingRequestFields: new Set<string>(),
           isDeduplicationActive: false
       };
    }
    const categoryState = this.categoryColumnStates[categoryKey];

    if (isVisible) {
      categoryState.currentlyVisibleColumns.add(columnField);
      // 
      if (!categoryState.loadedFields.has(columnField) || categoryState.isDeduplicationActive) {
        categoryState.pendingRequestFields.add(columnField);
      }
    } else {
      categoryState.currentlyVisibleColumns.delete(columnField);
      categoryState.pendingRequestFields.delete(columnField); // Remove if it was pending and now hidden
    }

    // Trigger debouncer if there are pending fields or if deduplication might prompt a refresh due to visibility change
    if (categoryState.pendingRequestFields.size > 0 || (isVisible && categoryState.isDeduplicationActive)) {
      this.columnToggleRequests$.next({ categoryKey, fieldName: columnField, isVisible });
    }
  }

  private processBatchedColumnRequests(): void {
    const currentTabKey = this.getCurrentTabKey();
    if (!currentTabKey || !this.categoryColumnStates[currentTabKey]) {
      // Clear all pending if no context, or handle more gracefully
      Object.values(this.categoryColumnStates).forEach(state => state.pendingRequestFields.clear());
      return;
    }

    const categoryState = this.categoryColumnStates[currentTabKey];
    const originalQuery = this.query.trim();

    if (!originalQuery) {
      categoryState.pendingRequestFields.clear();
      return;
    }

    const newFieldsRequested = Array.from(categoryState.pendingRequestFields)
                                .some(field => !categoryState.loadedFields.has(field));

    if (!newFieldsRequested && !categoryState.isDeduplicationActive) {
      categoryState.pendingRequestFields.clear();
      return;
    }

    const fieldsToSendToBackend = Array.from(categoryState.currentlyVisibleColumns);

    if (fieldsToSendToBackend.length === 0) {
        // If nothing is visible, but a fetch was triggered (e.g. by isDeduplicationActive and a previous pending field)
        // We probably shouldn't fetch an empty set of columns.
        console.warn(`Attempted to fetch for ${currentTabKey}, but no columns are currently visible.`);
        categoryState.pendingRequestFields.clear();
        if(categoryState.isDeduplicationActive) {
            // If dedupe was active and this was the trigger, but nothing visible, maybe reset dedupe?
            // Or let it persist until a visible column interaction. For now, just clear pending.
        }
        return;
    }

    this.isLoadingCategory = true;

    this.searchService.fetchDetailedCategoryData(originalQuery, currentTabKey, fieldsToSendToBackend)
      .pipe(first())
      .subscribe({
        next: (response: SearchResponse) => {
          this.isLoadingCategory = false;
          if (response && response[currentTabKey]) {
            const detailedResult = response[currentTabKey];
            this.searchResultMap[currentTabKey] = detailedResult;
            const tabIndex = this.tabs.findIndex(t => t.key === currentTabKey);
            if (tabIndex !== -1) {
              this.tabs[tabIndex].data = [...detailedResult.data]; 
              // Potentially update columnDefs if they can change dynamically per fetch for a category
              // this.tabs[tabIndex].columnDef = detailedResult.config.columns;
            }

            // All fields in the successful response (which are fieldsToSendToBackend) are now loaded
            categoryState.loadedFields = new Set<string>(fieldsToSendToBackend);
            categoryState.isDeduplicationActive = false; // Reset flag
            console.log(`Data fetched for ${currentTabKey}. Loaded:`, Array.from(categoryState.loadedFields));
          } else {
            console.warn(`Detailed data for ${currentTabKey} missing in response.`);
          }
          categoryState.pendingRequestFields.clear();
        },
        error: (err) => {
          this.isLoadingCategory = false;
          console.error(`Error fetching detailed data for ${currentTabKey}:`, err);
          categoryState.pendingRequestFields.clear(); // Clear pending to avoid retry loops without user action
        }
      });
  }

  public handleDuplicatesRemoved(categoryKey: string): void {
    if (this.categoryColumnStates[categoryKey]) {
      this.categoryColumnStates[categoryKey].isDeduplicationActive = true;
      console.log(`Deduplication activated for category: ${categoryKey}.`);
    } else {
      console.warn(`State for category ${categoryKey} not found on duplicatesRemoved.`);
    }
  }

  public handleOriginalDataRestored(categoryKey: string): void {
    if (this.categoryColumnStates[categoryKey]) {
      this.categoryColumnStates[categoryKey].isDeduplicationActive = false;
      console.log(`Deduplication deactivated for category: ${categoryKey} (original data restored).`);
      // When original data is restored in AllJobsComponent, it implies a reset.
      // The next interaction with column visibility will determine if a fetch is needed
      // based on the (now false) isDeduplicationActive and loadedFields state.
      // If AllJobsComponent restored to data that SearchComponent provided,
      // loadedFields should still be accurate.
    } else {
      console.warn(`State for category ${categoryKey} not found on originalDataRestored.`);
    }
  }


  buildTabs(): void {
    const newTabs: TabData[] = [];
    for (const [categoryKey, categoryResult] of Object.entries(this.searchResultMap)) {
      if (categoryResult?.data && categoryResult.data.length > 0 && categoryResult.config) {
        newTabs.push({
          key: categoryResult.config.key,
          data: categoryResult.data,
          label: categoryResult.config.label,
          columnDef: categoryResult.config.columns
        });
      }
    }
    this.tabs = newTabs;
  }

  private selectTabByKey(key?: string | null, updateUrl: boolean = true): void {
    let newIndex = -1;
    if (key && this.tabs.length > 0) {
      const foundIndex = this.tabs.findIndex(tab => tab.key === key);
      newIndex = (foundIndex !== -1) ? foundIndex : 0; // Default to first if key not found
    } else if (this.tabs.length > 0) {
      newIndex = 0; // Default to first tab if no key
    }

    if (this.selectedTabIndex !== newIndex) {
      this.selectedTabIndex = newIndex;
      this.isLoadingCategory = false; // Reset category loader when switching tabs
      // Any pending requests for the *previous* tab should ideally be cancelled or ignored.
      // For simplicity, processBatchedColumnRequests checks currentTabKey.
      Object.values(this.categoryColumnStates).forEach(state => state.pendingRequestFields.clear());


    }
    if (updateUrl) {
        this.updateUrlWithState();
    }
  }

  selectTab(index: number): void {
    if (index >= 0 && index < this.tabs.length && this.selectedTabIndex !== index) {
      this.selectedTabIndex = index;
      this.isLoadingCategory = false; // Reset category loader
      Object.values(this.categoryColumnStates).forEach(state => state.pendingRequestFields.clear());
      this.updateUrlWithState();
    }
  }

  private updateUrlWithState(): void {
    if (this.isLoading) return; // Don't update URL if main search is loading

    const currentQuery = this.query.trim() || null;
    let currentTabKey: string | null = null;

    if (this.tabs.length > 0 && this.selectedTabIndex >= 0 && this.selectedTabIndex < this.tabs.length) {
      currentTabKey = this.tabs[this.selectedTabIndex].key;
    }

    const queryParams: { [key: string]: string | null } = {};
    if (currentQuery) queryParams['q'] = currentQuery;
    if (currentTabKey) queryParams['tab'] = currentTabKey;
    // If both are null, it will clear them from URL.

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: queryParams,
      replaceUrl: !currentQuery // Use replaceUrl if clearing search or just switching tabs
    }).catch(err => console.error("Navigation error updating URL:", err));
  }

  clearSearch(): void {
    this.query = '';
    this.onQueryInputChange(); // To update suggestions if any logic depends on it
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {}
    }).catch(err => console.error("Navigation error on clearSearch:", err));
    
  }

  resetToHome(): void {
    this.query = '';
    this.tabs = [];
    this.searchResultMap = {};
    this.categoryColumnStates = {};
    this.hasResults = false;
    this.hasSearched = false;
    this.isLoading = false;
    this.isLoadingCategory = false;
    this.showNoResultsMessage = false;
    this.selectedTabIndex = -1;
    this.placeholderIndex = 0;
    this.currentPlaceholder = this.placeholders[0];
    this.searchSubscription?.unsubscribe();
    Object.values(this.categoryColumnStates).forEach(state => state.pendingRequestFields.clear());

    this.updateTryButtonText();
    const currentParams = this.route.snapshot.queryParams;
    if (currentParams['q'] || currentParams['tab']) {
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: {}
      }).catch(err => console.error("Navigation error on resetToHome:", err));
    }
    if (!this.isFocused) this.startPlaceholderCycle();
  }

  onSearchIconClick(): void {
    if (this.query.trim()) {
      this.doSearch();
    }
  }

  private getCurrentTabKey(): string | null {
    return (this.tabs.length > 0 && this.selectedTabIndex >= 0 && this.selectedTabIndex < this.tabs.length)
      ? this.tabs[this.selectedTabIndex].key
      : null;
  }
}       
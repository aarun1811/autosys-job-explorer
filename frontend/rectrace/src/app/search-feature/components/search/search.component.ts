import { SearchResponse, TabData } from '../../../models/job.model';
import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { SearchService } from '../../../services/search.service';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, Observable } from 'rxjs';
import { MatAutocompleteSelectedEvent, MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { ColumnVisibleEvent } from '../all-jobs/all-jobs.component';
import { UserInfo, UserService } from '../../../services/user.service';

// Import our new services
import { SearchStateService } from '../../services/search-state.service';
import { SearchResultsService } from '../../services/search-results.service';
import { SearchInputService } from '../../services/search-input.service';
import { ColumnVisibilityService } from '../../services/column-visibility.service';

@Component({
  selector: 'app-search',
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.css'],
})
export class SearchComponent implements OnInit, OnDestroy {
  // State from services
  query: string = '';
  isLoading: boolean = false;
  isLoadingCategory: boolean = false;
  searchResultMap: SearchResponse = {};
  tabs: TabData[] = [];
  hasResults: boolean = false;
  hasSearched: boolean = false;
  showNoResultsMessage: boolean = false;
  isFocused: boolean = false;
  currentPlaceholder: string = '';
  tryButtonText: string = '';
  selectedTabIndex: number = -1;

  // User state
  userLoginId: string = "";
  userInitials: string | null = null;
  isUserIdentified: boolean = false;

  // Observables from services
  suggestions$: Observable<string[]>;
  currentPlaceholder$: Observable<string>;
  tryButtonText$: Observable<string>;

  // Subscriptions
  private queryParamsSubscription: Subscription | null = null;
  private searchSubscription: Subscription | null = null;
  private stateSubscription: Subscription | null = null;
  private resultsSubscription: Subscription | null = null;
  private inputSubscription: Subscription | null = null;

  @ViewChild('searchInput', { read: MatAutocompleteTrigger }) autocompleteTriggerCentered!: MatAutocompleteTrigger;
  @ViewChild('searchInputNavbar', { read: MatAutocompleteTrigger }) autocompleteTriggerNavbar!: MatAutocompleteTrigger;

  constructor(
    private searchService: SearchService,
    private route: ActivatedRoute,
    private router: Router,
    private readonly userService: UserService,
    // Inject our new services
    private searchStateService: SearchStateService,
    private searchResultsService: SearchResultsService,
    private searchInputService: SearchInputService,
    private columnVisibilityService: ColumnVisibilityService
  ) {
    // Initialize observables from services
    this.suggestions$ = this.searchInputService.suggestions$;
    this.currentPlaceholder$ = this.searchInputService.currentPlaceholder$;
    this.tryButtonText$ = this.searchInputService.tryButtonText$;
  }

    ngOnInit(): void {
    this.initializeStateFromServices();
    this.initializeQueryParamsSubscription();
    this.initializeUserService();
    this.initializePlaceholderCycle();
  }

  // Private initialization methods
  private initializeStateFromServices(): void {
    // Subscribe to state changes from services
    this.stateSubscription = this.searchStateService.state$.subscribe(state => {
      this.query = state.query;
      this.isLoading = state.isLoading;
      this.isLoadingCategory = state.isLoadingCategory;
      this.hasSearched = state.hasSearched;
      this.showNoResultsMessage = state.showNoResultsMessage;
      this.selectedTabIndex = state.selectedTabIndex;
      this.isFocused = state.isFocused;
    });

    this.resultsSubscription = this.searchResultsService.searchResultMap$.subscribe(searchResultMap => {
      this.searchResultMap = searchResultMap;
    });

    this.resultsSubscription.add(
      this.searchResultsService.tabs$.subscribe(tabs => {
        this.tabs = tabs;
      })
    );

    this.resultsSubscription.add(
      this.searchResultsService.hasResults$.subscribe(hasResults => {
        this.hasResults = hasResults;
      })
    );

    this.inputSubscription = this.searchInputService.currentPlaceholder$.subscribe(placeholder => {
      this.currentPlaceholder = placeholder;
    });

    this.inputSubscription.add(
      this.searchInputService.tryButtonText$.subscribe(tryButtonText => {
        this.tryButtonText = tryButtonText;
      })
    );
  }

  private initializeQueryParamsSubscription(): void {
    this.queryParamsSubscription = this.route.queryParams.subscribe(params => {
      const queryFromUrl = params['q'];
      const tabFromUrl = params['tab'];

      if (queryFromUrl) {
        if (this.query !== queryFromUrl || !this.hasSearched) {
          this.searchStateService.updateQuery(queryFromUrl);
          this.doSearch(tabFromUrl);
        } else if (this.hasSearched && tabFromUrl && this.tabs.length > 0) {
          this.selectTabByKey(tabFromUrl, false);
        }
      } else {
        if (this.hasSearched) {
          this.clearSearchResultsView();
        } else {
          if (!this.isFocused) this.searchInputService.startPlaceholderCycle();
        }
      }
    });
  }

  private initializeUserService(): void {
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

  private initializePlaceholderCycle(): void {
    if (!this.query) {
      this.searchInputService.updateTryButtonText();
      if (!this.isFocused) this.searchInputService.startPlaceholderCycle();
    }
  }

  ngOnDestroy(): void {
    this.queryParamsSubscription?.unsubscribe();
    this.searchSubscription?.unsubscribe();
    this.stateSubscription?.unsubscribe();
    this.resultsSubscription?.unsubscribe();
    this.inputSubscription?.unsubscribe();
    this.searchInputService.stopPlaceholderCycle();
  }

  onQueryInputChange(): void {
    this.searchInputService.onQueryInputChange(this.query);
  }

  onSuggestionSelected(event: MatAutocompleteSelectedEvent): void {
    this.query = event.option.viewValue;
    this.searchStateService.updateQuery(this.query);
    this.doSearch();
  }

  private clearSearchResultsView(): void {
    this.searchStateService.clearSearchState();
    this.searchResultsService.clearSearchResults();
    this.searchSubscription?.unsubscribe();

    // Focus navbar input
    const input = document.querySelector('.navbar-search .search-input') as HTMLInputElement;
    if (input) {
      input.focus();
    }
  }

  updateTryButtonText(): void {
    this.searchInputService.updateTryButtonText();
  }

  onTryButtonClick(): void {
    this.query = this.searchInputService.getCurrentTryButtonText();
    this.searchStateService.updateQuery(this.query);
    this.doSearch();
  }

  onSearchFocus(): void {
    this.searchStateService.setFocused(true);
    this.searchInputService.stopPlaceholderCycle();
  }

  onSearchBlur(): void {
    this.searchStateService.setFocused(false);
    if (!this.hasSearched) {
      this.searchInputService.startPlaceholderCycle();
    }
  }

  doSearch(targetTabKey?: string): void {
    if (!this.query || this.query.trim().length === 0) {
      return;
    }

    this.searchStateService.updateQuery(this.query);
    this.searchStateService.setLoading(true);
    this.searchStateService.setHasSearched(true);
    this.searchStateService.updateUrlWithState(this.query, targetTabKey);

    this.searchSubscription?.unsubscribe();
    this.searchSubscription = this.searchService.search(this.query).subscribe({
      next: (searchResponse: SearchResponse) => {
        this.searchResultsService.updateSearchResults(searchResponse);
        this.searchStateService.setLoading(false);

        if (targetTabKey) {
          this.selectTabByKey(targetTabKey, false);
        } else {
          this.selectTabByKey(undefined, false);
        }
      },
      error: (error) => {
        console.error('Search error:', error);
        this.searchStateService.setLoading(false);
        this.searchStateService.setShowNoResultsMessage(true);
      }
    });
  }

  selectTab(index: number): void {
    this.searchStateService.setSelectedTabIndex(index);
    const tab = this.tabs[index];
    if (tab) {
      this.searchStateService.updateUrlWithState(this.query, tab.key);
    }
  }

  handleColumnVisibilityChange(event: ColumnVisibleEvent): void {
    // Convert ColumnVisibleEvent to ColumnVisibilityEvent
    const columnVisibilityEvent = {
      categoryKey: event.categoryKey,
      columnField: event.columnField,
      isVisible: event.isVisible
    };

    this.columnVisibilityService.handleColumnVisibilityChange(columnVisibilityEvent);

    const currentState = this.searchResultsService.getCategoryColumnState(event.categoryKey);
    if (currentState) {
      const updatedState = this.columnVisibilityService.updateCategoryColumnState(
        event.categoryKey,
        currentState,
        event.columnField,
        event.isVisible
      );
      this.searchResultsService.updateCategoryColumnState(event.categoryKey, updatedState);
    }
  }

  handleDuplicatesRemoved(categoryKey: string): void {
    const currentState = this.searchResultsService.getCategoryColumnState(categoryKey);
    if (currentState) {
      const updatedState = { ...currentState, isDeduplicationActive: true };
      this.searchResultsService.updateCategoryColumnState(categoryKey, updatedState);
    }
  }

  handleOriginalDataRestored(categoryKey: string): void {
    const currentState = this.searchResultsService.getCategoryColumnState(categoryKey);
    if (currentState) {
      const updatedState = { ...currentState, isDeduplicationActive: false };
      this.searchResultsService.updateCategoryColumnState(categoryKey, updatedState);
    }
  }

  clearSearch(): void {
    this.query = '';
    this.searchStateService.updateQuery('');
    this.searchInputService.onQueryInputChange('');
    this.searchStateService.updateUrlWithState(this.query);
  }

  resetToHome(): void {
    this.clearSearch();
    this.searchStateService.resetToInitialState();
    this.searchResultsService.clearSearchResults();
    this.searchInputService.startPlaceholderCycle();
  }

  onSearchIconClick(): void {
    this.doSearch();
  }

  private selectTabByKey(key?: string | null, updateUrl: boolean = true): void {
    if (!key && this.tabs.length === 0) return;
    if (!key && this.tabs.length > 0) {
      key = this.tabs[0].key;
    }
    const tabIndex = this.tabs.findIndex(tab => tab.key === key);
    if (tabIndex !== -1) {
      this.searchStateService.setSelectedTabIndex(tabIndex);
      if (updateUrl) {
        this.searchStateService.updateUrlWithState(this.query, key || undefined);
      }
    }
  }

  private getCurrentTabKey(): string | null {
    if (this.selectedTabIndex >= 0 && this.selectedTabIndex < this.tabs.length) {
      return this.tabs[this.selectedTabIndex].key;
    }
    return null;
  }
}

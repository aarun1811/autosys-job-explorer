import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject, Subscription, Observable, of } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged, switchMap, catchError } from 'rxjs/operators';
import { ActivatedRoute, Router } from '@angular/router';
import { MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { SearchServiceV5, CategoryResultV4 } from '../../../services/search-v5.service';

@Component({
  selector: 'app-search-v5',
  templateUrl: './search-v5.component.html',
  styleUrls: ['./search-v5.component.css']
})
export class SearchV5Component implements OnInit, OnDestroy {
  // Core search state
  searchTerm: string = '';
  searchResults: CategoryResultV4[] = [];
  selectedTab: number = 0;
  isLoading: boolean = false;
  errorMessage: string = '';
  
  // Visual state for Google-inspired design
  hasSearched: boolean = false;
  isFocused: boolean = false;
  currentPlaceholder: string = 'files';
  tryButtonText: string = 'SBN_JOB_NAME';
  showNoResultsMessage: boolean = false;
  
  // User state
  userLoginId: string = '';
  userInitials: string = '';
  isUserIdentified: boolean = false;
  
  // Suggestions
  suggestions$: Observable<string[]> = of([]);
  private searchInput$ = new Subject<string>();
  
  // Placeholder animation
  private placeholders = ['files', 'jobs', 'boxes', 'recons'];
  private placeholderIndex = 0;
  private placeholderInterval: any;
  
  // Sample searches for Try button - matches old implementation
  private tryButtonTexts: {name: string, options: string[]}[] = [
    {
      name: 'file name',
      options: ['reconour', 'gpdw', 'flexcube', 'fullsuite']
    },
    {
      name: 'job name', 
      options: ['FLBCM1', 'reco_break', 'wf_exec', 'EODPRO']
    },
    {
      name: 'box name',
      options: ['B_FLBCM', 'B_BATCH', 'B_RECON', 'B_EOD']
    },
    {
      name: 'recon name',
      options: ['nostro', 'ledger', 'position', 'cash']
    }
  ];
  
  private destroy$ = new Subject<void>();
  private queryParamsSubscription: Subscription | null = null;
  
  constructor(
    private searchService: SearchServiceV5,
    private route: ActivatedRoute,
    private router: Router
  ) {}
  
  ngOnInit(): void {
    // Initialize component
    this.startPlaceholderAnimation();
    this.initializeUser();
    this.updateTryButtonText();
    this.initializeQueryParamsSubscription();
    this.initializeSuggestions();
  }
  
  private initializeSuggestions(): void {
    this.suggestions$ = this.searchInput$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(query => {
        if (!query || query.trim().length < 2) {
          return of([]);
        }
        return this.searchService.getSuggestions(query.trim()).pipe(
          catchError(() => of([]))
        );
      })
    );
  }
  
  private initializeQueryParamsSubscription(): void {
    this.queryParamsSubscription = this.route.queryParams.subscribe(params => {
      const queryFromUrl = params['q'];
      const tabFromUrl = params['tab'];
      
      // If there's a query in the URL and we haven't searched yet, perform the search
      if (queryFromUrl && !this.hasSearched) {
        this.searchTerm = queryFromUrl;
        this.performSearch();
      }
      
      // If there's a tab parameter, select that tab
      if (tabFromUrl && this.searchResults.length > 0) {
        const tabIndex = this.searchResults.findIndex(cat => cat.key === tabFromUrl);
        if (tabIndex !== -1) {
          this.selectedTab = tabIndex;
        }
      }
    });
  }
  
  private startPlaceholderAnimation(): void {
    this.placeholderInterval = setInterval(() => {
      this.placeholderIndex = (this.placeholderIndex + 1) % this.placeholders.length;
      this.currentPlaceholder = this.placeholders[this.placeholderIndex];
    }, 2000);
  }
  
  private initializeUser(): void {
    // Get user from localStorage or headers
    const storedUser = localStorage.getItem('userLoginId');
    if (storedUser) {
      this.userLoginId = storedUser;
      this.userInitials = this.getUserInitials(storedUser);
      this.isUserIdentified = true;
    }
  }
  
  private getUserInitials(loginId: string): string {
    const parts = loginId.split('.');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return loginId.substring(0, 2).toUpperCase();
  }
  
  updateTryButtonText(): void {
    // Select a random category to display
    const randomItem = this.tryButtonTexts[Math.floor(Math.random() * this.tryButtonTexts.length)];
    this.tryButtonText = randomItem.name;
  }
  
  onTryButtonClick(): void {
    // Find the category and select a random option from it
    const foundItem = this.tryButtonTexts.find(item => item.name === this.tryButtonText);
    if (foundItem?.options) {
      const randomOption = foundItem.options[Math.floor(Math.random() * foundItem.options.length)];
      this.searchTerm = randomOption;
      this.performSearch();
    }
  }
  
  onSearchFocus(): void {
    this.isFocused = true;
  }
  
  onSearchBlur(): void {
    this.isFocused = false;
  }
  
  onSearchIconClick(): void {
    if (this.searchTerm) {
      this.performSearch();
    }
  }
  
  resetToHome(): void {
    this.searchTerm = '';
    this.searchResults = [];
    this.hasSearched = false;
    this.showNoResultsMessage = false;
    this.errorMessage = '';
    this.selectedTab = 0;
    // Clear URL parameters
    this.updateUrlWithState();
  }
  
  selectTab(index: number): void {
    this.selectedTab = index;
    // Update URL with selected tab
    if (this.searchResults[index]) {
      this.updateUrlWithState(this.searchTerm, this.searchResults[index].key);
    }
  }
  
  private updateUrlWithState(query?: string, tabKey?: string): void {
    const params: any = {};
    
    if (query) {
      params.q = query;
    }
    
    if (tabKey) {
      params.tab = tabKey;
    }
    
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: params,
      replaceUrl: true
    });
  }
  
  performSearch(): void {
    if (!this.searchTerm || !this.searchTerm.trim()) {
      this.errorMessage = 'Please enter a search term';
      return;
    }
    
    this.errorMessage = '';
    this.isLoading = true;
    this.searchResults = [];
    this.hasSearched = true;
    this.showNoResultsMessage = false;
    
    // Update URL with search query
    const firstTabKey = this.searchResults.length > 0 ? this.searchResults[0].key : undefined;
    this.updateUrlWithState(this.searchTerm.trim(), firstTabKey);
    
    this.searchService.performInitialSearch(this.searchTerm.trim())
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          // Convert category results map to array and filter out empty results
          this.searchResults = Object.values(response.categoryResults)
            .filter(cat => cat.count > 0)
            .sort((a, b) => b.count - a.count); // Sort by count descending
          
          this.isLoading = false;
          this.selectedTab = 0;
          
          if (this.searchResults.length === 0) {
            this.showNoResultsMessage = true;
          } else {
            // Update URL with first tab after results are loaded
            this.updateUrlWithState(this.searchTerm.trim(), this.searchResults[0].key);
          }
        },
        error: (error) => {
          console.error('Search failed', error);
          this.isLoading = false;
          this.errorMessage = 'Search failed. Please try again.';
          this.hasSearched = false;
        }
      });
  }
  
  onKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      this.performSearch();
    }
  }
  
  onSearchInput(): void {
    this.searchInput$.next(this.searchTerm);
  }
  
  onSuggestionSelected(event: MatAutocompleteSelectedEvent): void {
    this.searchTerm = event.option.value;
    this.performSearch();
  }
  
  clearSearch(): void {
    this.searchTerm = '';
    // Don't reset hasSearched to keep navbar visible
    // Just clear the search term and keep user on the results page
    // Focus the input after clearing
    setTimeout(() => {
      const input = document.querySelector('.navbar-search .search-input') as HTMLInputElement;
      if (input) {
        input.focus();
      }
    }, 0);
  }
  
  getTabLabel(category: CategoryResultV4): string {
    const countText = category.hasMore ? `${category.count}+` : `${category.count}`;
    return `${category.label} (${countText})`;
  }
  
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    
    if (this.placeholderInterval) {
      clearInterval(this.placeholderInterval);
    }
    
    if (this.queryParamsSubscription) {
      this.queryParamsSubscription.unsubscribe();
    }
  }
}
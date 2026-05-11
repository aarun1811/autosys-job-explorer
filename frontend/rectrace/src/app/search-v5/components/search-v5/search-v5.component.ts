import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject, Subscription, Observable, of } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged, switchMap, catchError } from 'rxjs/operators';
import { ActivatedRoute, Router } from '@angular/router';
import { MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { SearchServiceV5, CategoryResultV4 } from '../../../services/search-v5.service';
import { ThemeService, Theme } from 'src/app/services/theme.service';
import { UserInfo, UserService } from 'src/app/services/user.service';

@Component({
  selector: 'app-search-v5',
  templateUrl: './search-v5.component.html',
  styleUrls: ['./search-v5.component.scss']
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

  // Theme state
  currentTheme$: Observable<Theme>;
  isDarkMode: boolean = false;
  logoPath: string = 'assets/rectrace-dark.png';

  // Suggestions
  suggestions$: Observable<string[]> = of([]);
  private searchInput$ = new Subject<string>();

  // Placeholder animation
  private placeholders = [
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
  private placeholderIndex = 0;
  private placeholderInterval: any;

  // Sample searches for Try button - matches old implementation
  private readonly tryButtonTexts: { name: string, options: string[] }[] = [
    {
      name: 'file name',
      options: ['reconour', 'gpdw', 'flexcube', 'fullsuite']
    },
    {
      name: 'agent code',
      options: ['nyk.cash', 'sbn.cash', 'pus.pos', 'mib.st', 'spb.st']
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

  private destroy$ = new Subject<void>();
  private queryParamsSubscription: Subscription | null = null;

  constructor(
    private searchService: SearchServiceV5,
    private route: ActivatedRoute,
    private router: Router,
    private userService: UserService,
    private themeService: ThemeService
  ) {
    this.currentTheme$ = this.themeService.getTheme();
  }

  ngOnInit(): void {
    // Initialize component
    this.startPlaceholderAnimation();
    this.initializeUser();
    this.updateTryButtonText();
    this.initializeQueryParamsSubscription();
    this.initializeSuggestions();
    this.initializeTheme();
  }

  private initializeTheme(): void {
    this.currentTheme$.pipe(takeUntil(this.destroy$)).subscribe(theme => {
      this.isDarkMode = theme === 'dark';
      this.logoPath = this.isDarkMode ? 'assets/rectrace-dark.png' : 'assets/rectrace.png';
    });
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
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

      // If there's a query in the URL and we haven't searched yet, perform the search
      if (queryFromUrl && !this.hasSearched) {
        this.searchTerm = queryFromUrl;
        this.performSearch(true); // Pass true for deeplink searches
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
    } else {
      this.userService.getUserInfo().subscribe(
        (userInfo: UserInfo | null) => {
          if (userInfo && userInfo.loginId && userInfo.loginId.trim() !== '') {
            this.userLoginId = userInfo.loginId;
            this.userInitials = this.userLoginId.substring(0, 2).toUpperCase();
            this.isUserIdentified = true;
            localStorage.setItem('userLoginId', this.userLoginId);
          } else {
            this.isUserIdentified = false;
          }
        }
      );
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
    this.searchInput$.next('');
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

  performSearch(isDeepLink: boolean = false): void {
    if (!this.searchTerm || !this.searchTerm.trim()) {
      this.errorMessage = 'Please enter a search term';
      return;
    }

    this.searchInput$.next('');

    this.errorMessage = '';
    this.isLoading = true;
    this.searchResults = [];
    this.hasSearched = true;
    this.showNoResultsMessage = false;

    // Only preserve the tab parameter for deeplink searches
    let tabToPreserve: string | undefined;
    if (isDeepLink) {
      tabToPreserve = this.route.snapshot.queryParams['tab'];
    }
    this.updateUrlWithState(this.searchTerm.trim(), tabToPreserve);

    this.searchService.performInitialSearch(this.searchTerm.trim())
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          // Convert category results map to array and filter out empty results
          this.searchResults = Object.values(response.categoryResults)
            .filter(cat => cat.count > 0)
            .sort((a, b) => b.count - a.count); // Sort by count descending

          this.isLoading = false;

          // Check if there's a tab parameter in the URL and set it
          const tabFromUrl = this.route.snapshot.queryParams['tab'];
          if (tabFromUrl && this.searchResults.length > 0) {
            const tabIndex = this.searchResults.findIndex(cat => cat.key === tabFromUrl);
            if (tabIndex !== -1) {
              this.selectedTab = tabIndex;
            } else {
              this.selectedTab = 0; // Default to first tab if specified tab not found
            }
          } else {
            this.selectedTab = 0; // Default to first tab
          }

          if (this.searchResults.length === 0) {
            this.showNoResultsMessage = true;
          } else {
            // Update URL with current tab after results are loaded
            const currentTabKey = this.searchResults[this.selectedTab]?.key || this.searchResults[0].key;
            this.updateUrlWithState(this.searchTerm.trim(), currentTabKey);
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
    this.searchInput$.next('');
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
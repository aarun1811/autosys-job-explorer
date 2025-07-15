import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Router, ActivatedRoute } from '@angular/router';

export interface SearchState {
  query: string;
  hasSearched: boolean;
  isLoading: boolean;
  isLoadingCategory: boolean;
  showNoResultsMessage: boolean;
  selectedTabIndex: number;
  isFocused: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class SearchStateService {
  private readonly initialState: SearchState = {
    query: '',
    hasSearched: false,
    isLoading: false,
    isLoadingCategory: false,
    showNoResultsMessage: false,
    selectedTabIndex: -1,
    isFocused: false
  };

  private stateSubject = new BehaviorSubject<SearchState>(this.initialState);
  public state$ = this.stateSubject.asObservable();

  constructor(
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.initializeFromUrl();
  }

  // Getters for current state
  get currentState(): SearchState {
    return this.stateSubject.value;
  }

  get query(): string {
    return this.currentState.query;
  }

  get hasSearched(): boolean {
    return this.currentState.hasSearched;
  }

  get isLoading(): boolean {
    return this.currentState.isLoading;
  }

  get isLoadingCategory(): boolean {
    return this.currentState.isLoadingCategory;
  }

  get showNoResultsMessage(): boolean {
    return this.currentState.showNoResultsMessage;
  }

  get selectedTabIndex(): number {
    return this.currentState.selectedTabIndex;
  }

  get isFocused(): boolean {
    return this.currentState.isFocused;
  }

  // State update methods
  updateQuery(query: string): void {
    this.updateState({ query });
  }

  setLoading(isLoading: boolean): void {
    this.updateState({ isLoading });
  }

  setCategoryLoading(isLoadingCategory: boolean): void {
    this.updateState({ isLoadingCategory });
  }

  setHasSearched(hasSearched: boolean): void {
    this.updateState({ hasSearched });
  }

  setShowNoResultsMessage(showNoResultsMessage: boolean): void {
    this.updateState({ showNoResultsMessage });
  }

  setSelectedTabIndex(selectedTabIndex: number): void {
    this.updateState({ selectedTabIndex });
  }

  setFocused(isFocused: boolean): void {
    this.updateState({ isFocused });
  }

  clearSearchState(): void {
    this.updateState({
      query: '',
      hasSearched: true,
      isLoading: false,
      isLoadingCategory: false,
      showNoResultsMessage: false,
      selectedTabIndex: -1
    });
  }

  resetToInitialState(): void {
    this.updateState(this.initialState);
  }

  // URL state management
  private initializeFromUrl(): void {
    this.route.queryParams.subscribe(params => {
      const queryFromUrl = params['q'];
      if (queryFromUrl && queryFromUrl !== this.query) {
        this.updateQuery(queryFromUrl);
      }
    });
  }

  updateUrlWithState(query?: string, tabKey?: string): void {
    const currentQuery = query || this.query;
    const params: any = {};

    if (currentQuery) {
      params.q = currentQuery;
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

  // Private helper method
  private updateState(partialState: Partial<SearchState>): void {
    const currentState = this.stateSubject.value;
    const newState = { ...currentState, ...partialState };
    this.stateSubject.next(newState);
  }
}

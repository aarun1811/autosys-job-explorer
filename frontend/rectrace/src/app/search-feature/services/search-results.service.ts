import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { SearchResponse, TabData, SearchCategoryResult } from '../../models/job.model';

export interface CategoryColumnState {
  loadedFields: Set<string>;
  initialHiddenFields: Set<string>;
  currentlyVisibleColumns: Set<string>;
  pendingRequestFields: Set<string>;
  isDeduplicationActive: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class SearchResultsService {
  private searchResultMapSubject = new BehaviorSubject<SearchResponse>({});
  private tabsSubject = new BehaviorSubject<TabData[]>([]);
  private hasResultsSubject = new BehaviorSubject<boolean>(false);
  private categoryColumnStatesSubject = new BehaviorSubject<{ [categoryKey: string]: CategoryColumnState }>({});

  public searchResultMap$ = this.searchResultMapSubject.asObservable();
  public tabs$ = this.tabsSubject.asObservable();
  public hasResults$ = this.hasResultsSubject.asObservable();
  public categoryColumnStates$ = this.categoryColumnStatesSubject.asObservable();

  // Getters for current state
  get searchResultMap(): SearchResponse {
    return this.searchResultMapSubject.value;
  }

  get tabs(): TabData[] {
    return this.tabsSubject.value;
  }

  get hasResults(): boolean {
    return this.hasResultsSubject.value;
  }

  get categoryColumnStates(): { [categoryKey: string]: CategoryColumnState } {
    return this.categoryColumnStatesSubject.value;
  }

  // Public methods
  updateSearchResults(searchResponse: SearchResponse): void {
    this.searchResultMapSubject.next(searchResponse);
    this.buildTabsFromResults(searchResponse);
    this.initializeCategoryColumnStates(searchResponse);
    this.updateHasResults(searchResponse);
  }

  clearSearchResults(): void {
    this.searchResultMapSubject.next({});
    this.tabsSubject.next([]);
    this.hasResultsSubject.next(false);
    this.categoryColumnStatesSubject.next({});
  }

  updateTabs(tabs: TabData[]): void {
    this.tabsSubject.next(tabs);
  }

  updateCategoryColumnStates(states: { [categoryKey: string]: CategoryColumnState }): void {
    this.categoryColumnStatesSubject.next(states);
  }

  updateCategoryColumnState(categoryKey: string, state: CategoryColumnState): void {
    const currentStates = this.categoryColumnStatesSubject.value;
    const updatedStates = { ...currentStates, [categoryKey]: state };
    this.categoryColumnStatesSubject.next(updatedStates);
  }

  getCategoryColumnState(categoryKey: string): CategoryColumnState | undefined {
    return this.categoryColumnStatesSubject.value[categoryKey];
  }

  // Private methods
  private buildTabsFromResults(searchResponse: SearchResponse): void {
    const tabs: TabData[] = [];

    Object.keys(searchResponse).forEach(categoryKey => {
      const categoryResult = searchResponse[categoryKey];
      if (categoryResult && categoryResult.data && categoryResult.data.length > 0) {
        tabs.push({
          key: categoryKey,
          label: categoryResult.config.label,
          data: categoryResult.data,
          columnDef: categoryResult.config.columns
        });
      }
    });

    this.tabsSubject.next(tabs);
  }

  private initializeCategoryColumnStates(searchResponse: SearchResponse): void {
    const states: { [categoryKey: string]: CategoryColumnState } = {};

    Object.keys(searchResponse).forEach(categoryKey => {
      const categoryResult = searchResponse[categoryKey];
      if (categoryResult && categoryResult.config) {
        const initialHiddenFields = new Set<string>();
        const currentlyVisibleColumns = new Set<string>();

        // Initialize based on column definitions
        categoryResult.config.columns.forEach(col => {
          if (col.field) {
            currentlyVisibleColumns.add(col.field);
            if (col.hide) {
              initialHiddenFields.add(col.field);
            }
          }
        });

        states[categoryKey] = {
          loadedFields: new Set<string>(),
          initialHiddenFields,
          currentlyVisibleColumns,
          pendingRequestFields: new Set<string>(),
          isDeduplicationActive: false
        };
      }
    });

    this.categoryColumnStatesSubject.next(states);
  }

  private updateHasResults(searchResponse: SearchResponse): void {
    const hasResults = Object.keys(searchResponse).some(categoryKey => {
      const categoryResult = searchResponse[categoryKey];
      return categoryResult && categoryResult.data && categoryResult.data.length > 0;
    });

    this.hasResultsSubject.next(hasResults);
  }
}

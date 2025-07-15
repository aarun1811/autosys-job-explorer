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

  public searchResultMap$ = this.searchResultMapSubject.asObservable();
  public tabs$ = this.tabsSubject.asObservable();
  public hasResults$ = this.hasResultsSubject.asObservable();

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

  // Public methods
  updateSearchResults(searchResponse: SearchResponse): void {
    this.searchResultMapSubject.next(searchResponse);
    this.buildTabsFromResults(searchResponse);
    this.updateHasResults(searchResponse);
  }

  clearSearchResults(): void {
    this.searchResultMapSubject.next({});
    this.tabsSubject.next([]);
    this.hasResultsSubject.next(false);
  }

  updateTabs(tabs: TabData[]): void {
    this.tabsSubject.next(tabs);
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

  private updateHasResults(searchResponse: SearchResponse): void {
    const hasResults = Object.keys(searchResponse).some(categoryKey => {
      const categoryResult = searchResponse[categoryKey];
      return categoryResult && categoryResult.data && categoryResult.data.length > 0;
    });

    this.hasResultsSubject.next(hasResults);
  }
}

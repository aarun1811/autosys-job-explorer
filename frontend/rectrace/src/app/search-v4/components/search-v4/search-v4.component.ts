import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { SearchServiceV4, CategoryResultV4 } from '../../../services/search-v4.service';

@Component({
  selector: 'app-search-v4',
  templateUrl: './search-v4.component.html',
  styleUrls: ['./search-v4.component.css']
})
export class SearchV4Component implements OnInit, OnDestroy {
  searchTerm: string = '';
  searchResults: CategoryResultV4[] = [];
  selectedTab: number = 0;
  isLoading: boolean = false;
  errorMessage: string = '';
  private destroy$ = new Subject<void>();
  
  constructor(private searchServiceV4: SearchServiceV4) {}
  
  ngOnInit(): void {
    // Initialize component
    console.log('SearchV4Component initialized');
  }
  
  performSearch(): void {
    if (!this.searchTerm || !this.searchTerm.trim()) {
      this.errorMessage = 'Please enter a search term';
      return;
    }
    
    this.errorMessage = '';
    this.isLoading = true;
    this.searchResults = [];
    
    this.searchServiceV4.performInitialSearch(this.searchTerm.trim())
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
            this.errorMessage = 'No results found for your search';
          }
          
          console.log('Search completed. Categories with results:', this.searchResults.length);
        },
        error: (error) => {
          console.error('Search failed', error);
          this.isLoading = false;
          this.errorMessage = 'Search failed. Please try again.';
        }
      });
  }
  
  onKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      this.performSearch();
    }
  }
  
  clearSearch(): void {
    this.searchTerm = '';
    this.searchResults = [];
    this.errorMessage = '';
  }
  
  getTabLabel(category: CategoryResultV4): string {
    const countText = category.hasMore ? `${category.count}+` : `${category.count}`;
    return `${category.label} (${countText})`;
  }
  
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
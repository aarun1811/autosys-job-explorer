import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject, Observable } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { CategoryColumnState } from './search-results.service';

export interface ColumnVisibilityEvent {
  categoryKey: string;
  columnField: string;
  isVisible: boolean;
}

export interface BatchedColumnRequest {
  categoryKey: string;
  fieldName: string;
  isVisible: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ColumnVisibilityService {
  private columnToggleRequests$ = new Subject<ColumnVisibilityEvent>();
  private batchedRequestsSubject = new BehaviorSubject<BatchedColumnRequest[]>([]);

  public batchedRequests$ = this.batchedRequestsSubject.asObservable();

  constructor() {
    this.initializeBatchedRequests();
  }

  private initializeBatchedRequests(): void {
    this.columnToggleRequests$.pipe(
      debounceTime(750)
    ).subscribe(() => {
      this.processBatchedColumnRequests();
    });
  }

  // Public methods
  handleColumnVisibilityChange(event: ColumnVisibilityEvent): void {
    this.columnToggleRequests$.next(event);
  }

    updateCategoryColumnState(
    categoryKey: string,
    currentState: CategoryColumnState,
    columnField: string,
    isVisible: boolean
  ): CategoryColumnState {
    const updatedState = { ...currentState };

    if (isVisible) {
      updatedState.currentlyVisibleColumns.add(columnField);
      updatedState.pendingRequestFields.add(columnField);
    } else {
      updatedState.currentlyVisibleColumns.delete(columnField);
      updatedState.pendingRequestFields.delete(columnField);
    }

    return updatedState;
  }

  getPendingFieldsForCategory(categoryKey: string, currentState: CategoryColumnState): string[] {
    return Array.from(currentState.pendingRequestFields);
  }

  clearPendingFieldsForCategory(categoryKey: string, currentState: CategoryColumnState): CategoryColumnState {
    const updatedState = { ...currentState };
    updatedState.pendingRequestFields.clear();
    return updatedState;
  }

  markFieldsAsLoaded(categoryKey: string, currentState: CategoryColumnState, fields: string[]): CategoryColumnState {
    const updatedState = { ...currentState };
    fields.forEach(field => {
      updatedState.loadedFields.add(field);
      updatedState.pendingRequestFields.delete(field);
    });
    return updatedState;
  }

  // Private methods
  private processBatchedColumnRequests(): void {
    // This method will be called when batched requests are ready to be processed
    // The actual implementation will depend on how the SearchComponent handles batched requests
    const requests = this.batchedRequestsSubject.value;
    if (requests.length > 0) {
      // Process the batched requests
      this.batchedRequestsSubject.next([]);
    }
  }

  // Helper methods for column state management
  isColumnVisible(categoryKey: string, columnField: string, currentState: CategoryColumnState): boolean {
    return currentState.currentlyVisibleColumns.has(columnField);
  }

  isFieldLoaded(categoryKey: string, columnField: string, currentState: CategoryColumnState): boolean {
    return currentState.loadedFields.has(columnField);
  }

  hasPendingRequests(categoryKey: string, currentState: CategoryColumnState): boolean {
    return currentState.pendingRequestFields.size > 0;
  }

  getVisibleColumnsForCategory(categoryKey: string, currentState: CategoryColumnState): string[] {
    return Array.from(currentState.currentlyVisibleColumns);
  }

  getLoadedFieldsForCategory(categoryKey: string, currentState: CategoryColumnState): string[] {
    return Array.from(currentState.loadedFields);
  }

  getPendingFieldsForCategoryArray(categoryKey: string, currentState: CategoryColumnState): string[] {
    return Array.from(currentState.pendingRequestFields);
  }
}

import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { JobData } from '../../models/job.model';

export interface GridState {
  isCompactView: boolean;
  isDeduplicated: boolean;
  originalRowData: (JobData | null | undefined)[];
  isProgrammaticChange: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class GridStateService {
  private stateSubject = new BehaviorSubject<GridState>({
    isCompactView: false,
    isDeduplicated: false,
    originalRowData: [],
    isProgrammaticChange: false
  });

  public state$: Observable<GridState> = this.stateSubject.asObservable();

  constructor() {}

  // Getters for current state
  get isCompactView(): boolean {
    return this.stateSubject.value.isCompactView;
  }

  get isDeduplicated(): boolean {
    return this.stateSubject.value.isDeduplicated;
  }

  get originalRowData(): (JobData | null | undefined)[] {
    return this.stateSubject.value.originalRowData;
  }

  get isProgrammaticChange(): boolean {
    return this.stateSubject.value.isProgrammaticChange;
  }

  // State update methods
  setCompactView(isCompact: boolean): void {
    this.updateState({ isCompactView: isCompact });
  }

  setDeduplicated(isDeduplicated: boolean): void {
    this.updateState({ isDeduplicated });
  }

  setOriginalRowData(data: (JobData | null | undefined)[]): void {
    this.updateState({ originalRowData: [...data] });
  }

  setProgrammaticChange(isProgrammatic: boolean): void {
    this.updateState({ isProgrammaticChange: isProgrammatic });
  }

  // Reset state
  resetState(): void {
    this.stateSubject.next({
      isCompactView: false,
      isDeduplicated: false,
      originalRowData: [],
      isProgrammaticChange: false
    });
  }

  private updateState(partialState: Partial<GridState>): void {
    const currentState = this.stateSubject.value;
    this.stateSubject.next({ ...currentState, ...partialState });
  }
}

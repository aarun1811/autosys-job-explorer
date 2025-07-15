import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { SearchService } from '../../services/search.service';

@Injectable({
  providedIn: 'root'
})
export class SearchInputService {
  private queryInput$ = new Subject<string>();
  private placeholderIndex = 0;
  private isAnimating = false;

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

  public suggestions$!: Observable<string[]>;
  public currentPlaceholder$ = new BehaviorSubject<string>('');
  public tryButtonText$ = new BehaviorSubject<string>('');

  constructor(private searchService: SearchService) {
    this.initializeSuggestions();
    this.updateTryButtonText();
  }

  private initializeSuggestions(): void {
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
  }

  // Public methods
  onQueryInputChange(query: string): void {
    this.queryInput$.next(query);
  }

  startPlaceholderCycle(): void {
    if (this.isAnimating) return;

    this.isAnimating = true;
    this.cyclePlaceholder();
  }

  stopPlaceholderCycle(): void {
    this.isAnimating = false;
  }

  updateTryButtonText(): void {
    const randomItem = this.tryButtonTexts[Math.floor(Math.random() * this.tryButtonTexts.length)];
    this.tryButtonText$.next(randomItem.name);
  }

  getCurrentTryButtonText(): string {
    return this.tryButtonText$.value;
  }

  getCurrentPlaceholder(): string {
    return this.currentPlaceholder$.value;
  }

  // Private methods
  private cyclePlaceholder(): void {
    if (!this.isAnimating) return;

    this.currentPlaceholder$.next(this.placeholders[this.placeholderIndex]);
    this.placeholderIndex = (this.placeholderIndex + 1) % this.placeholders.length;

    setTimeout(() => {
      if (this.isAnimating) {
        this.cyclePlaceholder();
      }
    }, 3000);
  }
}

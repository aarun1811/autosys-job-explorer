import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { DateRange } from '../../../../../../services/tlm-stats-v2.service';
import { FilterState } from '../../tlm-stats-modal-v2.component';

@Component({
  selector: 'app-tlm-filters-v2',
  templateUrl: './tlm-filters-v2.component.html',
  styleUrls: ['./tlm-filters-v2.component.css']
})
export class TlmFiltersV2Component implements OnInit {
  
  @Input() filterState!: FilterState;
  @Input() isLoadingRecons: boolean = false;
  @Input() isLoadingSetIds: boolean = false;
  
  @Output() reconSelectionChange = new EventEmitter<string[]>();
  @Output() setIdSelectionChange = new EventEmitter<string[]>();
  @Output() dateRangeChange = new EventEmitter<DateRange>();
  @Output() clearFilters = new EventEmitter<void>();
  @Output() applyFilters = new EventEmitter<void>();

  // Constants
  DateRange = DateRange;
  
  // Date range options
  dateRangeOptions = [
    { value: DateRange.ONE_DAY, label: 'Last 1 Day', description: 'Last business day' },
    { value: DateRange.SEVEN_DAYS, label: 'Last 7 Days', description: 'Last 7 calendar days' },
    { value: DateRange.THIRTY_DAYS, label: 'Last 30 Days', description: 'Last 30 calendar days' }
  ];

  constructor() { }

  ngOnInit(): void {
    // Component initialization
  }

  onReconSelectionChange(): void {
    this.reconSelectionChange.emit([...this.filterState.selectedRecons]);
  }

  onSetIdSelectionChange(): void {
    this.setIdSelectionChange.emit([...this.filterState.selectedSetIds]);
  }

  onDateRangeSelectionChange(dateRange: DateRange): void {
    this.dateRangeChange.emit(dateRange);
  }

  onClearFiltersClick(): void {
    this.clearFilters.emit();
  }

  onApplyFiltersClick(): void {
    this.applyFilters.emit();
  }

  // Helper methods
  getSelectedReconsText(): string {
    const count = this.filterState.selectedRecons.length;
    if (count === 0) return 'Select recons';
    if (count === 1) return this.filterState.selectedRecons[0];
    return `${count} recons selected`;
  }

  getSelectedSetIdsText(): string {
    const count = this.filterState.selectedSetIds.length;
    if (count === 0) return 'Select set IDs';
    if (count === 1) return this.filterState.selectedSetIds[0];
    return `${count} set IDs selected`;
  }

  canClearFilters(): boolean {
    return (!this.filterState.reconLocked && this.filterState.selectedRecons.length > 0) ||
           (!this.filterState.setIdLocked && this.filterState.selectedSetIds.length > 0) ||
           this.filterState.dateRange !== DateRange.ONE_DAY;
  }
}
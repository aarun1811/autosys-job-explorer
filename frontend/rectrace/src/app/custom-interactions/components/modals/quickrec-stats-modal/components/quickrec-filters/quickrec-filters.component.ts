import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

@Component({
  selector: 'app-quickrec-filters',
  templateUrl: './quickrec-filters.component.html',
  styleUrls: ['./quickrec-filters.component.scss']
})
export class QuickRecFiltersComponent implements OnInit {
  @Input() initialReconId?: string;
  @Input() initialRecPortalId?: string;
  @Input() entryPoint: 'recon_id' | 'rec_portal_id' = 'recon_id';
  
  @Output() dateRangeChange = new EventEmitter<number>();
  @Output() filterChange = new EventEmitter<any>();
  
  filterForm: FormGroup;
  dateRangeOptions = [
    { value: 1, label: '1 Day' },
    { value: 7, label: '7 Days' },
    { value: 30, label: '30 Days' }
  ];
  
  selectedDateRange = 1;
  
  constructor(private fb: FormBuilder) {
    this.filterForm = this.fb.group({
      reconId: [''],
      recPortalId: ['']
    });
  }
  
  ngOnInit(): void {
    // Set initial values
    if (this.initialReconId) {
      this.filterForm.patchValue({ reconId: this.initialReconId });
    }
    if (this.initialRecPortalId) {
      this.filterForm.patchValue({ recPortalId: this.initialRecPortalId });
    }
    
    // Listen for form changes
    this.filterForm.valueChanges
      .pipe(
        debounceTime(500),
        distinctUntilChanged()
      )
      .subscribe(values => {
        this.filterChange.emit(values);
      });
  }
  
  onDateRangeSelect(dateRange: number): void {
    this.selectedDateRange = dateRange;
    this.dateRangeChange.emit(dateRange);
  }
  
  clearFilters(): void {
    this.filterForm.reset();
    this.selectedDateRange = 1;
    this.dateRangeChange.emit(1);
    this.filterChange.emit({
      reconId: '',
      recPortalId: ''
    });
  }
  
  isDateRangeSelected(value: number): boolean {
    return this.selectedDateRange === value;
  }
}
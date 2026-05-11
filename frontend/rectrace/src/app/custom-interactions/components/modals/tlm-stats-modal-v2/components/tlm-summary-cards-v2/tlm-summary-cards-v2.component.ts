import { Component, Input, OnInit } from '@angular/core';
import { DashboardSummary } from '../../../../../../services/tlm-stats-v2.service';

@Component({
  selector: 'app-tlm-summary-cards-v2',
  templateUrl: './tlm-summary-cards-v2.component.html',
  styleUrls: ['./tlm-summary-cards-v2.component.scss']
})
export class TlmSummaryCardsV2Component implements OnInit {

  @Input() summary: DashboardSummary | null = null;
  @Input() isLoading: boolean = false;
  @Input() hasError: boolean = false;

  constructor() { }

  ngOnInit(): void {
    // Component initialization
  }

  // Utility methods for formatting
  formatNumber(value: number | undefined): string {
    if (value === undefined || value === null) return '0';
    return value.toLocaleString();
  }

  formatPercentage(value: number | undefined): string {
    if (value === undefined || value === null) return '0.0%';
    return `${value.toFixed(1)}%`;
  }

  // Get appropriate icon for each metric type
  getCardIcon(cardType: string): string {
    switch (cardType) {
      case 'total':
        return 'dashboard';
      case 'breaks':
        return 'warning';
      case 'automatch':
        return 'auto_fix_high';
      case 'manual':
        return 'touch_app';
      default:
        return 'analytics';
    }
  }

  // Get appropriate color class for each metric type
  getCardColorClass(cardType: string): string {
    switch (cardType) {
      case 'total':
        return 'card-primary';
      case 'breaks':
        return 'card-warning';
      case 'automatch':
        return 'card-success';
      case 'manual':
        return 'card-info';
      default:
        return 'card-default';
    }
  }
}
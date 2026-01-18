import { Component, Input } from '@angular/core';
import { QuickRecDashboardSummary } from 'src/app/services/quickrec-stats.service';

@Component({
  selector: 'app-quickrec-summary',
  templateUrl: './quickrec-summary.component.html',
  styleUrls: ['./quickrec-summary.component.css']
})
export class QuickRecSummaryComponent {
  @Input() summary: QuickRecDashboardSummary | null = null;
  
  getSummaryCards() {
    if (!this.summary) return [];
    
    return [
      {
        title: 'Left Side',
        items: [
          { label: 'Total Records', value: this.summary.totalLeftRecords, icon: 'description' },
          { label: 'Breaks', value: this.summary.totalLeftBreaks, percentage: this.summary.leftBreakPercentage, icon: 'warning', color: 'warn' },
          { label: 'Auto Matches', value: this.summary.totalLeftAutoMatches, percentage: this.summary.leftAutoMatchPercentage, icon: 'check_circle', color: 'primary' },
          { label: 'Manual Matches', value: this.summary.totalLeftManualMatches, percentage: this.summary.leftManualMatchPercentage, icon: 'pan_tool', color: 'accent' }
        ]
      },
      {
        title: 'Right Side',
        items: [
          { label: 'Total Records', value: this.summary.totalRightRecords, icon: 'description' },
          { label: 'Breaks', value: this.summary.totalRightBreaks, percentage: this.summary.rightBreakPercentage, icon: 'warning', color: 'warn' },
          { label: 'Auto Matches', value: this.summary.totalRightAutoMatches, percentage: this.summary.rightAutoMatchPercentage, icon: 'check_circle', color: 'primary' },
          { label: 'Manual Matches', value: this.summary.totalRightManualMatches, percentage: this.summary.rightManualMatchPercentage, icon: 'pan_tool', color: 'accent' }
        ]
      }
    ];
  }
  
  formatNumber(value: number): string {
    return value.toLocaleString();
  }
  
  formatPercentage(value: number): string {
    return value.toFixed(2) + '%';
  }
}
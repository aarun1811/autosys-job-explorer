import { Component, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { DashboardSummary } from '../../../../../../services/tlm-stats-v2.service';

interface ChartData {
  category: string;
  value: number;
  percentage: number;
  color: string;
}

@Component({
  selector: 'app-tlm-pie-chart-v2',
  templateUrl: './tlm-pie-chart-v2.component.html',
  styleUrls: ['./tlm-pie-chart-v2.component.css']
})
export class TlmPieChartV2Component implements OnInit, OnChanges {
  
  @Input() summary: DashboardSummary | null = null;
  @Input() isLoading: boolean = false;
  @Input() hasError: boolean = false;
  @Input() isDarkTheme: boolean = false;

  chartData: ChartData[] = [];

  constructor() { }

  ngOnInit(): void {
    this.updateChartData();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['summary'] || changes['isDarkTheme']) {
      this.updateChartData();
    }
  }

  private updateChartData(): void {
    if (!this.summary || this.summary.total_items === 0) {
      this.chartData = [];
      return;
    }

    this.chartData = [
      {
        category: 'Breaks',
        value: this.summary.total_breaks,
        percentage: this.summary.breaks_percentage,
        color: this.getColorValue('--google-yellow')
      },
      {
        category: 'Automatch',
        value: this.summary.total_automatch_items,
        percentage: this.summary.automatch_percentage,
        color: this.getColorValue('--google-green')
      },
      {
        category: 'Manual Match',
        value: this.summary.total_manual_match_items,
        percentage: this.summary.manual_match_percentage,
        color: this.getColorValue('--google-purple')
      }
    ].filter(item => item.value > 0); // Only show categories with data
  }

  private getColorValue(cssVariable: string): string {
    // Define fallback colors for chart
    const colorMap: { [key: string]: string } = {
      '--google-yellow': '#fbbc04',
      '--google-green': '#34a853',
      '--google-purple': '#8e24aa',
      '--google-blue': '#4285f4',
      '--google-red': '#ea4335'
    };

    try {
      const computedValue = getComputedStyle(document.documentElement)
        .getPropertyValue(cssVariable)
        .trim();
      return computedValue || colorMap[cssVariable] || '#4285f4';
    } catch {
      return colorMap[cssVariable] || '#4285f4';
    }
  }

  // Export chart as image - simplified for CSS chart
  exportChartAsImage(format: 'png' | 'jpg' = 'png'): void {
    // For now, just log the export request
    // Could be implemented with html2canvas or similar library
    console.log(`Export chart as ${format} requested`);
    alert(`Chart export as ${format.toUpperCase()} - Feature coming soon!`);
  }

  // Check if chart has data
  hasData(): boolean {
    return this.chartData.length > 0 && this.chartData.some(item => item.value > 0);
  }

  // Get total items for display
  getTotalItems(): number {
    return this.chartData.reduce((sum, item) => sum + item.value, 0);
  }
}
import { Component, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { DashboardSummary } from '../../../../../../services/tlm-stats-v2.service';

@Component({
  selector: 'app-tlm-pie-chart-v2',
  templateUrl: './tlm-pie-chart-v2.component.html',
  styleUrls: ['./tlm-pie-chart-v2.component.scss']
})
export class TlmPieChartV2Component implements OnInit, OnChanges {

  @Input() summary: DashboardSummary | null = null;
  @Input() isLoading: boolean = false;
  @Input() hasError: boolean = false;
  @Input() isDarkTheme: boolean = false;

  chartOptions: any = {};
  hasChartData: boolean = false;

  constructor() { }

  ngOnInit(): void {
    this.updateChart();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['summary'] || changes['isDarkTheme']) {
      this.updateChart();
    }
  }

  private updateChart(): void {
    if (!this.summary || this.summary.total_items === 0) {
      this.hasChartData = false;
      return;
    }

    // Define a mapping of categories to their fixed colors.
    const categoryColors: { [key: string]: string } = {
      'Breaks': '#fbbc04',
      'Automatch': '#34a853',
      'Manual Match': '#8e24aa'
    };

    const chartData = [
      {
        category: 'Breaks',
        value: this.summary.total_breaks,
        percentage: this.summary.breaks_percentage
      },
      {
        category: 'Automatch',
        value: this.summary.total_automatch_items,
        percentage: this.summary.automatch_percentage
      },
      {
        category: 'Manual Match',
        value: this.summary.total_manual_match_items,
        percentage: this.summary.manual_match_percentage
      }
    ].filter(item => item.value > 0);

    // Create the fills array dynamically based on the filtered data.
    const dynamicFills = chartData.map(item => categoryColors[item.category as keyof typeof categoryColors]);

    this.hasChartData = chartData.length > 0;

    if (!this.hasChartData) {
      return;
    }

    const textColor = this.isDarkTheme ? '#e0e0e0' : '#333333';
    const backgroundColor = this.isDarkTheme ? '#1e1e1e' : '#ffffff';
    const gridLineColor = this.isDarkTheme ? '#424242' : '#e0e0e0';

    this.chartOptions = {
      theme: this.isDarkTheme ? 'ag-default-dark' : 'ag-default',
      background: {
        fill: backgroundColor
      },
      data: chartData,
      series: [
        {
          type: 'pie',
          angleKey: 'value',
          labelKey: 'category',
          calloutLabelKey: 'category',
          sectorLabelKey: 'percentage',
          calloutLabel: {
            enabled: true,
            fontWeight: '500',
            fontSize: 11,
            color: textColor
          },
          sectorLabel: {
            enabled: true,
            formatter: (params: any) => {
              return `${params.value.toFixed(1)}%`;
            },
            fontWeight: 'bold',
            fontSize: 12,
            color: '#ffffff'
          },
          tooltip: {
            renderer: (params: any) => {
              return {
                title: params.datum.category,
                content: `${params.datum.value.toLocaleString()} items (${params.datum.percentage.toFixed(1)}%)`
              };
            }
          },
          fills: dynamicFills,
          strokes: dynamicFills,
          strokeWidth: 2,
          shadow: {
            enabled: true,
            blur: 5,
            xOffset: 2,
            yOffset: 2,
            color: 'rgba(0, 0, 0, 0.1)'
          },
          highlightStyle: {
            item: {
              fill: undefined,
              stroke: undefined,
              strokeWidth: 3
            }
          },
          innerRadiusRatio: 0.5
        }
      ],
      legend: {
        enabled: true,
        position: 'bottom',
        spacing: 20,
        item: {
          label: {
            fontWeight: '500',
            fontSize: 12,
            color: textColor
          },
          marker: {
            size: 15,
            strokeWidth: 2
          }
        }
      },
      padding: {
        top: 20,
        right: 20,
        bottom: 20,
        left: 20
      }
    };
  }

  hasData(): boolean {
    return this.hasChartData;
  }

  getTotalItems(): number {
    return this.summary ? this.summary.total_items : 0;
  }

  exportChartAsImage(format: 'png' | 'jpg' = 'png'): void {
    console.log(`Export chart as ${format} requested`);
    alert(`Chart export as ${format.toUpperCase()} - Feature coming soon!`);
  }
}
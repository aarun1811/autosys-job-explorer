import { Component, AfterViewInit, ElementRef, ViewChild, Input, Output, EventEmitter, OnDestroy } from '@angular/core';
import type { Core, NodeSingular, CytoscapeOptions } from 'cytoscape';
import cytoscape from 'cytoscape';
import dagre from 'cytoscape-dagre';
import { ThemeService } from '../../../../services/theme.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { JobStatusInfo, VisualState } from 'src/app/services/execution-order.service';

// Register the dagre layout
cytoscape.use(dagre);

interface JobNode {
  jobName: string;
  loadJob: string;
  executionOrder: number;
}

interface JobDetails {
  jobType: string;
  machine: string;
  runCalendar: string;
  excludeCalendar: string;
  boxName: string;
  command: string;
  description: string;
}

// Status color configuration for light and dark themes
interface StatusColors {
  bg: string;
  border: string;
  text: string;
  icon: string;
}

const STATUS_COLORS: { light: Record<VisualState, StatusColors>; dark: Record<VisualState, StatusColors> } = {
  light: {
    COMPLETED: { bg: '#e6f4ea', border: '#34a853', text: '#1e4620', icon: 'check_circle' },
    FAILED: { bg: '#fce8e6', border: '#ea4335', text: '#8b1a1a', icon: 'error' },
    RUNNING: { bg: '#e8f0fe', border: '#1a73e8', text: '#1a4f8b', icon: 'play_circle' },
    WAITING: { bg: '#fef7e0', border: '#f9ab00', text: '#7a5c00', icon: 'schedule' },
    INACTIVE: { bg: '#f1f3f4', border: '#9aa0a6', text: '#5f6368', icon: 'pause_circle' }
  },
  dark: {
    COMPLETED: { bg: '#1e3a2f', border: '#81c995', text: '#81c995', icon: 'check_circle' },
    RUNNING: { bg: '#1e3a5f', border: '#8ab4f8', text: '#8ab4f8', icon: 'play_circle' },
    FAILED: { bg: '#3c2a2a', border: '#f28b82', text: '#f28b82', icon: 'error' },
    WAITING: { bg: '#3c3520', border: '#fdd663', text: '#fdd663', icon: 'schedule' },
    INACTIVE: { bg: '#303134', border: '#9aa0a6', text: '#9aa0a6', icon: 'pause_circle' }
  }
}

@Component({
  selector: 'app-execution-order-graph',
  templateUrl: './execution-order-graph.component.html',
  styleUrls: ['./execution-order-graph.component.scss']
})
export class ExecutionOrderGraphComponent implements AfterViewInit, OnDestroy {
  @ViewChild('cy') private readonly cyElement!: ElementRef;
  @Input() executionSequence: JobNode[] = [];
  @Input() jobDetails: { [key: string]: JobDetails } = {};
  @Input() jobStatuses: { [key: string]: JobStatusInfo } = {};
  @Input() statusAvailable: boolean = true;
  @Input() loadJob: string = '';
  @Output() nodeSelected = new EventEmitter<{
    jobName: string | undefined | null;
    details: JobDetails | undefined | null;
    status: JobStatusInfo | undefined | null;
  }>();

  private cy: Core | undefined;
  private selectedNode: NodeSingular | null = null;
  public currentZoom: number = 1;
  public zoomStep: number = 0.1;
  private destroy$ = new Subject<void>();
  private isDarkMode = false;

  constructor(private themeService: ThemeService) { }

  ngAfterViewInit() {
    // Subscribe to theme changes
    this.themeService.getTheme()
      .pipe(takeUntil(this.destroy$))
      .subscribe(theme => {
        this.isDarkMode = theme === 'dark';
        if (this.cy) {
          this.updateGraphTheme();
        }
      });

    this.renderGraph();
    // Set initial zoom using calculation
    if (this.cy) {
      const initialZoom = this.calculateInitialZoom();
      this.cy.zoom(initialZoom);
      this.cy.center();
      this.currentZoom = initialZoom;
      this.updateZoomDisplay();
    }
  }

  private updateGraphTheme() {
    if (!this.cy) return;

    // Update styles based on theme
    this.cy.style()
      .selector('node')
      .style({
        'background-color': this.isDarkMode ? '#303134' : '#E8F0FE',
        'color': this.isDarkMode ? '#8ab4f8' : '#1A73E8',
        'border-color': this.isDarkMode ? '#5f6368' : '#E8EAED',
      })
      .selector('edge')
      .style({
        'line-color': this.isDarkMode ? '#5f6368' : '#A8C7FA',
        'target-arrow-color': this.isDarkMode ? '#5f6368' : '#A8C7FA',
      })
      .selector('node:selected')
      .style({
        'background-color': this.isDarkMode ? '#8ab4f8' : '#1A73E8',
        'color': this.isDarkMode ? '#202124' : '#FFFFFF',
        'border-color': this.isDarkMode ? '#aecbfa' : '#1557B0',
      })
      .selector('node.hover')
      .style({
        'background-color': this.isDarkMode ? '#394457' : '#F1F7FE',
        'border-color': this.isDarkMode ? '#8ab4f8' : '#1A73E8',
      })
      .selector('edge.hover')
      .style({
        'line-color': this.isDarkMode ? '#8ab4f8' : '#1A73E8',
        'target-arrow-color': this.isDarkMode ? '#8ab4f8' : '#1A73E8',
      })
      .selector('edge:selected')
      .style({
        'line-color': this.isDarkMode ? '#8ab4f8' : '#1A73E8',
        'target-arrow-color': this.isDarkMode ? '#8ab4f8' : '#1A73E8',
      })
      .update();
  }

  private renderGraph() {
    const elements = [...this.getNodes(), ...this.getEdges()];

    const config: CytoscapeOptions = {
      container: this.cyElement.nativeElement,
      elements: elements,
      style: [
        {
          selector: 'node',
          style: {
            // Use data-driven colors when status is available
            'background-color': (ele: any) => {
              if (this.statusAvailable && ele.data('statusBg')) {
                return ele.data('statusBg');
              }
              return this.isDarkMode ? '#303134' : '#E8F0FE';
            },
            // Multi-line label: job name + status
            'label': (ele: any) => {
              const name = ele.data('label');
              const status = ele.data('statusLabel');
              return status ? `${name}\n(${status})` : name;
            },
            'text-valign': 'center',
            'color': (ele: any) => {
              if (this.statusAvailable && ele.data('statusText')) {
                return ele.data('statusText');
              }
              return this.isDarkMode ? '#8ab4f8' : '#1A73E8';
            },
            'font-family': 'Google Sans, sans-serif',
            'font-size': '12px',
            'font-weight': 500,
            'text-wrap': 'wrap',
            'line-height': 1.3,
            'text-max-width': (ele: any) => Math.max(120, ele.data('label').length * 8) - 6 + 'px',
            'width': (ele: any) => Math.max(120, ele.data('label').length * 8) + 'px',
            'height': (ele: any) => ele.data('statusLabel') ? '44px' : '32px',
            'padding': '4px 12px',
            'shape': 'round-rectangle',
            'border-width': 2,
            'border-color': (ele: any) => {
              if (this.statusAvailable && ele.data('statusBorder')) {
                return ele.data('statusBorder');
              }
              return this.isDarkMode ? '#5f6368' : '#E8EAED';
            },
            'border-opacity': 1,
            'border-style': 'solid',
            'background-opacity': 1,
            'transition-property': 'background-color, border-color, border-opacity',
            'transition-duration': 200
          }
        },
        {
          selector: 'edge',
          style: {
            'curve-style': 'bezier',
            'width': 2,
            'line-color': this.isDarkMode ? '#5f6368' : '#A8C7FA',
            'target-arrow-shape': 'triangle',
            'target-arrow-color': this.isDarkMode ? '#5f6368' : '#A8C7FA',
            'arrow-scale': 0.8,
            'opacity': 0.9,
          }
        },
        {
          selector: 'node:selected',
          style: {
            'background-color': this.isDarkMode ? '#8ab4f8' : '#1A73E8',
            'color': this.isDarkMode ? '#202124' : '#FFFFFF',
            'border-color': this.isDarkMode ? '#aecbfa' : '#1557B0',
            'border-width': 1,
            'border-opacity': 1,
            'z-index': 10
          }
        },
        {
          selector: 'node.hover',
          style: {
            'background-color': this.isDarkMode ? '#394457' : '#F1F7FE',
            'border-color': this.isDarkMode ? '#8ab4f8' : '#1A73E8',
            'border-opacity': 0.8,
            'z-index': 5
          }
        },
        {
          selector: 'edge.hover',
          style: {
            'width': 2,
            'line-color': this.isDarkMode ? '#8ab4f8' : '#1A73E8',
            'target-arrow-color': this.isDarkMode ? '#8ab4f8' : '#1A73E8',
            'opacity': 1
          }
        },
        {
          selector: 'edge:selected',
          style: {
            'width': 2,
            'line-color': this.isDarkMode ? '#8ab4f8' : '#1A73E8',
            'target-arrow-color': this.isDarkMode ? '#8ab4f8' : '#1A73E8',
            'opacity': 1,
            'z-index': 9
          }
        }
      ],
      layout: {
        name: 'dagre',
        ...({
          rankDir: 'TB',
          nodeSep: 30,
          edgeSep: 20,
          rankSep: 50,
          align: 'UL',
          acyclicer: 'greedy',
          padding: 20
        } as any)
      },
      zoomingEnabled: true,
      userZoomingEnabled: false,
      panningEnabled: true,
      userPanningEnabled: true,
      autoungrabify: false,
      boxSelectionEnabled: false,
      wheelSensitivity: 0.2,
      minZoom: 0.1,
      maxZoom: 3
    };

    this.cy = cytoscape(config);
    this.cy.ready(() => {
      console.log('Cytoscape graph loaded with elements:', this.cy?.elements().length);

      // Update zoom level
      this.updateZoomDisplay();
    });

    // Event handling for mouseover/out with classes for consistent styling
    this.cy.on('mouseover', 'node', (event) => {
      const node = event.target;
      if (!node.selected()) {
        node.addClass('hover');
      }
    });

    this.cy.on('mouseout', 'node', (event) => {
      const node = event.target;
      node.removeClass('hover');
    });

    this.cy.on('mouseover', 'edge', (event) => {
      const edge = event.target;
      edge.addClass('hover');
    });

    this.cy.on('mouseout', 'edge', (event) => {
      const edge = event.target;
      edge.removeClass('hover');
    });

    // Selection handling
    this.cy.on('select', 'node', (event) => {
      const node = event.target as NodeSingular;
      this.selectedNode = node;
      const jobName = node.data('id');
      const details = this.jobDetails[jobName];
      // Look up status (case-insensitive)
      const statusKey = Object.keys(this.jobStatuses || {}).find(
        key => key.toLowerCase() === jobName.toLowerCase()
      );
      const status = statusKey ? this.jobStatuses[statusKey] : null;
      this.nodeSelected.emit({ jobName, details, status });
    });

    this.cy.on('unselect', 'node', (event) => {
      this.selectedNode = null;
      this.nodeSelected.emit({ jobName: null, details: null, status: null });
    });

    // Handle trackpad and mouse wheel events
    const container = this.cy.container();
    if (container) {
      // Trackpad panning
      container.addEventListener('wheel', (event: any) => {
        event.preventDefault();

        // Handle panning for both trackpad and mouse wheel
        const deltaX = event.deltaX ?? 0;
        const deltaY = event.deltaY ?? 0;

        // Adjust sensitivity for trackpad
        const sensitivity = 0.5;

        this.cy?.panBy({
          x: deltaX * sensitivity,
          y: deltaY * sensitivity
        });
      });
    }

    // Update zoom display when zoom changes
    this.cy.on('zoom', () => {
      this.currentZoom = this.cy?.zoom() ?? 1;
      this.updateZoomDisplay();
    });
  }

  private updateZoomDisplay() {
    this.currentZoom = this.cy?.zoom() ?? 1;
  }

  private getStatusColors(visualState: VisualState): StatusColors {
    const theme = this.isDarkMode ? 'dark' : 'light';
    return STATUS_COLORS[theme][visualState] || STATUS_COLORS[theme].INACTIVE;
  }

  private getNodes() {
    return this.executionSequence.map(job => {
      // Look up status by job name (case-insensitive)
      const statusKey = Object.keys(this.jobStatuses || {}).find(
        key => key.toLowerCase() === job.jobName.toLowerCase()
      );
      const status = statusKey ? this.jobStatuses[statusKey] : null;
      const visualState: VisualState = status?.visualState || 'INACTIVE';
      const colors = this.getStatusColors(visualState);

      return {
        data: {
          id: job.jobName,
          label: job.jobName,
          statusLabel: this.statusAvailable && status ? status.statusName : '',
          executionOrder: job.executionOrder,
          type: job.jobName === this.loadJob ? 'loadJob' : 'regularJob',
          visualState: visualState,
          statusBg: colors.bg,
          statusBorder: colors.border,
          statusText: colors.text,
          statusIcon: colors.icon
        }
      };
    });
  }

  private getEdges() {
    const edges = [];
    for (let i = 0; i < this.executionSequence.length - 1; i++) {
      edges.push({
        data: {
          id: `${this.executionSequence[i].jobName}-${this.executionSequence[i + 1].jobName}`,
          source: this.executionSequence[i].jobName,
          target: this.executionSequence[i + 1].jobName
        }
      });
    }
    return edges;
  }

  // Zoom control methods
  zoomIn() {
    if (this.cy) {
      const newZoom = Math.min(3, this.currentZoom + this.zoomStep);
      this.cy.zoom({
        level: newZoom,
        renderedPosition: { x: this.cy.width() / 2, y: this.cy.height() / 2 }
      });
      this.currentZoom = newZoom;
      this.updateZoomDisplay();
    }
  }

  zoomOut() {
    if (this.cy) {
      const newZoom = Math.max(0.1, this.currentZoom - this.zoomStep);
      this.cy.zoom({
        level: newZoom,
        renderedPosition: { x: this.cy.width() / 2, y: this.cy.height() / 2 }
      });
      this.currentZoom = newZoom;
      this.updateZoomDisplay();
    }
  }

  resetZoom() {
    if (this.cy) {
      // Calculate a reasonable zoom level based on number of nodes
      const nodeCount = this.executionSequence.length;
      const zoomLevel = Math.min(1.5, Math.max(0.5, 50 / nodeCount));

      this.cy.zoom(zoomLevel);
      this.cy.center();
      this.currentZoom = zoomLevel;
      this.updateZoomDisplay();
    }
  }

  centerGraph() {
    if (this.cy) {
      this.cy.center();
    }
  }

  fitGraph() {
    if (this.cy) {
      this.cy.fit();
      this.currentZoom = this.cy.zoom();
      this.updateZoomDisplay();
    }
  }

  // Update zoom calculation logic
  private calculateInitialZoom(): number {
    const nodeCount = this.executionSequence.length;
    // More granular zoom levels based on node count
    if (nodeCount <= 3) return 1.3;
    if (nodeCount <= 5) return 1.2;
    if (nodeCount <= 8) return 1.0;
    if (nodeCount <= 12) return 0.9;
    if (nodeCount <= 15) return 0.8;
    if (nodeCount <= 20) return 0.7;
    if (nodeCount <= 30) return 0.6;
    return Math.max(0.5, 25 / nodeCount);
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.cy) {
      this.cy.destroy();
    }
  }
}

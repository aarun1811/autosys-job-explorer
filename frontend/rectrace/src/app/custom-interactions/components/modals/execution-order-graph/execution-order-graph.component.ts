import { Component, AfterViewInit, ElementRef, ViewChild, Input, Output, EventEmitter, OnDestroy } from '@angular/core';
import type { Core, NodeSingular, CytoscapeOptions } from 'cytoscape';
import cytoscape from 'cytoscape';
import dagre from 'cytoscape-dagre';
import { ThemeService } from '../../../../services/theme.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { JobStatusInfo, STATUS_COLORS, STATUS_ICONS } from '../../../../models/job-status.model';

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

@Component({
  selector: 'app-execution-order-graph',
  templateUrl: './execution-order-graph.component.html',
  styleUrls: ['./execution-order-graph.component.css']
})
export class ExecutionOrderGraphComponent implements AfterViewInit, OnDestroy {
  @ViewChild('cy') private readonly cyElement!: ElementRef;
  @Input() executionSequence: JobNode[] = [];
  @Input() jobDetails: { [key: string]: JobDetails } = {};
  @Input() loadJob: string = '';
  @Input() jobStatusMap?: { [key: string]: JobStatusInfo };
  @Output() nodeSelected = new EventEmitter<{ jobName: string | undefined | null; details: JobDetails | undefined | null; status?: JobStatusInfo | null }>();

  private cy: Core | undefined;
  private selectedNode: NodeSingular | null = null;
  public currentZoom: number = 1;
  public zoomStep: number = 0.1;
  private destroy$ = new Subject<void>();
  private isDarkMode = false;
  
  // Make these accessible in template
  public readonly STATUS_ICONS = STATUS_ICONS;

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
    const elements = [ ...this.getNodes(), ...this.getEdges() ];

    const config: CytoscapeOptions = {
      container: this.cyElement.nativeElement,
      elements: elements,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': (ele: any) => this.getNodeColor(this.getJobStatus(ele.data('id'))),
            'label': (ele: any) => {
              const icon = ele.data('statusIcon');
              const label = ele.data('label');
              return icon ? `${icon} ${label}` : label;
            },
            'text-valign': 'center',
            'color': this.isDarkMode ? '#8ab4f8' : '#1A73E8',
            'font-family': 'Google Sans, sans-serif',
            'font-size': '13px',
            'font-weight': 500,
            'text-wrap': 'wrap',
            'text-max-width': (ele: { data: (arg0: string) => any;}) => Math.max(100, ele.data('label').length * 9) - 6 + 'px',
            'width': (ele: { data: (arg0: string) => any;}) => Math.max(100, ele.data('label').length * 9) + 'px',
            'height': '32px',
            'padding': '4px 12px',
            'shape': 'round-rectangle',
            'border-width': (ele: any) => ele.data('status') === 5 ? 2 : 1,
            'border-color': (ele: any) => this.getNodeBorderColor(this.getJobStatus(ele.data('id'))),
            'border-opacity': (ele: any) => ele.data('hasRunToday') ? 0.5 : 1,
            'border-style': (ele: any) => ele.data('hasRunToday') ? 'dashed' : 'solid',
            'background-opacity': (ele: any) => ele.data('hasRunToday') ? 0.7 : 1,
            'transition-property': 'background-color, border-color, border-opacity',
            'transition-duration': 200
          }
        },
        // Completed today - muted appearance
        {
          selector: 'node.completed-today',
          style: {
            'font-style': 'italic',
            'opacity': 0.8
          }
        },
        // Currently active - emphasized
        {
          selector: 'node.active-now',
          style: {
            'font-weight': 'bold',
            'border-width': 2,
            'z-index': 5
          }
        },
        // Running animation
        {
          selector: 'node.running',
          style: {
            'background-blacken': -0.1,
            'border-width': 2
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
      const status = this.getJobStatus(jobName);
      this.nodeSelected.emit({ jobName, details, status });
    });

    this.cy.on('unselect', 'node', (event) => {
      this.selectedNode = null;
      const jobName = null;
      const details = null;
      this.nodeSelected.emit({ jobName, details });
    });

    // Handle trackpad and mouse wheel events
    const container = this.cy.container();
    if (container) {
      // Trackpad panning
      container.addEventListener('wheel', (event: any) => {
        event.preventDefault();

        // Handle panning for both trackpad and mouse wheel
        const deltaX = event.deltaX || 0;
        const deltaY = event.deltaY || 0;

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

  private getNodes() {
    return this.executionSequence.map(job => {
      const status = this.getJobStatus(job.jobName);
      const statusIcon = status ? STATUS_ICONS[status.status] || '' : '';
      
      return {
        data: {
          id: job.jobName,
          label: job.jobName,
          executionOrder: job.executionOrder,
          type: job.jobName === this.loadJob ? 'loadJob' : 'regularJob',
          status: status?.status,
          statusName: status?.statusName,
          visualState: status?.visualState,
          statusIcon: statusIcon,
          hasRunToday: status?.hasRunToday,
          isCurrentlyActive: status?.isCurrentlyActive
        },
        classes: this.getNodeClasses(status)
      };
    });
  }
  
  private getJobStatus(jobName: string): JobStatusInfo | undefined {
    if (!this.jobStatusMap) return undefined;
    // Case-insensitive lookup
    const upperJobName = jobName.toUpperCase();
    return this.jobStatusMap[upperJobName] || this.jobStatusMap[jobName];
  }
  
  private getNodeClasses(status?: JobStatusInfo): string {
    if (!status) return '';
    
    const classes = [];
    
    // Add visual state class
    if (status.visualState === 'COMPLETED_TODAY') {
      classes.push('completed-today');
    } else if (status.visualState === 'ACTIVE_NOW') {
      classes.push('active-now');
      if (status.status === 1) { // RUNNING
        classes.push('running');
      }
    }
    
    // Add status-specific class
    classes.push(`status-${status.status}`);
    
    return classes.join(' ');
  }
  
  private getNodeColor(status?: JobStatusInfo): string {
    if (!status) return this.isDarkMode ? '#303134' : '#E8F0FE';
    
    const theme = this.isDarkMode ? 'dark' : 'light';
    const colorConfig = STATUS_COLORS[theme][status.status];
    
    if (!colorConfig) return this.isDarkMode ? '#303134' : '#E8F0FE';
    
    // Determine which color to use based on visual state
    if (status.visualState === 'COMPLETED_TODAY' && colorConfig.muted) {
      return colorConfig.muted;
    }
    
    return colorConfig.normal;
  }
  
  private getNodeBorderColor(status?: JobStatusInfo): string {
    if (!status) return this.isDarkMode ? '#5f6368' : '#E8EAED';
    
    const theme = this.isDarkMode ? 'dark' : 'light';
    const colorConfig = STATUS_COLORS[theme][status.status];
    
    return colorConfig?.border || (this.isDarkMode ? '#5f6368' : '#E8EAED');
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
  
  // Legend helper methods
  hasStatuses(): boolean {
    return this.jobStatusMap !== undefined && Object.keys(this.jobStatusMap).length > 0;
  }
  
  getActiveJobs(): JobStatusInfo[] {
    if (!this.jobStatusMap) return [];
    
    const uniqueStatuses = new Map<number, JobStatusInfo>();
    Object.values(this.jobStatusMap).forEach(status => {
      if (status.visualState === 'ACTIVE_NOW' && !uniqueStatuses.has(status.status)) {
        uniqueStatuses.set(status.status, status);
      }
    });
    
    return Array.from(uniqueStatuses.values()).sort((a, b) => a.status - b.status);
  }
  
  getCompletedTodayJobs(): JobStatusInfo[] {
    if (!this.jobStatusMap) return [];
    
    const uniqueStatuses = new Map<number, JobStatusInfo>();
    Object.values(this.jobStatusMap).forEach(status => {
      if (status.visualState === 'COMPLETED_TODAY' && !uniqueStatuses.has(status.status)) {
        uniqueStatuses.set(status.status, status);
      }
    });
    
    return Array.from(uniqueStatuses.values()).sort((a, b) => a.status - b.status);
  }
  
  getCurrentStateJobs(): JobStatusInfo[] {
    if (!this.jobStatusMap) return [];
    
    const uniqueStatuses = new Map<number, JobStatusInfo>();
    Object.values(this.jobStatusMap).forEach(status => {
      if (status.visualState === 'CURRENT_STATE' && !uniqueStatuses.has(status.status)) {
        uniqueStatuses.set(status.status, status);
      }
    });
    
    return Array.from(uniqueStatuses.values()).sort((a, b) => a.status - b.status);
  }
  
  getStatusColor(statusCode: number, isMuted: boolean): string {
    const theme = this.isDarkMode ? 'dark' : 'light';
    const colorConfig = STATUS_COLORS[theme][statusCode];
    
    if (!colorConfig) return this.isDarkMode ? '#303134' : '#E8F0FE';
    
    if (isMuted && colorConfig.muted) {
      return colorConfig.muted;
    }
    
    return colorConfig.normal;
  }
}

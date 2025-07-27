import { Component, AfterViewInit, ElementRef, ViewChild, Input, Output, EventEmitter } from '@angular/core';
import type { Core, NodeSingular, CytoscapeOptions } from 'cytoscape';
import cytoscape from 'cytoscape';
import dagre from 'cytoscape-dagre';

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
  // New v2 fields
  status: string;
  nextStartTime: string;
  isScheduledToday: boolean;
}

@Component({
  selector: 'app-execution-order-graph',
  templateUrl: './execution-order-graph.component.html',
  styleUrls: ['./execution-order-graph.component.css']
})
export class ExecutionOrderGraphComponent implements AfterViewInit {
  @ViewChild('cy') private readonly cyElement!: ElementRef;
  @Input() executionSequence: JobNode[] = [];
  @Input() jobDetails: { [key: string]: JobDetails } = {};
  @Input() loadJob: string = '';
  @Output() nodeSelected = new EventEmitter<{ jobName: string | undefined | null; details: JobDetails | undefined | null }>();

  private cy: Core | undefined;
  private selectedNode: NodeSingular | null = null;
  public currentZoom: number = 1;
  public zoomStep: number = 0.1;

  constructor() { }

  ngAfterViewInit() {
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

  private renderGraph() {
    const elements = [ ...this.getNodes(), ...this.getEdges() ];

    const config: CytoscapeOptions = {
      container: this.cyElement.nativeElement,
      elements: elements,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': '#E8F0FE',
            'label': 'data(label)',
            'text-valign': 'center',
            'color': '#1A73E8',
            'font-family': 'Google Sans, sans-serif',
            'font-size': '13px',
            'font-weight': 500,
            'text-wrap': 'wrap',
            'text-max-width': (ele: { data: (arg0: string) => any;}) => Math.max(100, ele.data('label').length * 9) - 6 + 'px',
            'width': (ele: { data: (arg0: string) => any;}) => Math.max(100, ele.data('label').length * 9) + 'px',
            'height': '32px',
            'padding': '4px 12px',
            'shape': 'round-rectangle',
            'border-width': 1,
            'border-color': '#E8EAED',
            'border-opacity': 0.6,
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
            'line-color': '#A8C7FA',
            'target-arrow-shape': 'triangle',
            'target-arrow-color': '#A8C7FA',
            'arrow-scale': 0.8,
            'opacity': 0.9,
          }
        },
        {
          selector: 'node:selected',
          style: {
            'background-color': '#1A73E8',
            'color': '#FFFFFF',
            'border-color': '#1557B0',
            'border-width': 1,
            'border-opacity': 1,
            'z-index': 10
          }
        },
        {
          selector: 'node.hover',
          style: {
            'background-color': '#F1F7FE',
            'border-color': '#1A73E8',
            'border-opacity': 0.8,
            'z-index': 5
          }
        },
        {
          selector: 'edge.hover',
          style: {
            'width': 2,
            'line-color': '#1A73E8',
            'target-arrow-color': '#1A73E8',
            'opacity': 1
          }
        },
        {
          selector: 'edge:selected',
          style: {
            'width': 2,
            'line-color': '#1A73E8',
            'target-arrow-color': '#1A73E8',
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

      // Apply individual node styling based on status
      this.cy?.nodes().forEach(node => {
        const jobName = node.data('id');
        const jobDetails = this.jobDetails[jobName];
        const status = jobDetails?.status;
        const backgroundColor = this.getStatusColor(status);
        const isFailure = status?.toUpperCase() === 'FAILURE';

        node.style({
          'background-color': backgroundColor,
          'color': isFailure ? '#FFFFFF' : '#1A73E8',
          'font-weight': isFailure ? '600' : '500',
          'border-width': isFailure ? 2 : 1,
          'border-color': isFailure ? '#D32F2F' : '#E8EAED',
          'border-opacity': isFailure ? 1 : 0.6
        });
      });

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
      this.nodeSelected.emit({ jobName, details });
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
    return this.executionSequence.map(job => ({
      data: {
        id: job.jobName,
        label: job.jobName,
        executionOrder: job.executionOrder,
        type: job.jobName === this.loadJob ? 'loadJob' : 'regularJob'
      }
    }));
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

  private getStatusColor(status: string): string {
    switch (status?.toUpperCase()) {
      case 'SUCCESS':
        return '#4CAF50'; // Green
      case 'RUNNING':
        return '#2196F3'; // Blue
      case 'STARTING':
        return '#03A9F4'; // Light Blue
      case 'ACTIVATED':
        return '#FF9800'; // Orange
      case 'FAILURE':
        return '#F44336'; // Red (prominent)
      case 'TERMINATED':
        return '#D32F2F'; // Dark Red
      case 'ON_HOLD':
        return '#9E9E9E'; // Gray
      case 'ON_ICE':
        return '#BDBDBD'; // Light Gray
      case 'INACTIVE':
        return '#F5F5F5'; // Very Light Gray
      default:
        return '#E8F0FE'; // Default blue
    }
  }

  private getNodeStyle(jobName: string) {
    const jobDetails = this.jobDetails[jobName];
    const status = jobDetails?.status;
    const backgroundColor = this.getStatusColor(status);
    const isFailure = status?.toUpperCase() === 'FAILURE';

    return {
      'background-color': backgroundColor,
      'label': 'data(label)',
      'text-valign': 'center',
      'color': isFailure ? '#FFFFFF' : '#1A73E8', // White text for failure, blue for others
      'font-family': 'Google Sans, sans-serif',
      'font-size': '13px',
      'font-weight': isFailure ? '600' : '500', // Bold for failure
      'text-wrap': 'wrap',
      'text-max-width': (ele: { data: (arg0: string) => any;}) => Math.max(100, ele.data('label').length * 9) - 6 + 'px',
      'width': (ele: { data: (arg0: string) => any;}) => Math.max(100, ele.data('label').length * 9) + 'px',
      'height': '32px',
      'padding': '4px 12px',
      'shape': 'round-rectangle',
      'border-width': isFailure ? 2 : 1, // Thicker border for failure
      'border-color': isFailure ? '#D32F2F' : '#E8EAED',
      'border-opacity': isFailure ? 1 : 0.6,
      'border-style': 'solid',
      'background-opacity': 1,
      'transition-property': 'background-color, border-color, border-opacity',
      'transition-duration': 200
    };
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
}

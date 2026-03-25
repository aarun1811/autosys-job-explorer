import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

// Visual states for UI rendering - maps to 5 color groups
export type VisualState = 'COMPLETED' | 'FAILED' | 'RUNNING' | 'WAITING' | 'INACTIVE';

// Job status information from Autosys database
export interface JobStatusInfo {
  jobName: string;
  status: number | null;
  statusName: string;
  nextStartEpoch: number | null;
  nextStartFormatted: string | null;
  isScheduledToday: boolean;
  isCurrentlyActive: boolean;
  visualState: VisualState;
}

// Job node in the execution sequence
export interface JobNode {
  jobName: string;
  loadJob: string;
  executionOrder: number;
}

// Job details from the database
export interface JobDetails {
  jobType: string;
  machine: string;
  runCalendar: string;
  excludeCalendar: string;
  boxName: string;
  command: string;
  description: string;
}

// Complete execution order response from backend
export interface ExecutionOrderData {
  loadJob: string;
  executionSequence: JobNode[];
  jobDetails: { [key: string]: JobDetails };
  jobStatuses: { [key: string]: JobStatusInfo } | null;
  statusAvailable: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ExecutionOrderService {
  private readonly apiUrl = `${environment.apiUrl}/execution-order`;

  constructor(private readonly http: HttpClient) { }

  getExecutionOrder(jobName: string): Observable<ExecutionOrderData> {
    return this.http.get<ExecutionOrderData>(`${this.apiUrl}/${jobName}`);
  }
}

import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

// V2 Interfaces for API requests and responses
export interface SsrmRequest {
  startRow: number;
  endRow: number;
  rowGroupCols?: any[];
  valueCols?: any[];
  pivotCols?: any[];
  pivotMode?: boolean;
  groupKeys?: string[];
  filterModel?: any;
  sortModel?: any[];
  tlm_instance: string;
  agent_codes?: string[];
  set_ids?: string[];
  date_range?: number;
}

export interface SsrmResponse<T> {
  data: T[];
  lastRow?: number;
  status: string;
  count: number;
}

export interface DashboardSummary {
  total_breaks: number;
  total_automatch_items: number;
  total_manual_match_items: number;
  total_items: number;
  breaks_percentage: number;
  automatch_percentage: number;
  manual_match_percentage: number;
}

export interface MergedReconStats {
  tlm_instance: string;
  agent_code: string;
  setid: string;
  stmt_date: string;
  bran_code: string;
  corr_acc_no: string;
  total_items?: number;
  automatch_items?: number;
  total_manual_match_count?: number;
}

export interface BreakStatsV2 {
  breaks_count: number;
  agent_code: string;
  local_acc_no: string;
  stmt_date: string;
  bran_code: string;
}

export interface ApiResponse<T> {
  status: string;
  data: T;
  count?: number;
}

export enum DateRange {
  ONE_DAY = 1,
  SEVEN_DAYS = 7,
  THIRTY_DAYS = 30
}

@Injectable({
  providedIn: 'root'
})
export class TlmStatsV2Service {
  private readonly baseUrl = environment.tlmStatsUrl + '/v2';

  constructor(private http: HttpClient) {}

  /**
   * Get breaks table data with SSRM
   */
  getBreaksTableData(request: SsrmRequest): Observable<SsrmResponse<BreakStatsV2>> {
    return this.http.post<SsrmResponse<BreakStatsV2>>(`${this.baseUrl}/dashboard/breaks`, request);
  }

  /**
   * Get reconciliation table data with SSRM (merged automatch + manual match)
   */
  getReconTableData(request: SsrmRequest): Observable<SsrmResponse<MergedReconStats>> {
    return this.http.post<SsrmResponse<MergedReconStats>>(`${this.baseUrl}/dashboard/recon`, request);
  }

  /**
   * Get dashboard summary for pie chart and summary cards
   */
  getDashboardSummary(params: {
    tlm_instance: string;
    agent_code?: string[];
    set_id?: string[];
    date_range?: number;
  }): Observable<ApiResponse<DashboardSummary>> {
    let httpParams = new HttpParams().set('tlm_instance', params.tlm_instance);

    if (params.agent_code && params.agent_code.length > 0) {
      params.agent_code.forEach(code => {
        httpParams = httpParams.append('agent_code', code);
      });
    }

    if (params.set_id && params.set_id.length > 0) {
      params.set_id.forEach(setId => {
        httpParams = httpParams.append('set_id', setId);
      });
    }

    if (params.date_range) {
      httpParams = httpParams.set('date_range', params.date_range.toString());
    }

    return this.http.get<ApiResponse<DashboardSummary>>(`${this.baseUrl}/dashboard/summary`, { params: httpParams });
  }

  /**
   * Get all recons for a TLM instance
   */
  getReconsForTlmInstance(tlmInstance: string): Observable<ApiResponse<string[]>> {
    const httpParams = new HttpParams().set('tlm_instance', tlmInstance);
    return this.http.get<ApiResponse<string[]>>(`${this.baseUrl}/filters/recons`, { params: httpParams });
  }

  /**
   * Get all set_ids for a recon
   */
  getSetIdsForRecon(tlmInstance: string, agentCode: string): Observable<ApiResponse<string[]>> {
    const httpParams = new HttpParams()
      .set('tlm_instance', tlmInstance)
      .set('agent_code', agentCode);
    return this.http.get<ApiResponse<string[]>>(`${this.baseUrl}/filters/set-ids`, { params: httpParams });
  }

  /**
   * Export breaks data (full data without pagination)
   */
  exportBreaksData(request: SsrmRequest): Observable<ApiResponse<BreakStatsV2[]>> {
    return this.http.post<ApiResponse<BreakStatsV2[]>>(`${this.baseUrl}/export/breaks`, request);
  }

  /**
   * Export reconciliation data (full data without pagination)
   */
  exportReconData(request: SsrmRequest): Observable<ApiResponse<MergedReconStats[]>> {
    return this.http.post<ApiResponse<MergedReconStats[]>>(`${this.baseUrl}/export/recon`, request);
  }

  /**
   * Create SSRM request with common parameters
   */
  createSsrmRequest(params: {
    startRow: number;
    endRow: number;
    tlmInstance: string;
    agentCodes?: string[];
    setIds?: string[];
    dateRange?: DateRange;
    sortModel?: any[];
    filterModel?: any;
  }): SsrmRequest {
    return {
      startRow: params.startRow,
      endRow: params.endRow,
      tlm_instance: params.tlmInstance,
      agent_codes: params.agentCodes,
      set_ids: params.setIds,
      date_range: params.dateRange || DateRange.ONE_DAY,
      sortModel: params.sortModel,
      filterModel: params.filterModel
    };
  }

  /**
   * Health check
   */
  healthCheck(): Observable<any> {
    return this.http.get(`${this.baseUrl}/health`);
  }
}
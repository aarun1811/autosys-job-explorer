import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

// Interfaces for API responses
export interface BreakStatsResponse {
  status: string;
  tlm_instance: string;
  data: BreakStatsData[];
  count: number;
}

export interface BreakStatsData {
  breaks_count: number;
  agent_code: string;
  local_acc_no: string;
  stmt_date: string;
  bran_code: string;
}

export interface AutomatchStatsResponse {
  status: string;
  tlm_instance: string;
  data: AutomatchStatsData[];
  count: number;
}

export interface AutomatchStatsData {
  tlm_instance: string;
  agent_code: string;
  setid: string;
  stmt_date: string;
  bran_code: string;
  corr_acc_no: string;
  total_items: number;
  automatch_items: number;
}

export interface ManualMatchStatsResponse {
  status: string;
  data: ManualMatchStatsData[];
  count: number;
}

export interface ManualMatchStatsData {
  tlm_instance: string;
  agent_code: string;
  setid: string;
  stmt_date: string;
  bran_code: string;
  corr_acc_no: string;
  total_manual_match_count: number;
}

// Merged interface for displaying both automatch and manual match data together
export interface MergedStatsData {
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

@Injectable({
  providedIn: 'root'
})
export class TlmStatsService {
  private readonly baseUrl = environment.tlmStatsUrl;

  constructor(private http: HttpClient) {}

  /**
   * Fetch break statistics
   */
  getBreakStats(params: {
    tlm_instance: string;
    local_acc_no?: string;
    agent_code?: string;
  }): Observable<BreakStatsResponse> {
    let httpParams = new HttpParams().set('tlm_instance', params.tlm_instance);

    if (params.local_acc_no) {
      httpParams = httpParams.set('local_acc_no', params.local_acc_no);
    }

    if (params.agent_code) {
      httpParams = httpParams.set('agent_code', params.agent_code);
    }

    return this.http.get<BreakStatsResponse>(`${this.baseUrl}/breaks`, { params: httpParams });
  }

  /**
   * Fetch automatch statistics
   */
  getAutomatchStats(params: {
    tlm_instance: string;
    local_acc_no?: string;
    agent_code?: string;
  }): Observable<AutomatchStatsResponse> {
    let httpParams = new HttpParams().set('tlm_instance', params.tlm_instance);

    if (params.local_acc_no) {
      httpParams = httpParams.set('local_acc_no', params.local_acc_no);
    }

    if (params.agent_code) {
      httpParams = httpParams.set('agent_code', params.agent_code);
    }

    return this.http.get<AutomatchStatsResponse>(`${this.baseUrl}/automatch`, { params: httpParams });
  }

  /**
   * Fetch manual match statistics
   */
  getManualMatchStats(params: {
    set_id?: string;
    agent_code?: string;
    tlm_instance?: string;
  }): Observable<ManualMatchStatsResponse> {
    let httpParams = new HttpParams();

    if (params.set_id) {
      httpParams = httpParams.set('set_id', params.set_id);
    }

    if (params.agent_code) {
      httpParams = httpParams.set('agent_code', params.agent_code);
    }

    if (params.tlm_instance) {
      httpParams = httpParams.set('tlm_instance', params.tlm_instance);
    }

    return this.http.get<ManualMatchStatsResponse>(`${this.baseUrl}/manual-match`, { params: httpParams });
  }
}

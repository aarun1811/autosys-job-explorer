import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

// Interfaces for QuickRec API
export interface QuickRecStatsRequest {
  recon_id?: string;
  rec_portal_id?: string;
  date_range?: number;
  entry_point?: string; // "recon_id" or "rec_portal_id"
}

export interface QuickRecAutoMatchStats {
  reconName: string;
  reconId: string;
  recPortalId: string;
  leftRecordCount: number;
  rightRecordCount: number;
  leftBreakCount: number;
  rightBreakCount: number;
  leftMatchCount: number;
  rightMatchCount: number;
  loadDate: string;
}

export interface QuickRecManualMatchStats {
  recPortalId: string;
  cob: string;
  updatedDate: string;
  leftManualMatches: number;
  rightManualMatches: number;
}

export interface QuickRecDashboardSummary {
  totalLeftRecords: number;
  totalRightRecords: number;
  totalLeftBreaks: number;
  totalRightBreaks: number;
  totalLeftAutoMatches: number;
  totalRightAutoMatches: number;
  totalLeftManualMatches: number;
  totalRightManualMatches: number;
  leftBreakPercentage: number;
  rightBreakPercentage: number;
  leftAutoMatchPercentage: number;
  rightAutoMatchPercentage: number;
  leftManualMatchPercentage: number;
  rightManualMatchPercentage: number;
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
export class QuickRecStatsService {
  private readonly baseUrl = environment.tlmStatsUrl + '/quickrec-stats';

  constructor(private http: HttpClient) {}

  /**
   * Get auto-match statistics
   */
  getAutoMatchStats(request: QuickRecStatsRequest): Observable<ApiResponse<QuickRecAutoMatchStats[]>> {
    return this.http.post<ApiResponse<QuickRecAutoMatchStats[]>>(
      `${this.baseUrl}/automatch`,
      request
    );
  }

  /**
   * Get manual match statistics
   */
  getManualMatchStats(request: QuickRecStatsRequest): Observable<ApiResponse<QuickRecManualMatchStats[]>> {
    return this.http.post<ApiResponse<QuickRecManualMatchStats[]>>(
      `${this.baseUrl}/manual-match`,
      request
    );
  }

  /**
   * Get dashboard summary
   */
  getDashboardSummary(params: {
    recon_id?: string;
    rec_portal_id?: string;
    date_range?: number;
    entry_point?: string;
  }): Observable<ApiResponse<QuickRecDashboardSummary>> {
    let httpParams = new HttpParams();

    if (params.recon_id) {
      httpParams = httpParams.set('recon_id', params.recon_id);
    }

    if (params.rec_portal_id) {
      httpParams = httpParams.set('rec_portal_id', params.rec_portal_id);
    }

    if (params.date_range) {
      httpParams = httpParams.set('date_range', params.date_range.toString());
    }

    if (params.entry_point) {
      httpParams = httpParams.set('entry_point', params.entry_point);
    }

    return this.http.get<ApiResponse<QuickRecDashboardSummary>>(
      `${this.baseUrl}/summary`,
      { params: httpParams }
    );
  }

  /**
   * Create QuickRec stats request with common parameters
   */
  createQuickRecStatsRequest(params: {
    reconId?: string;
    recPortalId?: string;
    dateRange?: DateRange;
    entryPoint?: string;
  }): QuickRecStatsRequest {
    return {
      recon_id: params.reconId,
      rec_portal_id: params.recPortalId,
      date_range: params.dateRange || DateRange.ONE_DAY,
      entry_point: params.entryPoint
    };
  }

  /**
   * Health check
   */
  healthCheck(): Observable<any> {
    return this.http.get(`${this.baseUrl}/health`);
  }
}
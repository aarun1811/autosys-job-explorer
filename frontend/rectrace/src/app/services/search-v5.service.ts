import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

// DTOs matching backend
export interface InitialSearchResponseV4 {
  categoryResults: { [key: string]: CategoryResultV4 };
  searchTerm: string;
  timestamp: number;
}

export interface CategoryResultV4 {
  key: string;
  label: string;
  values: string[];  // Unique values from ES (max 1000)
  count: number;
  hasMore: boolean;  // True if we hit the 1000 limit
  columns: ColumnDefinition[];
}

export interface ColumnDefinition {
  field: string;
  headerName: string;
  rowGroup?: boolean;
  hide?: boolean;
  sortable?: boolean;
  filter?: boolean;
  resizable?: boolean;
  width?: number;
  cellRenderer?: string;
  cellRendererParams?: any;
  cellStyle?: any;
  pinned?: string;
}

export interface SSRMRequestV4 {
  category?: string;
  initialFilter: InitialFilter;
  rowGroupCols?: string[];
  groupKeys?: string[];
  startRow: number;
  endRow: number;
  sortModel?: SortModel[];
  filterModel?: { [key: string]: FilterModel };
  visibleColumns?: string[];  // Currently visible columns for SELECT DISTINCT
}

export interface InitialFilter {
  column: string;
  values: string[];  // ES results (max 1000)
}

export interface SortModel {
  colId: string;
  sort: string;  // 'asc' or 'desc'
}

export interface FilterModel {
  filterType: string;
  type?: string;
  filter?: string;
  operator?: string;
  condition1?: string;
  condition2?: string;
}

export interface SSRMResponseV4 {
  rows: any[];
  lastRow: number;
}

export interface SearchConfigurationV4 {
  categories: CategoryConfigV4[];
}

export interface CategoryConfigV4 {
  key: string;
  label: string;
  searchColumn: string;
  elasticsearch: any;
  oracle: any;
  columns: ColumnDefinition[];
}

export interface ExportRequestV4 {
  category: string;
  initialFilter: InitialFilter;
  columns: string[];
  rowGroupCols?: string[];
  sortModel?: SortModel[];
}

@Injectable({
  providedIn: 'root'
})
export class SearchServiceV5 {
  private apiUrl = `${environment.apiUrl}/v4/search`;  // Using V4 endpoints
  
  constructor(private http: HttpClient) {}
  
  performInitialSearch(keyword: string): Observable<InitialSearchResponseV4> {
    return this.http.get<InitialSearchResponseV4>(`${this.apiUrl}/initial`, {
      params: { keyword },
      headers: this.getHeaders()
    });
  }
  
  fetchSSRMData(request: SSRMRequestV4): Observable<SSRMResponseV4> {
    const category = request.category || 'unknown';
    return this.http.post<SSRMResponseV4>(
      `${this.apiUrl}/ssrm/${category}`,
      request,
      { headers: this.getHeaders() }
    );
  }
  
  getConfiguration(): Observable<SearchConfigurationV4> {
    return this.http.get<SearchConfigurationV4>(`${this.apiUrl}/config`, {
      headers: this.getHeaders()
    });
  }
  
  exportData(category: string, request: ExportRequestV4): Observable<Blob> {
    return this.http.post(`${this.apiUrl}/export/${category}`, request, {
      responseType: 'blob',
      headers: this.getHeaders()
    });
  }
  
  private getHeaders(): HttpHeaders {
    // Get user ID from session or use default
    const userId = sessionStorage.getItem('userId') || 'user@citi.com';
    return new HttpHeaders({
      'x-citiportal-loginid': userId
    });
  }
}
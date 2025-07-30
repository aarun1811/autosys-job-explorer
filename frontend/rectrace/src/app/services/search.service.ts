import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { environment } from 'src/environments/environment';
// Import the new response type structure
import { SearchResponse } from '../models/job.model';

// SSRM Response interface for individual categories
export interface SSRMResponse {
  success: boolean;
  rows: any[];
  lastRow: number;
  error?: string;
}

// Remove the old type alias if it exists
// export type SearchResultMap = {[key: string]: JobData[]}; // No longer needed

@Injectable({
 providedIn: 'root'
})
export class SearchService {
 private readonly apiUrl = `${environment.apiUrl}`;

 constructor(private readonly http: HttpClient) {}

 /**
  * Performs a search against the backend API.
  * @param query The user's search query string.
  * @returns An Observable emitting the search results structured by category,
  * including data and column definitions.
  */
 search(query: string): Observable<SearchResponse> {
  const params = new HttpParams().set('q', query);
  // Update the type parameter for the http.get call
  return this.http.get<SearchResponse>(`${this.apiUrl}/search`, { params });
 }

  /**
   * Fetches combined search suggestions based on the user's input prefix.
   * @param prefix The prefix string typed by the user.
   * @returns An observable array of suggestion strings.
   */
  getCombinedSuggestions(prefix: string): Observable<string[]> {
    // Don't hit backend for very short prefixes (e.g., less than 2 chars)
    if (!prefix || prefix.trim().length < 2) {
      return of([]); // Return an observable of an empty array
    }
    // Set the 'prefix' query parameter
    const params = new HttpParams().set('prefix', prefix.trim());
    // Call the new backend endpoint and expect an array of strings
    return this.http.get<string[]>(`${this.apiUrl}/search/suggest`, { params });
  }

  /**
   * V2 Initial: Performs an initial search using the V2 endpoint.
   * Fetches essential columns for all categories.
   * (This method assumes the V2 backend's initial search mirrors V1 but uses the /v2/search endpoint)
   */
  searchV2Initial(query: string): Observable<SearchResponse> {
    const params = new HttpParams().set('q', query);
    // Assuming your V2 endpoint for initial search (all categories, essential fields) is also /v2/search without extra params
    return this.http.get<SearchResponse>(`${this.apiUrl}/v2/search`, { params });
  }

  /**
   * V2 Detailed: Fetches detailed data (all rows, specified columns) for a single category.
   * @param query The original search query term.
   * @param categoryKey The key of the category to fetch detailed data for.
   * @param requestedFields A list of field names for which data is requested.
   * @returns An Observable emitting a SearchResponse-like structure
   */
  fetchDetailedCategoryData(query: string, categoryKey: string, requestedFields: string[]): Observable<SearchResponse> {
    let params = new HttpParams()
      .set('q', query)
      .set('category', categoryKey)
      .set('requestedFields', requestedFields.join(','));
    // Call the V2 endpoint for detailed data
    return this.http.get<SearchResponse>(`${this.apiUrl}/v2/search`, { params });
  }

  /**
   * V2 Group Expansion: Expands a specific group within a category.
   * @param query The original search query term.
   * @param categoryKey The key of the category containing the group.
   * @param groupKey The key of the group to expand.
   * @param requestedFields Optional list of field names for which data is requested.
   * @returns An Observable emitting the expanded group data.
   */
  expandGroup(query: string, categoryKey: string, groupKey: string, requestedFields?: string[]): Observable<SearchResponse> {
    let params = new HttpParams()
      .set('q', query)
      .set('category', categoryKey)
      .set('groupKey', groupKey);

    if (requestedFields && requestedFields.length > 0) {
      params = params.set('requestedFields', requestedFields.join(','));
    }

    return this.http.get<SearchResponse>(`${this.apiUrl}/v2/search`, { params });
  }

  // NEW: V3 methods for simplified search architecture

  /**
   * V3 Keyword Search: Performs keyword search using the V3 endpoint.
   * Uses Elasticsearch for fast keyword search only.
   * @param query The user's search query string.
   * @param category Optional category to search in. If not provided, searches all categories.
   * @returns An Observable emitting the search results.
   */
  searchV3Keyword(query: string, category?: string): Observable<SearchResponse> {
    let params = new HttpParams().set('q', query);
    if (category) {
      params = params.set('category', category);
    }
    return this.http.get<SearchResponse>(`${this.apiUrl}/v3/search/keyword`, { params });
  }

  /**
   * V3 Group Expansion: Expands a specific group using the V3 endpoint.
   * Uses Oracle for group expansion and detailed data.
   * @param query The original search query term.
   * @param category The category containing the group.
   * @param groupKey The key of the group to expand.
   * @returns An Observable emitting the expanded group data.
   */
  expandGroupV3(query: string, category: string, groupKey: string): Observable<SearchResponse> {
    const params = new HttpParams()
      .set('q', query)
      .set('category', category)
      .set('groupKey', groupKey);
    return this.http.get<SearchResponse>(`${this.apiUrl}/v3/search/expand`, { params });
  }

  /**
   * SSRM Data for Individual Category: Fetches data for a specific category using SSRM.
   * Each tab will have its own SSRM datasource calling this method.
   * @param params AG Grid SSRM parameters
   * @param category The category to fetch data for
   * @param searchTerm The search term
   * @param visibleColumns Optional list of visible columns
   * @returns An Observable emitting the SSRM formatted response.
   */
  fetchSSRMDataForCategory(params: any, category: string, searchTerm: string, visibleColumns?: string[]): Observable<SSRMResponse> {
    const requestBody = {
      searchTerm: searchTerm,
      category: category,
      groupKeys: params.request.groupKeys || [],
      visibleColumns: visibleColumns || [],
      rowGroupCols: params.request.rowGroupCols || [],
      valueCols: params.request.valueCols || [],
      filterModel: params.request.filterModel || {},
      sortModel: params.request.sortModel || []
    };
    
    return this.http.post<SSRMResponse>(`${this.apiUrl}/v3/search/ssrm/${category}`, requestBody);
  }
}

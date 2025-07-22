import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { environment } from 'src/environments/environment';
// Import the new response type structure
import { SearchResponse } from '../models/job.model';

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
}

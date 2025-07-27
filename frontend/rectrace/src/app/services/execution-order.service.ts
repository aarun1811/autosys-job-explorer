import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ExecutionOrderService {
  private readonly apiUrl = `${environment.apiUrl}/execution-order`;

  constructor(private readonly http: HttpClient) {}

  getExecutionOrder(jobName: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/${jobName}`);
  }

  /**
   * Enhanced v2 method that includes job status and next start time
   */
  getExecutionOrderV2(jobName: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/v2/${jobName}`);
  }
}

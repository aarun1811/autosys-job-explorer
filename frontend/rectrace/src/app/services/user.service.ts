import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, of } from 'rxjs';
import { environment } from 'src/environments/environment';

export interface UserInfo {
  loginId: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private readonly apiUrl = `${environment.apiUrl}`;

  constructor(private readonly http: HttpClient) { }

  getUserInfo(): Observable<UserInfo | null> {
    return this.http.get<UserInfo>(`${this.apiUrl}/user/info`).pipe(
      catchError(error => {
        console.error('Error fetching user info:', error);
        return of(null);
      })
    );
  }
}

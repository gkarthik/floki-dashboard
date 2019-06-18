import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';

import { Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';

import { AntibioticResistance } from './antibiotic-resistance';

@Injectable({
  providedIn: 'root'
})
export class AnnotationService {
  private reportUrl = "./assets/json-reports/ar.json";

  constructor(
    private http: HttpClient
  ) { }

  private jsonData: AntibioticResistance[];

  private handleError<T> (operation = 'operation', result?: T) {
    return (error: any): Observable<T> => {
      console.error(error);
      console.log(`${operation} failed: ${error.message}`);
      return of(result as T);
    };
  }

  getJson(): Observable<any> {
    return this.http.get<any>(this.reportUrl)
      .pipe(
	tap(d => this.jsonData = d),
	catchError(this.handleError('getJson', []))
      );
  }

}

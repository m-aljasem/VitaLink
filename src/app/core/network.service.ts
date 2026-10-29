import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, fromEvent, merge, of } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class NetworkService {
  private onlineStatus$ = new BehaviorSubject<boolean>(navigator.onLine);

  constructor() {
    // Listen to online/offline events
    merge(
      fromEvent(window, 'online').pipe(map(() => true)),
      fromEvent(window, 'offline').pipe(map(() => false)),
      of(navigator.onLine)
    ).subscribe(status => {
      this.onlineStatus$.next(status);
    });
  }

  isOnline(): boolean {
    return navigator.onLine;
  }

  getOnlineStatus(): Observable<boolean> {
    return this.onlineStatus$.asObservable();
  }
}


/**
 * True when a request failed because the server couldn't be reached (so it is
 * worth retrying later), as opposed to the server rejecting it.
 */
export function isNetworkError(error: any): boolean {
  if (!navigator.onLine) return true;
  const message = `${error?.message ?? ''} ${error?.details ?? ''}`;
  return /failed to fetch|network|load failed|timeout|fetch failed/i.test(message);
}

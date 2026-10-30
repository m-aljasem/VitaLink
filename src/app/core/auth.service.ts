import { Injectable } from '@angular/core';
import { getSupabaseClient } from './supabase.client';
import { User, Session } from '@supabase/supabase-js';
import { BehaviorSubject, Observable } from 'rxjs';
import { OfflineStorageService } from './offline-storage.service';
import { isNetworkError } from './network.service';
import { ReminderService } from './reminder.service';

export interface Profile {
  id: string;
  email: string;
  role: 'patient' | 'provider';
  language: string;
  first_name?: string;
  last_name?: string;
  age?: number;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  country?: string;
  city?: string;
  provider_kind?: 'doctor' | 'nurse' | 'family' | 'friend' | 'caregiver';
  hospital?: string;
  conditions?: string[];
  height_cm?: number;
  glucose_unit?: 'mg/dL' | 'mmol/L';
  weight_unit?: 'kg' | 'lb';
  created_at?: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private supabase = getSupabaseClient();
  private currentUser$ = new BehaviorSubject<User | null>(null);
  private currentProfile$ = new BehaviorSubject<Profile | null>(null);
  private session$ = new BehaviorSubject<Session | null>(null);
  private initializationPromise: Promise<void> | null = null;

  constructor(
    private offlineStorage: OfflineStorageService,
    private reminderService: ReminderService
  ) {
    this.initializationPromise = this.initializeSession();
  }

  private async initializeSession(): Promise<void> {
    try {
      const { data: { session } } = await this.supabase.auth.getSession();
      if (session) {
        this.session$.next(session);
        this.currentUser$.next(session.user);
        await this.loadProfile(session.user.id);
      }
    } catch (error) {
      // Handle NavigatorLockAcquireTimeoutError gracefully
      // Try to get session without lock after a short delay
      setTimeout(async () => {
        try {
          const { data: { session } } = await this.supabase.auth.getSession();
          if (session) {
            this.session$.next(session);
            this.currentUser$.next(session.user);
            await this.loadProfile(session.user.id);
          }
        } catch (retryError) {
          // Silently handle retry errors
        }
      }, 100);
    }

    // Set up auth state change listener
    this.supabase.auth.onAuthStateChange((_event, session) => {
      this.session$.next(session);
      this.currentUser$.next(session?.user ?? null);
      if (session?.user) {
        this.loadProfile(session.user.id);
      } else {
        this.currentProfile$.next(null);
      }
    });
  }

  async waitForInitialization(): Promise<void> {
    if (this.initializationPromise) {
      await this.initializationPromise;
    }
  }

  async requestOTP(email: string): Promise<{ error?: any }> {
    const { error } = await this.supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
      },
    });
    return { error };
  }

  async verifyOTP(email: string, token: string): Promise<{ error?: any; session?: Session }> {
    const { data, error } = await this.supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    });
    if (data.session) {
      this.session$.next(data.session);
      this.currentUser$.next(data.session.user);
      await this.loadProfile(data.session.user.id);
    }
    return { error, session: data.session || undefined };
  }

  async loadProfile(userId: string): Promise<void> {
    let data: Profile | null = null;
    let error: any = null;
    try {
      ({ data, error } = await this.supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle());
    } catch (err) {
      error = err;
    }

    if (!error) {
      // A missing row means a new user who still needs onboarding.
      this.currentProfile$.next(data as Profile | null);
      if (data) {
        this.offlineStorage.init().then(() => this.offlineStorage.saveProfile(data as Profile)).catch(() => undefined);
      }
      return;
    }

    // Server unreachable: use the copy saved on this device, so offline users aren't sent to onboarding.
    if (isNetworkError(error)) {
      try {
        await this.offlineStorage.init();
        const cached = await this.offlineStorage.getProfile(userId);
        if (cached) {
          this.currentProfile$.next(cached);
          return;
        }
      } catch {
        // Fall through
      }
    }
    this.currentProfile$.next(null);
  }

  async getCurrentProfile(): Promise<Profile | null> {
    const user = this.currentUser$.value;
    if (!user) return null;
    
    const profile = this.currentProfile$.value;
    if (profile) return profile;

    await this.loadProfile(user.id);
    return this.currentProfile$.value;
  }

  getCurrentUser(): User | null {
    return this.currentUser$.value;
  }

  getCurrentSession(): Session | null {
    return this.session$.value;
  }

  getUserObservable(): Observable<User | null> {
    return this.currentUser$.asObservable();
  }

  getProfileObservable(): Observable<Profile | null> {
    return this.currentProfile$.asObservable();
  }

  async signOut(): Promise<void> {
    // Don't leave health data or scheduled reminders on a possibly shared device.
    try {
      await this.offlineStorage.init();
      await this.offlineStorage.clearAll();
    } catch (error) {
      console.error('Failed to clear offline storage on sign out:', error);
    }
    await this.reminderService.cancelAllNotifications();
    await this.supabase.auth.signOut();
    this.currentUser$.next(null);
    this.currentProfile$.next(null);
    this.session$.next(null);
  }

  /** Permanently deletes the account and all its data on the server, then signs out. */
  async deleteAccount(): Promise<{ error?: any }> {
    const { error } = await this.supabase.rpc('delete_my_account');
    if (error) return { error };
    await this.signOut();
    return {};
  }

  async isAuthenticated(): Promise<boolean> {
    // Wait for initialization to complete before checking session
    await this.waitForInitialization();
    const session = await this.supabase.auth.getSession();
    return !!session.data.session;
  }
}


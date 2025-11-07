import { Injectable } from '@angular/core';
import { getSupabaseClient } from './supabase.client';
import { User, Session } from '@supabase/supabase-js';
import { BehaviorSubject, Observable } from 'rxjs';

export interface Profile {
  id: string;
  email: string;
  role: 'patient' | 'provider';
  language: string;
  first_name?: string;
  last_name?: string;
  age?: number;
  gender?: 'male' | 'female';
  country?: string;
  city?: string;
  provider_kind?: 'doctor' | 'nurse' | 'family' | 'friend' | 'caregiver';
  hospital?: string;
  conditions?: string[];
  height_cm?: number;
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

  constructor() {
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
    const { data, error } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (!error && data) {
      this.currentProfile$.next(data as Profile);
    }
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
    await this.supabase.auth.signOut();
    this.currentUser$.next(null);
    this.currentProfile$.next(null);
    this.session$.next(null);
  }

  async isAuthenticated(): Promise<boolean> {
    // Wait for initialization to complete before checking session
    await this.waitForInitialization();
    const session = await this.supabase.auth.getSession();
    return !!session.data.session;
  }
}


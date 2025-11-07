import { Injectable } from '@angular/core';
import { getSupabaseClient } from './supabase.client';
import { Profile } from './auth.service';

export { Profile } from './auth.service';

@Injectable({
  providedIn: 'root',
})
export class ProfileService {
  private supabase = getSupabaseClient();

  async createProfile(profile: Partial<Profile>): Promise<{ data?: Profile; error?: any }> {
    const { data, error } = await this.supabase
      .from('profiles')
      .insert(profile)
      .select()
      .single();

    return { data: data as Profile, error };
  }

  async updateProfile(userId: string, updates: Partial<Profile>): Promise<{ data?: Profile; error?: any }> {
    const { data, error } = await this.supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    return { data: data as Profile, error };
  }

  async getProfile(userId: string): Promise<{ data?: Profile; error?: any }> {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      return { error };
    }

    return { data: data as Profile | undefined, error: data ? undefined : new Error('Profile not found') };
  }
}


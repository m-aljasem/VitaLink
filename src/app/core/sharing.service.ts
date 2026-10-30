import { Injectable } from '@angular/core';
import { getSupabaseClient } from './supabase.client';

export interface ProviderLink {
  id: string;
  provider_id: string;
  patient_id: string;
  share_bp: boolean;
  share_glucose: boolean;
  share_spo2: boolean;
  share_hr: boolean;
  share_pain: boolean;
  share_weight: boolean;
  created_at: string;
}

export interface AuditView {
  id: string;
  provider_id: string;
  patient_id: string;
  metric: string;
  viewed_at: string;
}

export type SharingFlags = Pick<ProviderLink, 'share_bp' | 'share_glucose' | 'share_spo2' | 'share_hr' | 'share_pain' | 'share_weight'>;

export interface LinkToken {
  id: string;
  provider_id: string;
  code: string;
  expires_at: string;
  used: boolean;
  created_at: string;
}

@Injectable({
  providedIn: 'root',
})
export class SharingService {
  private supabase = getSupabaseClient();

  /** Generates a single-use, 15-minute code server-side for the signed-in provider. */
  async createToken(): Promise<{ data?: LinkToken; error?: any }> {
    const { data, error } = await this.supabase.rpc('create_link_token');
    return { data: data as LinkToken, error };
  }

  /**
   * Redeems a provider's code for the signed-in patient and applies the chosen
   * sharing flags in the same transaction. Returns `TOO_MANY_ATTEMPTS` or
   * `INVALID_CODE` as the error code when the code is rejected.
   */
  async redeemToken(code: string, sharing: SharingFlags): Promise<{ data?: ProviderLink; error?: any }> {
    const { data, error } = await this.supabase.rpc('redeem_link_token', {
      p_code: code,
      p_share_bp: sharing.share_bp,
      p_share_glucose: sharing.share_glucose,
      p_share_spo2: sharing.share_spo2,
      p_share_hr: sharing.share_hr,
      p_share_pain: sharing.share_pain,
      p_share_weight: sharing.share_weight,
    });

    if (error) {
      if (error.message?.includes('too_many_attempts')) {
        return { error: { ...error, code: 'TOO_MANY_ATTEMPTS' } };
      }
      return { error };
    }
    // The function returns a row of nulls when the code is invalid or expired.
    if (!data || !(data as ProviderLink).id) {
      return { error: { code: 'INVALID_CODE', message: 'Invalid or expired code' } };
    }
    return { data: data as ProviderLink };
  }

  async getProviderLinks(providerId: string): Promise<{ data?: ProviderLink[]; error?: any }> {
    const { data, error } = await this.supabase
      .from('provider_links')
      .select('*')
      .eq('provider_id', providerId);

    return { data: data as ProviderLink[], error };
  }

  async getPatientLinks(patientId: string): Promise<{ data?: ProviderLink[]; error?: any }> {
    const { data, error } = await this.supabase
      .from('provider_links')
      .select('*')
      .eq('patient_id', patientId);

    return { data: data as ProviderLink[], error };
  }

  async updateSharing(linkId: string, sharing: Partial<SharingFlags>): Promise<{ data?: ProviderLink; error?: any }> {
    const { data, error } = await this.supabase
      .from('provider_links')
      .update(sharing)
      .eq('id', linkId)
      .select()
      .single();

    return { data: data as ProviderLink, error };
  }

  async revokeLink(linkId: string): Promise<{ error?: any }> {
    const { error } = await this.supabase
      .from('provider_links')
      .delete()
      .eq('id', linkId);

    return { error };
  }

  async deleteToken(tokenId: string): Promise<{ error?: any }> {
    const { error } = await this.supabase
      .from('link_tokens')
      .delete()
      .eq('id', tokenId);

    return { error };
  }

  /** Records that the signed-in provider viewed a patient's metric (shown to the patient). */
  async logView(providerId: string, patientId: string, metric: string): Promise<void> {
    const { error } = await this.supabase
      .from('audit_views')
      .insert({ provider_id: providerId, patient_id: patientId, metric });
    if (error) console.error('Failed to log provider view:', error);
  }

  /** Who viewed the signed-in patient's data, newest first. */
  async getAccessLog(patientId: string, limit = 100): Promise<{ data?: AuditView[]; error?: any }> {
    const { data, error } = await this.supabase
      .from('audit_views')
      .select('*')
      .eq('patient_id', patientId)
      .order('viewed_at', { ascending: false })
      .limit(limit);
    return { data: data as AuditView[], error };
  }

  async getActiveTokens(providerId: string): Promise<{ data?: LinkToken[]; error?: any }> {
    const { data, error } = await this.supabase
      .from('link_tokens')
      .select('*')
      .eq('provider_id', providerId)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    return { data: data as LinkToken[], error };
  }
}


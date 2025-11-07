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

  async createToken(providerId: string): Promise<{ data?: LinkToken; error?: any }> {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);

    const { data, error } = await this.supabase
      .from('link_tokens')
      .insert({
        provider_id: providerId,
        code,
        expires_at: expiresAt.toISOString(),
        used: false,
      })
      .select()
      .single();

    return { data: data as LinkToken, error };
  }

  async redeemToken(code: string, patientId: string): Promise<{ data?: ProviderLink; error?: any }> {
    // Find valid token
    const { data: token, error: tokenError } = await this.supabase
      .from('link_tokens')
      .select('*')
      .eq('code', code)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (tokenError || !token) {
      return { error: tokenError || new Error('Invalid or expired code') };
    }

    // Check if link already exists
    const { data: existingLink } = await this.supabase
      .from('provider_links')
      .select('*')
      .eq('provider_id', token.provider_id)
      .eq('patient_id', patientId)
      .single();

    let link: ProviderLink;
    if (existingLink) {
      // Update existing link
      const { data, error } = await this.supabase
        .from('provider_links')
        .update({})
        .eq('id', existingLink.id)
        .select()
        .single();
      link = data as ProviderLink;
      if (error) return { error };
    } else {
      // Create new link
      const { data, error } = await this.supabase
        .from('provider_links')
        .insert({
          provider_id: token.provider_id,
          patient_id: patientId,
          share_bp: false,
          share_glucose: false,
          share_spo2: false,
          share_hr: false,
          share_pain: false,
          share_weight: false,
        })
        .select()
        .single();
      link = data as ProviderLink;
      if (error) return { error };
    }

    // Mark token as used
    await this.supabase
      .from('link_tokens')
      .update({ used: true })
      .eq('id', token.id);

    return { data: link };
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

  async updateSharing(linkId: string, sharing: Partial<Pick<ProviderLink, 'share_bp' | 'share_glucose' | 'share_spo2' | 'share_hr' | 'share_pain' | 'share_weight'>>): Promise<{ data?: ProviderLink; error?: any }> {
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


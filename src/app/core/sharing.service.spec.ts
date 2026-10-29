import { TestBed } from '@angular/core/testing';
import { SharingService, SharingFlags } from './sharing.service';
import { fakeSupabase } from '../testing/fake-supabase';

describe('SharingService', () => {
  let service: SharingService;
  let supabase: ReturnType<typeof fakeSupabase>;
  const flags: SharingFlags = {
    share_bp: true,
    share_glucose: false,
    share_spo2: false,
    share_hr: true,
    share_pain: false,
    share_weight: false,
  };

  beforeEach(() => {
    service = TestBed.inject(SharingService);
    supabase = fakeSupabase();
    (service as any).supabase = supabase;
  });

  it('redeems a code through the RPC with the chosen sharing flags', async () => {
    const link = { id: 'link-1', provider_id: 'prov', patient_id: 'pat', ...flags };
    supabase.rpc.and.resolveTo({ data: link, error: null });

    const { data, error } = await service.redeemToken('123456', flags);

    expect(error).toBeUndefined();
    expect(data).toEqual(link as any);
    expect(supabase.rpc).toHaveBeenCalledWith('redeem_link_token', {
      p_code: '123456',
      p_share_bp: true,
      p_share_glucose: false,
      p_share_spo2: false,
      p_share_hr: true,
      p_share_pain: false,
      p_share_weight: false,
    });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('reports INVALID_CODE when the RPC returns no link', async () => {
    supabase.rpc.and.resolveTo({ data: null, error: null });
    expect((await service.redeemToken('000000', flags)).error.code).toBe('INVALID_CODE');
  });

  it('reports INVALID_CODE when the RPC returns a row of nulls', async () => {
    supabase.rpc.and.resolveTo({ data: { id: null }, error: null });
    expect((await service.redeemToken('000000', flags)).error.code).toBe('INVALID_CODE');
  });

  it('reports TOO_MANY_ATTEMPTS when the server rate limits', async () => {
    supabase.rpc.and.resolveTo({ data: null, error: { message: 'too_many_attempts', code: 'P0001' } });
    expect((await service.redeemToken('000000', flags)).error.code).toBe('TOO_MANY_ATTEMPTS');
  });

  it('creates codes server-side', async () => {
    supabase.rpc.and.resolveTo({ data: { id: 't1', code: '482913' }, error: null });

    const { data } = await service.createToken();

    expect(supabase.rpc).toHaveBeenCalledWith('create_link_token');
    expect(data?.code).toBe('482913');
  });
});

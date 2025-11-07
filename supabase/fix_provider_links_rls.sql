-- Fix RLS Policies for provider_links and profiles
-- Run this in Supabase SQL Editor
-- 
-- Issue 1: Patients cannot insert into provider_links when redeeming a code
-- Solution: Add a policy that allows patients to insert links where they are the patient_id

-- Drop policy if it exists, then create it
DROP POLICY IF EXISTS "patients create links" ON public.provider_links;

-- Add policy to allow patients to create links (when patient_id = auth.uid())
CREATE POLICY "patients create links" ON public.provider_links 
  FOR INSERT 
  WITH CHECK (patient_id = auth.uid());

-- Issue 2: Providers cannot see patient profiles even when they have a link
-- Solution: Add a policy that allows providers to see patient profiles when a link exists

-- Drop policy if it exists, then create it
DROP POLICY IF EXISTS "providers see linked patients" ON public.profiles;

-- Allow providers to see patient profiles when they have a link
CREATE POLICY "providers see linked patients" ON public.profiles 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.provider_links pl
      WHERE pl.provider_id = auth.uid() AND pl.patient_id = profiles.id
    )
  );

-- Allow patients to see provider profiles when they have a link
DROP POLICY IF EXISTS "patients see linked providers" ON public.profiles;
CREATE POLICY "patients see linked providers" ON public.profiles 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.provider_links pl
      WHERE pl.patient_id = auth.uid() AND pl.provider_id = profiles.id
    )
  );


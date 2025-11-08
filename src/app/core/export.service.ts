import { Injectable } from '@angular/core';
import { ObservationService, Observation } from './observation.service';
import { AuthService } from './auth.service';
import { observationsToCSV, observationsToJSON, observationsToFHIR, downloadFile } from '../shared/utils/export';

@Injectable({
  providedIn: 'root',
})
export class ExportService {
  constructor(
    private observationService: ObservationService,
    private authService: AuthService
  ) {}

  async exportToCSV(): Promise<{ error?: any }> {
    const user = this.authService.getCurrentUser();
    if (!user) {
      return { error: new Error('Not authenticated') };
    }

    const { data: observations, error } = await this.observationService.getAllObservations(user.id, 10000);
    if (error || !observations) {
      return { error };
    }

    const csvContent = observationsToCSV(observations);
    const filename = `vitalink-export-${new Date().toISOString().split('T')[0]}.csv`;
    downloadFile(csvContent, filename, 'text/csv;charset=utf-8;');

    return {};
  }

  async exportToJSON(): Promise<{ error?: any }> {
    const user = this.authService.getCurrentUser();
    if (!user) {
      return { error: new Error('Not authenticated') };
    }

    const { data: observations, error } = await this.observationService.getAllObservations(user.id, 10000);
    if (error || !observations) {
      return { error };
    }

    const jsonContent = observationsToJSON(observations);
    const filename = `vitalink-export-${new Date().toISOString().split('T')[0]}.json`;
    downloadFile(jsonContent, filename, 'application/json;charset=utf-8;');

    return {};
  }

  async exportToFHIR(): Promise<{ error?: any }> {
    const user = this.authService.getCurrentUser();
    if (!user) {
      return { error: new Error('Not authenticated') };
    }

    const { data: observations, error } = await this.observationService.getAllObservations(user.id, 10000);
    if (error || !observations) {
      return { error };
    }

    // Get profile for patient information
    const profile = await this.authService.getCurrentProfile();

    const fhirContent = observationsToFHIR(observations, profile);
    const filename = `vitalink-export-${new Date().toISOString().split('T')[0]}.json`;
    downloadFile(fhirContent, filename, 'application/fhir+json;charset=utf-8;');

    return {};
  }
}


import { Injectable } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter, first } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class PwaUpdateService {
  private updateAvailable = false;

  constructor(private swUpdate: SwUpdate) {
    if (this.swUpdate.isEnabled) {
      // Listen for available updates
      this.swUpdate.versionUpdates
        .pipe(
          filter((evt): evt is VersionReadyEvent => evt.type === 'VERSION_READY')
        )
        .subscribe(() => {
          this.updateAvailable = true;
        });
    }
  }

  /**
   * Check if service worker is enabled
   */
  isEnabled(): boolean {
    return this.swUpdate.isEnabled;
  }

  /**
   * Check if an update is available
   */
  hasUpdateAvailable(): boolean {
    return this.updateAvailable;
  }

  /**
   * Check for updates manually
   * Returns true if an update is available, false otherwise
   */
  async checkForUpdates(): Promise<boolean> {
    if (!this.swUpdate.isEnabled) {
      return false;
    }

    try {
      // Initiate update check
      const updateCheckInitiated = await this.swUpdate.checkForUpdate();
      
      if (!updateCheckInitiated) {
        return false;
      }

      // Wait for version update event with proper timeout and cleanup
      return new Promise<boolean>((resolve) => {
        let resolved = false;
        const timeout = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            resolve(this.updateAvailable);
          }
        }, 3000); // Increased timeout to 3 seconds

        // Subscribe to version updates
        const subscription = this.swUpdate.versionUpdates
          .pipe(
            filter((evt): evt is VersionReadyEvent => evt.type === 'VERSION_READY'),
            first()
          )
          .subscribe(() => {
            if (!resolved) {
              resolved = true;
              clearTimeout(timeout);
              this.updateAvailable = true;
              subscription.unsubscribe();
              resolve(true);
            }
          });

        // Cleanup subscription if timeout fires
        setTimeout(() => {
          if (!resolved) {
            subscription.unsubscribe();
          }
        }, 3000);
      });
    } catch (error) {
      console.error('Error checking for updates:', error);
      return false;
    }
  }

  /**
   * Activate the update (reload the app)
   */
  async activateUpdate(): Promise<void> {
    if (!this.swUpdate.isEnabled) {
      throw new Error('Service worker is not enabled');
    }

    try {
      await this.swUpdate.activateUpdate();
      // Reload the page to apply the update
      window.location.reload();
    } catch (error) {
      console.error('Error activating update:', error);
      throw error;
    }
  }

  /**
   * Get update availability status
   */
  getUpdateStatus(): { available: boolean; enabled: boolean } {
    return {
      available: this.updateAvailable,
      enabled: this.swUpdate.isEnabled
    };
  }
}


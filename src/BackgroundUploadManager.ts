import { NitroModules } from 'react-native-nitro-modules';
import { AppState, type AppStateStatus } from 'react-native';
import type { TusClient } from './Tus.nitro';
import type { NitroBackgroundOptions, UploadMetadata } from './types';
import { useUploadStore } from './store/uploadStore';
import { TusUpload } from './TusUpload';

// Get the TusClient HybridObject
const TusClientModule = NitroModules.createHybridObject<TusClient>('TusClient');

/**
 * Background Upload Manager
 * Handles upload coordination, auto-resume, and background task management
 */
export class BackgroundUploadManager {
  private static instance: BackgroundUploadManager;
  private isInitialized: boolean = false;
  private appStateSubscription: any = null;
  private autoResumeEnabled: boolean = true;

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): BackgroundUploadManager {
    if (!BackgroundUploadManager.instance) {
      BackgroundUploadManager.instance = new BackgroundUploadManager();
    }
    return BackgroundUploadManager.instance;
  }

  /**
   * Initialize the background upload manager
   * @param options - Background upload configuration
   */
  async initialize(options: NitroBackgroundOptions = {}): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    // Configure native background uploads
    try {
      TusClientModule.configureBackgroundUploads(options);
    } catch (error) {
      // Silently handle configuration errors
    }

    // Set up app state listener for auto-resume
    this.setupAppStateListener();

    // Auto-resume pending uploads on initialization
    if (this.autoResumeEnabled) {
      await this.resumePendingUploads();
    }

    this.isInitialized = true;
  }

  /**
   * Set up app state listener to handle app transitions
   */
  private setupAppStateListener(): void {
    this.appStateSubscription = AppState.addEventListener(
      'change',
      this.handleAppStateChange.bind(this)
    );
  }

  /**
   * Handle app state changes
   */
  private async handleAppStateChange(
    nextAppState: AppStateStatus
  ): Promise<void> {
    if (nextAppState === 'active' && this.autoResumeEnabled) {
      // App came to foreground - resume pending uploads
      await this.resumePendingUploads();
    }
    // App went to background - uploads will continue via native layer
  }

  /**
   * Resume all pending uploads from storage
   */
  async resumePendingUploads(): Promise<void> {
    try {
      const activeUploads = useUploadStore.getState().getActiveUploads();

      for (const uploadMetadata of activeUploads) {
        try {
          // Create new TusUpload instance and resume
          const upload = new TusUpload(
            uploadMetadata.fileUri,
            uploadMetadata.options
          );

          // If upload has a URL, it can be resumed
          if (uploadMetadata.url) {
            await upload.start();
          }
        } catch (error) {
          // Mark as failed in store
          useUploadStore.getState().updateUpload(uploadMetadata.id, {
            status: 'failed',
          });
        }
      }
    } catch (error) {
      // Silently handle resume errors
    }
  }

  /**
   * Enable or disable auto-resume of uploads
   */
  setAutoResume(enabled: boolean): void {
    this.autoResumeEnabled = enabled;
  }

  /**
   * Get auto-resume status
   */
  isAutoResumeEnabled(): boolean {
    return this.autoResumeEnabled;
  }

  /**
   * Pause all active uploads
   */
  pauseAllUploads(): void {
    // This would need to coordinate with active TusUpload instances
    // For now, we update the store status
    const activeUploads = useUploadStore.getState().getActiveUploads();

    activeUploads.forEach((upload: UploadMetadata) => {
      useUploadStore.getState().updateUpload(upload.id, {
        status: 'paused',
      });
    });
  }

  /**
   * Clear all completed uploads from storage
   */
  clearCompletedUploads(): void {
    useUploadStore.getState().clearCompleted();
  }

  /**
   * Clear all uploads from storage
   */
  clearAllUploads(): void {
    useUploadStore.getState().clearAll();
  }

  /**
   * Get statistics about current uploads
   */
  getUploadStats(): {
    total: number;
    active: number;
    completed: number;
    failed: number;
    paused: number;
  } {
    const allUploads = useUploadStore.getState().getAllUploads();

    return {
      total: allUploads.length,
      active: allUploads.filter((u: UploadMetadata) => u.status === 'uploading')
        .length,
      completed: allUploads.filter(
        (u: UploadMetadata) => u.status === 'completed'
      ).length,
      failed: allUploads.filter((u: UploadMetadata) => u.status === 'failed')
        .length,
      paused: allUploads.filter((u: UploadMetadata) => u.status === 'paused')
        .length,
    };
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }

    this.isInitialized = false;
  }
}

// Export singleton instance
export const backgroundUploadManager = BackgroundUploadManager.getInstance();

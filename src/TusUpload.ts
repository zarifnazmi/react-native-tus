import { NitroModules } from 'react-native-nitro-modules';
import type { TusClient, TusUpload as NitroTusUpload } from './Tus.nitro';
import type {
  TusUploadOptions,
  UploadProgress,
  EventType,
  EventHandler,
  ProgressHandler,
  SuccessHandler,
  ErrorHandler,
  ChunkCompleteHandler,
  PreviousUpload,
} from './types';
import { useUploadStore } from './store/uploadStore';

// Get the TusClient HybridObject
const TusClientModule = NitroModules.createHybridObject<TusClient>('TusClient');

/**
 * TusUpload class - inspired by tus-js-client API
 * Provides resumable file uploads using the TUS protocol
 */
export class TusUpload {
  private nativeUpload: NitroTusUpload | null = null;
  private _file: { uri: string };
  private _options: TusUploadOptions;
  private _url: string | null = null;
  private eventHandlers: Map<EventType, Set<EventHandler>> = new Map();

  /**
   * Create a new TUS upload instance
   * @param file - File URI string or object with uri property
   * @param options - Upload configuration options
   */
  constructor(file: string | { uri: string }, options: TusUploadOptions) {
    this._file = typeof file === 'string' ? { uri: file } : file;
    this._options = options;

    // Initialize event handler sets
    this.eventHandlers.set('progress', new Set());
    this.eventHandlers.set('success', new Set());
    this.eventHandlers.set('error', new Set());
    this.eventHandlers.set('chunkComplete', new Set());

    // Register options callbacks if provided
    if (options.onProgress) {
      this.on('progress', options.onProgress);
    }
    if (options.onSuccess) {
      this.on('success', options.onSuccess);
    }
    if (options.onError) {
      this.on('error', options.onError);
    }
    if (options.onChunkComplete) {
      this.on('chunkComplete', options.onChunkComplete);
    }
  }

  /**
   * Get the file being uploaded
   */
  get file(): { uri: string } {
    return this._file;
  }

  /**
   * Get the upload options
   */
  get options(): TusUploadOptions {
    return this._options;
  }

  /**
   * Get the upload URL (available after upload is created on server)
   */
  get url(): string | null {
    return this._url || this.nativeUpload?.url || null;
  }

  /**
   * Start or resume the upload
   */
  async start(): Promise<void> {
    try {
      // Create native upload if not exists
      if (!this.nativeUpload) {
        this.nativeUpload = TusClientModule.createUpload(
          this._file.uri,
          this._options
        );

        // Set up native event callbacks
        this.setupNativeCallbacks();

        // Store in upload store
        const uploadId = this.nativeUpload.id;
        useUploadStore.getState().addUpload(uploadId, {
          id: uploadId,
          fileUri: this._file.uri,
          url: null,
          uploadSize: this.nativeUpload.uploadSize,
          offset: 0,
          metadata: this._options.metadata || {},
          options: this._options,
          status: 'pending',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }

      // Update status to uploading
      useUploadStore.getState().updateUpload(this.nativeUpload.id, {
        status: 'uploading',
      });

      // Start the upload
      await this.nativeUpload.start();
    } catch (error) {
      this.handleError(error as Error);
      throw error;
    }
  }

  /**
   * Pause the upload
   */
  pause(): void {
    if (!this.nativeUpload) {
      throw new Error('Upload not initialized. Call start() first.');
    }

    this.nativeUpload.pause();

    // Update status to paused
    useUploadStore.getState().updateUpload(this.nativeUpload.id, {
      status: 'paused',
    });
  }

  /**
   * Resume a paused upload
   */
  async resume(): Promise<void> {
    if (!this.nativeUpload) {
      throw new Error('Upload not initialized. Call start() first.');
    }

    try {
      // Update status to uploading
      useUploadStore.getState().updateUpload(this.nativeUpload.id, {
        status: 'uploading',
      });

      await this.nativeUpload.resume();
    } catch (error) {
      this.handleError(error as Error);
      throw error;
    }
  }

  /**
   * Abort the upload
   */
  async abort(): Promise<void> {
    if (!this.nativeUpload) {
      return;
    }

    try {
      await this.nativeUpload.abort();

      // Update status to failed
      useUploadStore.getState().updateUpload(this.nativeUpload.id, {
        status: 'failed',
      });
    } catch (error) {
      console.error('Error aborting upload:', error);
    }
  }

  /**
   * Get current upload progress
   */
  getProgress(): UploadProgress | null {
    if (!this.nativeUpload) {
      return null;
    }

    try {
      return this.nativeUpload.getProgress();
    } catch (error) {
      console.error('Error getting progress:', error);
      return null;
    }
  }

  /**
   * Register an event handler
   * @param event - Event type
   * @param callback - Event callback function
   */
  on(event: 'progress', callback: ProgressHandler): this;
  on(event: 'success', callback: SuccessHandler): this;
  on(event: 'error', callback: ErrorHandler): this;
  on(event: 'chunkComplete', callback: ChunkCompleteHandler): this;
  on(event: EventType, callback: EventHandler): this {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.add(callback);
    }
    return this;
  }

  /**
   * Unregister an event handler
   * @param event - Event type
   * @param callback - Event callback function (if not provided, removes all handlers for this event)
   */
  off(event: EventType, callback?: EventHandler): this {
    const handlers = this.eventHandlers.get(event);
    if (!handlers) return this;

    if (callback) {
      handlers.delete(callback);
    } else {
      handlers.clear();
    }

    return this;
  }

  /**
   * Find previous uploads for this file
   * @returns Array of previous upload information
   */
  async findPreviousUploads(): Promise<PreviousUpload[]> {
    const allUploads = useUploadStore.getState().getAllUploads();

    return allUploads
      .filter((upload: any) => upload.fileUri === this._file.uri && upload.url)
      .map((upload: any) => ({
        uploadId: upload.id,
        uploadUrl: upload.url!,
        fileUri: upload.fileUri,
        uploadSize: upload.uploadSize,
        offset: upload.offset,
      }));
  }

  /**
   * Resume from a previous upload
   * @param previousUpload - Previous upload information
   */
  resumeFromPreviousUpload(previousUpload: PreviousUpload): void {
    this._url = previousUpload.uploadUrl;
    // The native layer will handle resuming from the stored URL
  }

  /**
   * Set up native event callbacks
   */
  private setupNativeCallbacks(): void {
    if (!this.nativeUpload) return;

    // Progress callback
    this.nativeUpload.onProgress = (progress) => {
      const handlers = this.eventHandlers.get(
        'progress'
      ) as Set<ProgressHandler>;
      handlers.forEach((handler) => {
        handler(progress.bytesUploaded, progress.bytesTotal);
      });

      // Update store
      if (this.nativeUpload) {
        useUploadStore.getState().updateUpload(this.nativeUpload.id, {
          offset: progress.bytesUploaded,
        });
      }
    };

    // Success callback
    this.nativeUpload.onSuccess = () => {
      this._url = this.nativeUpload?.url || null;

      const handlers = this.eventHandlers.get('success') as Set<SuccessHandler>;
      handlers.forEach((handler) => {
        handler();
      });

      // Update store
      if (this.nativeUpload) {
        useUploadStore.getState().updateUpload(this.nativeUpload.id, {
          status: 'completed',
          url: this._url,
        });
      }
    };

    // Error callback
    this.nativeUpload.onError = (error) => {
      const errorObj = new Error(error.message) as any;
      errorObj.code = error.code;
      errorObj.originalError = error.originalError;

      this.handleError(errorObj);
    };

    // Chunk complete callback
    this.nativeUpload.onChunkComplete = (
      chunkSize,
      bytesUploaded,
      bytesTotal
    ) => {
      const handlers = this.eventHandlers.get(
        'chunkComplete'
      ) as Set<ChunkCompleteHandler>;
      handlers.forEach((handler) => {
        handler(chunkSize, bytesUploaded, bytesTotal);
      });
    };
  }

  /**
   * Handle upload errors
   */
  private handleError(error: Error): void {
    const handlers = this.eventHandlers.get('error') as Set<ErrorHandler>;
    handlers.forEach((handler) => {
      handler(error);
    });

    // Update store
    if (this.nativeUpload) {
      useUploadStore.getState().updateUpload(this.nativeUpload.id, {
        status: 'failed',
      });
    }
  }
}

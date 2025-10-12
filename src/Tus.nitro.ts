import type { HybridObject } from 'react-native-nitro-modules';

// Configuration options for TUS uploads
export interface TusOptions {
  endpoint: string;
  headers?: Record<string, string>;
  metadata?: Record<string, string>;
  chunkSize?: number;
  retryDelays?: number[];
  removeFingerprintOnSuccess?: boolean;
  uploadLengthDeferred?: boolean;
  storeFingerprintForResuming?: boolean;
  overridePatchMethod?: boolean;
  parallelize?: boolean; // Android specific
}

// Upload progress information
export interface UploadProgress {
  bytesUploaded: number;
  bytesTotal: number;
  percentage: number;
}

// Upload error information
export interface UploadError {
  code: string;
  message: string;
  originalError?: string;
}

// Background upload configuration
export interface BackgroundOptions {
  enableNotifications?: boolean;
  notificationTitle?: string;
  enableIOSBackgroundTask?: boolean;
}

// Individual upload instance
export interface TusUpload
  extends HybridObject<{ ios: 'swift'; android: 'kotlin' }> {
  // Properties
  readonly id: string;
  readonly url: string | null;
  readonly file: string;
  readonly uploadSize: number;
  readonly offset: number;
  readonly metadata: Record<string, string>;

  // Methods
  start(): Promise<void>;
  pause(): void;
  resume(): Promise<void>;
  abort(): Promise<void>;
  getProgress(): UploadProgress;

  // Event callbacks (set by JS layer)
  onProgress?: (progress: UploadProgress) => void;
  onSuccess?: () => void;
  onError?: (error: UploadError) => void;
  onChunkComplete?: (
    chunkSize: number,
    bytesUploaded: number,
    bytesTotal: number
  ) => void;
}

// Main TUS client manager
export interface TusClient
  extends HybridObject<{ ios: 'swift'; android: 'kotlin' }> {
  createUpload(fileUri: string, options: TusOptions): TusUpload;
  getUpload(uploadId: string): TusUpload | null;
  removeUpload(uploadId: string): void;
  getAllUploads(): TusUpload[];
  configureBackgroundUploads(options: BackgroundOptions): void;
}

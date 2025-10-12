import type {
  TusOptions as NitroTusOptions,
  UploadProgress as NitroUploadProgress,
  UploadError as NitroUploadError,
  BackgroundOptions as NitroBackgroundOptions,
} from './Tus.nitro';

// Re-export Nitro types
export type {
  NitroTusOptions,
  NitroUploadProgress,
  NitroUploadError,
  NitroBackgroundOptions,
};

// Enhanced TusUploadOptions for JavaScript layer
export interface TusUploadOptions extends Omit<NitroTusOptions, 'endpoint'> {
  endpoint: string;
  headers?: Record<string, string>;
  metadata?: Record<string, string>;
  chunkSize?: number;
  retryDelays?: number[];
  removeFingerprintOnSuccess?: boolean;
  uploadLengthDeferred?: boolean;
  storeFingerprintForResuming?: boolean;
  overridePatchMethod?: boolean;
  parallelize?: boolean;

  // Event callbacks
  onProgress?: (bytesUploaded: number, bytesTotal: number) => void;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
  onChunkComplete?: (
    chunkSize: number,
    bytesUploaded: number,
    bytesTotal: number
  ) => void;
}

// Upload progress information
export interface UploadProgress {
  bytesUploaded: number;
  bytesTotal: number;
  percentage: number;
}

// Upload error information
export interface UploadError extends Error {
  code: string;
  originalError?: string;
}

// Upload metadata for persistence
export interface UploadMetadata {
  id: string;
  fileUri: string;
  url: string | null;
  uploadSize: number;
  offset: number;
  metadata: Record<string, string>;
  options: TusUploadOptions;
  status: 'pending' | 'uploading' | 'paused' | 'completed' | 'failed';
  createdAt: number;
  updatedAt: number;
}

// Previous upload information for resuming
export interface PreviousUpload {
  uploadId: string;
  uploadUrl: string;
  fileUri: string;
  uploadSize: number;
  offset: number;
}

// Event handler types
export type ProgressHandler = (
  bytesUploaded: number,
  bytesTotal: number
) => void;
export type SuccessHandler = () => void;
export type ErrorHandler = (error: Error) => void;
export type ChunkCompleteHandler = (
  chunkSize: number,
  bytesUploaded: number,
  bytesTotal: number
) => void;

export type EventType = 'progress' | 'success' | 'error' | 'chunkComplete';
export type EventHandler =
  | ProgressHandler
  | SuccessHandler
  | ErrorHandler
  | ChunkCompleteHandler;

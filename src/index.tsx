// Main exports
export { TusUpload } from './TusUpload';
export {
  backgroundUploadManager,
  BackgroundUploadManager,
} from './BackgroundUploadManager';
export { useUploadStore } from './store/uploadStore';

// Type exports
export type {
  TusUploadOptions,
  UploadProgress,
  UploadError,
  UploadMetadata,
  PreviousUpload,
  ProgressHandler,
  SuccessHandler,
  ErrorHandler,
  ChunkCompleteHandler,
  EventType,
  EventHandler,
  NitroTusOptions,
  NitroUploadProgress,
  NitroUploadError,
  NitroBackgroundOptions,
} from './types';

// Re-export Nitro types for advanced usage
export type { TusClient, TusUpload as NitroTusUpload } from './Tus.nitro';

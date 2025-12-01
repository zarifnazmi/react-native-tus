import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { MMKV } from 'react-native-mmkv';
import type { UploadMetadata, TusUploadOptions } from '../types';

// Type for serializable options (without callback functions)
type SerializableOptions = Pick<
  TusUploadOptions,
  | 'endpoint'
  | 'chunkSize'
  | 'retryDelays'
  | 'storeFingerprintForResuming'
  | 'removeFingerprintOnSuccess'
  | 'uploadLengthDeferred'
  | 'overridePatchMethod'
  | 'parallelize'
  | 'metadata'
  | 'headers'
>;

// MMKV instance for persistent storage
const mmkvStorage = new MMKV({
  id: 'tus-uploads-storage',
});

// Create Zustand-compatible storage adapter for MMKV
const zustandMMKVStorage = {
  setItem: (name: string, value: string) => {
    try {
      mmkvStorage.set(name, value);
    } catch (error) {
      // Non-blocking - silently handle storage errors
    }
  },
  getItem: (name: string): string | null => {
    try {
      const value = mmkvStorage.getString(name);
      return value ?? null;
    } catch (error) {
      return null;
    }
  },
  removeItem: (name: string) => {
    try {
      mmkvStorage.delete(name);
    } catch (error) {
      // Silently handle deletion errors
    }
  },
};

// Upload store interface
interface UploadStore {
  uploads: Record<string, UploadMetadata>;

  // Actions
  addUpload: (id: string, metadata: UploadMetadata) => void;
  updateUpload: (id: string, updates: Partial<UploadMetadata>) => void;
  removeUpload: (id: string) => void;
  getUpload: (id: string) => UploadMetadata | undefined;
  getAllUploads: () => UploadMetadata[];
  getActiveUploads: () => UploadMetadata[];
  clearCompleted: () => void;
  clearAll: () => void;
}

// Create the store with Zustand persist middleware
export const useUploadStore = create<UploadStore>()(
  persist(
    (set, get) => ({
      uploads: {},

      addUpload: (id: string, metadata: UploadMetadata) => {
        set((state: UploadStore) => {
          // Clean metadata to avoid storing functions or circular refs
          const cleanedMetadata: UploadMetadata = {
            ...metadata,
            // Only store serializable parts of options
            options: metadata.options
              ? ({
                  endpoint: metadata.options.endpoint,
                  chunkSize: metadata.options.chunkSize,
                  retryDelays: metadata.options.retryDelays,
                  storeFingerprintForResuming:
                    metadata.options.storeFingerprintForResuming,
                  removeFingerprintOnSuccess:
                    metadata.options.removeFingerprintOnSuccess,
                  uploadLengthDeferred: metadata.options.uploadLengthDeferred,
                  overridePatchMethod: metadata.options.overridePatchMethod,
                  parallelize: metadata.options.parallelize,
                  // Only store serializable metadata, not functions
                  metadata: metadata.options.metadata,
                  headers: metadata.options.headers,
                } as SerializableOptions & { endpoint: string })
              : ({ endpoint: '' } as TusUploadOptions),
          };

          return {
            uploads: {
              ...state.uploads,
              [id]: cleanedMetadata,
            },
          };
        });
      },

      updateUpload: (id: string, updates: Partial<UploadMetadata>) => {
        set((state: UploadStore) => {
          const existing = state.uploads[id];
          if (!existing) return state;

          const updated: UploadMetadata = {
            ...existing,
            ...updates,
            updatedAt: Date.now(),
          };

          return {
            uploads: {
              ...state.uploads,
              [id]: updated,
            },
          };
        });
      },

      removeUpload: (id: string) => {
        set((state: UploadStore) => {
          const newUploads = { ...state.uploads };
          delete newUploads[id];
          return { uploads: newUploads };
        });
      },

      getUpload: (id: string) => {
        return get().uploads[id];
      },

      getAllUploads: () => {
        return Object.values(get().uploads);
      },

      getActiveUploads: () => {
        return Object.values(get().uploads).filter(
          (upload: UploadMetadata) =>
            upload.status === 'uploading' || upload.status === 'pending'
        );
      },

      clearCompleted: () => {
        set((state: UploadStore) => {
          const newUploads = Object.fromEntries(
            Object.entries(state.uploads).filter(
              ([, upload]: [string, UploadMetadata]) =>
                upload.status !== 'completed'
            )
          ) as Record<string, UploadMetadata>;
          return { uploads: newUploads };
        });
      },

      clearAll: () => {
        set({ uploads: {} });
      },
    }),
    {
      name: 'tus-uploads-storage', // Storage key in MMKV
      storage: createJSONStorage(() => zustandMMKVStorage),
      // Only persist the uploads object, not functions
      partialize: (state) => ({ uploads: state.uploads }),
      // Handle migration if needed
      version: 1,
      // Skip hydration errors (non-blocking)
      skipHydration: false,
      onRehydrateStorage: () => (_state, error) => {
        if (error) {
          // Clear corrupted storage and start fresh
          try {
            mmkvStorage.delete('tus-uploads-storage');
          } catch (clearError) {
            // Silently handle clear errors
          }
        }
      },
    }
  )
);

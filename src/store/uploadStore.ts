import { create } from 'zustand';
import { MMKV } from 'react-native-mmkv';
import type { UploadMetadata } from '../types';

// MMKV instance for persistent storage
const storage = new MMKV({
  id: 'tus-uploads-storage',
});

// Storage key for uploads
const UPLOADS_KEY = 'tus_uploads';

// Helper functions for MMKV storage
const getStoredUploads = (): Record<string, UploadMetadata> => {
  try {
    const stored = storage.getString(UPLOADS_KEY);
    if (!stored) return {};
    return JSON.parse(stored);
  } catch (error) {
    console.error('Failed to read uploads from storage:', error);
    return {};
  }
};

const setStoredUploads = (uploads: Record<string, UploadMetadata>) => {
  try {
    storage.set(UPLOADS_KEY, JSON.stringify(uploads));
  } catch (error) {
    console.error('Failed to save uploads to storage:', error);
  }
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
  restoreUploads: () => void;
  clearCompleted: () => void;
  clearAll: () => void;
}

// Create the store
export const useUploadStore = create<UploadStore>((set, get) => ({
  uploads: {},

  addUpload: (id: string, metadata: UploadMetadata) => {
    set((state: UploadStore) => {
      const newUploads = {
        ...state.uploads,
        [id]: metadata,
      };
      setStoredUploads(newUploads);
      return { uploads: newUploads };
    });
  },

  updateUpload: (id: string, updates: Partial<UploadMetadata>) => {
    set((state: UploadStore) => {
      const existing = state.uploads[id];
      if (!existing) return state;

      const updated = {
        ...existing,
        ...updates,
        updatedAt: Date.now(),
      };

      const newUploads = {
        ...state.uploads,
        [id]: updated,
      };

      setStoredUploads(newUploads);
      return { uploads: newUploads };
    });
  },

  removeUpload: (id: string) => {
    set((state: UploadStore) => {
      const newUploads = { ...state.uploads };
      delete newUploads[id];
      setStoredUploads(newUploads);
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

  restoreUploads: () => {
    const stored = getStoredUploads();
    set({ uploads: stored });
  },

  clearCompleted: () => {
    set((state: UploadStore) => {
      const newUploads = Object.fromEntries(
        Object.entries(state.uploads).filter(
          ([, upload]: [string, UploadMetadata]) =>
            upload.status !== 'completed'
        )
      ) as Record<string, UploadMetadata>;
      setStoredUploads(newUploads);
      return { uploads: newUploads };
    });
  },

  clearAll: () => {
    storage.delete(UPLOADS_KEY);
    set({ uploads: {} });
  },
}));

// Initialize store with persisted uploads on app start
export const initializeUploadStore = () => {
  useUploadStore.getState().restoreUploads();
};

# react-native-tus

A modern, high-performance TUS (resumable upload) client for React Native, built with [Nitro Modules](https://nitro.margelo.com/) for optimal performance. Supports iOS (Swift/TUSKit) and Android (Kotlin/tus-android-client) with a JavaScript API inspired by [tus-js-client](https://github.com/tus/tus-js-client).

## Features

✅ **Resumable Uploads** - Pause and resume uploads even after app restarts  
✅ **Background Uploads** - Continue uploads when app is backgrounded  
✅ **Progress Tracking** - Real-time upload progress with chunk-level callbacks  
✅ **Persistent State** - Upload state persists across app restarts (zustand + MMKV)  
✅ **Notifications** - System notifications for upload progress (optional)  
✅ **Native Performance** - Built with Nitro Modules for zero-overhead native calls  
✅ **TypeScript** - Full TypeScript support with comprehensive types  
✅ **tus-js-client API** - Familiar API for easy migration  

## Installation

```sh
npm install react-native-tus react-native-nitro-modules react-native-mmkv
```

Or with yarn:

```sh
yarn add react-native-tus react-native-nitro-modules react-native-mmkv
```

### iOS Setup

1. Install pods:

```sh
cd ios && pod install
```

2. Add background modes to your `Info.plist`:

```xml
<key>UIBackgroundModes</key>
<array>
  <string>fetch</string>
  <string>processing</string>
</array>
<key>BGTaskSchedulerPermittedIdentifiers</key>
<array>
  <string>com.tus.backgroundUpload</string>
</array>
```

### Android Setup

1. Add permissions to your `AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.INTERNET" />
```

2. Gradle sync will automatically handle dependencies via autolinking.

## Basic Usage

### Simple Upload

```typescript
import { TusUpload } from 'react-native-tus';

// Create an upload
const upload = new TusUpload('file:///path/to/file.jpg', {
  endpoint: 'https://your-tus-server.com/files/',
  metadata: {
    filename: 'photo.jpg',
    filetype: 'image/jpeg',
  },
  chunkSize: 1024 * 1024, // 1MB chunks
});

// Set up event handlers
upload.on('progress', (bytesUploaded, bytesTotal) => {
  const percentage = (bytesUploaded / bytesTotal) * 100;
  console.log(`Upload progress: ${percentage.toFixed(2)}%`);
});

upload.on('success', () => {
  console.log('Upload complete!');
  console.log('Upload URL:', upload.url);
});

upload.on('error', (error) => {
  console.error('Upload failed:', error);
});

// Start the upload
await upload.start();
```

### Pause and Resume

```typescript
// Pause the upload
upload.pause();

// Resume later
await upload.resume();
```

### Background Uploads

```typescript
import { backgroundUploadManager } from 'react-native-tus';

// Initialize on app start (e.g., in App.tsx)
await backgroundUploadManager.initialize({
  enableNotifications: true,
  notificationTitle: 'Uploading files',
  enableIOSBackgroundTask: true,
});

// Uploads will automatically resume on app restart
// and continue in the background when app is minimized
```

### Using Upload Store (Persistent State)

```typescript
import { useUploadStore } from 'react-native-tus';

function UploadList() {
  // Access upload store
  const uploads = useUploadStore((state) => state.getAllUploads());
  
  return (
    <View>
      {uploads.map((upload) => (
        <View key={upload.id}>
          <Text>{upload.metadata.filename}</Text>
          <Text>Progress: {((upload.offset / upload.uploadSize) * 100).toFixed(1)}%</Text>
          <Text>Status: {upload.status}</Text>
        </View>
      ))}
    </View>
  );
}
```

## API Reference

### TusUpload Class

#### Constructor

```typescript
new TusUpload(file: string | { uri: string }, options: TusUploadOptions)
```

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `endpoint` | `string` | **required** | TUS server endpoint URL |
| `metadata` | `Record<string, string>` | `{}` | File metadata |
| `headers` | `Record<string, string>` | `{}` | Custom HTTP headers |
| `chunkSize` | `number` | `Infinity` | Upload chunk size in bytes |
| `retryDelays` | `number[]` | `[0, 1000, 3000, 5000]` | Retry delays in milliseconds |
| `storeFingerprintForResuming` | `boolean` | `true` | Store upload fingerprint for resuming |
| `removeFingerprintOnSuccess` | `boolean` | `false` | Remove fingerprint after success |
| `uploadLengthDeferred` | `boolean` | `false` | Allow deferred upload length |
| `overridePatchMethod` | `boolean` | `false` | Use POST instead of PATCH |
| `parallelize` | `boolean` | `false` | Enable parallel uploads (Android only) |

#### Methods

**`start(): Promise<void>`**  
Start the upload

**`pause(): void`**  
Pause the upload

**`resume(): Promise<void>`**  
Resume a paused upload

**`abort(): Promise<void>`**  
Abort the upload

**`getProgress(): UploadProgress | null`**  
Get current upload progress

**`on(event, callback): this`**  
Register event handler

**`off(event, callback?): this`**  
Unregister event handler

**`findPreviousUploads(): Promise<PreviousUpload[]>`**  
Find previous uploads for the same file

**`resumeFromPreviousUpload(previousUpload): void`**  
Resume from a previous upload

#### Events

**`progress`** - `(bytesUploaded: number, bytesTotal: number) => void`  
Fired on upload progress

**`success`** - `() => void`  
Fired when upload completes successfully

**`error`** - `(error: Error) => void`  
Fired on upload error

**`chunkComplete`** - `(chunkSize: number, bytesUploaded: number, bytesTotal: number) => void`  
Fired after each chunk is uploaded

#### Properties

**`url: string | null`**  
Upload URL (available after creation)

**`file: { uri: string }`**  
File being uploaded

**`options: TusUploadOptions`**  
Upload configuration

### BackgroundUploadManager

#### Methods

**`initialize(options?): Promise<void>`**  
Initialize the background upload manager

**`setAutoResume(enabled: boolean): void`**  
Enable/disable auto-resume

**`pauseAllUploads(): void`**  
Pause all active uploads

**`clearCompletedUploads(): void`**  
Remove completed uploads from storage

**`clearAllUploads(): void`**  
Remove all uploads from storage

**`getUploadStats(): UploadStats`**  
Get statistics about current uploads

**`destroy(): void`**  
Clean up resources

### useUploadStore Hook

Zustand store hook for managing upload state:

```typescript
const store = useUploadStore();

// Methods
store.addUpload(id, metadata);
store.updateUpload(id, updates);
store.removeUpload(id);
store.getUpload(id);
store.getAllUploads();
store.getActiveUploads();
store.clearCompleted();
store.clearAll();
```

## Advanced Usage

### Custom Headers

```typescript
const upload = new TusUpload(fileUri, {
  endpoint: 'https://your-server.com/files/',
  headers: {
    'Authorization': 'Bearer your-token',
    'X-Custom-Header': 'value',
  },
});
```

### Retry Configuration

```typescript
const upload = new TusUpload(fileUri, {
  endpoint: 'https://your-server.com/files/',
  retryDelays: [0, 1000, 3000, 5000, 10000], // Retry with increasing delays
});
```

### Multiple Concurrent Uploads

```typescript
const files = ['file1.jpg', 'file2.jpg', 'file3.jpg'];

const uploads = files.map(fileUri => {
  const upload = new TusUpload(fileUri, {
    endpoint: 'https://your-server.com/files/',
  });
  
  upload.on('success', () => {
    console.log(`${fileUri} uploaded successfully`);
  });
  
  return upload;
});

// Start all uploads
await Promise.all(uploads.map(upload => upload.start()));
```

### Auto-Resume on App Restart

The library automatically stores upload state in MMKV. When you initialize the BackgroundUploadManager, it will restore and resume any pending uploads:

```typescript
// In your App.tsx
useEffect(() => {
  backgroundUploadManager.initialize({
    enableNotifications: true,
  });
}, []);
```

## Platform-Specific Notes

### iOS

- Uses [TUSKit](https://github.com/tus/TUSKit) (~3.4.1) for native uploads
- Background uploads use `BGTaskScheduler` (iOS 13+)
- Requires background modes configuration in Info.plist

### Android

- Uses [tus-android-client](https://github.com/tus/tus-android-client) (0.1.12)
- Background uploads use WorkManager
- Supports both `file://` and `content://` URIs
- Requires notification and foreground service permissions

## Comparison with Other Libraries

| Feature | react-native-tus | react-native-tus-client | tus-js-client |
|---------|------------------|-------------------------|---------------|
| Performance | ⚡ Native (Nitro) | ⚠️ Bridge | 🌐 Web only |
| iOS Background | ✅ Yes | ❌ No | N/A |
| Android Background | ✅ Yes | ❌ No | N/A |
| Persistent State | ✅ MMKV | ❌ No | 🍪 localStorage |
| TypeScript | ✅ Full | ⚠️ Partial | ✅ Full |
| Maintained | ✅ Active | ❌ Outdated | ✅ Active |

## Troubleshooting

### iOS Build Errors

If you encounter TUSKit-related build errors:

```sh
cd ios
pod deintegrate
pod install
```

### Android ProGuard

Add ProGuard rules if using code obfuscation:

```proguard
-keep class io.tus.** { *; }
-keep class com.margelo.nitro.tus.** { *; }
```

### MMKV Setup

react-native-mmkv should auto-link. If you have issues:

```sh
cd ios && pod install
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development workflow and guidelines.

## License

MIT

## Credits

- Built with [Nitro Modules](https://github.com/mrousavy/nitro) by [@mrousavy](https://github.com/mrousavy)
- Uses [TUSKit](https://github.com/tus/TUSKit) for iOS
- Uses [tus-android-client](https://github.com/tus/tus-android-client) for Android
- API inspired by [tus-js-client](https://github.com/tus/tus-js-client)

## Support

- 📚 [TUS Protocol Documentation](https://tus.io/)
- 💬 [GitHub Issues](https://github.com/zarifnazmi/react-native-tus/issues)
- 🔥 [Nitro Modules Docs](https://nitro.margelo.com/)

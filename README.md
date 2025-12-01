# react-native-tus

A modern, high-performance TUS (resumable upload) client for React Native, built with [Nitro Modules](https://nitro.margelo.com/) for optimal native performance. Supports iOS and Android with a JavaScript API inspired by [tus-js-client](https://github.com/tus/tus-js-client).

## ✨ Features

- ✅ **Resumable Uploads** - Pause and resume uploads even after app restarts
- ✅ **Background Uploads** - Continue uploads when app is backgrounded (iOS & Android)
- ✅ **Progress Tracking** - Real-time upload progress with chunk-level callbacks
- ✅ **Persistent State** - Upload state persists across app restarts (Zustand + MMKV)
- ✅ **Native Performance** - Built with Nitro Modules for zero-overhead native calls
- ✅ **TypeScript** - Full TypeScript support with comprehensive types
- ✅ **tus-js-client API** - Familiar API for easy migration from web

## 📦 Installation

### Step 1: Install the Package

```sh
npm install react-native-tus react-native-nitro-modules react-native-mmkv
```

Or with yarn:

```sh
yarn add react-native-tus react-native-nitro-modules react-native-mmkv
```

### Step 2: iOS Setup

#### Install Native Dependencies

```sh
cd ios && pod install
```

#### Configure Background Modes

Add the following to your `Info.plist` to enable background uploads:

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

**What this does:**
- `fetch` and `processing` - Allows the app to perform background tasks
- `BGTaskSchedulerPermittedIdentifiers` - Registers background task identifiers for iOS 13+

### Step 3: Android Setup

#### Add Required Permissions

Add the following permissions to your `AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
```

**What this does:**
- `INTERNET` - Required for network uploads
- `POST_NOTIFICATIONS` - Shows upload progress notifications (Android 13+)
- `FOREGROUND_SERVICE` - Keeps uploads running in background

#### Gradle Sync

The native dependencies will be automatically linked via React Native autolinking. Simply rebuild your app:

```sh
cd android && ./gradlew clean
```

## 🚀 Quick Start

### Basic Upload Example

```typescript
import { TusUpload, backgroundUploadManager } from 'react-native-tus';

// Initialize background upload manager (do this once on app start)
await backgroundUploadManager.initialize({
  enableNotifications: true,
  notificationTitle: 'Uploading Files',
  enableIOSBackgroundTask: true,
});

// Create and start an upload
const upload = new TusUpload('file:///path/to/file.jpg', {
  endpoint: 'https://your-tus-server.com/files/',
  metadata: {
    filename: 'photo.jpg',
    filetype: 'image/jpeg',
  },
  chunkSize: 10 * 1024 * 1024, // 10MB chunks
});

// Track progress
upload.on('progress', (bytesUploaded, bytesTotal) => {
  const percentage = (bytesUploaded / bytesTotal) * 100;
  console.log(`Upload progress: ${percentage.toFixed(2)}%`);
});

// Handle completion
upload.on('success', () => {
  console.log('Upload complete!');
  console.log('Upload URL:', upload.url);
});

// Handle errors
upload.on('error', (error) => {
  console.error('Upload failed:', error.message);
});

// Start the upload
await upload.start();
```

## 📚 API Reference

### TusUpload Class

The main class for handling file uploads.

#### Constructor

```typescript
new TusUpload(file: string | { uri: string }, options: TusUploadOptions)
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `file` | `string \| { uri: string }` | File URI (e.g., `file:///path/to/file.jpg` or `content://...`) |
| `options` | `TusUploadOptions` | Upload configuration options |

**TusUploadOptions:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `endpoint` | `string` | **required** | TUS server endpoint URL |
| `metadata` | `Record<string, string>` | `{}` | File metadata (filename, filetype, etc.) |
| `headers` | `Record<string, string>` | `{}` | Custom HTTP headers for requests |
| `chunkSize` | `number` | `Infinity` | Upload chunk size in bytes (recommended: 5-10MB) |
| `retryDelays` | `number[]` | `[0, 1000, 3000, 5000]` | Retry delays in milliseconds for failed chunks |
| `storeFingerprintForResuming` | `boolean` | `true` | Store upload fingerprint for resuming after restart |
| `removeFingerprintOnSuccess` | `boolean` | `false` | Remove fingerprint after successful upload |
| `uploadLengthDeferred` | `boolean` | `false` | Allow deferred upload length (for streaming) |
| `overridePatchMethod` | `boolean` | `false` | Use POST instead of PATCH for uploads |
| `parallelize` | `boolean` | `false` | Enable parallel chunk uploads (Android only) |
| `onProgress` | `function` | - | Progress callback (alternative to `.on('progress')`) |
| `onSuccess` | `function` | - | Success callback (alternative to `.on('success')`) |
| `onError` | `function` | - | Error callback (alternative to `.on('error')`) |
| `onChunkComplete` | `function` | - | Chunk complete callback |

#### Methods

##### `start(): Promise<void>`

Starts the upload. If the upload was previously paused, it will resume from where it left off.

```typescript
await upload.start();
```

##### `pause(): void`

Pauses the upload. The upload can be resumed later with `resume()` or `start()`.

```typescript
upload.pause();
```

##### `resume(): Promise<void>`

Resumes a paused upload.

```typescript
await upload.resume();
```

##### `abort(): Promise<void>`

Aborts the upload and cleans up resources.

```typescript
await upload.abort();
```

##### `getProgress(): UploadProgress | null`

Returns the current upload progress.

```typescript
const progress = upload.getProgress();
console.log(`${progress.percentage.toFixed(2)}% complete`);
```

**Returns:**
```typescript
{
  bytesUploaded: number;
  bytesTotal: number;
  percentage: number;
}
```

##### `on(event: EventType, callback: Function): this`

Registers an event handler. Returns `this` for chaining.

**Events:**

- **`progress`** - `(bytesUploaded: number, bytesTotal: number) => void`
  - Fired during upload with current progress
  
- **`success`** - `() => void`
  - Fired when upload completes successfully
  
- **`error`** - `(error: Error) => void`
  - Fired when upload fails
  
- **`chunkComplete`** - `(chunkSize: number, bytesUploaded: number, bytesTotal: number) => void`
  - Fired after each chunk is uploaded

```typescript
upload
  .on('progress', (uploaded, total) => console.log(`${uploaded}/${total}`))
  .on('success', () => console.log('Done!'))
  .on('error', (err) => console.error(err));
```

##### `off(event: EventType, callback?: Function): this`

Removes an event handler. If no callback is provided, removes all handlers for that event.

```typescript
upload.off('progress', myProgressHandler);
upload.off('progress'); // Remove all progress handlers
```

##### `findPreviousUploads(): Promise<PreviousUpload[]>`

Finds previous uploads for the same file that can be resumed.

```typescript
const previousUploads = await upload.findPreviousUploads();
if (previousUploads.length > 0) {
  upload.resumeFromPreviousUpload(previousUploads[0]);
}
```

##### `resumeFromPreviousUpload(previousUpload: PreviousUpload): void`

Resumes from a previous upload session.

```typescript
upload.resumeFromPreviousUpload(previousUpload);
await upload.start();
```

#### Properties

##### `url: string | null`

The upload URL assigned by the TUS server (available after upload is created).

```typescript
console.log('Upload URL:', upload.url);
```

##### `file: { uri: string }`

The file being uploaded.

```typescript
console.log('Uploading:', upload.file.uri);
```

##### `options: TusUploadOptions`

The upload configuration options.

```typescript
console.log('Endpoint:', upload.options.endpoint);
```

---

### BackgroundUploadManager

Singleton class that manages background uploads and auto-resume functionality.

#### Methods

##### `initialize(options?: NitroBackgroundOptions): Promise<void>`

Initializes the background upload manager. Call this once when your app starts.

```typescript
await backgroundUploadManager.initialize({
  enableNotifications: true,
  notificationTitle: 'Uploading Files',
  enableIOSBackgroundTask: true,
});
```

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enableNotifications` | `boolean` | `false` | Show upload progress notifications (Android) |
| `notificationTitle` | `string` | - | Notification title text |
| `enableIOSBackgroundTask` | `boolean` | `false` | Enable iOS background upload tasks |

##### `setAutoResume(enabled: boolean): void`

Enable or disable automatic resume of uploads when app returns to foreground.

```typescript
backgroundUploadManager.setAutoResume(true);
```

##### `pauseAllUploads(): void`

Pauses all active uploads.

```typescript
backgroundUploadManager.pauseAllUploads();
```

##### `clearCompletedUploads(): void`

Removes completed uploads from persistent storage.

```typescript
backgroundUploadManager.clearCompletedUploads();
```

##### `clearAllUploads(): void`

Removes all uploads from persistent storage.

```typescript
backgroundUploadManager.clearAllUploads();
```

##### `getUploadStats(): UploadStats`

Returns statistics about current uploads.

```typescript
const stats = backgroundUploadManager.getUploadStats();
console.log(`Active: ${stats.active}, Completed: ${stats.completed}`);
```

**Returns:**
```typescript
{
  total: number;
  active: number;
  completed: number;
  failed: number;
  paused: number;
}
```

##### `destroy(): void`

Cleans up resources and removes listeners. Call this when unmounting your app.

```typescript
backgroundUploadManager.destroy();
```

---

### useUploadStore Hook

Zustand store hook for accessing persistent upload state.

```typescript
import { useUploadStore } from 'react-native-tus';

function UploadList() {
  const uploads = useUploadStore((state) => state.getAllUploads());
  
  return (
    <View>
      {uploads.map((upload) => (
        <View key={upload.id}>
          <Text>{upload.metadata.filename}</Text>
          <Text>{((upload.offset / upload.uploadSize) * 100).toFixed(1)}%</Text>
        </View>
      ))}
    </View>
  );
}
```

**Available Methods:**

- `addUpload(id, metadata)` - Add upload to store
- `updateUpload(id, updates)` - Update upload state
- `removeUpload(id)` - Remove upload from store
- `getUpload(id)` - Get single upload by ID
- `getAllUploads()` - Get all uploads
- `getActiveUploads()` - Get uploads with status 'uploading' or 'pending'
- `clearCompleted()` - Remove completed uploads
- `clearAll()` - Remove all uploads

## 📱 Running the Example App

The example app demonstrates a simple file upload flow with progress tracking.

### Setup

1. **Configure the TUS endpoint** (first time only):
   ```sh
   cd example
   cp config.example.ts config.ts
   ```
   
   Edit `config.ts` to set your TUS server endpoint. The default uses the public demo server at `https://tusd.tusdemo.net/files/`.

2. **Install dependencies**:

### iOS

```sh
cd example
yarn install
bundle install
cd ios
bundle exec pod install
cd ..
yarn ios
```

### Android

```sh
cd example
yarn install
yarn android
```

The example app allows you to:
- Pick a file using the native document picker
- Upload it to a TUS server
- Track upload progress in real-time
- See success/error states

> **Note**: The `example/config.ts` file is gitignored to keep development server details private. Always use `config.example.ts` as a template for your configuration.

## 🔧 Advanced Usage

### Custom Headers (Authentication)

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

## 🌐 Platform-Specific Notes

### iOS

- Uses [TUSKit](https://github.com/tus/TUSKit) (~3.4.1) for native uploads
- Background uploads use `BGTaskScheduler` (iOS 13+)
- **HTTPS required** for background uploads (iOS security requirement)
- HTTP endpoints automatically use foreground uploads
- Requires background modes configuration in `Info.plist`

### Android

- Uses [tus-android-client](https://github.com/tus/tus-android-client) (0.1.12)
- Background uploads use background threads with foreground service notifications
- Supports both `file://` and `content://` URIs
- Works with both HTTP and HTTPS endpoints
- Requires notification and foreground service permissions

## 🐛 Troubleshooting

### iOS Build Errors

If you encounter TUSKit-related build errors:

```sh
cd ios
pod deintegrate
pod install
```

### Android ProGuard

If using code obfuscation, add these ProGuard rules:

```proguard
-keep class io.tus.** { *; }
-keep class com.margelo.nitro.tus.** { *; }
```

### MMKV Setup Issues

react-native-mmkv should auto-link. If you have issues:

```sh
cd ios && pod install
```

For Android, ensure you've run:

```sh
cd android && ./gradlew clean
```

## 📄 License

MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

This library is built on top of excellent open-source projects:

### Core Technologies

- **[Nitro Modules](https://github.com/mrousavy/nitro)** by [@mrousavy](https://github.com/mrousavy)
  - High-performance native module framework that enables zero-overhead native calls
  - Powers the seamless TypeScript ↔ Native communication

### Native TUS Implementations

- **[TUSKit](https://github.com/tus/TUSKit)** - iOS TUS client
  - Robust Swift implementation of the TUS protocol
  - Handles background uploads and iOS-specific requirements

- **[tus-android-client](https://github.com/tus/tus-android-client)** - Android TUS client
  - Reliable Kotlin/Java implementation for Android
  - Supports both file:// and content:// URIs

### API Inspiration

- **[tus-js-client](https://github.com/tus/tus-js-client)** - JavaScript TUS client
  - Inspired the API design for familiarity and ease of migration

- **[react-native-tus-client](https://github.com/tus/react-native-tus-client)**
  - Provided inspiration for React Native specific design patterns and implementation details

### Additional Dependencies

- **[react-native-mmkv](https://github.com/mrousavy/react-native-mmkv)** - Fast, persistent key-value storage
- **[zustand](https://github.com/pmndrs/zustand)** - Lightweight state management

## 📚 Resources

- 📖 [TUS Protocol Documentation](https://tus.io/)
- 💬 [GitHub Issues](https://github.com/zarifnazmi/react-native-tus/issues)
- 🔥 [Nitro Modules Documentation](https://nitro.margelo.com/)
- 📦 [npm Package](https://www.npmjs.com/package/react-native-tus)

## 🤝 Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

Made with ❤️ using [Nitro Modules](https://nitro.margelo.com/)

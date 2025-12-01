import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { TusUpload, backgroundUploadManager } from 'react-native-tus';
import { pick, types } from '@react-native-documents/picker';

/**
 * Simplified TUS Upload Example
 *
 * This example demonstrates the core functionality of react-native-tus:
 * 1. Pick a file using the document picker
 * 2. Upload it to a TUS server
 * 3. Track upload progress
 * 4. Handle success/error states
 */
function App(): React.JSX.Element {
  const [currentUpload, setCurrentUpload] = useState<{
    filename: string;
    progress: number;
    status: 'uploading' | 'success' | 'error';
  } | null>(null);

  useEffect(() => {
    // Initialize background upload manager on app start
    const init = async () => {
      try {
        await backgroundUploadManager.initialize({
          enableNotifications: true,
          notificationTitle: 'Uploading Files',
          enableIOSBackgroundTask: true,
        });
      } catch (error) {
        console.error('Failed to initialize upload manager:', error);
      }
    };

    init();

    return () => {
      backgroundUploadManager.destroy();
    };
  }, []);

  const handlePickAndUpload = async () => {
    try {
      // Pick a file
      const results = await pick({
        allowMultiSelection: false,
        type: [types.allFiles],
      });

      const file = results[0];
      if (!file) return;

      // Set initial upload state
      setCurrentUpload({
        filename: file.name ?? 'Unknown file',
        progress: 0,
        status: 'uploading',
      });

      // Create upload instance
      const upload = new TusUpload(file.uri, {
        endpoint: 'http://157.245.202.155:8000/api/v1/files',
        metadata: {
          filename: file.name ?? 'file',
          contentType:
            (file.type as string | undefined) ?? 'application/octet-stream',
        },
        chunkSize: 10 * 1024 * 1024, // 10MB chunks
      });

      // Track progress
      upload.on('progress', (bytesUploaded, bytesTotal) => {
        const percent = bytesTotal > 0 ? (bytesUploaded / bytesTotal) * 100 : 0;
        setCurrentUpload((prev) =>
          prev ? { ...prev, progress: percent } : null
        );
      });

      // Handle success
      upload.on('success', () => {
        setCurrentUpload((prev) =>
          prev ? { ...prev, status: 'success' } : null
        );
        Alert.alert('Success', 'Upload completed successfully!');
      });

      // Handle errors
      upload.on('error', (error) => {
        setCurrentUpload((prev) =>
          prev ? { ...prev, status: 'error' } : null
        );
        Alert.alert('Upload Error', error.message || 'Unknown error');
      });

      // Start the upload
      await upload.start();
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        // User cancelled the picker
        return;
      }
      Alert.alert('Error', error.message);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'uploading':
        return '#4CAF50';
      case 'success':
        return '#2196F3';
      case 'error':
        return '#F44336';
      default:
        return '#9E9E9E';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>TUS Upload Example</Text>
        <Text style={styles.subtitle}>
          Resumable file uploads with the TUS protocol
        </Text>
      </View>

      <View style={styles.content}>
        <TouchableOpacity
          style={styles.uploadButton}
          onPress={handlePickAndUpload}
          disabled={currentUpload?.status === 'uploading'}
        >
          <Text style={styles.uploadButtonText}>
            {currentUpload?.status === 'uploading'
              ? 'Uploading...'
              : 'Pick File and Upload'}
          </Text>
        </TouchableOpacity>

        {currentUpload && (
          <View style={styles.uploadCard}>
            <View style={styles.uploadHeader}>
              <Text style={styles.filename}>{currentUpload.filename}</Text>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: getStatusColor(currentUpload.status) },
                ]}
              >
                <Text style={styles.statusText}>{currentUpload.status}</Text>
              </View>
            </View>

            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${currentUpload.progress}%` },
                  ]}
                />
              </View>
              <Text style={styles.progressText}>
                {currentUpload.progress.toFixed(1)}%
              </Text>
            </View>
          </View>
        )}

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            💡 This example demonstrates resumable file uploads using the TUS
            protocol. Uploads will continue in the background and resume
            automatically after app restart.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  uploadButton: {
    backgroundColor: '#2196F3',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  uploadButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  uploadCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  uploadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  filename: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginLeft: 10,
    width: 45,
  },
  infoBox: {
    padding: 16,
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  infoText: {
    fontSize: 14,
    color: '#1976D2',
    lineHeight: 20,
  },
});

export default App;

import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {
  TusUpload,
  backgroundUploadManager,
  useUploadStore,
  type UploadMetadata,
} from 'react-native-tus';

function App(): React.JSX.Element {
  const [uploads, setUploads] = useState<UploadMetadata[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // Subscribe to upload store
  const uploadStore = useUploadStore();

  useEffect(() => {
    // Initialize background upload manager
    const init = async () => {
      try {
        await backgroundUploadManager.initialize({
          enableNotifications: true,
          notificationTitle: 'Uploading Files',
          enableIOSBackgroundTask: true,
        });
        setIsInitialized(true);

        // Load uploads from store
        setUploads(uploadStore.getAllUploads());
      } catch (error) {
        console.error('Failed to initialize:', error);
        Alert.alert('Error', 'Failed to initialize upload manager');
      }
    };

    init();

    return () => {
      backgroundUploadManager.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update uploads list when store changes
  useEffect(() => {
    const unsubscribe = useUploadStore.subscribe((state) => {
      setUploads(state.getAllUploads());
    });

    return unsubscribe;
  }, []);

  const handleCreateUpload = async () => {
    try {
      // For demo purposes, using a test file path
      // In a real app, you would use a file picker
      const testFileUri = 'file:///path/to/test/file.jpg';

      const upload = new TusUpload(testFileUri, {
        endpoint: 'https://tusd.tusdemo.net/files/',
        metadata: {
          filename: 'test-file.jpg',
          filetype: 'image/jpeg',
        },
        chunkSize: 1024 * 1024, // 1MB chunks
        retryDelays: [0, 1000, 3000, 5000],
        storeFingerprintForResuming: true,
      });

      // Set up event handlers
      upload.on('progress', (bytesUploaded, bytesTotal) => {
        console.log(
          `Progress: ${((bytesUploaded / bytesTotal) * 100).toFixed(2)}%`
        );
      });

      upload.on('success', () => {
        Alert.alert('Success', 'Upload completed successfully!');
        console.log('Upload URL:', upload.url);
      });

      upload.on('error', (error) => {
        Alert.alert('Error', error.message);
        console.error('Upload error:', error);
      });

      upload.on('chunkComplete', (chunkSize, bytesUploaded, bytesTotal) => {
        console.log(
          `Chunk uploaded: ${chunkSize} bytes (${bytesUploaded}/${bytesTotal})`
        );
      });

      // Start the upload
      await upload.start();
    } catch (error: any) {
      Alert.alert('Error', error.message);
      console.error('Upload creation error:', error);
    }
  };

  const handlePauseUpload = (uploadId: string) => {
    const upload = uploadStore.getUpload(uploadId);
    if (upload) {
      // In a real implementation, you would need to keep track of TusUpload instances
      Alert.alert(
        'Info',
        'Pause functionality requires tracking upload instances'
      );
    }
  };

  const handleResumeUpload = async (uploadId: string) => {
    const uploadMetadata = uploadStore.getUpload(uploadId);
    if (uploadMetadata) {
      try {
        const upload = new TusUpload(
          uploadMetadata.fileUri,
          uploadMetadata.options
        );
        await upload.start();
      } catch (error: any) {
        Alert.alert('Error', error.message);
      }
    }
  };

  const handleRemoveUpload = (uploadId: string) => {
    uploadStore.removeUpload(uploadId);
  };

  const handleClearCompleted = () => {
    uploadStore.clearCompleted();
  };

  const renderUploadItem = (upload: UploadMetadata) => {
    const progress =
      upload.uploadSize > 0
        ? ((upload.offset / upload.uploadSize) * 100).toFixed(1)
        : 0;

    return (
      <View key={upload.id} style={styles.uploadItem}>
        <View style={styles.uploadHeader}>
          <Text style={styles.uploadFilename}>
            {upload.metadata.filename || 'Unknown file'}
          </Text>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: getStatusColor(upload.status) },
            ]}
          >
            <Text style={styles.statusText}>{upload.status}</Text>
          </View>
        </View>

        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
          <Text style={styles.progressText}>{progress}%</Text>
        </View>

        <View style={styles.uploadActions}>
          {upload.status === 'uploading' && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handlePauseUpload(upload.id)}
            >
              <Text style={styles.actionButtonText}>Pause</Text>
            </TouchableOpacity>
          )}

          {upload.status === 'paused' && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleResumeUpload(upload.id)}
            >
              <Text style={styles.actionButtonText}>Resume</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.actionButton, styles.removeButton]}
            onPress={() => handleRemoveUpload(upload.id)}
          >
            <Text style={styles.actionButtonText}>Remove</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'uploading':
        return '#4CAF50';
      case 'paused':
        return '#FF9800';
      case 'completed':
        return '#2196F3';
      case 'failed':
        return '#F44336';
      default:
        return '#9E9E9E';
    }
  };

  const stats = backgroundUploadManager.getUploadStats();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>TUS Upload Example</Text>
        {!isInitialized && <ActivityIndicator size="small" color="#2196F3" />}
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.total}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.active}</Text>
          <Text style={styles.statLabel}>Active</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.completed}</Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.failed}</Text>
          <Text style={styles.statLabel}>Failed</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={handleCreateUpload}
          disabled={!isInitialized}
        >
          <Text style={styles.buttonText}>Create Test Upload</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={handleClearCompleted}
        >
          <Text style={[styles.buttonText, styles.secondaryButtonText]}>
            Clear Completed
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.uploadsList}>
        {uploads.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              No uploads yet. Create a test upload to get started.
            </Text>
          </View>
        ) : (
          uploads.map(renderUploadItem)
        )}
      </ScrollView>

      <View style={styles.infoBox}>
        <Text style={styles.infoText}>
          💡 Note: This example uses test file paths. In a real app, integrate
          with a file picker library to select actual files.
        </Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    padding: 15,
    marginTop: 10,
    marginHorizontal: 15,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    padding: 15,
    gap: 10,
  },
  button: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: '#2196F3',
  },
  secondaryButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  secondaryButtonText: {
    color: '#2196F3',
  },
  uploadsList: {
    flex: 1,
    padding: 15,
  },
  uploadItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
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
    marginBottom: 10,
  },
  uploadFilename: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
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
    marginBottom: 10,
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
  uploadActions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    padding: 10,
    backgroundColor: '#2196F3',
    borderRadius: 6,
    alignItems: 'center',
  },
  removeButton: {
    backgroundColor: '#F44336',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
  infoBox: {
    margin: 15,
    padding: 15,
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

package com.margelo.nitro.tus

import android.content.Context
import android.content.SharedPreferences
import android.net.Uri
import com.facebook.proguard.annotations.DoNotStrip
import com.margelo.nitro.NitroModules
import com.margelo.nitro.core.Promise
import io.tus.android.client.TusPreferencesURLStore
import io.tus.java.client.TusClient
import io.tus.java.client.TusExecutor
import io.tus.java.client.TusUpload
import io.tus.java.client.TusUploader
import java.io.File
import java.net.URL
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

// MARK: - HybridTusUpload Implementation
@DoNotStrip
class HybridTusUpload(
    private val context: Context,
    private val _id: String,
    fileUri: String,
    private val options: TusOptions
) : HybridTusUploadSpec() {
    
    private var tusUpload: TusUpload? = null
    private var tusClient: TusClient? = null
    private var executor: TusExecutor? = null
    private var uploadUrl: String? = null
    private var currentOffset: Double = 0.0
    private var _uploadSize: Double = 0.0
    private val fileUriString: String = fileUri
    private var isPaused: Boolean = false
    
    // Event callbacks
    override var onProgress: ((UploadProgress) -> Unit)? = null
    override var onSuccess: (() -> Unit)? = null
    override var onError: ((UploadError) -> Unit)? = null
    override var onChunkComplete: ((Double, Double, Double) -> Unit)? = null
    
    init {
        setupTusClient()
        setupUpload(fileUri)
    }
    
    /**
     * Set up the TUS client with configuration
     */
    private fun setupTusClient() {
        tusClient = TusClient()
        tusClient?.uploadCreationURL = URL(options.endpoint)
        
        // Enable resumable uploads with SharedPreferences
        val prefs: SharedPreferences = context.getSharedPreferences("tus_uploads", Context.MODE_PRIVATE)
        tusClient?.enableResuming(TusPreferencesURLStore(prefs))
        
        // Set custom headers
        if (!options.headers.isNullOrEmpty()) {
            tusClient?.setHeaders(options.headers!!)
        }
    }
    
    /**
     * Set up the upload from a file URI
     * Handles both content:// and file:// URIs
     */
    private fun setupUpload(fileUri: String) {
        try {
            val uri = Uri.parse(fileUri)
            val file = when {
                fileUri.startsWith("content://") -> {
                    // Handle content:// URIs by copying to temp file
                    val inputStream = context.contentResolver.openInputStream(uri)
                    
                    if (inputStream == null) {
                        throw IllegalArgumentException("Cannot open input stream for URI: $fileUri")
                    }
                    
                    val tempFile = File.createTempFile("tus_upload", null, context.cacheDir)
                    inputStream.use { input ->
                        tempFile.outputStream().use { output ->
                            input.copyTo(output)
                        }
                    }
                    tempFile
                }
                fileUri.startsWith("file://") -> {
                    File(uri.path ?: throw IllegalArgumentException("Invalid file URI"))
                }
                else -> {
                    File(fileUri)
                }
            }
            
            if (!file.exists()) {
                throw IllegalArgumentException("File not found: $fileUri")
            }
            
            if (!file.canRead()) {
                throw IllegalArgumentException("File not readable: $fileUri")
            }
            
            _uploadSize = file.length().toDouble()
            tusUpload = TusUpload(file)
            
            // Set metadata
            options.metadata?.forEach { (key, value) ->
                tusUpload?.metadata?.put(key, value)
            }
        } catch (e: Exception) {
            throw RuntimeException("Failed to setup upload: ${e.message}", e)
        }
    }
    
    // MARK: - Properties
    override val id: String get() = _id
    override val url: String? get() = uploadUrl
    override val file: String get() = fileUriString
    override val uploadSize: Double get() = _uploadSize
    override val offset: Double get() = currentOffset
    override val metadata: Map<String, String> get() = options.metadata ?: emptyMap()
    
    // MARK: - Methods
    
    /**
     * Start the upload
     * @return Promise that resolves when upload completes
     */
    override fun start(): Promise<Unit> {
        val promise = Promise<Unit>()
        isPaused = false
        
        executor = object : TusExecutor() {
            override fun makeAttempt() {
                try {
                    val upload = tusUpload ?: throw IllegalStateException("TusUpload not initialized")
                    val client = tusClient ?: throw IllegalStateException("TusClient not initialized")
                    
                    val uploader: TusUploader = client.resumeOrCreateUpload(upload)
                    uploadUrl = uploader.uploadURL?.toString()
                    
                    if (uploadUrl == null || uploadUrl.isNullOrEmpty()) {
                        throw IllegalStateException("Upload URL is null after creation. Location header may not have been received correctly.")
                    }
                    
                    // Set chunk size immediately after creating uploader
                    val chunkSize = options.chunkSize?.toInt() ?: (10 * 1024 * 1024) // Default 10MB
                    uploader.chunkSize = chunkSize
                    
                    var uploadedBytes: Int
                    do {
                        uploadedBytes = uploader.uploadChunk()
                        
                        if (uploadedBytes > -1) {
                            currentOffset = uploader.offset.toDouble()
                            val totalBytes = tusUpload?.size ?: 0L
                            
                            val progress = UploadProgress(
                                bytesUploaded = currentOffset,
                                bytesTotal = totalBytes.toDouble(),
                                percentage = if (totalBytes > 0) (currentOffset / totalBytes.toDouble() * 100.0) else 0.0
                            )
                            
                            onProgress?.invoke(progress)
                            
                            if (uploadedBytes > 0) {
                                onChunkComplete?.invoke(
                                    uploadedBytes.toDouble(),
                                    currentOffset,
                                    totalBytes.toDouble()
                                )
                            }
                        }
                        
                        if (isPaused) {
                            uploader.finish()
                            return
                        }
                    } while (uploadedBytes > -1)
                    
                    uploader.finish()
                    onSuccess?.invoke()
                    promise.resolve(Unit)
                    
                } catch (e: Exception) {
                    
                    val error = UploadError(
                        code = "UPLOAD_FAILED",
                        message = e.message ?: "Upload failed",
                        originalError = e.toString()
                    )
                    onError?.invoke(error)
                    promise.reject(e)
                }
            }
        }
        
        // Execute in background thread
        Thread {
            try {
                executor?.makeAttempts()
            } catch (e: Exception) {
                
                val error = UploadError(
                    code = "UPLOAD_FAILED",
                    message = e.message ?: "Upload failed",
                    originalError = e.toString()
                )
                onError?.invoke(error)
                promise.reject(e)
            }
        }.start()
        
        return promise
    }
    
    /**
     * Pause the upload
     */
    override fun pause() {
        isPaused = true
    }
    
    /**
     * Resume a paused upload
     * @return Promise that resolves when upload resumes
     */
    override fun resume(): Promise<Unit> {
        return start()
    }
    
    /**
     * Abort the upload
     * @return Promise that resolves when upload is aborted
     */
    override fun abort(): Promise<Unit> {
        val promise = Promise<Unit>()
        isPaused = true
        promise.resolve(Unit)
        return promise
    }
    
    /**
     * Get current upload progress
     * @return Upload progress information
     */
    override fun getProgress(): UploadProgress {
        val totalBytes = _uploadSize
        return UploadProgress(
            bytesUploaded = currentOffset,
            bytesTotal = totalBytes,
            percentage = if (totalBytes > 0) (currentOffset / totalBytes * 100.0) else 0.0
        )
    }
}

// MARK: - HybridTusClient Implementation

/**
 * Main TUS client that manages upload instances
 */
@DoNotStrip
class HybridTusClient() : HybridTusClientSpec() {
    private var context: Context? = null
    private val uploads = ConcurrentHashMap<String, HybridTusUpload>()
    private var backgroundOptions: BackgroundOptions? = null
    
    /**
     * Create a new upload instance
     * @param fileUri URI of the file to upload
     * @param options Upload configuration options
     * @return Upload instance
     */
    override fun createUpload(fileUri: String, options: TusOptions): HybridTusUploadSpec {
        val appContext = getApplicationContext()
        val uploadId = UUID.randomUUID().toString()
        val upload = HybridTusUpload(appContext, uploadId, fileUri, options)
        uploads[uploadId] = upload
        return upload
    }

    private fun getApplicationContext(): Context {
        val reactContext = NitroModules.applicationContext
            ?: throw IllegalStateException("ReactApplicationContext not available. Make sure NitroModules is properly initialized.")
        return reactContext.applicationContext
            ?: throw IllegalStateException("Application context not available from ReactApplicationContext.")
    }
    
    /**
     * Get an existing upload by ID
     * @param uploadId Upload identifier
     * @return Upload instance if found
     */
    override fun getUpload(uploadId: String): HybridTusUploadSpec? {
        return uploads[uploadId]
    }
    
    /**
     * Remove an upload from the manager
     * @param uploadId Upload identifier
     */
    override fun removeUpload(uploadId: String) {
        uploads.remove(uploadId)
    }
    
    /**
     * Get all managed uploads
     * @return Array of all upload instances
     */
    override fun getAllUploads(): Array<HybridTusUploadSpec> {
        return uploads.values.toTypedArray()
    }
    
    /**
     * Configure background upload support
     * @param options Background upload configuration
     */
    override fun configureBackgroundUploads(options: BackgroundOptions) {
        this.backgroundOptions = options

        if (options.enableNotifications == true) {
            val appContext = getApplicationContext()
            NotificationHelper.createNotificationChannel(appContext)
        }
    }
}

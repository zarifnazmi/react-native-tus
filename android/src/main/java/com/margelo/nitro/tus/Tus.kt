package com.margelo.nitro.tus

import android.content.Context
import android.content.SharedPreferences
import android.net.Uri
import com.facebook.proguard.annotations.DoNotStrip
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
    private val id: String,
    fileUri: String,
    private val options: TusOptions
) : HybridTusUploadSpec() {
    
    private var tusUpload: TusUpload? = null
    private var tusClient: TusClient? = null
    private var executor: TusExecutor? = null
    private var uploadUrl: String? = null
    private var currentOffset: Double = 0.0
    private var uploadSize: Double = 0.0
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
    
    private fun setupTusClient() {
        tusClient = TusClient()
        tusClient?.uploadCreationURL = URL(options.endpoint)
        
        // Enable resumable uploads with SharedPreferences
        val prefs: SharedPreferences = context.getSharedPreferences("tus_uploads", Context.MODE_PRIVATE)
        tusClient?.enableResuming(TusPreferencesURLStore(prefs))
        
        // Set custom headers
        options.headers?.forEach { (key, value) ->
            tusClient?.setHeader(key, value)
        }
    }
    
    private fun setupUpload(fileUri: String) {
        try {
            val uri = Uri.parse(fileUri)
            val file = when {
                fileUri.startsWith("content://") -> {
                    // Handle content:// URIs
                    val inputStream = context.contentResolver.openInputStream(uri)
                    val tempFile = File.createTempFile("tus_upload", null, context.cacheDir)
                    inputStream?.use { input ->
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
            
            uploadSize = file.length().toDouble()
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
    override fun getId(): String = id
    override fun getUrl(): String? = uploadUrl
    override fun getFile(): String = fileUriString
    override fun getUploadSize(): Double = uploadSize
    override fun getOffset(): Double = currentOffset
    override fun getMetadata(): Map<String, String> = options.metadata ?: emptyMap()
    
    // MARK: - Methods
    override fun start(): Promise<Unit> {
        val promise = Promise<Unit>()
        isPaused = false
        
        executor = object : TusExecutor() {
            override fun makeAttempt() {
                try {
                    val uploader: TusUploader = tusClient?.resumeOrCreateUpload(tusUpload) 
                        ?: throw IllegalStateException("TusClient not initialized")
                    
                    uploadUrl = uploader.uploadURL?.toString()
                    
                    // Set chunk size if specified
                    options.chunkSize?.let { 
                        uploader.chunkSize = it.toInt()
                    }
                    
                    var uploadedBytes: Long
                    do {
                        uploadedBytes = uploader.upload()
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
    
    override fun pause() {
        isPaused = true
    }
    
    override fun resume(): Promise<Unit> {
        return start()
    }
    
    override fun abort(): Promise<Unit> {
        val promise = Promise<Unit>()
        isPaused = true
        executor?.cancel()
        promise.resolve(Unit)
        return promise
    }
    
    override fun getProgress(): UploadProgress {
        val totalBytes = uploadSize
        return UploadProgress(
            bytesUploaded = currentOffset,
            bytesTotal = totalBytes,
            percentage = if (totalBytes > 0) (currentOffset / totalBytes * 100.0) else 0.0
        )
    }
}

// MARK: - HybridTusClient Implementation
@DoNotStrip
class HybridTusClient(private val context: Context) : HybridTusClientSpec() {
    private val uploads = ConcurrentHashMap<String, HybridTusUpload>()
    private var backgroundOptions: BackgroundOptions? = null
    
    override fun createUpload(fileUri: String, options: TusOptions): HybridTusUpload {
        val uploadId = UUID.randomUUID().toString()
        val upload = HybridTusUpload(context, uploadId, fileUri, options)
        uploads[uploadId] = upload
        return upload
    }
    
    override fun getUpload(uploadId: String): HybridTusUpload? {
        return uploads[uploadId]
    }
    
    override fun removeUpload(uploadId: String) {
        uploads.remove(uploadId)
    }
    
    override fun getAllUploads(): List<HybridTusUpload> {
        return uploads.values.toList()
    }
    
    override fun configureBackgroundUploads(options: BackgroundOptions) {
        this.backgroundOptions = options
        
        if (options.enableNotifications == true) {
            NotificationHelper.createNotificationChannel(context)
        }
    }
}

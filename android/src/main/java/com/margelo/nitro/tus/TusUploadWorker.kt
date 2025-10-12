package com.margelo.nitro.tus

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import androidx.work.ForegroundInfo
import androidx.core.app.NotificationCompat
import com.facebook.proguard.annotations.DoNotStrip

@DoNotStrip
class TusUploadWorker(
    private val context: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(context, workerParams) {
    
    companion object {
        const val KEY_UPLOAD_ID = "upload_id"
        const val KEY_FILE_URI = "file_uri"
        const val KEY_ENDPOINT = "endpoint"
        const val KEY_FILE_NAME = "file_name"
    }
    
    override suspend fun doWork(): Result {
        val uploadId = inputData.getString(KEY_UPLOAD_ID) ?: return Result.failure()
        val fileUri = inputData.getString(KEY_FILE_URI) ?: return Result.failure()
        val endpoint = inputData.getString(KEY_ENDPOINT) ?: return Result.failure()
        val fileName = inputData.getString(KEY_FILE_NAME) ?: "file"
        
        // Set foreground to keep worker alive
        setForeground(createForegroundInfo(uploadId, fileName))
        
        try {
            // The actual upload work would be performed here
            // This would integrate with HybridTusUpload
            
            // Show completion notification
            NotificationHelper.showUploadComplete(context, uploadId, fileName)
            
            return Result.success()
        } catch (e: Exception) {
            // Show error notification
            NotificationHelper.showUploadError(context, uploadId, fileName, e.message ?: "Unknown error")
            return Result.failure()
        }
    }
    
    private fun createForegroundInfo(uploadId: String, fileName: String): ForegroundInfo {
        val notification = NotificationCompat.Builder(context, "tus_upload_channel")
            .setContentTitle("Uploading in background")
            .setContentText(fileName)
            .setSmallIcon(android.R.drawable.stat_sys_upload)
            .setOngoing(true)
            .build()
        
        return ForegroundInfo(uploadId.hashCode(), notification)
    }
}


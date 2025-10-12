package com.margelo.nitro.tus

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.facebook.proguard.annotations.DoNotStrip

@DoNotStrip
object NotificationHelper {
    private const val CHANNEL_ID = "tus_upload_channel"
    private const val CHANNEL_NAME = "TUS Uploads"
    private const val CHANNEL_DESCRIPTION = "Notifications for file uploads"
    
    fun createNotificationChannel(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val importance = NotificationManager.IMPORTANCE_LOW
            val channel = NotificationChannel(CHANNEL_ID, CHANNEL_NAME, importance).apply {
                description = CHANNEL_DESCRIPTION
            }
            
            val notificationManager: NotificationManager =
                context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }
    
    fun showUploadProgress(
        context: Context,
        uploadId: String,
        fileName: String,
        progress: Int,
        title: String = "Uploading"
    ) {
        val builder = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.stat_sys_upload)
            .setContentTitle(title)
            .setContentText("$fileName - $progress%")
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setProgress(100, progress, false)
            .setOngoing(true)
        
        with(NotificationManagerCompat.from(context)) {
            notify(uploadId.hashCode(), builder.build())
        }
    }
    
    fun showUploadComplete(context: Context, uploadId: String, fileName: String) {
        val builder = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.stat_sys_upload_done)
            .setContentTitle("Upload Complete")
            .setContentText("$fileName has been uploaded successfully")
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setAutoCancel(true)
        
        with(NotificationManagerCompat.from(context)) {
            notify(uploadId.hashCode(), builder.build())
        }
    }
    
    fun showUploadError(context: Context, uploadId: String, fileName: String, error: String) {
        val builder = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.stat_notify_error)
            .setContentTitle("Upload Failed")
            .setContentText("$fileName - $error")
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setAutoCancel(true)
        
        with(NotificationManagerCompat.from(context)) {
            notify(uploadId.hashCode(), builder.build())
        }
    }
    
    fun cancelNotification(context: Context, uploadId: String) {
        with(NotificationManagerCompat.from(context)) {
            cancel(uploadId.hashCode())
        }
    }
}


import Foundation
import UserNotifications

class NotificationManager {
    static let shared = NotificationManager()
    
    private var options: BackgroundOptions?
    
    private init() {}
    
    func configure(options: BackgroundOptions) {
        self.options = options
        
        if options.enableNotifications ?? false {
            requestNotificationPermission()
        }
    }
    
    private func requestNotificationPermission() {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { granted, error in
            if let error = error {
            }
        }
    }
    
    func showUploadProgress(uploadId: String, progress: Double, fileName: String) {
        guard options?.enableNotifications ?? false else { return }
        
        let content = UNMutableNotificationContent()
        content.title = options?.notificationTitle ?? "Uploading"
        content.body = "\(fileName) - \(Int(progress))%"
        content.sound = nil
        
        let request = UNNotificationRequest(
            identifier: "upload_\(uploadId)",
            content: content,
            trigger: nil
        )
        
        UNUserNotificationCenter.current().add(request) { error in
            if let error = error {
            }
        }
    }
    
    func showUploadComplete(uploadId: String, fileName: String) {
        guard options?.enableNotifications ?? false else { return }
        
        let content = UNMutableNotificationContent()
        content.title = "Upload Complete"
        content.body = "\(fileName) has been uploaded successfully"
        content.sound = .default
        
        let request = UNNotificationRequest(
            identifier: "upload_complete_\(uploadId)",
            content: content,
            trigger: nil
        )
        
        UNUserNotificationCenter.current().add(request) { error in
            if let error = error {
            }
        }
    }
    
    func showUploadError(uploadId: String, fileName: String, error: String) {
        guard options?.enableNotifications ?? false else { return }
        
        let content = UNMutableNotificationContent()
        content.title = "Upload Failed"
        content.body = "\(fileName) - \(error)"
        content.sound = .default
        
        let request = UNNotificationRequest(
            identifier: "upload_error_\(uploadId)",
            content: content,
            trigger: nil
        )
        
        UNUserNotificationCenter.current().add(request) { error in
            if let error = error {
            }
        }
    }
    
    func removeNotification(uploadId: String) {
        UNUserNotificationCenter.current().removeDeliveredNotifications(withIdentifiers: [
            "upload_\(uploadId)",
            "upload_complete_\(uploadId)",
            "upload_error_\(uploadId)"
        ])
    }
}


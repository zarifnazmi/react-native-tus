import Foundation
import BackgroundTasks
import TUSKit

class BackgroundUploadManager {
    static let shared = BackgroundUploadManager()
    
    private let backgroundTaskIdentifier = "com.tus.backgroundUpload"
    private var options: BackgroundOptions?
    
    private init() {}
    
    func configure(options: BackgroundOptions) {
        self.options = options
        registerBackgroundTasks()
    }
    
    private func registerBackgroundTasks() {
        if #available(iOS 13.0, *) {
            BGTaskScheduler.shared.register(
                forTaskWithIdentifier: backgroundTaskIdentifier,
                using: nil
            ) { task in
                self.handleBackgroundUpload(task: task as! BGProcessingTask)
            }
        }
    }
    
    func scheduleBackgroundUpload() {
        if #available(iOS 13.0, *) {
            let request = BGProcessingTaskRequest(identifier: backgroundTaskIdentifier)
            request.requiresNetworkConnectivity = true
            request.requiresExternalPower = false
            
            do {
                try BGTaskScheduler.shared.submit(request)
            } catch {
                print("Could not schedule background upload: \(error)")
            }
        }
    }
    
    @available(iOS 13.0, *)
    private func handleBackgroundUpload(task: BGProcessingTask) {
        // Schedule the next background task
        scheduleBackgroundUpload()
        
        task.expirationHandler = {
            // Cancel ongoing uploads when time expires
            task.setTaskCompleted(success: false)
        }
        
        // Resume any pending uploads
        // This would be coordinated with TUSKit's upload management
        task.setTaskCompleted(success: true)
    }
}


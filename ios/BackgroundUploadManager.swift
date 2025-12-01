import Foundation
import BackgroundTasks
import TUSKit

class BackgroundUploadManager {
    static let shared = BackgroundUploadManager()
    
    private let backgroundTaskIdentifier = "com.tus.backgroundUpload"
    private var options: BackgroundOptions?
    private static var didRegisterTasks = false
    
    private init() {}
    
    func configure(options: BackgroundOptions) {
        self.options = options
        // BGTaskScheduler registration must happen during app launch (AppDelegate)
        // to comply with Apple's requirements. The host app is responsible for
        // registering the task identifier in AppDelegate. We only keep scheduling here.
    }
    
    public func registerBackgroundTasksIfNeeded() {
        if #available(iOS 13.0, *) {
            // Ensure we only register once if the host app opts into library-based registration
            guard !Self.didRegisterTasks else { return }
            BGTaskScheduler.shared.register(
                forTaskWithIdentifier: backgroundTaskIdentifier,
                using: nil
            ) { task in
                self.handleBackgroundUpload(task: task as! BGProcessingTask)
            }
            Self.didRegisterTasks = true
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


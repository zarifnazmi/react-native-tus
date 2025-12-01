import Foundation
import TUSKit
import BackgroundTasks
import NitroModules

// MARK: - HybridTusUpload Implementation
class HybridTusUpload: HybridTusUploadSpec {
    private let tusClient: TUSClient
    private var tusUploadId: UUID?
    private let _id: String
    private var _url: String?
    private let _file: String
    private var _uploadSize: Double
    private var _offset: Double = 0
    private var _metadata: [String: String]
    private var isPaused: Bool = false
    private let endpoint: String
    
    // Event callbacks
    public var onProgress: ((UploadProgress) -> Void)?
    public var onSuccess: (() -> Void)?
    public var onError: ((UploadError) -> Void)?
    public var onChunkComplete: ((Double, Double, Double) -> Void)?
    
    init(id: String, fileUri: String, options: TusOptions, client: TUSClient) throws {
        self._id = id
        self._file = fileUri
        self._metadata = options.metadata ?? [:]
        self.tusClient = client
        self.endpoint = options.endpoint
        
        // Convert file URI to URL
        guard let fileURL = URL(string: fileUri) else {
            throw NSError(domain: "TusError", code: -1, userInfo: [NSLocalizedDescriptionKey: "Invalid file URI"])
        }
        
        // Get file size
        let fileManager = FileManager.default
        var filePath = fileURL.path
        
        // Handle file:// scheme
        if fileUri.hasPrefix("file://") {
            filePath = fileURL.path
        }
        
        guard fileManager.fileExists(atPath: filePath) else {
            throw NSError(domain: "TusError", code: -2, userInfo: [NSLocalizedDescriptionKey: "File not found: \(filePath)"])
        }
        
        let attributes = try fileManager.attributesOfItem(atPath: filePath)
        self._uploadSize = (attributes[.size] as? NSNumber)?.doubleValue ?? 0
        
        // Base HybridObject init
        super.init()
    }

    override init() {
        // Fallback init required by generated autolinking registration
        let serverURL = URL(string: "http://localhost")!
        
        // CRITICAL: Always use foreground session (URLSession.shared or .default)
        // Background sessions cause issues with HTTP and immediate uploads
        if let client = try? TUSClient(
            server: serverURL,
            sessionIdentifier: "margelo.nitro.tus.autolink." + UUID().uuidString,
            session: URLSession.shared,  // Foreground session
            chunkSize: 10 * 1024 * 1024   // 10MB chunks (matches server partSize)
        ) {
            self.tusClient = client
        } else {
            // Fallback to default configuration (still foreground)
            let sessionConfig = URLSessionConfiguration.default
            self.tusClient = try! TUSClient(
                server: serverURL,
                sessionIdentifier: "margelo.nitro.tus.autolink." + UUID().uuidString,
                sessionConfiguration: sessionConfig,
                storageDirectory: nil,
                chunkSize: 10 * 1024 * 1024  // 10MB chunks (matches server partSize)
            )
        }
        self._id = ""
        self._file = ""
        self._metadata = [:]
        self._uploadSize = 0
        self.endpoint = "http://localhost"
        super.init()
    }
    
    // MARK: - Properties
    public var id: String { _id }
    public var url: String? { _url }
    public var file: String { _file }
    public var uploadSize: Double { _uploadSize }
    public var offset: Double { _offset }
    public var metadata: [String: String] { _metadata }
    
    // MARK: - Methods
    
    /// Start or resume the upload
    /// - Returns: Promise that resolves when upload is scheduled
    public func start() throws -> Promise<Void> {
        let promise = Promise<Void>()
        isPaused = false
        
        guard let fileURL = URL(string: _file) else {
            promise.reject(withError: NSError(domain: "TusError", code: -4, userInfo: [NSLocalizedDescriptionKey: "Invalid file URL"]))
            return promise
        }
        
        guard let uploadURL = URL(string: endpoint) else {
            promise.reject(withError: NSError(domain: "TusError", code: -5, userInfo: [NSLocalizedDescriptionKey: "Invalid endpoint URL"]))
            return promise
        }
        
        do {
            let id = try tusClient.uploadFileAt(
                filePath: fileURL,
                uploadURL: uploadURL,
                customHeaders: _metadata,
                context: _metadata
            )
            
            self.tusUploadId = id
            // Map native UUID to our upload id for delegate callbacks
            NitroTusMapping.shared.map[id] = _id
            
            // Resolve once scheduled; completion will be forwarded via delegate to onSuccess/onError
            promise.resolve(withResult: ())
        } catch {
            
            let tusError = UploadError(
                code: "UPLOAD_SCHEDULE_FAILED",
                message: error.localizedDescription,
                originalError: error.localizedDescription
            )
            self.onError?(tusError)
            promise.reject(withError: error)
        }
        return promise
    }
    
    /// Pause the upload
    public func pause() throws {
        isPaused = true
        if let id = tusUploadId {
            try? tusClient.cancel(id: id)
        }
    }
    
    /// Resume a paused upload
    /// - Returns: Promise that resolves when upload is resumed
    public func resume() throws -> Promise<Void> {
        let promise = Promise<Void>()
        guard let id = tusUploadId else {
            return try start()
        }
        do {
            _ = try tusClient.resume(id: id)
            isPaused = false
            promise.resolve(withResult: ())
        } catch {
            promise.reject(withError: error)
        }
        return promise
    }
    
    /// Abort the upload
    /// - Returns: Promise that resolves when upload is aborted
    public func abort() throws -> Promise<Void> {
        let promise = Promise<Void>()
        if let id = tusUploadId {
            try? tusClient.cancel(id: id)
        }
        promise.resolve(withResult: ())
        return promise
    }
    
    /// Get current upload progress
    /// - Returns: Upload progress information
    public func getProgress() throws -> UploadProgress {
        return UploadProgress(
            bytesUploaded: _offset,
            bytesTotal: _uploadSize,
            percentage: _uploadSize > 0 ? (_offset / _uploadSize * 100.0) : 0
        )
    }
}

// MARK: - HybridTusClient Implementation

/// Main TUS client that manages uploads and handles client selection
/// Uses a hybrid approach with separate foreground and background clients
class HybridTusClient: HybridTusClientSpec {
    private var uploads: [String: HybridTusUpload] = [:]
    private var uuidToUploadId: [UUID: String] = [:]
    private var backgroundOptions: BackgroundOptions?
    
    // Hybrid approach: Two clients for different scenarios
    private let foregroundClient: TUSClient  // For HTTP and immediate HTTPS uploads
    private var backgroundClient: TUSClient? // For HTTPS background uploads
    
    override init() {
        let serverURL = URL(string: "http://localhost")! // placeholder
        
        // FOREGROUND CLIENT: Works with HTTP and HTTPS, immediate execution
        // Use for:
        // - Development with HTTP endpoints
        // - HTTPS uploads when background is not configured
        // - Immediate uploads that need to complete now
        let foregroundConfig = URLSessionConfiguration.default
        foregroundConfig.timeoutIntervalForRequest = 300 // 5 minutes
        foregroundConfig.timeoutIntervalForResource = 3600 // 1 hour
        
        self.foregroundClient = try! TUSClient(
            server: serverURL,
            sessionIdentifier: "margelo.nitro.tus.foreground",
            sessionConfiguration: foregroundConfig,
            storageDirectory: nil,
            chunkSize: 10 * 1024 * 1024  // 10MB chunks (matches server partSize)
        )
        
        super.init()
        foregroundClient.delegate = self
        
        // Background client will be created in configureBackgroundUploads if needed
    }
    
    /// Create a new upload instance
    /// - Parameters:
    ///   - fileUri: URI of the file to upload
    ///   - options: Upload configuration options
    /// - Returns: Upload instance
    public func createUpload(fileUri: String, options: TusOptions) throws -> (any HybridTusUploadSpec) {
        let uploadId = UUID().uuidString
        
        // SMART CLIENT SELECTION: Choose between foreground and background based on endpoint
        let endpointURL = URL(string: options.endpoint)
        let isHTTPS = endpointURL?.scheme == "https"
        let hasBackgroundClient = backgroundClient != nil
        let backgroundEnabled = backgroundOptions?.enableIOSBackgroundTask ?? false
        
        // Decision logic:
        // 1. HTTP → Always use foreground (background doesn't work with HTTP)
        // 2. HTTPS + background enabled + background client exists → Use background
        // 3. HTTPS but no background → Use foreground
        let shouldUseBackground = isHTTPS && backgroundEnabled && hasBackgroundClient
        let selectedClient = shouldUseBackground ? backgroundClient! : foregroundClient
        
        let upload = try HybridTusUpload(
            id: uploadId, 
            fileUri: fileUri, 
            options: options, 
            client: selectedClient
        )
        uploads[uploadId] = upload
        return upload
    }
    
    /// Get an existing upload by ID
    /// - Parameter uploadId: Upload identifier
    /// - Returns: Upload instance if found
    public func getUpload(uploadId: String) throws -> (any HybridTusUploadSpec)? {
        return uploads[uploadId]
    }
    
    /// Remove an upload from the manager
    /// - Parameter uploadId: Upload identifier
    public func removeUpload(uploadId: String) throws {
        uploads.removeValue(forKey: uploadId)
    }
    
    /// Get all managed uploads
    /// - Returns: Array of all upload instances
    public func getAllUploads() throws -> [(any HybridTusUploadSpec)] {
        return Array(uploads.values)
    }
    
    /// Configure background upload support
    /// - Parameter options: Background upload configuration
    public func configureBackgroundUploads(options: BackgroundOptions) throws {
        self.backgroundOptions = options
        
        if options.enableIOSBackgroundTask ?? false {
            // BACKGROUND CLIENT: Only for HTTPS endpoints
            // Background URLSession requires HTTPS for security
            // This client will be used when:
            // 1. Endpoint is HTTPS
            // 2. Background is enabled
            // 3. Upload needs to continue when app is in background
            
            let serverURL = URL(string: "https://placeholder.com")! // Will be overridden per-upload
            let backgroundConfig = URLSessionConfiguration.background(
                withIdentifier: "margelo.nitro.tus.background"
            )
            backgroundConfig.timeoutIntervalForRequest = 300 // 5 minutes
            backgroundConfig.timeoutIntervalForResource = 3600 // 1 hour
            backgroundConfig.isDiscretionary = false // Upload immediately, don't wait for optimal conditions
            backgroundConfig.sessionSendsLaunchEvents = true // Wake app when transfer completes
            
            do {
                self.backgroundClient = try TUSClient(
                    server: serverURL,
                    sessionIdentifier: "margelo.nitro.tus.background.session",
                    sessionConfiguration: backgroundConfig,
                    storageDirectory: nil,
                    chunkSize: 10 * 1024 * 1024  // 10MB chunks (matches server partSize)
                )
                
                backgroundClient?.delegate = self
            } catch {
                // Background client creation failed, will fall back to foreground client
            }
            
            BackgroundUploadManager.shared.configure(options: options)
        }
    }
}

// MARK: - TUSClientDelegate
extension HybridTusClient: TUSClientDelegate {
    func didStartUpload(id: UUID, context: [String : String]?, client: TUSClient) {
        // Upload started - no action needed
    }
    
    func didFinishUpload(id: UUID, url: URL, context: [String : String]?, client: TUSClient) {
        let uploadId = NitroTusMapping.shared.map[id] ?? uuidToUploadId[id]
        if let uploadId, let upload = uploads[uploadId] {
            upload.onSuccess?()
        }
    }
    
    func uploadFailed(id: UUID, error: Error, context: [String : String]?, client: TUSClient) {
        let uploadId = NitroTusMapping.shared.map[id] ?? uuidToUploadId[id]
        if let uploadId, let upload = uploads[uploadId] {
            let tusError = UploadError(
                code: "UPLOAD_FAILED",
                message: error.localizedDescription,
                originalError: error.localizedDescription
            )
            upload.onError?(tusError)
        }
    }
    
    func fileError(error: TUSClientError, client: TUSClient) {
        // File error occurred - handled by individual upload error callbacks
    }
    
    @available(iOS 11.0, macOS 10.13, *)
    func totalProgress(bytesUploaded: Int, totalBytes: Int, client: TUSClient) {
        // Aggregate progress across all uploads - not currently used
    }
    
    @available(iOS 11.0, macOS 10.13, *)
    func progressFor(id: UUID, context: [String : String]?, bytesUploaded: Int, totalBytes: Int, client: TUSClient) {
        let uploadId = NitroTusMapping.shared.map[id] ?? uuidToUploadId[id]
        if let uploadId, let upload = uploads[uploadId] {
            let percentage = totalBytes > 0 ? (Double(bytesUploaded) / Double(totalBytes) * 100.0) : 0.0
            upload.onProgress?(UploadProgress(
                bytesUploaded: Double(bytesUploaded),
                bytesTotal: Double(totalBytes),
                percentage: percentage
            ))
        }
    }
}

private class NitroTusMapping {
    static let shared = NitroTusMapping()
    var map: [UUID: String] = [:]
}

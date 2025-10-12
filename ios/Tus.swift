import Foundation
import TUSKit
import BackgroundTasks

// MARK: - HybridTusUpload Implementation
class HybridTusUpload: HybridTusUploadSpec {
    private var tusUpload: TUSUpload?
    private var uploadTask: TUSUploadTask?
    private let _id: String
    private var _url: String?
    private let _file: String
    private var _uploadSize: Double
    private var _offset: Double = 0
    private var _metadata: [String: String]
    private var isPaused: Bool = false
    
    // Event callbacks
    public var onProgress: ((UploadProgress) -> Void)?
    public var onSuccess: (() -> Void)?
    public var onError: ((UploadError) -> Void)?
    public var onChunkComplete: ((Double, Double, Double) -> Void)?
    
    init(id: String, fileUri: String, options: TusOptions) throws {
        self._id = id
        self._file = fileUri
        self._metadata = options.metadata ?? [:]
        
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
        
        // Create TUSUpload
        self.tusUpload = TUSUpload(
            withDataLocationURL: fileURL,
            uploadURL: URL(string: options.endpoint)!,
            metadata: options.metadata ?? [:]
        )
        
        super.init(hybridContext: .init())
    }
    
    // MARK: - Properties
    public var id: String { _id }
    public var url: String? { _url }
    public var file: String { _file }
    public var uploadSize: Double { _uploadSize }
    public var offset: Double { _offset }
    public var metadata: [String: String] { _metadata }
    
    // MARK: - Methods
    public func start() throws -> Promise<Void> {
        let promise = Promise<Void>()
        
        guard let upload = tusUpload else {
            promise.reject(NSError(domain: "TusError", code: -3, userInfo: [NSLocalizedDescriptionKey: "Upload not initialized"]))
            return promise
        }
        
        isPaused = false
        
        // Create upload task
        uploadTask = TUSClient.shared.uploadOrResume(forUpload: upload) { [weak self] result in
            guard let self = self else { return }
            
            switch result {
            case .success(let upload):
                self._url = upload.uploadURL?.absoluteString
                self._offset = self._uploadSize
                self.onSuccess?()
                promise.resolve(())
                
            case .failure(let error):
                let tusError = UploadError(
                    code: "UPLOAD_FAILED",
                    message: error.localizedDescription,
                    originalError: error.localizedDescription
                )
                self.onError?(tusError)
                promise.reject(error)
            }
        }
        
        // Progress handler
        uploadTask?.progressHandler = { [weak self] bytesUploaded, bytesTotal in
            guard let self = self else { return }
            self._offset = Double(bytesUploaded)
            
            let progress = UploadProgress(
                bytesUploaded: Double(bytesUploaded),
                bytesTotal: Double(bytesTotal),
                percentage: Double(bytesUploaded) / Double(bytesTotal) * 100.0
            )
            
            self.onProgress?(progress)
        }
        
        return promise
    }
    
    public func pause() throws {
        isPaused = true
        uploadTask?.cancel()
    }
    
    public func resume() throws -> Promise<Void> {
        return try start()
    }
    
    public func abort() throws -> Promise<Void> {
        let promise = Promise<Void>()
        uploadTask?.cancel()
        promise.resolve(())
        return promise
    }
    
    public func getProgress() throws -> UploadProgress {
        return UploadProgress(
            bytesUploaded: _offset,
            bytesTotal: _uploadSize,
            percentage: _uploadSize > 0 ? (_offset / _uploadSize * 100.0) : 0
        )
    }
}

// MARK: - HybridTusClient Implementation
class HybridTusClient: HybridTusClientSpec {
    private var uploads: [String: HybridTusUpload] = [:]
    private var backgroundOptions: BackgroundOptions?
    
    override init(hybridContext: HybridContext) {
        super.init(hybridContext: hybridContext)
        
        // Configure TUSKit
        TUSClient.shared.delegate = self
    }
    
    public func createUpload(fileUri: String, options: TusOptions) throws -> HybridTusUpload {
        let uploadId = UUID().uuidString
        let upload = try HybridTusUpload(id: uploadId, fileUri: fileUri, options: options)
        uploads[uploadId] = upload
        return upload
    }
    
    public func getUpload(uploadId: String) throws -> HybridTusUpload? {
        return uploads[uploadId]
    }
    
    public func removeUpload(uploadId: String) throws {
        uploads.removeValue(forKey: uploadId)
    }
    
    public func getAllUploads() throws -> [HybridTusUpload] {
        return Array(uploads.values)
    }
    
    public func configureBackgroundUploads(options: BackgroundOptions) throws {
        self.backgroundOptions = options
        
        if options.enableIOSBackgroundTask ?? false {
            BackgroundUploadManager.shared.configure(options: options)
        }
    }
}

// MARK: - TUSClientDelegate
extension HybridTusClient: TUSClientDelegate {
    func tusClient(_ client: TUSClient, didStartUpload upload: TUSUpload) {
        // Upload started
    }
    
    func tusClient(_ client: TUSClient, didFinishUpload upload: TUSUpload) {
        // Upload finished
    }
    
    func tusClient(_ client: TUSClient, uploadDidFail upload: TUSUpload, withError error: Error) {
        // Upload failed
    }
}

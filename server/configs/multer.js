import multer from 'multer'
import { createWriteStream } from 'node:fs'
import { mkdtemp, rm, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

// Each request owns an isolated directory, including partially written files.
const storage = {
  _handleFile(req, file, callback) {
    const path = join(req.uploadDirectory, randomUUID())
    const output = createWriteStream(path)
    req.uploadWrites.push(new Promise((resolve) => output.once('close', resolve)))
    const abort = () => file.stream.destroy(new Error('Upload interrupted.'))
    req.once('aborted', abort)
    file.stream.once('error', () => output.destroy())
    output.once('close', () => req.removeListener('aborted', abort))
    output.once('error', (error) => { file.stream.unpipe(output); file.stream.resume(); callback(error) })
    output.once('finish', () => callback(null, { path, size: output.bytesWritten }))
    file.stream.pipe(output)
    if (req.aborted) abort()
  },
  _removeFile(req, file, callback) {
    unlink(file.path).then(() => callback(), (error) => callback(error.code === 'ENOENT' ? null : error))
  },
}

export function withUpload(field, handler, { directory = tmpdir(), maxSize } = {}) {
  const upload = multer({ storage, ...(maxSize ? { limits: { fileSize: maxSize } } : {}) }).single(field)
  return async (req, res, next) => {
    let folder
    let disconnected = false
    let rejectUpload
    const end = res.end
    let endArgs
    // Keep the function invocation alive until its temporary files are removed.
    // Streaming writes still reach the client immediately.
    res.end = function (...args) { endArgs = args; return this }
    const disconnect = () => {
      disconnected = true
      rejectUpload?.(new Error('Upload interrupted.'))
    }
    req.once('aborted', disconnect)
    res.once('close', disconnect)
    try {
      folder = await mkdtemp(join(directory, 'quickai-upload-'))
      req.uploadDirectory = folder
      req.uploadWrites = []
      if (req.aborted || res.destroyed || disconnected) return
      await new Promise((resolve, reject) => {
        rejectUpload = reject
        upload(req, res, (error) => error ? reject(error) : resolve())
      })
      rejectUpload = null
      if (disconnected || res.destroyed) return
      if (!req.file) return res.status(400).json({ success: false, message: 'Please choose a file to upload.' })
      // Await the controller so cleanup cannot race with PDF/Cloudinary reads.
      await handler(req, res, next)
    } catch (error) {
      console.error('Upload request failed:', error.message)
      if (!res.headersSent && !res.destroyed && !disconnected) {
        res.status(error instanceof multer.MulterError ? 400 : 500).json({
          success: false,
          message: error.code === 'LIMIT_FILE_SIZE' ? 'Resume file size exceeds allowed size (5MB).'
            : error instanceof multer.MulterError ? error.message : 'Upload or processing failed. Please try again.',
        })
      } else if (!res.destroyed && !disconnected) {
        // An interrupted SSE response must close so the client can offer Retry.
        res.end()
      }
    } finally {
      rejectUpload = null
      req.removeListener('aborted', disconnect)
      res.removeListener('close', disconnect)
      await Promise.all(req.uploadWrites || [])
      if (folder) {
        try { await rm(folder, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }) }
        catch (error) { console.error('Temporary upload cleanup failed:', error.message) }
      }
      res.end = end
      if (endArgs && !res.destroyed) end.apply(res, endArgs)
    }
  }
}

export function requireUploadPlan(req, res, next) {
  if (req.plan !== 'premium') {
    return res.status(403).json({ success: false, message: 'This feature is only available for premium subscriptions.' })
  }
  next()
}

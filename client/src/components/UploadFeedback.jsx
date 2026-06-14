const UploadFeedback = ({ loading, progress, errorMessage }) => (
  <div className='mt-3 text-sm text-slate-600' aria-live='polite'>
    {loading && <>
      <p>{progress.phase === 'preparing' ? 'Preparing upload...'
        : progress.phase === 'processing' ? 'Upload complete. Processing...'
        : progress.percent === null ? 'Uploading...' : `Uploading: ${progress.percent}%`}</p>
      {progress.phase === 'uploading' && <progress className='mt-2 w-full' max={100} value={progress.percent ?? undefined} aria-label='File upload progress' />}
    </>}
    {errorMessage && <p role='alert' className='text-red-600'>{errorMessage}</p>}
  </div>
)
export default UploadFeedback

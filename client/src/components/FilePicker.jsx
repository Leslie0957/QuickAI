const FilePicker = ({ accept, file, label, onChange }) => (
  <label className='relative mt-2 flex w-full cursor-pointer items-center gap-3 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-600 transition-colors hover:border-gray-400 focus-within:ring-2 focus-within:ring-blue-400'>
    <input
      aria-label={label}
      type='file'
      accept={accept}
      onChange={onChange}
      required
      className='absolute inset-0 h-full w-full cursor-pointer opacity-0'
    />
    <span className='shrink-0'>Choose file</span>
    <span className='min-w-0 truncate'>{file?.name || 'No file chosen'}</span>
  </label>
)

export default FilePicker

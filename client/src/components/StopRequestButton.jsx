const StopRequestButton = ({ onClick, stopping = false, label = 'Stop generating' }) => (
  <button type='button' onClick={onClick} disabled={stopping}
    className='mt-3 w-full rounded-lg border border-gray-300 py-2 text-sm cursor-pointer disabled:cursor-not-allowed disabled:opacity-50'>
    {stopping ? 'Stopping...' : label}
  </button>
)

export default StopRequestButton


import './index.css'

function App() {
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 md:flex md:justify-center">
      <main
        className="relative min-h-screen w-full max-w-[500px] overflow-x-hidden bg-white pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] dark:bg-gray-900"
      >
        {/* Status bar safe area */}
        <div className="absolute inset-x-0 top-0 h-[env(safe-area-inset-top)] bg-white dark:bg-gray-900" />

        {/* App content */}
        <div className="p-4">
          <div className="rounded-xl bg-primary-400 p-8 text-center text-white">
            Quizza App Content
          </div>
        </div>

        {/* Home indicator safe area */}
        <div className="absolute inset-x-0 bottom-0 h-[env(safe-area-inset-bottom)] bg-white dark:bg-gray-900" />
      </main>
    </div>
  )
}

export default App

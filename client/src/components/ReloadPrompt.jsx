import React from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { motion, AnimatePresence } from 'framer-motion'
import { RefreshCcw } from 'lucide-react'

function ReloadPrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('SW Registered: ' + r)
    },
    onRegisterError(error) {
      console.log('SW registration error', error)
    },
  })

  const close = () => {
    setOfflineReady(false)
    setNeedRefresh(false)
  }

  return (
    <AnimatePresence>
      {(offlineReady || needRefresh) && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-4 right-4 z-50 p-4 bg-white dark:bg-slate-800 rounded-lg shadow-2xl border border-sky-100 dark:border-slate-700 max-w-sm"
        >
          <div className="flex items-start gap-3">
            <div className="p-2 bg-sky-50 dark:bg-sky-900/30 rounded-full">
              <RefreshCcw className="w-5 h-5 text-sky-600 dark:text-sky-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-slate-900 dark:text-white mb-1">
                {offlineReady ? 'Ready to work offline' : 'Update Available'}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {offlineReady
                  ? 'App is now ready to work offline.'
                  : 'A new version of PPG EMP HUB is available. Refresh to update.'}
              </p>
              <div className="mt-4 flex gap-2">
                {needRefresh && (
                  <button
                    onClick={() => updateServiceWorker(true)}
                    className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium rounded-md transition-colors shadow-sm"
                  >
                    Refresh to Update
                  </button>
                )}
                <button
                  onClick={() => close()}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-sm font-medium rounded-md transition-colors"
                >
                  Later
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default ReloadPrompt

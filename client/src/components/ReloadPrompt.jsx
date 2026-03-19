import React, { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import Swal from 'sweetalert2';
import { motion, AnimatePresence } from 'framer-motion';
import { FaSync, FaShieldAlt, FaRocket } from 'react-icons/fa';

function ReloadPrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('SW Registered: ' + r);
    },
    onRegisterError(error) {
      console.log('SW registration error', error);
    },
  });

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  const handleUpdate = () => {
    // Set a flag to show success message after reload
    localStorage.setItem('pwa_update_success', 'true');
    updateServiceWorker(true);
  };

  useEffect(() => {
    // Check if we just updated
    if (localStorage.getItem('pwa_update_success') === 'true') {
      localStorage.removeItem('pwa_update_success');
      Swal.fire({
        icon: 'success',
        title: 'Update Successful!',
        text: 'PPG EMP HUB has been updated to the latest version.',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 4000,
        background: '#f0f9ff',
        color: '#0369a1',
        iconColor: '#0ea5e9'
      });
    }

    // Optional: Auto-trigger update if needed, or keep it persistent
  }, []);

  return (
    <AnimatePresence>
      {needRefresh && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-sky-900/40 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="bg-white rounded-[40px] shadow-2xl overflow-hidden max-w-sm w-full border border-sky-100"
          >
            <div className="bg-gradient-to-br from-sky-600 to-sky-700 p-8 text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-full opacity-10">
                <FaSync className="text-[150px] absolute -top-10 -left-10 animate-spin-slow" />
              </div>
              <div className="relative z-10">
                <div className="h-20 w-20 bg-white/20 backdrop-blur-md rounded-3xl mx-auto flex items-center justify-center mb-6 border border-white/30 shadow-xl">
                  <FaRocket className="text-white text-3xl animate-bounce" />
                </div>
                <h2 className="text-2xl font-black text-white tracking-tight leading-tight">New Update Available!</h2>
                <p className="text-sky-100 text-sm font-bold mt-2 uppercase tracking-widest opacity-80">Version Synchronization Required</p>
              </div>
            </div>

            <div className="p-8 space-y-6">
              <div className="space-y-4">
                <div className="flex items-start gap-4 p-4 bg-sky-50 rounded-2xl border border-sky-100">
                  <div className="mt-1 h-2 w-2 bg-sky-500 rounded-full shrink-0" />
                  <p className="text-[13px] font-bold text-sky-700 leading-relaxed">
                    A mandatory update is required to ensure the stability and security of PPG EMP HUB.
                  </p>
                </div>
                <div className="flex items-start gap-4 p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                  <FaShieldAlt className="mt-1 text-emerald-500 shrink-0" />
                  <p className="text-[13px] font-bold text-emerald-700 leading-relaxed">
                    All features will be available immediately after this quick update.
                  </p>
                </div>
              </div>

              <button
                onClick={handleUpdate}
                className="w-full py-5 bg-sky-600 hover:bg-sky-700 text-white rounded-3xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-sky-200 transition-all active:scale-95 flex items-center justify-center gap-3 group"
              >
                <FaSync className="group-hover:rotate-180 transition-transform duration-500" />
                Update & Refresh Now
              </button>
              
              <p className="text-[10px] text-center font-black text-gray-300 uppercase tracking-widest">
                No "Update Later" option — System Mandatory
              </p>
            </div>
          </motion.div>
        </div>
      )}

      {offlineReady && !needRefresh && (
        <motion.div
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 50 }}
          className="fixed bottom-6 right-6 z-[9998] p-5 bg-white rounded-2xl shadow-2xl border border-emerald-100 flex items-center gap-4"
        >
          <div className="h-10 w-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-100">
            <FaShieldAlt />
          </div>
          <div>
            <p className="text-[11px] font-black text-gray-800 uppercase tracking-wider">Ready for Offline</p>
            <p className="text-[10px] font-bold text-gray-400">App cached successfully</p>
          </div>
          <button 
            onClick={() => setOfflineReady(false)}
            className="ml-4 p-2 text-gray-300 hover:text-gray-500 transition-colors"
          >
            ×
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default ReloadPrompt;

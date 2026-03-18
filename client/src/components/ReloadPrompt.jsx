import React from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

function ReloadPrompt() {
  // We're using autoUpdate, so we just register it and let it handle updates silently in the background
  useRegisterSW({
    onRegistered(r) {
      console.log('SW Registered for Auto Update: ' + r)
    },
    onRegisterError(error) {
      console.log('SW registration error', error)
    },
  })

  // Return null so no visual "update available" message is ever shown
  return null
}

export default ReloadPrompt

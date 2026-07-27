import { globals } from '@/globals'
import axios from '@axios'
import Echo from 'laravel-echo'
import Pusher from 'pusher-js'

declare global {
  interface Window {
    Pusher: typeof Pusher
  }
}

window.Pusher = Pusher

const echo = new Echo({
  broadcaster: 'reverb',

  key: globals.reverb.key,

  wsHost: globals.reverb.host,

  wsPort: globals.reverb.port,

  wssPort: globals.reverb.port,

  forceTLS: globals.reverb.scheme === 'https',

  enabledTransports: ['ws', 'wss'],

  authEndpoint: `${globals.api}/broadcasting/auth`,

  authorizer: (channel: any) => {
    return {
      authorize: (socketId: string, callback: (error: boolean, data: any) => void) => {
        axios
          .post(`${globals.api}/broadcasting/auth`, {
            socket_id: socketId,
            channel_name: channel.name,
          })
          .then(response => callback(false, response.data))
          .catch(error => callback(true, error))
      },
    }
  },
})

export default echo

// ── Connection diagnostics — logs raw Reverb/Pusher socket state so
// silent failures are traceable instead of just "nothing happened."
echo.connector.pusher.connection.bind('state_change', (states: { previous: string; current: string }) => {
  console.log(`[Reverb] ${states.previous} → ${states.current}`)
})

echo.connector.pusher.connection.bind('error', (err: any) => {
  console.error('[Reverb] connection error:', err)
})

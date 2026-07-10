import { globals } from '@/globals'
import Echo from 'laravel-echo'
import Pusher from 'pusher-js'

declare global {
  interface Window {
    Pusher: typeof Pusher
  }
}

window.Pusher = Pusher

const token = localStorage.getItem('auth_token')

const echo = new Echo({
  broadcaster: 'reverb',

  key: globals.reverb.key,

  wsHost: globals.reverb.host,

  wsPort: globals.reverb.port,

  wssPort: globals.reverb.port,

  forceTLS: globals.reverb.scheme === 'https',

  enabledTransports: ['ws', 'wss'],

  authEndpoint: `${globals.api}/broadcasting/auth`,

  auth: {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  },
})

export default echo

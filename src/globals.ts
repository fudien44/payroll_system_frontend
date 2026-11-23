interface Globals {
  api: string

  reverb: {
    host: string
    port: number
    key: string
    scheme: 'http' | 'https'
  }
}

export const globals: Globals = {
  api: 'http://192.168.1.65:8091',
  reverb: {
    host: '192.168.1.65',
    port: 8091,
    key: 'hu882a2okihcyczisf6y',
    scheme: 'http',
  },
}

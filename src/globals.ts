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
  api: 'http://127.0.0.1:8000',
  // api: 'http://10.10.123.41:8000',
  // api: 'http://10.10.122.29:8000',
  // api: 'http://10.10.120.96:8000',

  reverb: {
    host: '10.10.123.41',
    port: 8080,
    key: 'hu882a2okihcyczisf6y',
    scheme: 'http',
  },
  }

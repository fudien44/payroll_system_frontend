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
<<<<<<< HEAD
  // api: 'http://127.0.0.1:8000',
  // api: 'http://10.10.123.41:8000',
  api: 'http://10.10.122.29:8000',
  // api: 'http://192.168.1.76',
  // api: 'http://10.10.120.96:8000',

  reverb: {
    host: '10.10.122.29',
=======
  api: 'http://127.0.0.1:8000',
  // api: 'http://10.10.123.41:8000',
  // api: 'http://10.10.122.29:8000',
  // api: 'http://10.10.120.96:8000',

  reverb: {
    host: '127.0.0.1',
>>>>>>> 4a097cc0875ac42e0392268c522c041e9af8883d
    port: 8080,
    key: 'hu882a2okihcyczisf6y',
    scheme: 'http',
  },

}

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
  // api: 'http://127.0.0.1:8000',
  // api: 'http://10.10.123.41:8000',
  api: 'http://10.10.122.29:8000',
  // api: 'http://192.168.1.76',
  // api: 'http://10.10.120.96:8000',

  reverb: {
<<<<<<< HEAD
    host: '10.10.122.29',
=======
    host: '10.10.123.41',
>>>>>>> 7078d17a59c3a7ce85d4a8120cbf30b3a1ebb15f
    port: 8080,
    key: 'hu882a2okihcyczisf6y',
    scheme: 'http',
  },

}

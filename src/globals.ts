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
<<<<<<< HEAD
  // api: 'http://10.10.123.41:8000',
  api: 'http://10.10.122.29:8000',
  // api: 'https://dbms.doh12.com',
  // api: 'http://10.10.120.96:8000',

  reverb: {
    host: '10.10.122.29',
    port: 8080,
    // host: 'dbms.doh12.com',
    // port: 443,
=======
  api: 'http://10.10.123.41:8000',
  // api: 'http://10.10.122.29:8000',
  // api: 'http://192.168.1.76',
  // api: 'http://10.10.120.96:8000',

  reverb: {
    host: '10.10.123.41',
    port: 8080,
>>>>>>> 4b216d204c268e0003f64c7e4ee54d5151ff8c3b
    key: 'hu882a2okihcyczisf6y',
    scheme: 'http',
  },

}

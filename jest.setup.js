// Polyfill para File no ambiente de testes
if (typeof global.File === 'undefined') {
  global.File = function() {};
}

// Compatibility layer for FEB/FAB requests through Jina Reader.
// The discovery module already works without the browser engine. The results
// module still sends that header and the Reader can answer 401. We also turn
// Markdown tables into the plain row format expected by the existing parser.
(() => {
  const nativeFetch = window.fetch.bind(window);

  window.fetch = async (input, init = {}) => {
    const requestUrl = typeof input === 'string' ? input : input?.url || '';
    if (!requestUrl.startsWith('https://r.jina.ai/')) return nativeFetch(input, init);

    const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
    headers.delete('x-engine');

    const response = await nativeFetch(input, { ...init, headers });
    const requestedFormat = headers.get('x-respond-with') || '';
    if (requestedFormat !== 'markdown') return response;

    const text = await response.text();
    const normalized = text
      .split(/\r?\n/)
      .map(line => line
        .replace(/^\s*\|\s*/, '')
        .replace(/\s*\|\s*$/, '')
        .replace(/\s*\|\s*/g, ' '))
      .join('\n');

    return new Response(normalized, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    });
  };
})();

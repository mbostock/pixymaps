var hosts = {},
    hostRe = /^(?:([^:\/?\#]+):)?(?:\/\/([^\/?\#]*))?([^?\#]*)(?:\?([^\#]*))?(?:\#(.*))?/,
    maxActive = 4, // per host
    maxAttempts = 4; // per uri

function pixymaps_queue(uri, callback) {
  var hostname = (hostRe.lastIndex = 0, hostRe).exec(uri)[2] || "";

  // Retrieve the host-specific queue.
  var host = hosts[hostname] || (hosts[hostname] = {
    active: 0,
    queued: []
  });

  // Process the host's queue, perhaps immediately starting our request.
  load.attempt = 0;
  host.queued.push(load);
  process(host);

  // Issue the HTTP request.
  function load() {
    var image = new Image();
    image.onload = end;
    image.onerror = error;
    image.src = uri;
  }

  // Handle the HTTP response.
  // Hooray, callback our available data!
  function end() {
    host.active--;
    callback(this);
    process(host);
  }

  // Boo, an error occurred. We should retry, maybe.
  function error(error) {
    host.active--;
    if (++load.attempt < maxAttempts) {
      host.queued.push(load);
    } else {
      callback(null);
    }
    process(host);
  }
};

function process(host) {
  if (host.active >= maxActive || !host.queued.length) return;
  host.active++;
  host.queued.pop()();
}

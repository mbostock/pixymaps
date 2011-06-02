var cache = {},
    head = null,
    tail = null,
    size = 0,
    maxSize = 512;

function pixymaps_cache(key, callback) {
  var value = cache[key];

  // If this value is in the cache…
  if (value) {

    // Move it to the front of the least-recently used list.
    if (value.previous) {
      value.previous.next = value.next;
      if (value.next) value.next.previous = value.previous;
      else tail = value.previous;
      value.previous = null;
      value.next = head;
      head.previous = value;
      head = value;
    }

    // If the value is loaded, callback.
    // Otherwise, add the callback to the list.
    return value.callbacks
        ? value.callbacks.push(callback)
        : callback(value.value);
  }

  // Otherwise, add the value to the cache.
  value = cache[key] = {
    key: key,
    next: head,
    previous: null,
    callbacks: [callback]
  };

  // Add the value to the front of the least-recently used list.
  if (head) head.previous = value;
  else tail = value;
  head = value;
  size++;

  // Flush any extra values.
  flush();

  // Load the requested resource!
  pixymaps_queue(key, function(image) {
    var callbacks = value.callbacks;
    delete value.callbacks; // must be deleted before callback!
    value.value = image;
    callbacks.forEach(function(callback) { callback(image); });
  });
};

function flush() {
  for (var value = tail; size > maxSize && value; value = value.previous) {
    size--;
    delete cache[value.key];
    if (value.next) value.next.previous = value.previous;
    else if (tail = value.previous) tail.next = null;
    if (value.previous) value.previous.next = value.next;
    else if (head = value.next) head.previous = null;
  }
}

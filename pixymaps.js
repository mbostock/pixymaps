(function(){pixymaps = {version: "0.0.1"}; // semver
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
pixymaps.image = function() {
  var image = {},
      view,
      url,
      zoom = Math.round;

  image.view = function(x) {
    if (!arguments.length) return view;
    view = x;
    return image;
  };

  image.url = function(x) {
    if (!arguments.length) return url;
    url = typeof x === "string" && /{.}/.test(x) ? _url(x) : x;
    return image;
  };

  image.zoom = function(x) {
    if (!arguments.length) return zoom;
    zoom = typeof x === "function" ? x : function() { return x; };
    return image;
  };

  image.render = function(canvas, callback) {
    var context = canvas.getContext("2d"),
        viewSize = view.size(),
        viewAngle = view.angle(),
        viewCenter = view.center(),
        viewZoom = viewCenter[2],
        coordinateSize = view.coordinateSize();

    // compute the zoom offset and scale
    var dz = viewZoom - (viewZoom = zoom(viewZoom)),
        kz = Math.pow(2, -dz);

    // compute the coordinates of the four corners
    var c0 = view.coordinate([0, 0]),
        c1 = view.coordinate([viewSize[0], 0]),
        c2 = view.coordinate(viewSize),
        c3 = view.coordinate([0, viewSize[1]]);

    // apply the zoom offset to our coordinates
    c0[0] *= kz; c1[0] *= kz; c2[0] *= kz; c3[0] *= kz;
    c0[1] *= kz; c1[1] *= kz; c2[1] *= kz; c3[1] *= kz;
    c0[2] =      c1[2] =      c2[2] =      c3[2] -= dz;

    // compute the bounding box
    var x0 = Math.floor(Math.min(c0[0], c1[0], c2[0], c3[0])),
        x1 = Math.ceil(Math.max(c0[0], c1[0], c2[0], c3[0])),
        y0 = Math.floor(Math.min(c0[1], c1[1], c2[1], c3[1])),
        y1 = Math.ceil(Math.max(c0[1], c1[1], c2[1], c3[1])),
        dx = coordinateSize[0],
        dy = coordinateSize[1];

    // compute the set of visible tiles using scan conversion
    var tiles = [], z = c0[2], remaining = 0;
    scanTriangle(c0, c1, c2, push);
    scanTriangle(c2, c3, c0, push);
    function push(x, y) { remaining = tiles.push([x, y, z]); }

    // set the canvas size and transform
    var tx = viewSize[0] / 2 + dx * (x0 - viewCenter[0] * kz) | 0,
        ty = viewSize[1] / 2 + dy * (y0 - viewCenter[1] * kz) | 0;
    canvas.style.webkitTransform = "matrix3d(1,0,0,0,0,1,0,0,0,0,1,0," + tx + "," + ty + ",0,1)";
    canvas.width = (x1 - x0) * dx;
    canvas.height = (y1 - y0) * dy;

    // load each tile (hopefully from the cache) and draw it to the canvas
    tiles.forEach(function(tile) {
      var key = url(tile);

      // If there's something to show for this tile, show it.
      return key == null ? done() : pixymaps_cache(key, function(image) {
        context.drawImage(image, dx * (tile[0] - x0), dy * (tile[1] - y0));
        done();
      });

      // if that was the last tile, callback!
      function done() {
        if (!--remaining && callback) {
          callback();
        }
      }
    });

    return image;
  };

  return image;
};

// scan-line conversion
function edge(a, b) {
  if (a[1] > b[1]) { var t = a; a = b; b = t; }
  return {
    x0: a[0],
    y0: a[1],
    x1: b[0],
    y1: b[1],
    dx: b[0] - a[0],
    dy: b[1] - a[1]
  };
}

// scan-line conversion
function scanSpans(e0, e1, load) {
  var y0 = Math.floor(e1.y0),
      y1 = Math.ceil(e1.y1);

  // sort edges by x-coordinate
  if ((e0.x0 == e1.x0 && e0.y0 == e1.y0)
      ? (e0.x0 + e1.dy / e0.dy * e0.dx < e1.x1)
      : (e0.x1 - e1.dy / e0.dy * e0.dx < e1.x0)) {
    var t = e0; e0 = e1; e1 = t;
  }

  // scan lines!
  var m0 = e0.dx / e0.dy,
      m1 = e1.dx / e1.dy,
      d0 = e0.dx > 0, // use y + 1 to compute x0
      d1 = e1.dx < 0; // use y + 1 to compute x1
  for (var y = y0; y < y1; y++) {
    var x0 = Math.ceil(m0 * Math.max(0, Math.min(e0.dy, y + d0 - e0.y0)) + e0.x0),
        x1 = Math.floor(m1 * Math.max(0, Math.min(e1.dy, y + d1 - e1.y0)) + e1.x0);
    for (var x = x1; x < x0; x++) {
      load(x, y);
    }
  }
}

// scan-line conversion
function scanTriangle(a, b, c, load) {
  var ab = edge(a, b),
      bc = edge(b, c),
      ca = edge(c, a);

  // sort edges by y-length
  if (ab.dy > bc.dy) { var t = ab; ab = bc; bc = t; }
  if (ab.dy > ca.dy) { var t = ab; ab = ca; ca = t; }
  if (bc.dy > ca.dy) { var t = bc; bc = ca; ca = t; }

  // scan span! scan span!
  if (ab.dy) scanSpans(ca, ab, load);
  if (bc.dy) scanSpans(ca, bc, load);
}
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
pixymaps.url = function(template) {
  var hosts = [],
      repeat = "repeat-x"; // repeat, repeat-y, no-repeat

  function format(c) {
    var x = c[0], y = c[1], z = c[2], max = 1 << z;

    // Repeat-x and repeat-y.
    if (/^repeat(-x)?$/.test(repeat) && (x = x % max) < 0) x += max;
    if (/^repeat(-y)?$/.test(repeat) && (y = y % max) < 0) y += max;
    if (z < 0 || x < 0 || x >= max || y < 0 || y >= max) return null;

    return template.replace(/{(.)}/g, function(s, v) {
      switch (v) {
        case "X": return x;
        case "Y": return y;
        case "Z": return z;
        case "S": return hosts[Math.abs(x + y + z) % hosts.length];
      }
      return v;
    });
  }

  format.template = function(x) {
    if (!arguments.length) return template;
    template = x;
    return format;
  };

  format.hosts = function(x) {
    if (!arguments.length) return hosts;
    hosts = x;
    return format;
  };

  format.repeat = function(x) {
    if (!arguments.length) return repeat;
    repeat = x;
    return format;
  };

  return format;
};
pixymaps.view = function() {
  var view = {},
      size = [0, 0],
      coordinateSize = [256, 256],
      center = [.5, .5, 0],
      angle = 0,
      angleCos = 1, // Math.cos(angle)
      angleSin = 0, // Math.sin(angle)
      angleCosi = 1, // Math.cos(-angle)
      angleSini = 0; // Math.sin(-angle)

  view.point = function(coordinate) {
    var kc = Math.pow(2, center[2] - (coordinate.length < 3 ? 0 : coordinate[2])),
        dx = (coordinate[0] * kc - center[0]) * coordinateSize[0],
        dy = (coordinate[1] * kc - center[1]) * coordinateSize[1];
    return [
      size[0] / 2 + angleCos * dx - angleSin * dy,
      size[1] / 2 + angleSin * dx + angleCos * dy
    ];
  };

  view.coordinate = function(point) {
    var dx = (point[0] - size[0] / 2);
        dy = (point[1] - size[1] / 2);
    return [
      center[0] + (angleCosi * dx - angleSini * dy) / coordinateSize[0],
      center[1] + (angleSini * dx + angleCosi * dy) / coordinateSize[1],
      center[2]
    ];
  };

  // The number of points in a coordinate at zoom level 0.
  view.coordinateSize = function(x) {
    if (!arguments.length) return coordinateSize;
    coordinateSize = x;
    return view;
  };

  view.size = function(x) {
    if (!arguments.length) return size;
    size = x;
    return view;
  };

  view.center = function(x) {
    if (!arguments.length) return center;
    center = x;
    if (center.length < 3) center[2] = 0;
    return view;
  };

  view.zoom = function(x) {
    if (!arguments.length) return center[2];
    return zoomBy(x - center[2]);
  };

  view.angle = function(x) {
    if (!arguments.length) return angle;
    angle = x;
    angleCos = Math.cos(angle);
    angleSin = Math.sin(angle);
    angleCosi = Math.cos(-angle);
    angleSini = Math.sin(-angle);
    return view;
  };

  view.panBy = function(x) {
    return view.center([
      center[0] - (angleSini * x[1] + angleCosi * x[0]) / coordinateSize[0],
      center[1] - (angleCosi * x[1] - angleSini * x[0]) / coordinateSize[1],
      center[2]
    ]);
  };

  function zoomBy(x) {
    var k = Math.pow(2, x);
    return view.center([
      center[0] * k,
      center[1] * k,
      center[2] + x
    ]);
  }

  view.zoomBy = function(x, point, coordinate) {
    if (arguments.length < 2) return zoomBy(x);

    // compute the coordinate of the center point
    if (arguments.length < 3) coordinate = view.coordinate(point);

    // compute the new point of the coordinate
    var point2 = zoomBy(x).point(coordinate);

    // pan so that the point and coordinate match after zoom
    return view.panBy([point[0] - point2[0], point[1] - point2[1]]);
  };

  view.rotateBy = function(x) {
    return view.angle(angle + x);
  };

  return view;
};
})()
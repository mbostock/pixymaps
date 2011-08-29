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

  image.render = function(context, callback) {
    var viewSize = view.size(),
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

    // allocate an offscreen buffer to draw tiles
    var offcanvas = document.createElement("canvas"),
        offcontext = offcanvas.getContext("2d");

    // disable offscreen antialiasing; that happens at the end
    offcontext.antialias = "none";
    offcanvas.width = (x1 - x0) * dx;
    offcanvas.height = (y1 - y0) * dy;

    // compute the set of visible tiles using scan conversion
    var tiles = [], z = c0[2], remaining = 0;
    scanTriangle(c0, c1, c2, push);
    scanTriangle(c2, c3, c0, push);
    function push(x, y) { remaining = tiles.push([x, y, z]); }

    // load each tile (hopefully from the cache) and draw it to the canvas
    tiles.forEach(function(tile) {
      var key = url(tile);

      // If there's something to show for this tile, show it.
      return key == null ? done() : pixymaps_cache(key, function(image) {
        offcontext.drawImage(image, dx * (tile[0] - x0), dy * (tile[1] - y0));
        done();
      });

      // if that was the last tile, draw onscreen and callback!
      function done() {
        if (!--remaining) {
          context.save();
          context.translate(viewSize[0] / 2, viewSize[1] / 2);
          context.rotate(viewAngle);
          context.scale(1 / kz, 1 / kz);
          context.drawImage(offcanvas, dx * (x0 - viewCenter[0] * kz) | 0, dy * (y0 - viewCenter[1] * kz) | 0);
          context.restore();

          if (callback) callback();
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

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

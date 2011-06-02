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

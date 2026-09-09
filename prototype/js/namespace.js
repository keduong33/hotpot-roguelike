(function (global) {
  var Hotpot = {
    VERSION: 1,
    config: null,
    state: null
  };

  Hotpot.clone = function (value) {
    return JSON.parse(JSON.stringify(value));
  };

  Hotpot.round = function (n) {
    return Math.round(n * 100) / 100;
  };

  Hotpot.escapeHtml = function (value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  };

  Hotpot.shuffle = function (list) {
    var i, j, tmp;
    for (i = list.length - 1; i > 0; i--) {
      j = Math.floor(Math.random() * (i + 1));
      tmp = list[i];
      list[i] = list[j];
      list[j] = tmp;
    }
    return list;
  };

  Hotpot.log = function (state, message) {
    if (!state) return;
    if (!state.log) state.log = [];
    state.log.unshift("T" + state.turn + ": " + message);
    if (state.log.length > 80) state.log.length = 80;
  };

  Hotpot.note = function (ctx, message) {
    if (ctx.snapshot) {
      if (!ctx.snapshot.triggeredEffects) ctx.snapshot.triggeredEffects = [];
      ctx.snapshot.triggeredEffects.push(message);
    }
    if (ctx.state && !ctx.snapshot) Hotpot.log(ctx.state, message);
  };

  global.Hotpot = Hotpot;
})(window);

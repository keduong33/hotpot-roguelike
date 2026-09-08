(function (Hotpot) {
  function whenMatches(when, target, config) {
    var tag, i, inst;
    if (!when) return true;
    if (when.anyInPot && when.anyInPot.hasTag) {
      tag = when.anyInPot.hasTag;
      for (i = 0; i < target.pot.length; i++) {
        inst = target.pot[i];
        if (Hotpot.hasTag(inst, tag, config)) return true;
      }
      return false;
    }
    return true;
  }

  Hotpot.evaluateSynergies = function (trigger, ctx) {
    var config = ctx.config || Hotpot.config;
    var target = ctx.snapshot || ctx.state;
    var list = (config && config.synergies) || [];
    var i, syn;
    for (i = 0; i < list.length; i++) {
      syn = list[i];
      if (syn.trigger !== trigger) continue;
      if (!whenMatches(syn.when, target, config)) continue;
      if (ctx.snapshot) {
        if (!ctx.snapshot.triggeredSynergies) ctx.snapshot.triggeredSynergies = [];
        ctx.snapshot.triggeredSynergies.push(syn.name);
      } else if (ctx.state) {
        Hotpot.log(ctx.state, "Synergy: " + syn.name);
      }
      Hotpot.applyEffect(syn.then, ctx);
    }
  };
})(window.Hotpot);

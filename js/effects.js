(function (Hotpot) {
  function soupOf(ctx) {
    return (ctx.snapshot || ctx.state).soup;
  }

  function potOf(ctx) {
    return (ctx.snapshot || ctx.state).pot;
  }

  function formatDelta(amount) {
    return amount >= 0 ? "+" + amount : String(amount);
  }

  function inTargetList(inst, ctx) {
    var list, i;
    if (!ctx || !ctx.targetInstances) return true;
    list = ctx.targetInstances;
    for (i = 0; i < list.length; i++) {
      if (list[i] === inst || (list[i] && list[i].instanceId === inst.instanceId)) return true;
    }
    return false;
  }

  function instanceMatches(inst, effect, config, ctx) {
    var tags;
    var unless;
    if (!inTargetList(inst, ctx)) return false;
    tags = Hotpot.matcherTagList(effect);
    unless = Hotpot.unlessTagList(effect);
    if (tags.length && !Hotpot.hasAllTags(inst, tags, config)) return false;
    if (unless.length && Hotpot.hasAllTags(inst, unless, config)) return false;
    return true;
  }

  Hotpot.isModifyPointsType = function (type) {
    return type === "modifyPoints" || type === "modifyIngredientPoints" || type === "modifyBonusPoints";
  };

  Hotpot.instancePointMods = function (instance) {
    if (!instance) return 0;
    return (instance.pointMods || 0) + (instance.bonusPoints || 0) + (instance.synergyPointMods || 0);
  };

  function modifySoup(effect, ctx) {
    var soup = soupOf(ctx);
    var property = effect.property;
    var amount = effect.amount || 0;
    var source = ctx.sourceInstance;
    var def;
    if (!property) return;
    if (!soup.properties) soup.properties = {};
    soup.properties[property] = (soup.properties[property] || 0) + amount;
    def = source ? Hotpot.getIngredientDef(source.defId, ctx.config) : null;
    Hotpot.note(ctx, (def ? def.name : "Effect") + ": " + property + " " + formatDelta(amount));
  }

  function modifyPoints(effect, ctx) {
    var config = ctx.config;
    var pot = potOf(ctx);
    var i, inst, def, delta;
    for (i = 0; i < pot.length; i++) {
      inst = pot[i];
      if (!instanceMatches(inst, effect, config, ctx)) continue;
      if (effect.perTurn != null) {
        delta = inst.turnsInPot <= (effect.peakTurns != null ? effect.peakTurns : Infinity)
          ? effect.perTurn
          : (effect.afterPeak != null ? effect.afterPeak : 0);
      } else {
        delta = effect.amount || 0;
      }
      inst.pointMods = (inst.pointMods || 0) + delta;
      def = Hotpot.getIngredientDef(inst.defId, config);
      Hotpot.note(ctx, (def ? def.name : inst.defId) + " points " + formatDelta(delta));
    }
  }

  Hotpot.applyEffect = function (effect, ctx) {
    if (!effect || !effect.type) return;
    if (effect.type === "modifySoup") {
      modifySoup(effect, ctx);
      return;
    }
    if (Hotpot.isModifyPointsType(effect.type)) {
      modifyPoints(effect, ctx);
      return;
    }
    Hotpot.note(ctx, "Unknown effect: " + effect.type);
  };
})(window.Hotpot);

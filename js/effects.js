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

  function instanceMatches(inst, effect, config) {
    if (effect.hasTag && !Hotpot.hasTag(inst, effect.hasTag, config)) return false;
    if (effect.unlessTag && Hotpot.hasTag(inst, effect.unlessTag, config)) return false;
    return true;
  }

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

  function modifyBonusPoints(effect, ctx) {
    var config = ctx.config;
    var pot = potOf(ctx);
    var i, inst, def, delta;
    for (i = 0; i < pot.length; i++) {
      inst = pot[i];
      if (!instanceMatches(inst, effect, config)) continue;
      if (effect.perTurn != null) {
        delta = inst.turnsInPot <= (effect.peakTurns != null ? effect.peakTurns : Infinity)
          ? effect.perTurn
          : (effect.afterPeak != null ? effect.afterPeak : 0);
      } else {
        delta = effect.amount || 0;
      }
      inst.bonusPoints = (inst.bonusPoints || 0) + delta;
      def = Hotpot.getIngredientDef(inst.defId, config);
      Hotpot.note(ctx, (def ? def.name : inst.defId) + " bonus " + formatDelta(delta));
    }
  }

  function modifyIngredientPoints(effect, ctx) {
    var config = ctx.config;
    var pot = potOf(ctx);
    var amount = effect.amount || 0;
    var i, inst, def;
    for (i = 0; i < pot.length; i++) {
      inst = pot[i];
      if (!instanceMatches(inst, effect, config)) continue;
      inst.synergyPointMods = (inst.synergyPointMods || 0) + amount;
      def = Hotpot.getIngredientDef(inst.defId, config);
      Hotpot.note(ctx, (def ? def.name : inst.defId) + " points " + formatDelta(amount));
    }
  }

  Hotpot.applyEffect = function (effect, ctx) {
    if (!effect || !effect.type) return;
    switch (effect.type) {
      case "modifySoup":
        modifySoup(effect, ctx);
        break;
      case "modifyBonusPoints":
        modifyBonusPoints(effect, ctx);
        break;
      case "modifyIngredientPoints":
        modifyIngredientPoints(effect, ctx);
        break;
      default:
        Hotpot.note(ctx, "Unknown effect: " + effect.type);
        break;
    }
  };
})(window.Hotpot);

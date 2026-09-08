(function (Hotpot) {
  Hotpot.tickPotFreshness = function (state, config) {
    var cfg = config || Hotpot.config;
    var i, inst, def, prev;
    for (i = 0; i < state.pot.length; i++) {
      inst = state.pot[i];
      def = Hotpot.getIngredientDef(inst.defId, cfg);
      inst.turnsInState += 1;
      inst.turnsInPot += 1;
      if (!def) continue;
      prev = inst.freshness;
      if (inst.freshness === "fresh" && inst.turnsInState >= def.freshDuration) {
        inst.freshness = "cooked";
        inst.turnsInState = 0;
      } else if (inst.freshness === "cooked" && inst.turnsInState >= def.cookedDuration) {
        inst.freshness = "spoiled";
        inst.turnsInState = 0;
      }
      if (prev !== inst.freshness) {
        Hotpot.log(state, (def.name || inst.defId) + " became " + inst.freshness);
      }
    }
  };
})(window.Hotpot);

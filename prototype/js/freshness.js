(function (Hotpot) {
  var NEXT = {
    fresh: "cooked",
    cooked: "overcooked",
    overcooked: "spoiled"
  };
  var DURATION_KEY = {
    fresh: "freshDuration",
    cooked: "cookedDuration",
    overcooked: "overcookedDuration"
  };

  Hotpot.freshnessCountdown = function (inst, config) {
    var cfg = config || Hotpot.config;
    var def, next, key, duration, left;
    if (!inst || inst.freshness === "spoiled") return "spoiled";
    next = NEXT[inst.freshness];
    if (!next) return inst.freshness;
    def = Hotpot.getIngredientDef(inst.defId, cfg);
    key = DURATION_KEY[inst.freshness];
    duration = def && def[key] != null ? Number(def[key]) : 1;
    if (!(duration >= 0)) duration = 1;
    left = duration - (inst.turnsInState || 0);
    if (left < 1) left = 1;
    if (left === 1) return "1 more turn until " + next;
    return left + " more turns until " + next;
  };

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
        inst.freshness = "overcooked";
        inst.turnsInState = 0;
      } else if (inst.freshness === "overcooked" && inst.turnsInState >= (def.overcookedDuration != null ? def.overcookedDuration : 2)) {
        inst.freshness = "spoiled";
        inst.turnsInState = 0;
      }
      if (prev !== inst.freshness) {
        Hotpot.log(state, (def.name || inst.defId) + " became " + inst.freshness);
      }
    }
  };
})(window.Hotpot);

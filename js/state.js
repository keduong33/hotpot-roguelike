(function (Hotpot) {
  Hotpot.createInstance = function (defId, state) {
    var id = "c_" + state.nextInstanceId;
    state.nextInstanceId += 1;
    return {
      instanceId: id,
      defId: defId,
      freshness: "fresh",
      turnsInState: 0,
      turnsInPot: 0,
      pointMods: 0
    };
  };

  Hotpot.findInstance = function (list, instanceId) {
    var i;
    for (i = 0; i < list.length; i++) {
      if (list[i].instanceId === instanceId) return { item: list[i], index: i };
    }
    return null;
  };

  Hotpot.takeInstance = function (list, instanceId) {
    var found = Hotpot.findInstance(list, instanceId);
    if (!found) return null;
    list.splice(found.index, 1);
    return found.item;
  };

  Hotpot.createGameState = function (config) {
    var cfg = config || Hotpot.config;
    var table = cfg.table || {};
    return {
      turn: 1,
      rerollsLeft: table.startingRerolls != null ? table.startingRerolls : 3,
      runScore: 0,
      soup: Hotpot.makeSoup(table.startingSoupBaseId || "spicy_mala", cfg),
      pot: [],
      hand: [],
      deck: [],
      discard: [],
      customerId: table.startingCustomerId || "spicy_lover",
      lastSubmission: null,
      log: [],
      nextInstanceId: 1
    };
  };

  Hotpot.seedStartingDeck = function (state, config) {
    var cfg = config || Hotpot.config;
    var counts = (cfg.table && cfg.table.startingDeckCounts) || {};
    var defId, n, i;
    for (defId in counts) {
      if (!Object.prototype.hasOwnProperty.call(counts, defId)) continue;
      n = counts[defId] || 0;
      for (i = 0; i < n; i++) {
        if (!Hotpot.getIngredientDef(defId, cfg)) continue;
        state.deck.push(Hotpot.createInstance(defId, state));
      }
    }
    Hotpot.shuffle(state.deck);
  };

  Hotpot.createNewRun = function (config) {
    var cfg = config || Hotpot.config;
    var state = Hotpot.createGameState(cfg);
    Hotpot.seedStartingDeck(state, cfg);
    Hotpot.log(state, "New run. Soup: " + state.soup.baseId);
    return state;
  };
})(window.Hotpot);

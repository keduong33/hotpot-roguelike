(function (Hotpot) {
  function cfg() {
    return Hotpot.config;
  }

  function state() {
    return Hotpot.state;
  }

  Hotpot.maxSubmitIngredients = function (config) {
    var n = Number(config && config.table && config.table.maxSubmitIngredients);
    return n >= 1 ? n : 5;
  };

  Hotpot.handSize = function (config) {
    var n = Number(config && config.table && config.table.handSize);
    return n >= 1 ? n : 5;
  };

  function handFullMessage(config) {
    return "Hand is full (max " + Hotpot.handSize(config) + ")";
  }

  function handRoom(gameState, config) {
    return Math.max(0, Hotpot.handSize(config) - gameState.hand.length);
  }

  function maybeRecycle(gameState, config) {
    if (!config.table || !config.table.recycleDiscard) return;
    if (gameState.deck.length > 0) return;
    if (gameState.discard.length === 0) return;
    gameState.deck = gameState.discard.splice(0, gameState.discard.length);
    Hotpot.shuffle(gameState.deck);
    Hotpot.log(gameState, "Shuffled discard into deck (" + gameState.deck.length + ")");
  }

  function drawCards(gameState, config, count) {
    var drawn = 0;
    var card;
    var room = handRoom(gameState, config);
    if (count > room) count = room;
    while (drawn < count) {
      maybeRecycle(gameState, config);
      if (gameState.deck.length === 0) break;
      card = gameState.deck.pop();
      gameState.hand.push(card);
      drawn += 1;
    }
    return drawn;
  }

  function fillHand(gameState, config) {
    var need = handRoom(gameState, config);
    if (need > 0) drawCards(gameState, config, need);
  }

  function applyCardSoupEffects(gameState, config, instance) {
    var def = Hotpot.getIngredientDef(instance.defId, config);
    var i, effect;
    if (!def) return;
    for (i = 0; i < (def.effects || []).length; i++) {
      effect = def.effects[i];
      if (effect.type === "modifySoup") {
        Hotpot.applyEffect(effect, {
          state: gameState,
          sourceInstance: instance,
          config: config
        });
      }
    }
  }

  function nextCustomer(gameState, config) {
    var list = config.customers || [];
    var i;
    if (!list.length) return;
    for (i = 0; i < list.length; i++) {
      if (list[i].id === gameState.customerId) {
        gameState.customerId = list[(i + 1) % list.length].id;
        return;
      }
    }
    gameState.customerId = list[0].id;
  }

  function pruneServeIds(gameState) {
    var ids = gameState.serveIds || [];
    var inPot = {};
    var next = [];
    var i;
    for (i = 0; i < gameState.pot.length; i++) inPot[gameState.pot[i].instanceId] = true;
    for (i = 0; i < ids.length; i++) {
      if (inPot[ids[i]]) next.push(ids[i]);
    }
    gameState.serveIds = next;
    return next;
  }

  function capServeIds(gameState, config) {
    var max = Hotpot.maxSubmitIngredients(config);
    pruneServeIds(gameState);
    if (gameState.serveIds.length > max) gameState.serveIds = gameState.serveIds.slice(0, max);
    return gameState.serveIds;
  }

  function selectedPotCards(gameState) {
    var ids = pruneServeIds(gameState);
    var want = {};
    var out = [];
    var i;
    for (i = 0; i < ids.length; i++) want[ids[i]] = true;
    for (i = 0; i < gameState.pot.length; i++) {
      if (want[gameState.pot[i].instanceId]) out.push(gameState.pot[i]);
    }
    return out;
  }

  function runEndTurn(gameState, config) {
    gameState.turn += 1;
    Hotpot.tickPotFreshness(gameState, config);
    Hotpot.evaluateSynergies("onEndTurn", { state: gameState, config: config });
    fillHand(gameState, config);
    Hotpot.log(gameState, "Turn ended. Hand " + gameState.hand.length);
    return gameState;
  }

  Hotpot.game = {
    newRun: function () {
      Hotpot.state = Hotpot.createNewRun(cfg());
      fillHand(Hotpot.state, cfg());
      Hotpot.log(Hotpot.state, "Drew opening hand (" + Hotpot.state.hand.length + ")");
      return Hotpot.state;
    },

    draw: function (count) {
      var config = cfg();
      var gameState = state();
      var n = count != null ? count : ((config.table && config.table.drawPerTurn) || 1);
      var drawn;
      var msg;
      if (handRoom(gameState, config) <= 0) {
        msg = handFullMessage(config);
        Hotpot.log(gameState, msg);
        return { ok: false, error: msg, drawn: 0 };
      }
      drawn = drawCards(gameState, config, n);
      Hotpot.log(gameState, "Drew " + drawn);
      return { ok: true, drawn: drawn };
    },

    addToPot: function (instanceId) {
      var gameState = state();
      var config = cfg();
      var card = Hotpot.takeInstance(gameState.hand, instanceId);
      var def;
      if (!card) return false;
      gameState.pot.push(card);
      def = Hotpot.getIngredientDef(card.defId, config);
      Hotpot.log(gameState, "Added " + (def ? def.name : card.defId) + " to pot");
      applyCardSoupEffects(gameState, config, card);
      Hotpot.evaluateSynergies("onAddToPot", {
        state: gameState,
        sourceInstance: card,
        config: config
      });
      return true;
    },

    discard: function (instanceId) {
      var gameState = state();
      var card = Hotpot.takeInstance(gameState.hand, instanceId);
      var def;
      if (!card) return false;
      gameState.discard.push(card);
      def = Hotpot.getIngredientDef(card.defId, cfg());
      Hotpot.log(gameState, "Discarded " + (def ? def.name : card.defId));
      return true;
    },

    reroll: function () {
      var gameState = state();
      var config = cfg();
      var size, drawn;
      if (gameState.rerollsLeft <= 0) {
        Hotpot.log(gameState, "No rerolls left");
        return false;
      }
      while (gameState.hand.length) gameState.discard.push(gameState.hand.pop());
      size = Hotpot.handSize(config);
      drawn = drawCards(gameState, config, size);
      gameState.rerollsLeft -= 1;
      Hotpot.log(gameState, "Rerolled (" + drawn + " drawn, " + gameState.rerollsLeft + " left)");
      return true;
    },

    endTurn: function () {
      return runEndTurn(state(), cfg());
    },

    capServeSelection: function () {
      return capServeIds(state(), cfg());
    },

    toggleServe: function (instanceId) {
      var gameState = state();
      var config = cfg();
      var max = Hotpot.maxSubmitIngredients(config);
      var ids = pruneServeIds(gameState);
      var idx = ids.indexOf(instanceId);
      var msg;
      if (!Hotpot.findInstance(gameState.pot, instanceId)) {
        return { ok: false, error: "That ingredient is not in the pot.", selected: false };
      }
      if (idx >= 0) {
        ids.splice(idx, 1);
        return { ok: true, selected: false, count: ids.length, max: max };
      }
      if (ids.length >= max) {
        msg = "Serve at most " + max + " ingredients";
        Hotpot.log(gameState, msg);
        return { ok: false, error: msg, selected: false, count: ids.length, max: max };
      }
      ids.push(instanceId);
      return { ok: true, selected: true, count: ids.length, max: max };
    },

    submitPot: function (instanceIds) {
      var gameState = state();
      var config = cfg();
      var snapshot;
      var resultsByModel;
      var activeId;
      var activeResult;
      var i;
      var max = Hotpot.maxSubmitIngredients(config);
      var msg;
      var selected;
      var card;
      if (instanceIds && instanceIds.length) {
        gameState.serveIds = instanceIds.slice();
      }
      capServeIds(gameState, config);
      selected = selectedPotCards(gameState);
      if (!gameState.pot.length) {
        msg = "Pot is empty — add ingredients before submit.";
        Hotpot.log(gameState, msg);
        return { ok: false, error: msg };
      }
      if (!selected.length) {
        msg = "Select ingredients to serve.";
        Hotpot.log(gameState, msg);
        return { ok: false, error: msg };
      }
      if (selected.length > max) {
        msg = "Serve at most " + max + " ingredients";
        Hotpot.log(gameState, msg);
        return { ok: false, error: msg };
      }
      snapshot = Hotpot.makeSnapshot(gameState, selected);
      Hotpot.prepareSnapshot(snapshot, config);
      resultsByModel = Hotpot.compareAll(snapshot, config);
      activeId = (config.scoring && config.scoring.activeModel) || "additive";
      activeResult = resultsByModel[activeId] || resultsByModel.additive;
      gameState.runScore = Hotpot.round(gameState.runScore + activeResult.finalScore);
      for (i = 0; i < selected.length; i++) {
        card = Hotpot.takeInstance(gameState.pot, selected[i].instanceId);
        if (card) gameState.discard.push(card);
      }
      gameState.serveIds = [];
      if (config.table && config.table.submitKeepsSoup === false) {
        gameState.soup = Hotpot.makeSoup(gameState.soup.baseId, config);
      }
      if (config.table && config.table.advanceCustomer) nextCustomer(gameState, config);
      gameState.lastSubmission = {
        ok: true,
        snapshot: snapshot,
        resultsByModel: resultsByModel,
        activeResult: activeResult
      };
      Hotpot.log(gameState, "Served " + selected.length + ". " + activeResult.modelId + " = " + activeResult.finalScore + " (run " + gameState.runScore + ")");
      runEndTurn(gameState, config);
      return gameState.lastSubmission;
    },

    changeSoup: function (baseId) {
      var gameState = state();
      var config = cfg();
      var rules = config.changeSoup || {};
      var penalty = rules.scorePenalty || 0;
      var i;
      if (rules.clearPot) {
        for (i = 0; i < gameState.pot.length; i++) gameState.discard.push(gameState.pot[i]);
        gameState.pot = [];
      }
      pruneServeIds(gameState);
      if (rules.resetProperties !== false) {
        gameState.soup = Hotpot.makeSoup(baseId, config);
      } else {
        gameState.soup.baseId = baseId;
      }
      gameState.runScore -= penalty;
      Hotpot.log(gameState, "Changed soup to " + gameState.soup.baseId + " (−" + penalty + ")");
      return gameState.soup;
    },

    setCustomer: function (customerId) {
      if (!Hotpot.getCustomer(customerId, cfg())) return false;
      state().customerId = customerId;
      Hotpot.log(state(), "Customer: " + customerId);
      return true;
    },

    setActiveModel: function (modelId) {
      var gameState = state();
      if (!Hotpot.SCORING_MODELS[modelId]) return false;
      cfg().scoring.activeModel = modelId;
      if (gameState.lastSubmission && gameState.lastSubmission.resultsByModel[modelId]) {
        gameState.lastSubmission.activeResult = gameState.lastSubmission.resultsByModel[modelId];
      }
      return true;
    },

    compareAll: function (preview) {
      var gameState = state();
      var config = cfg();
      var snapshot;
      if (!preview && gameState.lastSubmission) return gameState.lastSubmission.resultsByModel;
      snapshot = Hotpot.makeSnapshot(gameState, selectedPotCards(gameState));
      Hotpot.prepareSnapshot(snapshot, config);
      return Hotpot.compareAll(snapshot, config);
    },

    addDefToPile: function (defId, pileName) {
      var gameState = state();
      var config = cfg();
      var pile = gameState[pileName];
      var inst;
      var msg;
      if (!Hotpot.getIngredientDef(defId, config) || !pile) return null;
      if (pileName === "hand" && handRoom(gameState, config) <= 0) {
        msg = handFullMessage(config);
        Hotpot.log(gameState, msg);
        return { ok: false, error: msg };
      }
      inst = Hotpot.createInstance(defId, gameState);
      pile.push(inst);
      Hotpot.log(gameState, "Spawned " + defId + " into " + pileName);
      return inst;
    }
  };
})(window.Hotpot);

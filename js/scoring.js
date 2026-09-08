(function (Hotpot) {
  function knobs(config, modelId) {
    return (config.scoring && config.scoring.models && config.scoring.models[modelId]) || {};
  }

  function soupSum(snapshot) {
    var props = snapshot.soup.properties || {};
    var total = 0;
    var key;
    for (key in props) {
      if (Object.prototype.hasOwnProperty.call(props, key)) total += props[key] || 0;
    }
    return total;
  }

  function customerWeight(customer, property, modelCfg) {
    if (customer.weights && customer.weights[property] != null) return customer.weights[property];
    if (customer.likes && customer.likes.indexOf(property) !== -1) {
      return modelCfg.likeWeight != null ? modelCfg.likeWeight : 2;
    }
    if (customer.dislikes && customer.dislikes.indexOf(property) !== -1) {
      return modelCfg.dislikeWeight != null ? modelCfg.dislikeWeight : 0.5;
    }
    return modelCfg.defaultWeight != null ? modelCfg.defaultWeight : 1;
  }

  function likeDislikeCounts(snapshot, config) {
    var customer = Hotpot.getCustomer(snapshot.customerId, config) || { likes: [], dislikes: [], thresholds: {} };
    var likesHit = 0;
    var dislikesHit = 0;
    var i, prop, need;
    for (i = 0; i < (customer.likes || []).length; i++) {
      prop = customer.likes[i];
      need = customer.thresholds && customer.thresholds[prop] != null ? customer.thresholds[prop] : 1;
      if ((snapshot.soup.properties[prop] || 0) >= need) likesHit += 1;
    }
    for (i = 0; i < (customer.dislikes || []).length; i++) {
      prop = customer.dislikes[i];
      if ((snapshot.soup.properties[prop] || 0) > 0) dislikesHit += 1;
    }
    return { likesHit: likesHit, dislikesHit: dislikesHit, customer: customer };
  }

  function highestBandBonus(value, bands) {
    var best = 0;
    var i, band;
    for (i = 0; i < bands.length; i++) {
      band = bands[i];
      if (value >= band.min && band.bonus >= best) best = band.bonus;
    }
    return best;
  }

  Hotpot.instanceParts = function (instance, config) {
    var def = Hotpot.getIngredientDef(instance.defId, config);
    var base = def ? def.basePoints : 0;
    var freshness = (config.freshnessModifiers && config.freshnessModifiers[instance.freshness]) || 0;
    var bonus = instance.bonusPoints || 0;
    var synergy = instance.synergyPointMods || 0;
    return {
      base: base,
      freshness: freshness,
      bonus: bonus,
      synergy: synergy,
      total: base + freshness + bonus + synergy
    };
  };

  Hotpot.ingredientContribution = function (instance, snapshot, config) {
    return Hotpot.instanceParts(instance, config).total;
  };

  Hotpot.sumIngredientParts = function (snapshot, config) {
    var ingredient = 0;
    var synergy = 0;
    var i, parts;
    for (i = 0; i < snapshot.pot.length; i++) {
      parts = Hotpot.instanceParts(snapshot.pot[i], config);
      ingredient += parts.base + parts.freshness + parts.bonus;
      synergy += parts.synergy;
    }
    return {
      ingredient: ingredient,
      synergy: synergy,
      combined: ingredient + synergy
    };
  };

  Hotpot.makeSnapshot = function (state) {
    return {
      turn: state.turn,
      customerId: state.customerId,
      soup: Hotpot.clone(state.soup),
      pot: Hotpot.clone(state.pot),
      triggeredSynergies: [],
      triggeredEffects: []
    };
  };

  Hotpot.prepareSnapshot = function (snapshot, config) {
    var i, inst, def, e, j, sign;
    Hotpot.evaluateSynergies("onSubmit", { snapshot: snapshot, config: config });
    for (i = 0; i < snapshot.pot.length; i++) {
      inst = snapshot.pot[i];
      def = Hotpot.getIngredientDef(inst.defId, config);
      if (!def) continue;
      for (j = 0; j < (def.effects || []).length; j++) {
        e = def.effects[j];
        if (e.type !== "modifySoup") continue;
        sign = (e.amount || 0) >= 0 ? "+" : "";
        snapshot.triggeredEffects.push(def.name + ": " + e.property + " " + sign + (e.amount || 0));
      }
    }
    return snapshot;
  };

  function result(modelId, finalScore, breakdown, snapshot) {
    return {
      modelId: modelId,
      finalScore: Hotpot.round(finalScore),
      breakdown: breakdown,
      triggeredSynergies: (snapshot.triggeredSynergies || []).slice(),
      triggeredEffects: (snapshot.triggeredEffects || []).slice()
    };
  }

  function scoreAdditive(snapshot, config) {
    var cfg = knobs(config, "additive");
    var parts = Hotpot.sumIngredientParts(snapshot, config);
    var prefs = likeDislikeCounts(snapshot, config);
    var soupBonus = soupSum(snapshot) * (cfg.soupBonusPerPoint != null ? cfg.soupBonusPerPoint : 0.5);
    var likeBonus = prefs.likesHit * (cfg.likeHitBonus != null ? cfg.likeHitBonus : 8);
    var dislikePen = prefs.dislikesHit * (cfg.dislikePenalty != null ? cfg.dislikePenalty : 5);
    var finalScore = parts.ingredient + parts.synergy + likeBonus - dislikePen + soupBonus;
    return result("additive", finalScore, [
      { label: "Ingredient Points", value: Hotpot.round(parts.ingredient) },
      { label: "Synergy", value: Hotpot.round(parts.synergy) },
      { label: "Like-hit bonuses", value: Hotpot.round(likeBonus) },
      { label: "Dislike penalties", value: Hotpot.round(-dislikePen) },
      { label: "Soup bonus", value: Hotpot.round(soupBonus) }
    ], snapshot);
  }

  function scorePointsMultiplier(snapshot, config) {
    var cfg = knobs(config, "pointsMultiplier");
    var parts = Hotpot.sumIngredientParts(snapshot, config);
    var soupExtra = soupSum(snapshot) * (cfg.soupToMult != null ? cfg.soupToMult : 0.05);
    var mult = (cfg.baseMult != null ? cfg.baseMult : 1) + soupExtra;
    var finalScore = parts.combined * mult;
    return result("pointsMultiplier", finalScore, [
      { label: "Ingredient Points", value: Hotpot.round(parts.ingredient) },
      { label: "Synergy", value: Hotpot.round(parts.synergy) },
      { label: "Points", value: Hotpot.round(parts.combined) },
      { label: "Multiplier", value: Hotpot.round(mult) }
    ], snapshot);
  }

  function scoreSoupMultiplier(snapshot, config) {
    var cfg = knobs(config, "soupMultiplier");
    var parts = Hotpot.sumIngredientParts(snapshot, config);
    var mult = 1 + soupSum(snapshot) * (cfg.soupToMult != null ? cfg.soupToMult : 0.04);
    var finalScore = parts.combined * mult;
    return result("soupMultiplier", finalScore, [
      { label: "Ingredient Points", value: Hotpot.round(parts.ingredient) },
      { label: "Synergy", value: Hotpot.round(parts.synergy) },
      { label: "Multiplier", value: Hotpot.round(mult) }
    ], snapshot);
  }

  function scoreCustomerWeighted(snapshot, config) {
    var cfg = knobs(config, "customerWeighted");
    var parts = Hotpot.sumIngredientParts(snapshot, config);
    var customer = Hotpot.getCustomer(snapshot.customerId, config) || { likes: [], dislikes: [] };
    var props = snapshot.soup.properties || {};
    var soupScore = 0;
    var key, weight, contrib;
    var soupLines = [];
    for (key in props) {
      if (!Object.prototype.hasOwnProperty.call(props, key)) continue;
      weight = customerWeight(customer, key, cfg);
      contrib = (props[key] || 0) * weight;
      soupScore += contrib;
      if (props[key]) soupLines.push({ label: "Soup " + key + " × " + weight, value: Hotpot.round(contrib) });
    }
    var breakdown = [
      { label: "Ingredient Points", value: Hotpot.round(parts.ingredient) },
      { label: "Synergy", value: Hotpot.round(parts.synergy) },
      { label: "Weighted soup", value: Hotpot.round(soupScore) }
    ].concat(soupLines);
    return result("customerWeighted", parts.combined + soupScore, breakdown, snapshot);
  }

  function scoreThresholds(snapshot, config) {
    var cfg = knobs(config, "thresholds");
    var bands = cfg.bands || [];
    var parts = Hotpot.sumIngredientParts(snapshot, config);
    var props = snapshot.soup.properties || {};
    var bonusTotal = 0;
    var breakdown = [
      { label: "Ingredient Points", value: Hotpot.round(parts.ingredient) },
      { label: "Synergy", value: Hotpot.round(parts.synergy) }
    ];
    var key, bonus;
    for (key in props) {
      if (!Object.prototype.hasOwnProperty.call(props, key)) continue;
      bonus = highestBandBonus(props[key] || 0, bands);
      if (bonus) {
        bonusTotal += bonus;
        breakdown.push({ label: key + " threshold", value: bonus });
      }
    }
    return result("thresholds", parts.combined + bonusTotal, breakdown, snapshot);
  }

  Hotpot.SCORING_MODELS = {
    additive: { id: "additive", name: "Additive", score: scoreAdditive },
    pointsMultiplier: { id: "pointsMultiplier", name: "Points × Mult", score: scorePointsMultiplier },
    soupMultiplier: { id: "soupMultiplier", name: "Soup as Mult", score: scoreSoupMultiplier },
    customerWeighted: { id: "customerWeighted", name: "Customer Weighted", score: scoreCustomerWeighted },
    thresholds: { id: "thresholds", name: "Thresholds", score: scoreThresholds }
  };

  Hotpot.scoreSnapshot = function (snapshot, config, modelId) {
    var id = modelId || (config.scoring && config.scoring.activeModel) || "additive";
    var model = Hotpot.SCORING_MODELS[id] || Hotpot.SCORING_MODELS.additive;
    return model.score(snapshot, config);
  };

  Hotpot.compareAll = function (snapshot, config) {
    var out = {};
    var id;
    for (id in Hotpot.SCORING_MODELS) {
      if (Object.prototype.hasOwnProperty.call(Hotpot.SCORING_MODELS, id)) {
        out[id] = Hotpot.SCORING_MODELS[id].score(snapshot, config);
      }
    }
    return out;
  };
})(window.Hotpot);

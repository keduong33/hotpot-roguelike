(function (Hotpot) {
  function whenMatches(when, target, config) {
    var i;
    if (!when) return true;
    if (when.anyInPot) {
      if (!when.anyInPot.defId && !Hotpot.matcherTagList(when.anyInPot).length) return true;
      for (i = 0; i < target.pot.length; i++) {
        if (matcherHits(when.anyInPot, target.pot[i], config)) return true;
      }
      return false;
    }
    return true;
  }

  function matcherHits(matcher, inst, config) {
    var tags;
    if (!matcher) return false;
    if (matcher.defId) return inst.defId === matcher.defId;
    tags = Hotpot.matcherTagList(matcher);
    if (tags.length) return Hotpot.hasAllTags(inst, tags, config);
    return false;
  }

  function collectMatches(pot, matcher, config) {
    var out = [];
    var i;
    for (i = 0; i < pot.length; i++) {
      if (matcherHits(matcher, pot[i], config)) out.push(pot[i]);
    }
    return out;
  }

  function comboMembers(c) {
    var out = [];
    if (!c) return out;
    if (c.members && c.members.length) {
      c.members.forEach(function (m) {
        if (m && (m.defId || Hotpot.matcherTagList(m).length)) out.push(m);
      });
      return out;
    }
    if (c.a) out.push(c.a);
    if (c.b) out.push(c.b);
    return out;
  }

  function comboBoostIndex(c) {
    var boost;
    if (!c) return null;
    boost = c.boost;
    if (boost == null || boost === "all" || boost === "both") return null;
    if (boost === "a") return 0;
    if (boost === "b") return 1;
    if (/^\d+$/.test(String(boost))) return Number(boost);
    return null;
  }

  Hotpot.comboMembers = comboMembers;

  function complimentsTargets(syn, target, config) {
    var members = comboMembers(syn.compliments);
    var hits = [];
    var boostIndex, out, seen, i, inst, list;
    if (members.length < 2) return null;
    for (i = 0; i < members.length; i++) {
      list = collectMatches(target.pot, members[i], config);
      if (!list.length) return null;
      hits.push(list);
    }
    boostIndex = comboBoostIndex(syn.compliments);
    out = [];
    seen = {};
    function add(group) {
      var k;
      for (k = 0; k < group.length; k++) {
        inst = group[k];
        if (seen[inst.instanceId]) continue;
        seen[inst.instanceId] = true;
        out.push(inst);
      }
    }
    if (boostIndex == null) {
      for (i = 0; i < hits.length; i++) add(hits[i]);
    } else if (hits[boostIndex]) {
      add(hits[boostIndex]);
    }
    return out;
  }

  function noteFired(syn, ctx) {
    if (ctx.snapshot) {
      if (!ctx.snapshot.triggeredSynergies) ctx.snapshot.triggeredSynergies = [];
      ctx.snapshot.triggeredSynergies.push(syn.name);
    } else if (ctx.state) {
      Hotpot.log(ctx.state, "Synergy: " + syn.name);
    }
  }

  Hotpot.evaluateSynergies = function (trigger, ctx) {
    var config = ctx.config || Hotpot.config;
    var target = ctx.snapshot || ctx.state;
    var list = (config && config.synergies) || [];
    var i, syn, applyCtx, targets;
    for (i = 0; i < list.length; i++) {
      syn = list[i];
      if (syn.trigger !== trigger) continue;
      applyCtx = {
        snapshot: ctx.snapshot,
        state: ctx.state,
        config: config,
        sourceInstance: ctx.sourceInstance
      };
      if (syn.compliments) {
        targets = complimentsTargets(syn, target, config);
        if (!targets) continue;
        applyCtx.targetInstances = targets;
      } else if (!whenMatches(syn.when, target, config)) {
        continue;
      }
      noteFired(syn, ctx);
      Hotpot.applyEffect(syn.then, applyCtx);
    }
  };

  function matcherPhrase(matcher, config) {
    var def;
    var tags;
    if (!matcher) return "?";
    if (matcher.defId) {
      def = Hotpot.getIngredientDef(matcher.defId, config);
      return def ? def.name : matcher.defId;
    }
    tags = Hotpot.matcherTagList(matcher);
    if (tags.length) return tags.join("+");
    return "?";
  }

  function defMatchesMatcher(def, matcher, config) {
    var tags;
    if (!def || !matcher) return false;
    if (matcher.defId) return def.id === matcher.defId;
    tags = Hotpot.matcherTagList(matcher);
    if (tags.length) return Hotpot.hasAllTags(def, tags, config);
    return false;
  }

  function signed(n) {
    n = Number(n);
    if (isNaN(n)) n = 0;
    return n >= 0 ? "+" + n : String(n);
  }

  function pluralize(word) {
    if (!word) return "";
    if (/s$/i.test(word)) return word;
    return word + "s";
  }

  function partnerPhrase(matcher, config) {
    var tags;
    if (!matcher) return "?";
    if (matcher.defId) return matcherPhrase(matcher, config);
    tags = Hotpot.matcherTagList(matcher);
    if (tags.length === 1) return pluralize(tags[0]);
    if (tags.length) return tags.join("+");
    return "?";
  }

  function thenPointValue(then) {
    then = then || {};
    if (then.amount != null && then.amount !== 0) return Number(then.amount);
    if (then.perTurn != null) return Number(then.perTurn);
    return then.amount != null ? Number(then.amount) : 0;
  }

  function cookedWithLine(n, partner) {
    return signed(n) + " when cooked with " + partner;
  }

  function affectsLine(n, target) {
    return "affects " + target + " " + signed(n);
  }

  Hotpot.synergiesForDef = function (defId, config) {
    var cfg = config || Hotpot.config;
    var def = Hotpot.getIngredientDef(defId, cfg);
    var list = (cfg && cfg.synergies) || [];
    var synergies = [];
    var drawbacks = [];
    var seen = {};
    var i, syn, then, whenTag, n, members, partners, j, hit, boostIndex, boosted;

    function add(bucket, text) {
      if (!text || seen[text]) return;
      seen[text] = true;
      bucket.push(text);
    }

    if (!def) return { synergies: synergies, drawbacks: drawbacks };
    for (i = 0; i < list.length; i++) {
      syn = list[i];
      then = syn.then || {};
      n = thenPointValue(then);
      if (syn.compliments) {
        members = comboMembers(syn.compliments);
        boostIndex = comboBoostIndex(syn.compliments);
        hit = false;
        boosted = false;
        partners = [];
        for (j = 0; j < members.length; j++) {
          if (defMatchesMatcher(def, members[j], cfg)) {
            hit = true;
            if (boostIndex == null || j === boostIndex) boosted = true;
          } else {
            partners.push(partnerPhrase(members[j], cfg));
          }
        }
        if (hit && partners.length) {
          if (boosted) {
            add(n < 0 ? drawbacks : synergies, cookedWithLine(n, partners.join(" and ")));
          } else {
            add(n < 0 ? drawbacks : synergies, affectsLine(n, partnerPhrase(members[boostIndex], cfg)));
          }
        }
        continue;
      }
      whenTag = syn.when && syn.when.anyInPot;
      if (whenTag && defMatchesMatcher(def, whenTag, cfg)) {
        if (then.perTurn != null && then.perTurn > 0 && (!Hotpot.matcherTagList(then).length || Hotpot.hasAllTags(def, Hotpot.matcherTagList(then), cfg))) {
          add(synergies, signed(then.perTurn) + " per turn cooked");
        }
        if (then.afterPeak != null && then.afterPeak < 0) {
          add(drawbacks, "overcooked " + then.afterPeak + " per turn");
        }
        if (Hotpot.matcherTagList(then).length && Hotpot.formatTagList(Hotpot.matcherTagList(then)) !== Hotpot.formatTagList(Hotpot.matcherTagList(whenTag))) {
          add(n < 0 ? drawbacks : synergies, cookedWithLine(n, Hotpot.matcherTagList(then).map(pluralize).join("+")));
        } else if (Hotpot.unlessTagList(then).length) {
          add(n < 0 ? drawbacks : synergies, cookedWithLine(n, "non-" + Hotpot.unlessTagList(then).map(pluralize).join("+")));
        }
      }
      if (Hotpot.matcherTagList(then).length && Hotpot.formatTagList(Hotpot.matcherTagList(then)) !== Hotpot.formatTagList(Hotpot.matcherTagList(whenTag)) && Hotpot.hasAllTags(def, Hotpot.matcherTagList(then), cfg) && !(whenTag && defMatchesMatcher(def, whenTag, cfg))) {
        add(n < 0 ? drawbacks : synergies, cookedWithLine(n, Hotpot.matcherTagList(whenTag).length ? Hotpot.matcherTagList(whenTag).map(pluralize).join("+") : Hotpot.matcherTagList(then).map(pluralize).join("+")));
      }
    }
    return { synergies: synergies, drawbacks: drawbacks };
  };
})(window.Hotpot);

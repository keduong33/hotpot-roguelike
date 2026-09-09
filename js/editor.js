(function (Hotpot) {
  function slug(name) {
    return String(name || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "") || "ingredient";
  }

  function uniqueId(base) {
    var id = base;
    var n = 2;
    while (Hotpot.getIngredientDef(id, Hotpot.config)) {
      id = base + "_" + n;
      n += 1;
    }
    return id;
  }

  function uniqueSynergyId(base) {
    var id = base;
    var n = 2;
    while (Hotpot.editor.getSynergy(id)) {
      id = base + "_" + n;
      n += 1;
    }
    return id;
  }

  function cleanMatcher(matcher) {
    var tags;
    if (!matcher) return null;
    if (matcher.defId) return { defId: matcher.defId };
    if (matcher.hasTag && String(matcher.hasTag).indexOf(",") !== -1 && !(matcher.hasTags && matcher.hasTags.length)) {
      return cleanMatcher(Hotpot.matcherFromTagText(matcher.hasTag));
    }
    tags = Hotpot.matcherTagList(matcher);
    if (tags.length > 1) return { hasTags: tags };
    if (tags.length === 1) return { hasTag: tags[0] };
    return null;
  }

  Hotpot.editor = {
    parseTags: function (text) {
      return Hotpot.parseTags(text);
    },

    getSynergy: function (synId) {
      var list = (Hotpot.config && Hotpot.config.synergies) || [];
      var i;
      for (i = 0; i < list.length; i++) {
        if (list[i].id === synId) return list[i];
      }
      return null;
    },

    upsertIngredient: function (draft) {
      var list = Hotpot.config.ingredients;
      var existing = draft.id ? Hotpot.getIngredientDef(draft.id, Hotpot.config) : null;
      var def = {
        id: existing ? existing.id : uniqueId(slug(draft.name)),
        name: draft.name || "Untitled",
        basePoints: Number(draft.basePoints) || 0,
        tags: draft.tags || [],
        freshDuration: Number(draft.freshDuration) || 1,
        cookedDuration: Number(draft.cookedDuration) || 1,
        overcookedDuration: Number(draft.overcookedDuration) || 1,
        effects: draft.effects || []
      };
      if (existing) {
        list.splice(list.indexOf(existing), 1, def);
      } else {
        list.push(def);
      }
      return def;
    },

    deleteIngredient: function (defId) {
      var list = Hotpot.config.ingredients;
      var i;
      for (i = 0; i < list.length; i++) {
        if (list[i].id === defId) {
          list.splice(i, 1);
          return true;
        }
      }
      return false;
    },

    upsertSynergy: function (draft) {
      var list = Hotpot.config.synergies || (Hotpot.config.synergies = []);
      var existing = draft.id ? Hotpot.editor.getSynergy(draft.id) : null;
      var then = draft.then || { type: "modifyPoints", amount: 1 };
      var isWhen = draft.shape === "when";
      var def;
      var members;
      var trigger;
      var boost;
      if (isWhen) {
        if ((then.hasTag || (then.hasTags && then.hasTags.length)) && (then.unlessTag || (then.unlessTags && then.unlessTags.length))) {
          delete then.unlessTag;
          delete then.unlessTags;
        }
        trigger = cleanMatcher(draft.a) || (existing && existing.when && existing.when.anyInPot) || { hasTag: "" };
        def = {
          id: existing ? existing.id : uniqueSynergyId(slug(draft.name)),
          name: draft.name || "Untitled synergy",
          trigger: draft.trigger || "onSubmit",
          when: { anyInPot: trigger },
          then: then
        };
      } else {
        delete then.hasTag;
        delete then.hasTags;
        delete then.unlessTag;
        delete then.unlessTags;
        members = (draft.members || []).map(cleanMatcher).filter(Boolean);
        if (members.length < 2) {
          members = Hotpot.comboMembers({ a: draft.a, b: draft.b, members: draft.members });
        }
        if (members.length < 2) {
          members = [{ defId: "beef" }, { defId: "chili" }];
        }
        boost = draft.boost;
        if (boost === "a") boost = "0";
        else if (boost === "b") boost = "1";
        else if (boost === "both" || boost == null || boost === "") boost = "all";
        def = {
          id: existing ? existing.id : uniqueSynergyId(slug(draft.name)),
          name: draft.name || "Untitled synergy",
          trigger: draft.trigger || "onSubmit",
          compliments: {
            members: members,
            boost: boost === "all" || /^\d+$/.test(String(boost)) ? String(boost) : "all"
          },
          then: then
        };
      }
      if (existing) {
        list.splice(list.indexOf(existing), 1, def);
      } else {
        list.push(def);
      }
      return def;
    },

    deleteSynergy: function (synId) {
      var list = Hotpot.config.synergies || [];
      var i;
      for (i = 0; i < list.length; i++) {
        if (list[i].id === synId) {
          list.splice(i, 1);
          return true;
        }
      }
      return false;
    }
  };
})(window.Hotpot);

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

  Hotpot.editor = {
    parseTags: function (text) {
      return String(text || "")
        .split(/[, ]+/)
        .map(function (t) { return t.trim(); })
        .filter(Boolean);
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
    }
  };
})(window.Hotpot);

(function (Hotpot) {
  Hotpot.getIngredientDef = function (defId, config) {
    var cfg = config || Hotpot.config;
    var list = (cfg && cfg.ingredients) || [];
    var i;
    for (i = 0; i < list.length; i++) {
      if (list[i].id === defId) return list[i];
    }
    return null;
  };

  Hotpot.getCustomer = function (customerId, config) {
    var cfg = config || Hotpot.config;
    var list = (cfg && cfg.customers) || [];
    var i;
    for (i = 0; i < list.length; i++) {
      if (list[i].id === customerId) return list[i];
    }
    return null;
  };

  Hotpot.getSoupBase = function (baseId, config) {
    var cfg = config || Hotpot.config;
    var list = (cfg && cfg.soup && cfg.soup.bases) || [];
    var i;
    for (i = 0; i < list.length; i++) {
      if (list[i].id === baseId) return list[i];
    }
    return list[0] || null;
  };

  Hotpot.parseTags = function (text) {
    return String(text || "")
      .split(/[, ]+/)
      .map(function (t) { return t.trim(); })
      .filter(Boolean);
  };

  Hotpot.hasTag = function (instanceOrDef, tag, config) {
    var def = instanceOrDef;
    if (instanceOrDef && instanceOrDef.defId) {
      def = Hotpot.getIngredientDef(instanceOrDef.defId, config);
    }
    if (!def || !def.tags) return false;
    return def.tags.indexOf(tag) !== -1;
  };

  Hotpot.matcherTagList = function (obj) {
    if (!obj) return [];
    if (obj.hasTags && obj.hasTags.length) return obj.hasTags.filter(Boolean);
    if (obj.hasTag) return [obj.hasTag];
    return [];
  };

  Hotpot.unlessTagList = function (obj) {
    if (!obj) return [];
    if (obj.unlessTags && obj.unlessTags.length) return obj.unlessTags.filter(Boolean);
    if (obj.unlessTag) return [obj.unlessTag];
    return [];
  };

  Hotpot.hasAllTags = function (instanceOrDef, tags, config) {
    var i;
    if (!tags || !tags.length) return false;
    for (i = 0; i < tags.length; i++) {
      if (!Hotpot.hasTag(instanceOrDef, tags[i], config)) return false;
    }
    return true;
  };

  Hotpot.formatTagList = function (tags) {
    return (tags || []).join(", ");
  };

  Hotpot.matcherFromTagText = function (text) {
    var tags = Hotpot.parseTags(text);
    if (tags.length > 1) return { hasTags: tags };
    if (tags.length === 1) return { hasTag: tags[0] };
    return {};
  };

  Hotpot.emptySoupProperties = function (config) {
    var cfg = config || Hotpot.config;
    var names = (cfg.soup && cfg.soup.properties) || [];
    var props = {};
    var i;
    for (i = 0; i < names.length; i++) props[names[i]] = 0;
    return props;
  };

  Hotpot.makeSoup = function (baseId, config) {
    var cfg = config || Hotpot.config;
    var base = Hotpot.getSoupBase(baseId, cfg);
    var properties = Hotpot.emptySoupProperties(cfg);
    var key;
    if (base && base.properties) {
      for (key in base.properties) {
        if (Object.prototype.hasOwnProperty.call(base.properties, key)) {
          properties[key] = base.properties[key];
        }
      }
    }
    return {
      baseId: base ? base.id : baseId,
      properties: properties
    };
  };

  Hotpot.resetConfig = function () {
    Hotpot.config = Hotpot.clone(Hotpot.DEFAULT_CONFIG);
    return Hotpot.config;
  };
})(window.Hotpot);

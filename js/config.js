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

  Hotpot.hasTag = function (instanceOrDef, tag, config) {
    var def = instanceOrDef;
    if (instanceOrDef && instanceOrDef.defId) {
      def = Hotpot.getIngredientDef(instanceOrDef.defId, config);
    }
    if (!def || !def.tags) return false;
    return def.tags.indexOf(tag) !== -1;
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

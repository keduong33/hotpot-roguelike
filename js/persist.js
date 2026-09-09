(function (Hotpot) {
  var CONFIG_KEY = "hotpot-proto-config";
  var RUN_KEY = "hotpot-proto-run";

  function parse(raw) {
    try {
      return JSON.parse(raw);
    } catch (err) {
      return null;
    }
  }

  Hotpot.persist = {
    saveConfig: function () {
      localStorage.setItem(CONFIG_KEY, JSON.stringify(Hotpot.config));
      return true;
    },

    saveRun: function () {
      localStorage.setItem(RUN_KEY, JSON.stringify(Hotpot.state));
      return true;
    },

    saveAll: function () {
      Hotpot.persist.saveConfig();
      Hotpot.persist.saveRun();
      return true;
    },

    loadConfig: function () {
      var data = parse(localStorage.getItem(CONFIG_KEY));
      if (data && data.version) {
        Hotpot.config = data;
        return Hotpot.config;
      }
      return Hotpot.resetConfig();
    },

    loadRun: function () {
      var data = parse(localStorage.getItem(RUN_KEY));
      if (!data || typeof data.turn !== "number") return null;
      Hotpot.state = data;
      if (!Hotpot.state.nextInstanceId) Hotpot.state.nextInstanceId = 1;
      if (!Hotpot.state.serveIds) Hotpot.state.serveIds = [];
      return Hotpot.state;
    },

    loadAll: function () {
      Hotpot.persist.loadConfig();
      if (!Hotpot.persist.loadRun()) Hotpot.game.newRun();
      return { config: Hotpot.config, state: Hotpot.state };
    },

    exportJson: function () {
      return JSON.stringify({
        version: 1,
        config: Hotpot.config,
        state: Hotpot.state
      }, null, 2);
    },

    downloadExport: function () {
      var blob = new Blob([Hotpot.persist.exportJson()], { type: "application/json" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = "hotpot-prototype.json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },

    importJson: function (text) {
      var data = parse(text);
      if (!data) throw new Error("Invalid JSON");
      if (data.config) Hotpot.config = data.config;
      else if (data.ingredients) Hotpot.config = data;
      if (data.state) Hotpot.state = data.state;
      if (Hotpot.state && !Hotpot.state.serveIds) Hotpot.state.serveIds = [];
      if (!Hotpot.config) Hotpot.resetConfig();
      if (!Hotpot.state) Hotpot.game.newRun();
      return { config: Hotpot.config, state: Hotpot.state };
    },

    resetAll: function () {
      localStorage.removeItem(CONFIG_KEY);
      localStorage.removeItem(RUN_KEY);
      Hotpot.resetConfig();
      Hotpot.game.newRun();
    }
  };
})(window.Hotpot);

(function (Hotpot) {
  var comparisonCache = null;
  var comparisonIsPreview = false;
  var editorEditingId = "";

  function el(id) {
    return document.getElementById(id);
  }

  function esc(value) {
    return Hotpot.escapeHtml(value);
  }

  function defName(inst) {
    var def = Hotpot.getIngredientDef(inst.defId, Hotpot.config);
    return def ? def.name : inst.defId;
  }

  function tagsOf(inst) {
    var def = Hotpot.getIngredientDef(inst.defId, Hotpot.config);
    return def && def.tags ? def.tags.join(", ") : "";
  }

  function partsOf(inst) {
    return Hotpot.instanceParts(inst, Hotpot.config);
  }

  function soupRows(properties) {
    var names = ((Hotpot.config.soup && Hotpot.config.soup.properties) || []).slice();
    var key, html = "";
    for (key in properties) {
      if (Object.prototype.hasOwnProperty.call(properties, key) && names.indexOf(key) === -1) names.push(key);
    }
    names.forEach(function (name) {
      html += "<div class=\"stat\"><span>" + esc(name) + "</span><strong>" + (properties[name] || 0) + "</strong></div>";
    });
    return html;
  }

  function cardHtml(inst, zone) {
    var def = Hotpot.getIngredientDef(inst.defId, Hotpot.config);
    var parts = partsOf(inst);
    var actions = "";
    if (zone === "hand") {
      actions = "<div class=\"card-actions\">" +
        "<button type=\"button\" data-action=\"add-to-pot\" data-id=\"" + esc(inst.instanceId) + "\">Add to pot</button>" +
        "<button type=\"button\" data-action=\"discard\" data-id=\"" + esc(inst.instanceId) + "\">Discard</button>" +
        "</div>";
    }
    return "<article class=\"card freshness-" + esc(inst.freshness) + "\">" +
      "<header>" + esc(defName(inst)) + "</header>" +
      "<p class=\"pts\">" + parts.total + " pts <small>(base " + parts.base + " · " + esc(inst.freshness) + " " + parts.freshness + " · bonus " + parts.bonus + ")</small></p>" +
      "<p class=\"meta\">" + esc(inst.freshness) + " · in-state " + inst.turnsInState + " · in-pot " + inst.turnsInPot + "</p>" +
      "<p class=\"tags\">" + esc(tagsOf(inst)) + "</p>" +
      (def && def.effects && def.effects.length
        ? "<p class=\"effects\">" + def.effects.map(function (e) {
          if (e.type === "modifySoup") return esc(e.property) + " " + (e.amount >= 0 ? "+" : "") + e.amount;
          return esc(e.type);
        }).join(" · ") + "</p>"
        : "") +
      actions +
      "</article>";
  }

  function fillSelect(select, items, value, labelFn, valueFn) {
    if (!select) return;
    select.innerHTML = items.map(function (item) {
      var v = valueFn(item);
      return "<option value=\"" + esc(v) + "\"" + (v === value ? " selected" : "") + ">" + esc(labelFn(item)) + "</option>";
    }).join("");
  }

  function renderCustomer() {
    var customer = Hotpot.getCustomer(Hotpot.state.customerId, Hotpot.config);
    var html;
    fillSelect(el("customer-select"), Hotpot.config.customers || [], Hotpot.state.customerId, function (c) { return c.name; }, function (c) { return c.id; });
    if (!customer) {
      el("customer-body").innerHTML = "<p>No customer.</p>";
      return;
    }
    html = "<p class=\"lede\">" + esc(customer.name) + "</p>" +
      "<p><strong>Likes</strong> " + esc((customer.likes || []).join(", ") || "—") + "</p>" +
      "<p><strong>Dislikes</strong> " + esc((customer.dislikes || []).join(", ") || "—") + "</p>" +
      "<p><strong>Thresholds</strong> " + esc(JSON.stringify(customer.thresholds || {})) + "</p>" +
      "<p><strong>Weights</strong> " + esc(JSON.stringify(customer.weights || {})) + "</p>";
    el("customer-body").innerHTML = html;
  }

  function renderPot() {
    var soup = Hotpot.state.soup;
    var base = Hotpot.getSoupBase(soup.baseId, Hotpot.config);
    el("soup-name").textContent = base ? base.name : soup.baseId;
    el("soup-stats").innerHTML = soupRows(soup.properties);
    el("pot-cards").innerHTML = Hotpot.state.pot.length
      ? Hotpot.state.pot.map(function (inst) { return cardHtml(inst, "pot"); }).join("")
      : "<p class=\"empty\">Pot is empty.</p>";
    fillSelect(el("soup-select"), (Hotpot.config.soup && Hotpot.config.soup.bases) || [], soup.baseId, function (b) { return b.name; }, function (b) { return b.id; });
  }

  function renderHand() {
    el("hand-cards").innerHTML = Hotpot.state.hand.length
      ? Hotpot.state.hand.map(function (inst) { return cardHtml(inst, "hand"); }).join("")
      : "<p class=\"empty\">Hand is empty.</p>";
  }

  function renderDeck() {
    el("deck-count").textContent = String(Hotpot.state.deck.length);
    el("discard-count").textContent = String(Hotpot.state.discard.length);
    el("deck-preview").innerHTML = Hotpot.state.deck.slice().reverse().slice(0, 8).map(function (inst) {
      return "<span class=\"chip\">" + esc(defName(inst)) + "</span>";
    }).join("") || "<span class=\"empty\">Empty</span>";
  }

  function renderHud() {
    el("hud-turn").textContent = String(Hotpot.state.turn);
    el("hud-rerolls").textContent = String(Hotpot.state.rerollsLeft);
    el("hud-score").textContent = String(Hotpot.state.runScore);
    fillSelect(
      el("model-select"),
      Object.keys(Hotpot.SCORING_MODELS).map(function (id) { return Hotpot.SCORING_MODELS[id]; }),
      Hotpot.config.scoring.activeModel,
      function (m) { return m.name; },
      function (m) { return m.id; }
    );
  }

  function breakdownHtml(scoreResult) {
    if (!scoreResult) return "<p class=\"empty\">No score yet.</p>";
    var rows = (scoreResult.breakdown || []).map(function (row) {
      return "<div class=\"stat\"><span>" + esc(row.label) + "</span><strong>" + row.value + "</strong></div>";
    }).join("");
    return "<p class=\"lede\">" + esc((Hotpot.SCORING_MODELS[scoreResult.modelId] || {}).name || scoreResult.modelId) +
      " → <strong>" + scoreResult.finalScore + "</strong></p>" + rows +
      "<p><strong>Synergies</strong> " + esc((scoreResult.triggeredSynergies || []).join(", ") || "—") + "</p>" +
      "<p><strong>Effects</strong> " + esc((scoreResult.triggeredEffects || []).join("; ") || "—") + "</p>";
  }

  function renderScore() {
    var last = Hotpot.state.lastSubmission;
    el("score-body").innerHTML = last
      ? breakdownHtml(last.activeResult)
      : "<p class=\"empty\">Submit a pot to score. Compare All can preview the current pot.</p>";
    renderComparison(comparisonCache, comparisonIsPreview);
  }

  function renderComparison(results, isPreview) {
    var html;
    var id;
    comparisonCache = results;
    comparisonIsPreview = !!isPreview;
    if (!results) {
      el("compare-body").innerHTML = "<p class=\"empty\">No comparison yet.</p>";
      return;
    }
    html = isPreview ? "<p class=\"hint\">Preview of current pot (not submitted).</p>" : "<p class=\"hint\">Same snapshot, every model.</p>";
    html += "<div class=\"compare-grid\">";
    for (id in Hotpot.SCORING_MODELS) {
      if (!Object.prototype.hasOwnProperty.call(results, id)) continue;
      html += "<article class=\"compare-card\"><h3>" + esc(Hotpot.SCORING_MODELS[id].name) + "</h3>" +
        "<p class=\"lede\">" + results[id].finalScore + "</p>" +
        (results[id].breakdown || []).map(function (row) {
          return "<div class=\"stat\"><span>" + esc(row.label) + "</span><strong>" + row.value + "</strong></div>";
        }).join("") + "</article>";
    }
    html += "</div>";
    el("compare-body").innerHTML = html;
  }

  function renderDebug() {
    var state = Hotpot.state;
    var last = state.lastSubmission;
    var potLines = state.pot.map(function (inst) {
      return defName(inst) + " [" + inst.freshness + "] in-state=" + inst.turnsInState + " in-pot=" + inst.turnsInPot + " bonus=" + (inst.bonusPoints || 0);
    }).join("\n") || "(empty)";
    el("debug-body").innerHTML =
      "<pre>" + esc(
        "Turn: " + state.turn + "\n" +
        "Run score: " + state.runScore + "\n" +
        "Customer: " + state.customerId + "\n" +
        "Soup base: " + state.soup.baseId + "\n" +
        "Soup: " + JSON.stringify(state.soup.properties) + "\n\n" +
        "Pot:\n" + potLines + "\n\n" +
        "Triggered synergies: " + ((last && last.activeResult && last.activeResult.triggeredSynergies) || []).join(", ") + "\n" +
        "Triggered effects: " + ((last && last.activeResult && last.activeResult.triggeredEffects) || []).join("; ") + "\n" +
        "Active model: " + Hotpot.config.scoring.activeModel + "\n" +
        "Final score: " + ((last && last.activeResult && last.activeResult.finalScore) || "—")
      ) + "</pre>" +
      "<details><summary>Raw GameState</summary><pre>" + esc(JSON.stringify(state, null, 2)) + "</pre></details>" +
      "<h3>Log</h3><ul class=\"log\">" + state.log.map(function (line) {
        return "<li>" + esc(line) + "</li>";
      }).join("") + "</ul>";
  }

  function renderCatalog() {
    var list = Hotpot.config.ingredients || [];
    el("catalog-list").innerHTML = list.map(function (def) {
      return "<div class=\"catalog-row\">" +
        "<span><strong>" + esc(def.name) + "</strong> <code>" + esc(def.id) + "</code> · " + def.basePoints + " pts · " + esc((def.tags || []).join(", ")) + "</span>" +
        "<span class=\"row-actions\">" +
        "<button type=\"button\" data-action=\"edit-ing\" data-id=\"" + esc(def.id) + "\">Edit</button>" +
        "<button type=\"button\" data-action=\"add-def-hand\" data-id=\"" + esc(def.id) + "\">To hand</button>" +
        "<button type=\"button\" data-action=\"add-def-deck\" data-id=\"" + esc(def.id) + "\">To deck</button>" +
        "<button type=\"button\" data-action=\"delete-ing\" data-id=\"" + esc(def.id) + "\">Delete</button>" +
        "</span></div>";
    }).join("");
  }

  function effectRowHtml(effect) {
    effect = effect || { type: "modifySoup", property: "spicy", amount: 1 };
    return "<div class=\"effect-row\">" +
      "<select class=\"fx-type\">" +
      "<option value=\"modifySoup\"" + (effect.type === "modifySoup" ? " selected" : "") + ">modifySoup</option>" +
      "<option value=\"modifyBonusPoints\"" + (effect.type === "modifyBonusPoints" ? " selected" : "") + ">modifyBonusPoints</option>" +
      "<option value=\"modifyIngredientPoints\"" + (effect.type === "modifyIngredientPoints" ? " selected" : "") + ">modifyIngredientPoints</option>" +
      "</select>" +
      "<input class=\"fx-property\" placeholder=\"property / hasTag\" value=\"" + esc(effect.property || effect.hasTag || "") + "\">" +
      "<input class=\"fx-amount\" type=\"number\" value=\"" + (effect.amount != null ? effect.amount : (effect.perTurn != null ? effect.perTurn : 0)) + "\">" +
      "<button type=\"button\" data-action=\"remove-effect\">×</button>" +
      "</div>";
  }

  function readEffectsFromForm() {
    var rows = el("effect-rows").querySelectorAll(".effect-row");
    var out = [];
    rows.forEach(function (row) {
      var type = row.querySelector(".fx-type").value;
      var property = row.querySelector(".fx-property").value.trim();
      var amount = Number(row.querySelector(".fx-amount").value) || 0;
      var effect = { type: type, amount: amount };
      if (type === "modifySoup") effect.property = property || "spicy";
      else if (property) effect.hasTag = property;
      out.push(effect);
    });
    return out;
  }

  function fillEditor(def) {
    editorEditingId = def ? def.id : "";
    el("ing-id").value = def ? def.id : "";
    el("ing-name").value = def ? def.name : "";
    el("ing-points").value = def ? def.basePoints : 3;
    el("ing-tags").value = def ? (def.tags || []).join(", ") : "";
    el("ing-fresh").value = def ? def.freshDuration : 2;
    el("ing-cooked").value = def ? def.cookedDuration : 3;
    el("effect-rows").innerHTML = (def && def.effects && def.effects.length)
      ? def.effects.map(effectRowHtml).join("")
      : effectRowHtml({ type: "modifySoup", property: "umami", amount: 1 });
    el("editor-status").textContent = def ? "Editing " + def.id : "New ingredient";
  }

  function render() {
    if (!Hotpot.state || !Hotpot.config) return;
    renderHud();
    renderCustomer();
    renderPot();
    renderHand();
    renderDeck();
    renderScore();
    renderDebug();
    renderCatalog();
  }

  function afterCommand() {
    render();
  }

  function onClick(event) {
    var btn = event.target.closest("[data-action]");
    var action, id, results;
    if (!btn) return;
    action = btn.getAttribute("data-action");
    id = btn.getAttribute("data-id");
    switch (action) {
      case "new-run":
        Hotpot.game.newRun();
        comparisonCache = null;
        afterCommand();
        break;
      case "draw":
        Hotpot.game.draw();
        afterCommand();
        break;
      case "reroll":
        Hotpot.game.reroll();
        afterCommand();
        break;
      case "end-turn":
        Hotpot.game.endTurn();
        afterCommand();
        break;
      case "submit":
        Hotpot.game.submitPot();
        comparisonCache = Hotpot.state.lastSubmission.resultsByModel;
        comparisonIsPreview = false;
        afterCommand();
        break;
      case "change-soup":
        Hotpot.game.changeSoup(el("soup-select").value);
        afterCommand();
        break;
      case "add-to-pot":
        Hotpot.game.addToPot(id);
        afterCommand();
        break;
      case "discard":
        Hotpot.game.discard(id);
        afterCommand();
        break;
      case "compare-all":
        results = Hotpot.game.compareAll(!Hotpot.state.lastSubmission);
        comparisonCache = results;
        comparisonIsPreview = !Hotpot.state.lastSubmission;
        afterCommand();
        break;
      case "save":
        Hotpot.persist.saveAll();
        el("persist-status").textContent = "Saved config + run to localStorage.";
        break;
      case "load":
        Hotpot.persist.loadAll();
        comparisonCache = Hotpot.state.lastSubmission ? Hotpot.state.lastSubmission.resultsByModel : null;
        comparisonIsPreview = false;
        el("persist-status").textContent = "Loaded from localStorage.";
        afterCommand();
        break;
      case "export":
        Hotpot.persist.downloadExport();
        el("persist-status").textContent = "Downloaded JSON.";
        break;
      case "reset-data":
        Hotpot.persist.resetAll();
        comparisonCache = null;
        fillEditor(null);
        el("persist-status").textContent = "Reset to default catalog + new run.";
        afterCommand();
        break;
      case "add-effect":
        el("effect-rows").insertAdjacentHTML("beforeend", effectRowHtml());
        break;
      case "remove-effect":
        btn.closest(".effect-row").remove();
        break;
      case "save-ing":
        Hotpot.editor.upsertIngredient({
          id: el("ing-id").value || editorEditingId,
          name: el("ing-name").value,
          basePoints: el("ing-points").value,
          tags: Hotpot.editor.parseTags(el("ing-tags").value),
          freshDuration: el("ing-fresh").value,
          cookedDuration: el("ing-cooked").value,
          effects: readEffectsFromForm()
        });
        fillEditor(null);
        afterCommand();
        break;
      case "clear-ing":
        fillEditor(null);
        break;
      case "edit-ing":
        fillEditor(Hotpot.getIngredientDef(id, Hotpot.config));
        break;
      case "delete-ing":
        Hotpot.editor.deleteIngredient(id);
        if (editorEditingId === id) fillEditor(null);
        afterCommand();
        break;
      case "add-def-hand":
        Hotpot.game.addDefToPile(id, "hand");
        afterCommand();
        break;
      case "add-def-deck":
        Hotpot.game.addDefToPile(id, "deck");
        afterCommand();
        break;
      default:
        break;
    }
  }

  function bind() {
    el("app").addEventListener("click", onClick);
    el("customer-select").addEventListener("change", function () {
      Hotpot.game.setCustomer(el("customer-select").value);
      afterCommand();
    });
    el("model-select").addEventListener("change", function () {
      Hotpot.game.setActiveModel(el("model-select").value);
      afterCommand();
    });
    el("import-file").addEventListener("change", function () {
      var file = el("import-file").files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          Hotpot.persist.importJson(String(reader.result));
          el("persist-status").textContent = "Imported JSON.";
          afterCommand();
        } catch (err) {
          el("persist-status").textContent = "Import failed: " + err.message;
        }
      };
      reader.readAsText(file);
    });
    fillEditor(null);
  }

  Hotpot.ui = {
    bind: bind,
    render: render,
    fillEditor: fillEditor
  };
})(window.Hotpot);

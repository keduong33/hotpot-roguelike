(function (Hotpot) {
  var comparisonCache = null;
  var comparisonIsPreview = false;
  var editorEditingId = "";
  var editorSynergyId = "";
  var VIEW_KEY = "hotpot-proto-view";

  function el(id) {
    return document.getElementById(id);
  }

  function setSubmitStatus(msg) {
    var node = el("submit-status");
    if (!node) return;
    node.textContent = msg || "";
    node.className = msg ? "hint warn" : "hint";
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
    var synInfo = Hotpot.synergiesForDef(inst.defId, Hotpot.config) || { synergies: [], drawbacks: [] };
    var tags = tagsOf(inst);
    var soupLines = [];
    var stateLine = inst.freshness || "";
    function cardSection(title, items) {
      if (!items || !items.length) return "";
      return "<div class=\"card-sec\">" +
        "<p class=\"card-sec-h\">" + esc(title) + "</p>" +
        items.map(function (line) {
          return "<p class=\"card-sec-i\">" + line + "</p>";
        }).join("") +
        "</div>";
    }
    if (def && def.effects) {
      def.effects.forEach(function (e) {
        if (e.type === "modifySoup") {
          soupLines.push(esc(e.property) + " " + (e.amount >= 0 ? "+" : "") + e.amount);
        }
      });
    }
    if (zone === "hand") {
      actions = "<div class=\"card-actions\">" +
        "<button type=\"button\" data-action=\"add-to-pot\" data-id=\"" + esc(inst.instanceId) + "\">Add to pot</button>" +
        "<button type=\"button\" data-action=\"discard\" data-id=\"" + esc(inst.instanceId) + "\">Discard</button>" +
        "</div>";
    }
    return "<article class=\"card freshness-" + esc(inst.freshness) + "\">" +
      "<header>" + esc(defName(inst)) + "</header>" +
      "<p class=\"pts\">" + parts.total + " pts <small class=\"admin-only\">(base " + parts.base + " · " + esc(inst.freshness) + " " + parts.freshness + " · mods " + parts.pointMods + ")</small></p>" +
      "<p class=\"cook-eta\">" + esc(Hotpot.freshnessCountdown(inst, Hotpot.config)) + "</p>" +
      cardSection("Synergies", (synInfo.synergies || []).map(esc)) +
      cardSection("Drawbacks", (synInfo.drawbacks || []).map(esc)) +
      cardSection("State", stateLine
        ? [esc(stateLine) + "<span class=\"admin-only\"> · in-state " + inst.turnsInState + " · in-pot " + inst.turnsInPot + "</span>"]
        : []) +
      cardSection("Tags", tags ? [esc(tags)] : []) +
      cardSection("Soup", soupLines) +
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
      "<p class=\"admin-only\"><strong>Thresholds</strong> " + esc(JSON.stringify(customer.thresholds || {})) + "</p>" +
      "<p class=\"admin-only\"><strong>Weights</strong> " + esc(JSON.stringify(customer.weights || {})) + "</p>";
    el("customer-body").innerHTML = html;
  }

  function renderPot() {
    var soup = Hotpot.state.soup;
    var base = Hotpot.getSoupBase(soup.baseId, Hotpot.config);
    el("soup-name").textContent = base ? base.name : soup.baseId;
    el("soup-stats").innerHTML = soupRows(soup.properties);
    el("pot-count").textContent = Hotpot.state.pot.length + " / " + Hotpot.maxSubmitIngredients(Hotpot.config) + " in pot";
    el("pot-cards").innerHTML = Hotpot.state.pot.length
      ? Hotpot.state.pot.map(function (inst) { return cardHtml(inst, "pot"); }).join("")
      : "<p class=\"empty\">Pot is empty.</p>";
    fillSelect(el("soup-select"), (Hotpot.config.soup && Hotpot.config.soup.bases) || [], soup.baseId, function (b) { return b.name; }, function (b) { return b.id; });
  }

  function renderHand() {
    var max = Hotpot.handSize(Hotpot.config);
    el("hand-count").textContent = Hotpot.state.hand.length + " / " + max + " in hand";
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
      " → <strong>" + scoreResult.finalScore + "</strong></p>" +
      "<div class=\"admin-only\">" + rows +
      "<p><strong>Effects</strong> " + esc((scoreResult.triggeredEffects || []).join("; ") || "—") + "</p></div>" +
      "<p><strong>Synergies</strong> " + esc((scoreResult.triggeredSynergies || []).join(", ") || "—") + "</p>";
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
      return defName(inst) + " [" + inst.freshness + "] in-state=" + inst.turnsInState + " in-pot=" + inst.turnsInPot + " mods=" + Hotpot.instancePointMods(inst);
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

  function syncEffectRow(row) {
    var type;
    var prop;
    if (!row) return;
    type = row.querySelector(".fx-type") && row.querySelector(".fx-type").value;
    prop = row.querySelector(".fx-property");
    if (!prop) return;
    prop.hidden = Hotpot.isModifyPointsType(type);
    prop.placeholder = "soup property";
    if (prop.hidden) prop.value = "";
  }

  function effectRowHtml(effect) {
    var isPts;
    effect = effect || { type: "modifySoup", property: "spicy", amount: 1 };
    isPts = Hotpot.isModifyPointsType(effect.type);
    return "<div class=\"effect-row\">" +
      "<select class=\"fx-type\">" +
      "<option value=\"modifySoup\"" + (!isPts && effect.type === "modifySoup" ? " selected" : "") + ">Modify soup</option>" +
      "<option value=\"modifyPoints\"" + (isPts ? " selected" : "") + ">Modify points</option>" +
      "</select>" +
      "<input class=\"fx-property\" placeholder=\"soup property\" value=\"" + esc(isPts ? "" : (effect.property || "")) + "\"" + (isPts ? " hidden" : "") + ">" +
      "<input class=\"fx-amount\" type=\"number\" value=\"" + (effect.amount != null ? effect.amount : (effect.perTurn != null ? effect.perTurn : 0)) + "\">" +
      "<button type=\"button\" data-action=\"remove-effect\">×</button>" +
      "</div>";
  }

  function readEffectsFromForm() {
    var rows = el("effect-rows").querySelectorAll(".effect-row");
    var out = [];
    rows.forEach(function (row) {
      var type = row.querySelector(".fx-type").value;
      var property = row.querySelector(".fx-property") && row.querySelector(".fx-property").value.trim();
      var amount = Number(row.querySelector(".fx-amount").value) || 0;
      var effect = { type: type, amount: amount };
      if (type === "modifySoup") effect.property = property || "spicy";
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
    el("ing-overcooked").value = def && def.overcookedDuration != null ? def.overcookedDuration : 2;
    el("effect-rows").innerHTML = (def && def.effects && def.effects.length)
      ? def.effects.map(effectRowHtml).join("")
      : effectRowHtml({ type: "modifySoup", property: "umami", amount: 1 });
    el("editor-status").textContent = def ? "Editing " + def.id : "New ingredient";
  }

  function formatSigned(n) {
    if (n == null || n === "") return "";
    n = Number(n);
    if (isNaN(n)) return "";
    return (n >= 0 ? "+" : "") + n;
  }

  function triggerLabel(trigger) {
    if (trigger === "onEndTurn") return "at the end of the turn";
    if (trigger === "onAddToPot") return "when something is added to the pot";
    return "when the pot is submitted";
  }

  function thenScopeLabel(then) {
    var tags;
    var unless;
    if (!then) return "";
    tags = Hotpot.matcherTagList(then);
    unless = Hotpot.unlessTagList(then);
    if (tags.length) return "only “" + Hotpot.formatTagList(tags) + "”";
    if (unless.length) return "everyone except “" + Hotpot.formatTagList(unless) + "”";
    return "";
  }

  function thenLabel(then) {
    var scope;
    var text;
    if (!then) return "—";
    if (Hotpot.isModifyPointsType(then.type)) {
      if (then.perTurn != null) {
        text = formatSigned(then.perTurn) + " per turn cooked";
        if (then.peakTurns != null) {
          text += ", overcooked after " + then.peakTurns + " turns";
          if (then.afterPeak != null) text += " (" + formatSigned(then.afterPeak) + " per turn)";
        }
      } else {
        text = formatSigned(then.amount != null ? then.amount : 0) + " pts";
      }
    } else if (then.type === "modifySoup") text = (then.property || "soup") + " " + formatSigned(then.amount);
    else text = then.type || "—";
    scope = thenScopeLabel(then);
    return scope ? text + " · " + scope : text;
  }

  function matcherLabel(matcher) {
    var def;
    var tags;
    if (!matcher) return "?";
    if (matcher.defId) {
      def = Hotpot.getIngredientDef(matcher.defId, Hotpot.config);
      return def ? def.name : matcher.defId;
    }
    tags = Hotpot.matcherTagList(matcher);
    if (tags.length) return "tag “" + Hotpot.formatTagList(tags) + "”";
    return "?";
  }

  function boostTargetLabel(syn) {
    var members;
    var idx;
    if (!syn || !syn.compliments) return "";
    members = Hotpot.comboMembers(syn.compliments);
    idx = syn.compliments.boost;
    if (idx === "a") idx = 0;
    else if (idx === "b") idx = 1;
    else if (idx === "both" || idx === "all" || idx == null) idx = null;
    else if (/^\d+$/.test(String(idx))) idx = Number(idx);
    else idx = null;
    if (idx == null) return members.map(matcherLabel).join(" and ") || "all members";
    return matcherLabel(members[idx]) || "a member";
  }

  function synergySummary(syn) {
    var thenTxt = thenLabel(syn.then);
    var members;
    var trigger = syn.when && syn.when.anyInPot;
    if (syn.compliments) {
      members = Hotpot.comboMembers(syn.compliments);
      return "combo (all members of the combo) " + members.map(matcherLabel).join(" + ") +
        " · " + triggerLabel(syn.trigger) +
        " · " + thenTxt + " on " + boostTargetLabel(syn);
    }
    if (trigger && (trigger.defId || Hotpot.matcherTagList(trigger).length)) {
      return "if the pot contains " + matcherLabel(trigger) + " · " + triggerLabel(syn.trigger) + " · " + thenTxt;
    }
    return triggerLabel(syn.trigger) + " · " + thenTxt;
  }

  function matcherIsTag(matcher) {
    if (!matcher || matcher.defId) return false;
    return Hotpot.matcherTagList(matcher).length > 0 ||
      Object.prototype.hasOwnProperty.call(matcher, "hasTag") ||
      Object.prototype.hasOwnProperty.call(matcher, "hasTags");
  }

  function fillIngredientSelect(select, selectedId) {
    var list = Hotpot.config.ingredients || [];
    var found = false;
    var html;
    if (!select) return;
    html = "<option value=\"\">Choose…</option>";
    list.forEach(function (d) {
      if (d.id === selectedId) found = true;
      html += "<option value=\"" + esc(d.id) + "\"" + (d.id === selectedId ? " selected" : "") + ">" + esc(d.name) + "</option>";
    });
    select.innerHTML = html;
    select.value = found ? selectedId : "";
  }

  function syncSideFields(side) {
    var wrap = el("syn-side-" + side);
    var isTag;
    var ingField;
    var tagField;
    if (!wrap) return;
    isTag = el("syn-" + side + "-kind").value === "tag";
    wrap.setAttribute("data-kind", isTag ? "tag" : "ingredient");
    ingField = wrap.querySelector(".syn-ing-field");
    tagField = wrap.querySelector(".syn-tag-field");
    if (ingField) ingField.hidden = isTag;
    if (tagField) tagField.hidden = !isTag;
  }

  function updateSideReadout(side) {
    var readout = el("syn-" + side + "-readout");
    var kind;
    var tag;
    var defId;
    if (!readout) return;
    kind = el("syn-" + side + "-kind").value;
    tag = el("syn-" + side + "-tag").value.trim();
    defId = el("syn-" + side + "-ing").value;
    if (kind === "tag") {
      readout.textContent = tag ? "tag “" + tag + "”" : "tag";
    } else if (defId) {
      readout.textContent = matcherLabel({ defId: defId });
    } else if (tag) {
      readout.textContent = "still tag “" + tag + "” until you pick an ingredient and Save";
    } else {
      readout.textContent = "choose an ingredient";
    }
  }

  function setSideKind(side, kind, selectedDefId) {
    var isTag = kind === "tag";
    if (!el("syn-side-" + side)) return;
    el("syn-" + side + "-kind").value = isTag ? "tag" : "ingredient";
    fillIngredientSelect(el("syn-" + side + "-ing"), isTag ? "" : (selectedDefId || ""));
    syncSideFields(side);
    updateSideReadout(side);
  }

  function fillSynergyIngredientSelects() {
    var kind = el("syn-a-kind");
    var select = el("syn-a-ing");
    if (kind && select && el("syn-shape") && el("syn-shape").value === "when") {
      if (kind.value === "tag") fillIngredientSelect(select, "");
      else fillIngredientSelect(select, select.value);
      syncSideFields("a");
    }
    document.querySelectorAll("#syn-members .syn-member").forEach(function (row) {
      var memKind = row.querySelector(".syn-mem-kind");
      var memIng = row.querySelector(".syn-mem-ing");
      if (!memKind || !memIng) return;
      if (memKind.value === "tag") fillIngredientSelect(memIng, "");
      else fillIngredientSelect(memIng, memIng.value);
      syncMemberRow(row);
    });
  }

  function syncMemberRow(row) {
    var kind;
    var ingField;
    var tagField;
    if (!row) return;
    kind = row.querySelector(".syn-mem-kind");
    kind = kind ? kind.value : "ingredient";
    row.setAttribute("data-kind", kind === "tag" ? "tag" : "ingredient");
    ingField = row.querySelector(".syn-ing-field");
    tagField = row.querySelector(".syn-tag-field");
    if (ingField) ingField.hidden = kind === "tag";
    if (tagField) tagField.hidden = kind !== "tag";
  }

  function memberRowHtml() {
    return "<div class=\"syn-member syn-side\" data-kind=\"ingredient\">" +
      "<label>Kind <select class=\"syn-mem-kind\">" +
      "<option value=\"ingredient\">Ingredient</option>" +
      "<option value=\"tag\">Tag</option>" +
      "</select></label>" +
      "<label class=\"syn-ing-field\">Ingredient <select class=\"syn-mem-ing\"></select></label>" +
      "<label class=\"syn-tag-field\">Tag <input class=\"syn-mem-tag\" type=\"text\" placeholder=\"vegetable, spicy\"></label>" +
      "<button type=\"button\" data-action=\"remove-syn-member\">Remove</button>" +
      "</div>";
  }

  function addMemberRow(matcher) {
    var wrap = el("syn-members");
    var row, kind, ing, tag;
    if (!wrap) return;
    wrap.insertAdjacentHTML("beforeend", memberRowHtml());
    row = wrap.lastElementChild;
    kind = row.querySelector(".syn-mem-kind");
    ing = row.querySelector(".syn-mem-ing");
    tag = row.querySelector(".syn-mem-tag");
    if (matcherIsTag(matcher)) {
      kind.value = "tag";
      tag.value = Hotpot.formatTagList(Hotpot.matcherTagList(matcher));
      fillIngredientSelect(ing, "");
    } else {
      kind.value = "ingredient";
      tag.value = "";
      fillIngredientSelect(ing, matcher && matcher.defId ? matcher.defId : "");
    }
    syncMemberRow(row);
  }

  function readMembersFromForm() {
    var wrap = el("syn-members");
    var out = [];
    if (!wrap) return out;
    wrap.querySelectorAll(".syn-member").forEach(function (row) {
      var kind = row.querySelector(".syn-mem-kind").value;
      var tag;
      var defId;
      if (kind === "tag") {
        tag = Hotpot.matcherFromTagText(row.querySelector(".syn-mem-tag").value);
        if (tag.hasTag || (tag.hasTags && tag.hasTags.length)) out.push(tag);
      } else {
        defId = row.querySelector(".syn-mem-ing").value;
        if (defId) out.push({ defId: defId });
      }
    });
    return out;
  }

  function fillMemberRows(members) {
    var wrap = el("syn-members");
    if (!wrap) return;
    wrap.innerHTML = "";
    if (!members || !members.length) members = [{ defId: "beef" }, { defId: "chili" }];
    members.forEach(function (m) { addMemberRow(m); });
    if (members.length < 2) addMemberRow({ defId: "chili" });
  }

  function refreshBoostFromMembers(selected) {
    var members = readMembersFromForm();
    var html = "<option value=\"all\">All members</option>";
    var value;
    members.forEach(function (m, i) {
      html += "<option value=\"" + i + "\">" + esc(matcherLabel(m)) + "</option>";
    });
    if (!el("syn-boost")) return;
    el("syn-boost").innerHTML = html;
    value = selected;
    if (value === "a") value = "0";
    else if (value === "b") value = "1";
    else if (value === "both" || value == null || value === "") value = "all";
    if (value !== "all" && !/^\d+$/.test(String(value))) value = "all";
    if (value !== "all" && !members[Number(value)]) value = "all";
    el("syn-boost").value = String(value);
  }

  function applyMatcherToSide(side, matcher) {
    var defId;
    var tagValue;
    if (!el("syn-" + side + "-kind")) return;
    if (matcherIsTag(matcher)) {
      tagValue = Hotpot.formatTagList(Hotpot.matcherTagList(matcher));
      el("syn-" + side + "-tag").value = tagValue;
      setSideKind(side, "tag");
    } else if (matcher && matcher.defId) {
      defId = matcher.defId;
      el("syn-" + side + "-tag").value = "";
      setSideKind(side, "ingredient", defId);
    } else {
      el("syn-" + side + "-tag").value = "";
      setSideKind(side, "tag");
    }
  }

  function showSynergyValues(syn) {
    var c = syn && syn.compliments;
    var trigger = syn && syn.when && syn.when.anyInPot;
    var then = syn && syn.then;
    var members;
    var bRow = el("syn-dt-b") && el("syn-dt-b").parentNode;
    var boostRow = el("syn-dt-boost") && el("syn-dt-boost").parentNode;
    el("synergy-readout").textContent = syn ? synergySummary(syn) : "New combo synergy";
    el("syn-val-trigger").textContent = triggerLabel(syn && syn.trigger);
    if (c) {
      members = Hotpot.comboMembers(c);
      el("syn-val-a").textContent = members.map(matcherLabel).join(" + ") || "—";
      el("syn-val-b").textContent = "—";
      el("syn-val-boost").textContent = boostTargetLabel(syn) + " get " + thenLabel(then);
      if (bRow) bRow.hidden = true;
      if (boostRow) boostRow.hidden = false;
    } else if (trigger && (trigger.defId || Hotpot.matcherTagList(trigger).length)) {
      el("syn-val-a").textContent = matcherLabel(trigger);
      el("syn-val-b").textContent = thenScopeLabel(then) || "everyone";
      el("syn-val-boost").textContent = thenScopeLabel(then) || "everyone";
      if (bRow) bRow.hidden = false;
      if (boostRow) boostRow.hidden = true;
    } else {
      el("syn-val-a").textContent = "—";
      el("syn-val-b").textContent = "—";
      el("syn-val-boost").textContent = "—";
      if (bRow) bRow.hidden = false;
      if (boostRow) boostRow.hidden = false;
    }
    el("syn-val-then").textContent = syn ? thenLabel(then) : "—";
  }

  function applySynergyShape(shape) {
    var isWhen = shape === "when";
    if (el("syn-shape")) el("syn-shape").value = isWhen ? "when" : "compliments";
    if (el("syn-combo-wrap")) el("syn-combo-wrap").hidden = isWhen;
    if (el("syn-if-wrap")) el("syn-if-wrap").hidden = !isWhen;
    if (el("syn-dt-a")) el("syn-dt-a").textContent = isWhen ? "If the pot contains" : "Members of this combo";
    if (el("syn-dt-b")) el("syn-dt-b").textContent = "Who is affected";
    if (el("syn-dt-boost")) el("syn-dt-boost").textContent = "Who gets the bonus";
    if (el("syn-dt-b") && el("syn-dt-b").parentNode) el("syn-dt-b").parentNode.hidden = !isWhen;
    if (el("syn-dt-boost") && el("syn-dt-boost").parentNode) el("syn-dt-boost").parentNode.hidden = isWhen;
    syncWhoTagField();
    syncCookFields();
  }

  function syncWhoTagField() {
    var who = el("syn-who") ? el("syn-who").value : "everyone";
    var wrap = el("syn-who-tag-wrap");
    if (!wrap) return;
    wrap.hidden = who === "everyone";
    if (el("syn-who-tag")) {
      el("syn-who-tag").placeholder = who === "except" ? "noodle" : "vegetable, spicy";
    }
  }

  function fillWhoGets(then) {
    then = then || {};
    var who = "everyone";
    var tag = "";
    if (Hotpot.matcherTagList(then).length) {
      who = "only";
      tag = Hotpot.formatTagList(Hotpot.matcherTagList(then));
    } else if (Hotpot.unlessTagList(then).length) {
      who = "except";
      tag = Hotpot.formatTagList(Hotpot.unlessTagList(then));
    }
    if (el("syn-who")) el("syn-who").value = who;
    if (el("syn-who-tag")) el("syn-who-tag").value = tag;
    syncWhoTagField();
    if (el("syn-per-turn")) el("syn-per-turn").value = then.perTurn != null ? then.perTurn : "";
    if (el("syn-peak-turns")) el("syn-peak-turns").value = then.peakTurns != null ? then.peakTurns : "";
    if (el("syn-after-peak")) el("syn-after-peak").value = then.afterPeak != null ? then.afterPeak : "";
    syncCookFields(then);
  }

  function syncCookFields(then) {
    var trigger = el("syn-trigger") && el("syn-trigger").value;
    var show;
    then = then || {};
    show = trigger === "onEndTurn" || then.perTurn != null || then.peakTurns != null || then.afterPeak != null;
    if (el("when-fields")) el("when-fields").hidden = !show;
  }

  function readMatcherFromSide(side) {
    var kindEl = el("syn-" + side + "-kind");
    var kind;
    var defId;
    if (!kindEl) return {};
    kind = kindEl.value;
    if (kind === "tag") {
      return Hotpot.matcherFromTagText(el("syn-" + side + "-tag").value);
    }
    defId = el("syn-" + side + "-ing").value;
    if (!defId) return {};
    return { defId: defId };
  }

  function readSynergyThen() {
    var row = el("syn-effect-row").querySelector(".effect-row");
    var type, property, amount, then;
    var who, tag, perTurn, peakTurns, afterPeak;
    if (!row) return { type: "modifyPoints", amount: 2 };
    type = row.querySelector(".fx-type").value;
    amount = Number(row.querySelector(".fx-amount").value);
    if (isNaN(amount)) amount = 0;
    if (Hotpot.isModifyPointsType(type)) type = "modifyPoints";
    then = { type: type, amount: amount };
    if (type === "modifySoup") {
      property = row.querySelector(".fx-property") && row.querySelector(".fx-property").value.trim();
      then.property = property || "spicy";
    }
    perTurn = el("syn-per-turn") && el("syn-per-turn").value;
    peakTurns = el("syn-peak-turns") && el("syn-peak-turns").value;
    afterPeak = el("syn-after-peak") && el("syn-after-peak").value;
    if (el("syn-shape").value === "when") {
      who = el("syn-who") ? el("syn-who").value : "everyone";
      tag = el("syn-who-tag") ? Hotpot.matcherFromTagText(el("syn-who-tag").value) : {};
      if (who === "only" && (tag.hasTag || tag.hasTags)) {
        if (tag.hasTags) then.hasTags = tag.hasTags;
        else then.hasTag = tag.hasTag;
      } else if (who === "except" && (tag.hasTag || tag.hasTags)) {
        if (tag.hasTags) then.unlessTags = tag.hasTags;
        else then.unlessTag = tag.hasTag;
      }
    }
    if (perTurn !== "" && perTurn != null) {
      then.perTurn = Number(perTurn) || 0;
      delete then.amount;
    }
    if (peakTurns !== "" && peakTurns != null) then.peakTurns = Number(peakTurns);
    if (afterPeak !== "" && afterPeak != null) then.afterPeak = Number(afterPeak);
    return then;
  }

  function fillSynergyEditor(syn) {
    var then;
    var members;
    var trigger;
    editorSynergyId = syn && syn.id ? syn.id : "";
    el("syn-id").value = editorSynergyId;
    if (syn && syn.compliments) {
      applySynergyShape("compliments");
      el("syn-name").value = syn.name || "";
      el("syn-trigger").value = syn.trigger || "onSubmit";
      fillWhoGets({});
      members = Hotpot.comboMembers(syn.compliments);
      fillMemberRows(members);
      refreshBoostFromMembers(syn.compliments.boost);
      then = syn.then || { type: "modifyPoints", amount: 2 };
      el("syn-effect-row").innerHTML = effectRowHtml(then);
      syncEffectRow(el("syn-effect-row").querySelector(".effect-row"));
      el("synergy-status").textContent = "Editing " + syn.id;
      showSynergyValues(syn);
    } else if (syn && syn.when) {
      applySynergyShape("when");
      trigger = syn.when.anyInPot || {};
      then = syn.then || { type: "modifyPoints", amount: 1 };
      el("syn-name").value = syn.name || "";
      el("syn-trigger").value = syn.trigger || "onSubmit";
      applyMatcherToSide("a", trigger);
      fillWhoGets(then);
      el("syn-effect-row").innerHTML = effectRowHtml({
        type: then.type,
        amount: then.amount,
        perTurn: then.perTurn,
        property: then.property || ""
      });
      syncEffectRow(el("syn-effect-row").querySelector(".effect-row"));
      el("synergy-status").textContent = "Editing " + syn.id + " (if present)";
      showSynergyValues(syn);
    } else {
      applySynergyShape("compliments");
      el("syn-name").value = "";
      el("syn-trigger").value = "onSubmit";
      fillWhoGets({});
      fillMemberRows([{ defId: "beef" }, { defId: "chili" }]);
      refreshBoostFromMembers("all");
      el("syn-effect-row").innerHTML = effectRowHtml({ type: "modifyPoints", amount: 2 });
      syncEffectRow(el("syn-effect-row").querySelector(".effect-row"));
      el("synergy-status").textContent = "New combo synergy";
      showSynergyValues(null);
    }
  }

  function renderSynergyList() {
    var list = Hotpot.config.synergies || [];
    el("synergy-list").innerHTML = list.map(function (syn) {
      return "<div class=\"catalog-row\">" +
        "<span><strong>" + esc(syn.name) + "</strong> <code>" + esc(syn.id) + "</code><br>" + esc(synergySummary(syn)) + "</span>" +
        "<span class=\"row-actions\">" +
        "<button type=\"button\" data-action=\"edit-syn\" data-id=\"" + esc(syn.id) + "\">Edit</button>" +
        "<button type=\"button\" data-action=\"delete-syn\" data-id=\"" + esc(syn.id) + "\">Delete</button>" +
        "</span></div>";
    }).join("") || "<p class=\"empty\">No synergies.</p>";
  }

  function applyView(view) {
    if (view !== "admin") view = "player";
    document.body.dataset.view = view;
    try { localStorage.setItem(VIEW_KEY, view); } catch (err) { /* ignore */ }
    document.querySelectorAll(".view-toggle [data-action='set-view']").forEach(function (btn) {
      btn.setAttribute("aria-pressed", btn.getAttribute("data-id") === view ? "true" : "false");
    });
  }

  function loadView() {
    var saved = null;
    try { saved = localStorage.getItem(VIEW_KEY); } catch (err) { saved = null; }
    applyView(saved || "player");
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
    renderSynergyList();
    fillSynergyIngredientSelects();
    if (el("max-submit") && document.activeElement !== el("max-submit")) {
      el("max-submit").value = String(Hotpot.maxSubmitIngredients(Hotpot.config));
    }
    if (el("max-hand") && document.activeElement !== el("max-hand")) {
      el("max-hand").value = String(Hotpot.handSize(Hotpot.config));
    }
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
        results = Hotpot.game.draw();
        if (results && results.error) setSubmitStatus(results.error);
        else setSubmitStatus("");
        afterCommand();
        break;
      case "reroll":
        Hotpot.game.reroll();
        setSubmitStatus("");
        afterCommand();
        break;
      case "end-turn":
        Hotpot.game.endTurn();
        afterCommand();
        break;
      case "submit":
        results = Hotpot.game.submitPot();
        if (results && results.error) {
          setSubmitStatus(results.error);
        } else {
          setSubmitStatus("");
          comparisonCache = Hotpot.state.lastSubmission.resultsByModel;
          comparisonIsPreview = false;
        }
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
        fillSynergyEditor(null);
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
          overcookedDuration: el("ing-overcooked").value,
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
        results = Hotpot.game.addDefToPile(id, "hand");
        if (results && results.error) setSubmitStatus(results.error);
        else setSubmitStatus("");
        afterCommand();
        break;
      case "add-def-deck":
        Hotpot.game.addDefToPile(id, "deck");
        afterCommand();
        break;
      case "set-view":
        applyView(id);
        afterCommand();
        break;
      case "save-syn":
        Hotpot.editor.upsertSynergy({
          id: el("syn-id").value || editorSynergyId,
          shape: el("syn-shape").value,
          name: el("syn-name").value,
          trigger: el("syn-trigger").value,
          a: el("syn-a-kind") ? readMatcherFromSide("a") : {},
          members: readMembersFromForm(),
          boost: el("syn-boost") ? el("syn-boost").value : "all",
          then: readSynergyThen()
        });
        fillSynergyEditor(null);
        afterCommand();
        break;
      case "add-syn-member":
        addMemberRow({});
        refreshBoostFromMembers(el("syn-boost") && el("syn-boost").value);
        break;
      case "remove-syn-member":
        if (btn.closest(".syn-member")) {
          if (el("syn-members").querySelectorAll(".syn-member").length <= 2) break;
          btn.closest(".syn-member").remove();
          refreshBoostFromMembers(el("syn-boost") && el("syn-boost").value);
        }
        break;
      case "clear-syn":
        fillSynergyEditor(null);
        break;
      case "edit-syn":
        fillSynergyEditor(Hotpot.editor.getSynergy(id));
        break;
      case "delete-syn":
        Hotpot.editor.deleteSynergy(id || el("syn-id").value || editorSynergyId);
        fillSynergyEditor(null);
        afterCommand();
        break;
      default:
        break;
    }
  }

  function bind() {
    document.addEventListener("click", onClick);
    document.addEventListener("change", function (event) {
      var t = event.target;
      var row;
      if (t && t.classList && t.classList.contains("syn-kind")) {
        setSideKind(t.getAttribute("data-id"), t.value);
      }
      if (t && t.id === "syn-shape") applySynergyShape(t.value);
      if (t && t.id === "syn-who") syncWhoTagField();
      if (t && t.id === "syn-trigger") syncCookFields();
      if (t && t.classList && t.classList.contains("fx-type")) syncEffectRow(t.closest(".effect-row"));
      if (t && t.classList && (t.classList.contains("syn-mem-kind") || t.classList.contains("syn-mem-ing") || t.classList.contains("syn-mem-tag"))) {
        row = t.closest(".syn-member");
        if (t.classList.contains("syn-mem-kind")) syncMemberRow(row);
        refreshBoostFromMembers(el("syn-boost") && el("syn-boost").value);
      }
    });
    el("customer-select").addEventListener("change", function () {
      Hotpot.game.setCustomer(el("customer-select").value);
      afterCommand();
    });
    el("model-select").addEventListener("change", function () {
      Hotpot.game.setActiveModel(el("model-select").value);
      afterCommand();
    });
    el("max-submit").addEventListener("change", function () {
      var n = Number(el("max-submit").value);
      if (!Hotpot.config.table) Hotpot.config.table = {};
      Hotpot.config.table.maxSubmitIngredients = n >= 1 ? n : 5;
      afterCommand();
    });
    el("max-hand").addEventListener("change", function () {
      var n = Number(el("max-hand").value);
      if (!Hotpot.config.table) Hotpot.config.table = {};
      Hotpot.config.table.handSize = n >= 1 ? n : 5;
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
    loadView();
    fillEditor(null);
    fillSynergyEditor(null);
  }

  Hotpot.ui = {
    bind: bind,
    render: render,
    fillEditor: fillEditor
  };
})(window.Hotpot);

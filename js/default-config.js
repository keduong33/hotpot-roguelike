(function (Hotpot) {
  Hotpot.DEFAULT_CONFIG = {
    version: 1,
    table: {
      handSize: 5,
      drawPerTurn: 1,
      startingRerolls: 3,
      submitClearsPot: true,
      submitKeepsSoup: true,
      recycleDiscard: true,
      advanceCustomer: false,
      startingSoupBaseId: "spicy_mala",
      startingCustomerId: "spicy_lover",
      startingDeckCounts: {
        beef: 3,
        chili: 3,
        mushroom: 3,
        tofu: 2,
        noodle: 2,
        milk: 2
      }
    },
    soup: {
      properties: ["spicy", "sweet", "creamy", "rich", "umami", "salty", "sour"],
      bases: [
        { id: "spicy_mala", name: "Spicy Mala", properties: { spicy: 4, umami: 2 } },
        { id: "milky", name: "Milky", properties: { creamy: 4, sweet: 2 } }
      ]
    },
    freshnessModifiers: {
      fresh: 3,
      cooked: 5,
      spoiled: -3
    },
    changeSoup: {
      scorePenalty: 10,
      clearPot: false,
      resetProperties: true
    },
    ingredients: [
      {
        id: "beef",
        name: "Beef",
        basePoints: 5,
        tags: ["meat", "beef", "premium"],
        freshDuration: 2,
        cookedDuration: 3,
        effects: [
          { type: "modifySoup", property: "umami", amount: 3 },
          { type: "modifySoup", property: "rich", amount: 2 }
        ]
      },
      {
        id: "chili",
        name: "Chili",
        basePoints: 3,
        tags: ["vegetable", "spicy"],
        freshDuration: 2,
        cookedDuration: 2,
        effects: [
          { type: "modifySoup", property: "spicy", amount: 4 }
        ]
      },
      {
        id: "mushroom",
        name: "Mushroom",
        basePoints: 4,
        tags: ["vegetable", "mushroom", "umami"],
        freshDuration: 2,
        cookedDuration: 3,
        effects: [
          { type: "modifySoup", property: "umami", amount: 3 }
        ]
      },
      {
        id: "tofu",
        name: "Tofu",
        basePoints: 3,
        tags: ["vegetarian", "soy", "protein"],
        freshDuration: 3,
        cookedDuration: 2,
        effects: [
          { type: "modifySoup", property: "umami", amount: 1 },
          { type: "modifySoup", property: "salty", amount: 1 }
        ]
      },
      {
        id: "noodle",
        name: "Noodle",
        basePoints: 2,
        tags: ["noodle"],
        freshDuration: 3,
        cookedDuration: 4,
        effects: [
          { type: "modifySoup", property: "salty", amount: 1 }
        ]
      },
      {
        id: "milk",
        name: "Milk",
        basePoints: 2,
        tags: ["dairy", "creamy"],
        freshDuration: 1,
        cookedDuration: 2,
        effects: [
          { type: "modifySoup", property: "creamy", amount: 3 },
          { type: "modifySoup", property: "sweet", amount: 1 }
        ]
      }
    ],
    customers: [
      {
        id: "spicy_lover",
        name: "Spicy Lover",
        likes: ["spicy", "umami"],
        dislikes: ["sweet"],
        thresholds: { spicy: 7, umami: 5 },
        weights: { spicy: 2, umami: 3, creamy: 0.5 }
      },
      {
        id: "cream_fan",
        name: "Cream Fan",
        likes: ["creamy", "sweet", "rich"],
        dislikes: ["spicy"],
        thresholds: { creamy: 6, sweet: 3, rich: 4 },
        weights: { creamy: 3, sweet: 2, rich: 2, spicy: 0.25 }
      },
      {
        id: "umami_hunter",
        name: "Umami Hunter",
        likes: ["umami", "rich", "salty"],
        dislikes: ["sour"],
        thresholds: { umami: 8, rich: 4, salty: 3 },
        weights: { umami: 3, rich: 2, salty: 1.5, sour: 0.25 }
      }
    ],
    synergies: [
      {
        id: "noodle_boost",
        name: "Noodle synergy",
        trigger: "onSubmit",
        when: { anyInPot: { hasTag: "noodle" } },
        then: { type: "modifyIngredientPoints", unlessTag: "noodle", amount: 1 }
      },
      {
        id: "meat_veg",
        name: "Meat + vegetable synergy",
        trigger: "onSubmit",
        when: { anyInPot: { hasTag: "meat" } },
        then: { type: "modifyIngredientPoints", hasTag: "vegetable", amount: 1 }
      },
      {
        id: "veg_cooking",
        name: "Vegetable cooking",
        trigger: "onEndTurn",
        when: { anyInPot: { hasTag: "vegetable" } },
        then: {
          type: "modifyBonusPoints",
          hasTag: "vegetable",
          perTurn: 1,
          peakTurns: 3,
          afterPeak: -1
        }
      }
    ],
    scoring: {
      activeModel: "additive",
      models: {
        additive: {
          soupBonusPerPoint: 0.5,
          likeHitBonus: 8,
          dislikePenalty: 5
        },
        pointsMultiplier: {
          baseMult: 1,
          soupToMult: 0.05
        },
        soupMultiplier: {
          soupToMult: 0.04
        },
        customerWeighted: {
          likeWeight: 2,
          dislikeWeight: 0.5,
          defaultWeight: 1
        },
        thresholds: {
          bands: [
            { min: 5, bonus: 10 },
            { min: 8, bonus: 25 },
            { min: 10, bonus: 50 }
          ]
        }
      }
    }
  };
})(window.Hotpot);

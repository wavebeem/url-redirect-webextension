"use strict";

import Vue from "../lib/vue-2.6.11.min.js";

const page = browser.extension.getBackgroundPage();

const app = new Vue({
  el: "#app",

  data: {
    css: {
      h2: "normal",
      th: "tl normal pv1",
      card: "flex",
      table: "collapse mv4 dt--fixed",
      row: "b--black-10 bb",
      label: "db b mt3 nb2",
      checkbox:
        "Checkbox Focus-Border w2 h2 br1 ba b--black-20 bg-white input-reset",
      input:
        "input-reset button-reset f6 border-box db w-100 code ba b--black-20 br1 mv2 pa2 Focus-Border h2",
      add:
        "input-reset button-reset b db bg-moon-gray black b--transparent ba br2 mv2 ph3 pv2 Focus-Border hover-bg-light-silver",
      remove:
        "input-reset button-reset b db bg-transparent ba b--transparent br1 mv2 Focus-Border hover-bg-washed-red w2 h2 Remove"
    },
    config: page.getConfig()
  },

  methods: {
    addCSP() {
      this.config.removeCSPRules.push({ originPattern: "", enabled: true });
    },

    removeCSPByIndex(index) {
      this.config.removeCSPRules.splice(index, 1);
    },

    addRedirect() {
      this.config.redirectRules.push({
        fromPattern: "",
        toPattern: "",
        enabled: true
      });
    },

    removeRedirectByIndex(index) {
      this.config.redirectRules.splice(index, 1);
    }
  },

  computed: {
    configJSON() {
      return JSON.stringify(this.config, null, 2);
    }
  }
});

app.$watch("configJSON", json => {
  page.updateConfig(json);
});

Object.assign(globalThis, { app, page });

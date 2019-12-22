"use strict";

import Vue from "../lib/vue-2.6.11.min.js";

const page = browser.extension.getBackgroundPage();

const app = new Vue({
  el: "#app",

  data: {
    css: {
      label: "db b nb2",
      input:
        "input-reset button-reset border-box db w-100 code ba b--black-20 bw1 br1 mv3 pa2 Focus-Border",
      add:
        "input-reset button-reset b db bg-dark-blue white b--transparent ba bw1 br2 mv3 ph3 pv2 Focus-Border Hover-Dim-75",
      remove:
        "input-reset button-reset b db dark-red bg-white b--dark-red ba bw1 br2 mv3 ph3 pv2 Focus-Border Hover-Dim-50"
    },
    config: page.getConfig()
  },

  methods: {
    addCSP() {
      this.config.removeCSP.push({ originPattern: "" });
    },

    removeCSPByIndex(index) {
      this.config.removeCSP.splice(index, 1);
    },

    addRedirect() {
      this.config.redirect.push({ fromPattern: "", toPattern: "" });
    },

    removeRedirectByIndex(index) {
      this.config.redirect.splice(index, 1);
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

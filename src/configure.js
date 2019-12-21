"use strict";

import Vue from "../lib/vue-2.6.11.min.js";

const page = browser.extension.getBackgroundPage();

const app = new Vue({
  el: "#app",

  data: {
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

Object.assign(globalThis, { app });

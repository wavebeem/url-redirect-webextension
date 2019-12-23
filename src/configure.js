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
    },

    showImportDialog() {
      // TODO
      prompt("JSON Import");
    },

    showExportDialog() {
      // TODO
      alert(this.configJSON);
    }
  },

  computed: {
    configJSON() {
      return JSON.stringify(this.config, null, 2);
    }
  }
});

app.$watch("configJSON", json => {
  page.updateConfigJSON(json);
});

// Let's make debugging easier since this is an ES Module
Object.assign(globalThis, { app, page });

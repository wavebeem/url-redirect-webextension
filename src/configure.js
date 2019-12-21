"use strict";

import Vue from "../lib/vue-2.6.11.min.js";

const page = browser.extension.getBackgroundPage();
console.log(page);
// page.updateConfig(page.getConfig());
console.log(page.getConfig());

const app = new Vue({
  el: "#app",
  data: {
    text: "Hi",
    config: page.getConfig()
  },
  computed: {
    configJSON() {
      return JSON.stringify(this.config, null, 2);
    }
  }
});

console.log(app);

Object.assign(globalThis, { app });

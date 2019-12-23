"use strict";

import Vue from "../lib/vue-2.6.11.min.js";

export const page = browser.extension.getBackgroundPage();

export const app = new Vue({
  el: "#app",

  data: {
    importConfigJSON: "",
    isImportModalVisible: false,
    isExportModalVisible: false,
    config: page.getConfig()
  },

  methods: {
    doImport() {
      // TODO
      alert(this.importConfig);
      page.updateConfigJSON(this.importConfigJSON);
    },

    copyConfig() {
      // TODO
    },

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
      this.isImportModalVisible = true;
    },

    showExportDialog() {
      this.isExportModalVisible = true;
    },

    hideImportDialog() {
      this.isImportModalVisible = false;
    },

    hideExportDialog() {
      this.isExportModalVisible = false;
    }
  },

  computed: {
    configJSON() {
      return JSON.stringify(this.config, null, 2);
    }
  }
});

app.$watch("configJSON", function(json) {
  page.updateConfigJSON(json);
});

app.$watch("isImportModalVisible", function(isImportModalVisible) {
  if (isImportModalVisible) {
    this.$refs.importConfigJSON.focus();
  }
});

app.$watch("isExportModalVisible", function(isExportModalVisible) {
  if (isExportModalVisible) {
    this.$refs.exportConfig.focus();
  }
});

// Let's make debugging easier since this is an ES Module
Object.assign(globalThis, { app, page });

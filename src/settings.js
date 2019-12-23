"use strict";

import Vue from "../lib/vue-2.6.11.min.js";

export const page = browser.extension.getBackgroundPage();

export const app = new Vue({
  el: "#app",

  data: {
    isCopiedMessageVisible: false,
    importSettingsJSON: "",
    isImportModalVisible: false,
    isExportModalVisible: false,
    settings: page.getSettings()
  },

  methods: {
    doImport() {
      page.updateSettingsJSON(this.importSettingsJSON);
      this.settings = page.getSettings();
      this.isImportModalVisible = false;
      this.importSettingsJSON = "";
    },

    copySettings() {
      this.$refs.exportSettingsJSON.select();
      document.execCommand("copy");
      this.isCopiedMessageVisible = true;
      setTimeout(() => {
        this.isCopiedMessageVisible = false;
      }, 3000);
    },

    addCSP() {
      this.settings.removeCSPRules.push({ originPattern: "", enabled: true });
    },

    removeCSPByIndex(index) {
      this.settings.removeCSPRules.splice(index, 1);
    },

    addRedirect() {
      this.settings.redirectRules.push({
        fromPattern: "",
        toPattern: "",
        enabled: true
      });
    },

    removeRedirectByIndex(index) {
      this.settings.redirectRules.splice(index, 1);
    },

    showImportDialog() {
      this.isImportModalVisible = true;
    },

    showExportDialog() {
      this.isExportModalVisible = true;
    },

    hideImportDialog() {
      this.isImportModalVisible = false;
      this.importSettingsJSON = "";
    },

    hideExportDialog() {
      this.isExportModalVisible = false;
    }
  },

  computed: {
    settingsJSON() {
      return JSON.stringify(this.settings, null, 2);
    },

    importSettingsJSONError() {
      try {
        JSON.parse(this.importSettingsJSON);
        return "";
      } catch (err) {
        return "Invalid settings JSON";
      }
    }
  }
});

app.$watch("settingsJSON", function(json) {
  page.updateSettingsJSON(json);
});

app.$watch("isImportModalVisible", function(isImportModalVisible) {
  if (isImportModalVisible) {
    this.$refs.importSettingsJSON.focus();
  }
});

app.$watch("isExportModalVisible", function(isExportModalVisible) {
  if (isExportModalVisible) {
    this.$refs.exportSettingsJSON.focus();
  }
});

// Let's make debugging easier since this is an ES Module
Object.assign(globalThis, { app, page });

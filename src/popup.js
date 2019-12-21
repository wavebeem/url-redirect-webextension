"use strict";

const page = browser.extension.getBackgroundPage();
console.log(page);
page.updateConfig(page.getConfig());

const { isT3 } = require('./external-links');

function isT3Tab(tab, browserTabs = []) {
  if (!tab || tab.input !== undefined) return false;
  if (/(?:^| - )T3 Code$|^app\.t3\.codes$/i.test(tab.label)) return true;
  return browserTabs.some(browser => isT3(browser.url) && (
    browser.title === tab.label || (tab.label.endsWith('…') && browser.title.startsWith(tab.label.slice(0, -1)))
  ));
}
module.exports = { isT3Tab };

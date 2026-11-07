// Reminders are local notifications only, so the app never needs push.
// expo-notifications adds the push entitlement on its own, which Apple then
// refuses because the App ID has no Push capability. This takes it out again.
const { withEntitlementsPlist } = require("expo/config-plugins");

module.exports = function withoutPush(config) {
  return withEntitlementsPlist(config, (mod) => {
    delete mod.modResults["aps-environment"];
    return mod;
  });
};

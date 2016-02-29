var path = require("path");
var settings = {
  "v8": {
    "flags" : []
  },
  "app": {
    "native+"               : true,   // DEFAULT=FALSE; extends require to search native modules respecting the current v8 engine version.
    "autoAddWorkSpace"      : false,  // DEFAULT=TRUE; disables the autoAddWorkSpace behavior.
    "openDevToolsDetached"  : false,  // DEFAULT=FALSE; opens the dev tools windows detached in an own window.
    "hideMainWindow"        : false  // DEFAULT=FALSE;  hides the main window to show dev tools only.
  }
};

module.exports = settings;

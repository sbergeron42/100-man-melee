/* eslint-disable */
var chain = {};
function c() { return chain; }
chain.hide = c; chain.show = c; chain.toggle = c; chain.remove = c;
chain.append = c; chain.empty = c; chain.css = c; chain.click = c;
chain.fadeIn = c; chain.fadeOut = c; chain.after = c; chain.hover = c;
chain.attr = c; chain.val = c; chain.on = c; chain.off = c;
chain.prop = c; chain.text = c; chain.html = c;
function $() { return chain; }
$.fn = {};
$.extend = function() {};
module.exports = $;

var path = require("path");
var webpack = require("webpack");
var HappyPack = require('happypack');

var srcDir = path.join(process.cwd(), "src");
var stubDir = path.join(process.cwd(), "server", "headless", "stubs");
var distDir = path.join(process.cwd(), "server", "headless", "dist");

module.exports = {
  target: "node",
  cache: true,
  debug: false,
  devtool: undefined,
  entry: {
    headless: path.join(process.cwd(), "server", "headless", "entry.js"),
  },
  output: {
    path: distDir,
    filename: "[name].js",
    libraryTarget: "commonjs2",
  },
  resolve: {
    extensions: ["", ".js"],
    root: [srcDir],
    alias: {
      // Browser modules -> no-op stubs
      "main/sfx":                          path.join(stubDir, "sfx.js"),
      "main/render":                       path.join(stubDir, "render.js"),
      "main/vfx$":                           path.join(stubDir, "vfxAll.js"),
      "main/vfx/drawVfx":                  path.join(stubDir, "vfxAll.js"),
      "main/vfx/vfxQueue":                 path.join(stubDir, "vfxAll.js"),
      "main/vfx/renderVfx":               path.join(stubDir, "vfxAll.js"),
      "main/vfx/transparency":            path.join(stubDir, "vfxAll.js"),
      "main/vfx/makeColour":              path.join(stubDir, "vfxAll.js"),
      "main/vfx/blendColours":            path.join(stubDir, "vfxAll.js"),
      "main/vfx/drawArrayPath":           path.join(stubDir, "vfxAll.js"),
      "main/vfx/drawArrayPathNew":        path.join(stubDir, "vfxAll.js"),
      "main/vfx/drawHexagon":             path.join(stubDir, "vfxAll.js"),
      "main/vfx/chromaticAberration":     path.join(stubDir, "vfxAll.js"),
      "main/vfx/singGen":                 path.join(stubDir, "vfxAll.js"),
      "main/vfx/vfxData":                 path.join(stubDir, "vfxAll.js"),
      "main/vfx/vfxData/index":           path.join(stubDir, "vfxAll.js"),
      "main/vfx/dVfx":                    path.join(stubDir, "vfxAll.js"),
      "main/vfx/dVfx/laser":              path.join(stubDir, "vfxAll.js"),
      "main/vfx/dVfx/general":            path.join(stubDir, "vfxAll.js"),
      "main/vfx/lines":                   path.join(stubDir, "vfxAll.js"),
      "main/vfx/stars":                   path.join(stubDir, "vfxAll.js"),
      "main/music":                        path.join(stubDir, "music.js"),
      "main/camera":                       path.join(stubDir, "camera.js"),
      "main/resize":                       path.join(stubDir, "noop.js"),
      "main/loadscreen":                   path.join(stubDir, "noop.js"),
      "main/swordSwings":                  path.join(stubDir, "noop.js"),
      "main/replay":                       path.join(stubDir, "replay.js"),
      "main/multiplayer/streamclient":     path.join(stubDir, "streamclient.js"),
      "main/multiplayer/spectatorclient":  path.join(stubDir, "netclient.js"),
      "main/multiplayer/netclient":        path.join(stubDir, "netclient.js"),
      "main/multiplayer/encode":           path.join(stubDir, "noop.js"),
      "stages/stagerender":                path.join(stubDir, "stagerender.js"),
      "menus/css":                         path.join(stubDir, "menus.js"),
      "menus/menu":                        path.join(stubDir, "menus.js"),
      "menus/stageselect":                 path.join(stubDir, "menus.js"),
      "menus/startscreen":                 path.join(stubDir, "menus.js"),
      "menus/startup":                     path.join(stubDir, "menus.js"),
      "menus/audiomenu":                   path.join(stubDir, "menus.js"),
      "menus/gameplaymenu":                path.join(stubDir, "menus.js"),
      "menus/keyboardmenu":                path.join(stubDir, "menus.js"),
      "menus/controllermenu":              path.join(stubDir, "menus.js"),
      "menus/credits":                     path.join(stubDir, "menus.js"),
      "menus/keytest":                     path.join(stubDir, "noop.js"),
      "jquery":                            path.join(stubDir, "jquery.js"),
      "howler":                            path.join(stubDir, "noop.js"),
      "localforage":                       path.join(stubDir, "noop.js"),
      "pako":                              path.join(stubDir, "noop.js"),
      "input/gamepad/retrieveGamepadInputs": path.join(stubDir, "gamepad.js"),
      "input/gamepad/findGamepadInfo":     path.join(stubDir, "gamepad.js"),
      "input/gamepad/gamepads/custom":     path.join(stubDir, "gamepad.js"),
      "input/gamepad/drawGamepad":         path.join(stubDir, "gamepad.js"),
      "input/gamepad/gamepadCalibration":  path.join(stubDir, "gamepad.js"),
    },
  },
  module: {
    // No ESLint for headless build
    loaders: [{
      test: /\.jsx?$/,
      exclude: [/node_modules/],
      loader: "happypack/loader",
    }],
  },
  plugins: [
    new HappyPack({
      loaders: [{
        loader: 'babel-loader',
        query: {
          presets: ['es2015'],
          plugins: ['transform-flow-strip-types', 'transform-class-properties']
        }
      }],
      threads: 8
    }),
    // Inject browser global shims before any module code
    new webpack.BannerPlugin(
      [
        'if(typeof window==="undefined"){',
        '  global.window=global;global.window.addEventListener=function(){};global.window.removeEventListener=function(){};',
        '  global.document={onkeydown:null,onkeyup:null,',
        '    getElementById:function(){return{innerHTML:"",style:{},getContext:function(){return{}}}},',
        '    createElement:function(){return{style:{}}},',
        '    createElementNS:function(){return{}},',
        '    querySelectorAll:function(){return[]},',
        '    body:{appendChild:function(){}},',
        '    cookie:"",fullscreenElement:null,mozFullScreenElement:null,webkitFullscreenElement:null};',
        '  global.navigator={getGamepads:null,webkitGetGamepads:null,userAgent:""};',
        '  global.Image=function(){};',
        '  global.Howl=function(){return{play:function(){},stop:function(){},volume:function(){},fade:function(){},seek:function(){},playing:function(){return false},_volume:0}};',
        '  global.localStorage={getItem:function(){return""},setItem:function(){}};',
        '  if(!global.setTimeout)global.setTimeout=function(){return 0};',
        '  if(!global.setInterval)global.setInterval=function(){return 0};',
        '  if(!global.clearTimeout)global.clearTimeout=function(){};',
        '  if(!global.clearInterval)global.clearInterval=function(){};',
        '  global.requestAnimationFrame=function(){return 0};',
        '  global.cancelAnimationFrame=function(){};',
        '}'
      ].join(''),
      { raw: true, entryOnly: true }
    ),
  ],
};

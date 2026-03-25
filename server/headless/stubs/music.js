/* eslint-disable */
var noop = function() {};
export class MusicManager {
  constructor() {}
  static stopWhatisPlaying = noop;
  static isWhatisPlaying = function() { return false; };
  static playMenuLoop = noop;
  static playBattleFieldLoop = noop;
  static playyStoryLoop = noop;
  static playpStadiumLoop = noop;
  static playDreamLandLoop = noop;
  static playfinaldLoop = noop;
  static playfodLoop = noop;
  static playTargetTestLoop = noop;
}

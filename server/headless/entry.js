/* eslint-disable */
// Headless entry point for server-side bot simulation
// Compiled by webpack with browser deps aliased to no-op stubs

// Load character data (side-effect imports that register attributes/moves)
import 'characters/fox';
import 'characters/fox/moves';
import 'characters/fox/moves/UPTILT.js';
import 'characters/fox/attributes.js';
import 'characters/fox/ecb.js';
import 'characters/fox/index.js';
import 'characters/falco';
import 'characters/falco/moves';
import 'characters/falco/attributes.js';
import 'characters/falco/ecb.js';
import 'characters/falco/index.js';
import 'characters/falcon';
import 'characters/falcon/moves';
import 'characters/falcon/attributes.js';
import 'characters/falcon/ecb.js';
import 'characters/falcon/index.js';
import 'characters/marth';
import 'characters/marth/moves';
import 'characters/marth/dancingBladeAirMobility.js';
import 'characters/marth/dancingBladeCombo.js';
import 'characters/marth/ecbmarth.js';
import 'characters/marth/index.js';
import 'characters/marth/marthAttributes.js';
import 'characters/puff';
import 'characters/puff/moves';
import 'characters/puff/ecbpuff.js';
import 'characters/puff/index.js';
import 'characters/puff/puffAttributes.js';
import 'characters/puff/puffMultiJumpDrift.js';
import 'characters/puff/puffNextJump.js';
import 'characters/shared/moves';

// Load utility modules
import 'main/util/Box2D.js';
import 'main/util/Vec2D.js';
import 'main/util/Segment2D.js';
import 'main/util/createHitBox.js';
import 'main/util/createHitboxObject.js';
import 'main/util/deepCopyObject.js';

// Load core systems
import {actionStates} from 'physics/actionStateShortcuts';
import {physics, rebuildLedgeCache} from 'physics/physics';
import {executeHits, hitDetect, checkPhantoms, resetHitQueue, rebuildSpatialGrid} from 'physics/hitDetection';
import {destroyArticles, executeArticles, articlesHitDetection, executeArticleHits, resetAArticles} from 'physics/article';
import {runAI, clearNearestEnemyCache} from 'main/ai';
import {playerObject} from 'main/player';
import {setVsStage, getActiveStage} from 'stages/activeStage';
import {Vec2D} from 'main/util/Vec2D';
import {
  player, characterSelections, playerType, ports,
  currentPlayers, mType, pPal, palettes,
  ensurePlayerSlot, buildPlayerObject,
  MAX_PLAYERS, battleRoyaleMode,
  startingPoint, startingFace
} from 'main/main';
import {nullInputs, aiInputBank, ensureAIInputSlot} from 'input/input';
import {resetVfxQueue} from 'main/vfx/vfxQueue';

// Load stages
import 'stages/vs-stages/vs-stages.js';
import 'stages/activeStage.js';

// Load physics modules
import 'physics/actionStateShortcuts.js';
import 'physics/article.js';
import 'physics/hitDetection.js';
import 'physics/physics.js';
import 'main/ai.js';
import 'main/player.js';
import 'main/characters.js';
import 'input/input.js';
import 'main/linAlg.js';
import 'main/main.js';

var CHARACTERS = [0, 1, 2, 3, 4];

export function createBotRunner(config) {
  var botCount = config.botCount || 20;
  var stageId = config.stageId || 6; // mega battlefield

  // Initialize stage
  setVsStage(stageId);
  resetVfxQueue();

  // Calculate spawn positions across stage surfaces
  var activeStg = getActiveStage();
  var surfaces = [];
  if (activeStg.ground) {
    for (var gi = 0; gi < activeStg.ground.length; gi++) {
      var g = activeStg.ground[gi];
      surfaces.push({ left: g[0].x, right: g[1].x, y: g[0].y });
    }
  }
  if (activeStg.platform) {
    for (var pi = 0; pi < activeStg.platform.length; pi++) {
      var p = activeStg.platform[pi];
      surfaces.push({ left: p[0].x, right: p[1].x, y: p[0].y });
    }
  }
  var totalWidth = 0;
  for (var si = 0; si < surfaces.length; si++) {
    totalWidth += surfaces[si].right - surfaces[si].left;
  }
  var spacing = totalWidth / botCount;
  var spawnIndex = 0;
  for (var si2 = 0; si2 < surfaces.length && spawnIndex < botCount; si2++) {
    var surf = surfaces[si2];
    var surfWidth = surf.right - surf.left;
    var playersOnSurface = Math.round(surfWidth / spacing);
    if (si2 === surfaces.length - 1) playersOnSurface = botCount - spawnIndex;
    for (var pi2 = 0; pi2 < playersOnSurface && spawnIndex < botCount; pi2++) {
      var t = (pi2 + 0.5) / playersOnSurface;
      var xPos = surf.left + t * surfWidth;
      startingPoint[spawnIndex] = [xPos, surf.y + 5];
      startingFace[spawnIndex] = spawnIndex % 2 === 0 ? 1 : -1;
      spawnIndex++;
    }
  }

  // Spawn bot players
  for (var i = 0; i < botCount; i++) {
    ensurePlayerSlot(i);
    ensureAIInputSlot(i);
    characterSelections[i] = CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)];
    playerType[i] = 1; // AI
    currentPlayers[i] = i;
    mType[i] = null;
    pPal[i] = i % palettes.length;
  }
  // Build player objects
  for (var j = 0; j < botCount; j++) {
    buildPlayerObject(j);
    player[j].phys.face = startingFace[j] || 1;
    player[j].actionState = "WAIT";
    player[j].timer = 0;
    player[j].stocks = 1;
    player[j].difficulty = Math.floor(Math.random() * 5) + 1;
  }

  var tickCount = 0;
  var inputBuffers = [];
  for (var ib = 0; ib < botCount; ib++) inputBuffers.push(nullInputs());

  return {
    tick: function() {
      tickCount++;
      resetHitQueue();
      clearNearestEnemyCache();
      rebuildLedgeCache();

      var stage = getActiveStage();
      if (stage.movingPlatforms) stage.movingPlatforms();

      destroyArticles();
      executeArticles();

      // Run AI + physics for all bots
      for (var i = 0; i < botCount; i++) {
        if (playerType[i] > -1 && player[i]) {
          if (player[i].actionState !== "SLEEP" && player[i].stocks > 0) {
            runAI(i);
          }
          physics(i, inputBuffers);
        }
      }

      // Hit detection
      checkPhantoms();
      rebuildSpatialGrid();
      for (var h = 0; h < botCount; h++) {
        if (playerType[h] > -1) {
          hitDetect(h, inputBuffers);
        }
      }
      executeHits(inputBuffers);
      articlesHitDetection();
      executeArticleHits(inputBuffers);
    },

    getState: function(index) {
      if (!player[index]) return null;
      return {
        x: player[index].phys.pos.x,
        y: player[index].phys.pos.y,
        actionState: player[index].actionState,
        timer: player[index].timer,
        face: player[index].phys.face,
        percent: Math.round(player[index].percent),
        stocks: player[index].stocks,
        character: characterSelections[index],
        velX: player[index].phys.cVel.x,
        velY: player[index].phys.cVel.y,
        grounded: player[index].phys.grounded,
        shielding: player[index].phys.shielding || false,
        palette: pPal[index] || 0,
      };
    },

    getStates: function() {
      var states = [];
      for (var i = 0; i < botCount; i++) {
        states.push(this.getState(i));
      }
      return states;
    },

    getBotCount: function() { return botCount; },
    getTickCount: function() { return tickCount; },
    isAlive: function(index) {
      return player[index] && player[index].stocks > 0 && player[index].actionState !== "SLEEP";
    },
    getAliveCount: function() {
      var count = 0;
      for (var i = 0; i < botCount; i++) {
        if (this.isAlive(i)) count++;
      }
      return count;
    },
    applyHit: function(botIndex, damage, knockback, angle) {
      // Called when a human player hits a bot
      if (!player[botIndex]) return;
      player[botIndex].percent += damage;
      player[botIndex].hit.knockback = knockback;
      player[botIndex].hit.angle = angle;
      player[botIndex].hit.hitstun = Math.floor(knockback * 0.4);
      player[botIndex].hit.hitlag = Math.floor(damage * (1/3) + 3);
      player[botIndex].hit.reverse = false;
      player[botIndex].phys.cVel.x = 0;
      player[botIndex].phys.cVel.y = 0;
      if (knockback >= 80) {
        actionStates[characterSelections[botIndex]].DAMAGEFLYN.init(botIndex, inputBuffers, true);
      } else {
        actionStates[characterSelections[botIndex]].DAMAGEN2.init(botIndex, inputBuffers);
      }
    },
  };
}

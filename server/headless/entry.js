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
import {executeHits, hitDetect, checkPhantoms, resetHitQueue, rebuildSpatialGrid, hitQueue} from 'physics/hitDetection';
import {Box2D} from 'main/util/Box2D';
import {destroyArticles, executeArticles, articlesHitDetection, executeArticleHits, resetAArticles} from 'physics/article';
import {runAI, clearNearestEnemyCache} from 'main/ai';
import {playerObject} from 'main/player';
import {setVsStage, getActiveStage} from 'stages/activeStage';
import {Vec2D} from 'main/util/Vec2D';
import {
  player, characterSelections, playerType, ports, setPorts,
  currentPlayers, mType, pPal, palettes,
  ensurePlayerSlot, buildPlayerObject,
  MAX_PLAYERS, battleRoyaleMode,
  startingPoint, startingFace,
  setGameMode, setPlaying, setStarting
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
    player[j].difficulty = 4; // max vanilla CPU level
    player[j].inCSS = false;
    player[j].phys.grounded = true;
    // Place on stage ground (y=0 for mega battlefield)
    player[j].phys.pos.y = 0.001;
  }

  // Tell the engine how many players exist (hitDetect, AI, spatial grid all loop over ports)
  setPorts(botCount);

  // Set game state so AI and physics work correctly
  // Use setGameMode instead of changeGamemode to avoid rendering side effects
  setGameMode(3); // VS playing mode
  setPlaying(true);
  setStarting(false); // Skip the countdown phase

  // Ghost human slots: indices [botCount .. botCount+N) in the player array
  // These are lightweight player objects with just position + hurtbox
  // so hitDetect can find them as victims of bot attacks.
  var ghostSlots = {}; // serverId -> player index
  var ghostServerIds = {}; // player index -> serverId
  var pendingHumanHits = []; // [{victimServerId, damage, knockback, angle, attackerBotIndex}]
  var pendingGrabs = []; // [{victimServerId, attackerBotIndex}]
  var activeGrabs = {}; // ghostIndex -> {attackerBotIndex, victimServerId}
  var pendingGrabReleases = []; // [{victimServerId, attackerBotIndex}]

  var tickCount = 0;
  // Input buffers: 8-frame history per player
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

      // Run AI then feed AI input into physics for each bot
      for (var i = 0; i < botCount; i++) {
        if (playerType[i] > -1 && player[i]) {
          if (player[i].actionState !== "SLEEP" && player[i].stocks > 0) {
            runAI(i);
          }
          // Shift input history by copying values (not references!)
          // Physics detects new presses via rising edges (input[0].a && !input[1].a)
          // which breaks if all slots point to the same object.
          ensureAIInputSlot(i);
          for (var k = 7; k > 0; k--) {
            var dst = inputBuffers[i][k];
            var src = inputBuffers[i][k-1];
            dst.lsX = src.lsX; dst.lsY = src.lsY;
            dst.rawX = src.rawX; dst.rawY = src.rawY;
            dst.csX = src.csX; dst.csY = src.csY;
            dst.rawcsX = src.rawcsX; dst.rawcsY = src.rawcsY;
            dst.a = src.a; dst.b = src.b; dst.x = src.x; dst.y = src.y;
            dst.z = src.z; dst.s = src.s;
            dst.l = src.l; dst.r = src.r;
            dst.lA = src.lA; dst.rA = src.rA;
            dst.dl = src.dl; dst.dd = src.dd; dst.dr = src.dr; dst.du = src.du;
          }
          // Copy current AI input values into slot [0]
          var ai = aiInputBank[i][0];
          var buf = inputBuffers[i][0];
          buf.lsX = ai.lsX; buf.lsY = ai.lsY;
          buf.rawX = ai.lsX; buf.rawY = ai.lsY;
          buf.csX = ai.csX || 0; buf.csY = ai.csY || 0;
          buf.rawcsX = ai.csX || 0; buf.rawcsY = ai.csY || 0;
          buf.a = ai.a; buf.b = ai.b; buf.x = ai.x; buf.y = ai.y || false;
          buf.z = ai.z || false; buf.s = ai.s || false;
          buf.l = ai.l; buf.r = ai.r || false;
          buf.lA = ai.lA; buf.rA = ai.rA || 0;
          buf.dl = ai.dl || false; buf.dd = ai.dd || false;
          buf.dr = ai.dr || false; buf.du = ai.du || false;
          physics(i, inputBuffers);
        }
      }

      // Hit detection (includes ghost humans in spatial grid via ports)
      checkPhantoms();
      rebuildSpatialGrid();
      for (var h = 0; h < botCount; h++) {
        if (playerType[h] > -1) {
          hitDetect(h, inputBuffers);
        }
      }

      // Extract bot-to-human hits from hitQueue before executeHits
      // hitQueue entries: [victim, attacker, hitboxId, shieldHit, isThrow, drawBounce, phantom]
      pendingHumanHits = [];
      var botOnlyQueue = [];
      for (var hq = 0; hq < hitQueue.length; hq++) {
        var victim = hitQueue[hq][0];
        var attacker = hitQueue[hq][1];
        if (ghostServerIds[victim] !== undefined) {
          // This hit targets a ghost human — convert to HIT_EVENT data
          var hbId = hitQueue[hq][2];
          var hitbox = player[attacker].hitboxes.id[hbId];
          if (hitbox) {
            // Let grab hitboxes (type 2) stay in hitQueue so executeGrabHits processes them
            if (hitbox.type === 2) {
              botOnlyQueue.push(hitQueue[hq]);
              continue;
            }
            var kbAngle = hitbox.angle || 45;
            var dmg = hitbox.dmg || 0;
            // Compute knockback (simplified Melee formula)
            var victimPercent = player[victim].percent || 0;
            var weight = 100; // approximate
            var kb = hitbox.bk + Math.floor(((14 * (dmg + victimPercent) / (weight + 100)) + 18) * (hitbox.kg / 100) + dmg * 0.1);
            pendingHumanHits.push({
              victimServerId: ghostServerIds[victim],
              damage: Math.round(dmg),
              knockback: Math.min(kb, 65535),
              angle: Math.round(kbAngle),
              attackerBotIndex: attacker
            });
          }
        } else {
          botOnlyQueue.push(hitQueue[hq]);
        }
      }
      // Replace hitQueue with bot-only hits so executeHits doesn't touch ghosts
      hitQueue.length = 0;
      for (var bq = 0; bq < botOnlyQueue.length; bq++) {
        hitQueue.push(botOnlyQueue[bq]);
      }

      executeHits(inputBuffers);
      articlesHitDetection();
      executeArticleHits(inputBuffers);

      // Detect new grabs and releases on ghost humans
      pendingGrabs = [];
      pendingGrabReleases = [];
      for (var gi in ghostSlots) {
        var gIdx = ghostSlots[gi];
        var wasGrabbed = activeGrabs[gIdx] !== undefined;
        var isGrabbed = player[gIdx].phys.grabbedBy !== -1;
        if (isGrabbed && !wasGrabbed) {
          var grabber = player[gIdx].phys.grabbedBy;
          activeGrabs[gIdx] = { attackerBotIndex: grabber, victimServerId: parseInt(gi) };
          pendingGrabs.push({ victimServerId: parseInt(gi), attackerBotIndex: grabber });
        } else if (!isGrabbed && wasGrabbed) {
          pendingGrabReleases.push(activeGrabs[gIdx]);
          delete activeGrabs[gIdx];
        }
      }
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
    getPlayerDebug: function(index) {
      if (!player[index]) return null;
      return { inCSS: player[index].inCSS, difficulty: player[index].difficulty, face: player[index].phys.face, grounded: player[index].phys.grounded, hitlag: player[index].hit.hitlag, charSel: characterSelections[index] };
    },
    getAIInput: function(index) {
      ensureAIInputSlot(index);
      var inp = aiInputBank[index] ? aiInputBank[index][0] : null;
      if (!inp) return null;
      return { lsX: inp.lsX, lsY: inp.lsY, a: inp.a, b: inp.b, x: inp.x, z: inp.z };
    },
    getInputBuffer: function(index) {
      var inp = inputBuffers[index] ? inputBuffers[index][0] : null;
      if (!inp) return null;
      return { lsX: inp.lsX, lsY: inp.lsY, a: inp.a, b: inp.b };
    },
    // --- Ghost human management ---
    addHumanGhost: function(serverId) {
      var idx = botCount + Object.keys(ghostSlots).length;
      ensurePlayerSlot(idx);
      playerType[idx] = 2; // type 2 = network/ghost (valid for hitDetect: > -1)
      characterSelections[idx] = 0;
      // Build a minimal player object
      buildPlayerObject(idx);
      player[idx].phys.grounded = true;
      player[idx].phys.pos = new Vec2D(0, 0);
      player[idx].phys.posPrev = new Vec2D(0, 0);
      player[idx].phys.hurtBoxState = 0;
      player[idx].phys.shielding = false;
      player[idx].phys.face = 1;
      player[idx].actionState = "WAIT";
      player[idx].stocks = 1;
      player[idx].percent = 0;
      player[idx].phys.hurtbox = new Box2D([0, 0], [0, 0]);
      // Ensure hitboxes exist but are inactive (ghost is victim only)
      if (!player[idx].hitboxes) {
        player[idx].hitboxes = { active: [false, false, false, false], id: [{}, {}, {}, {}], hitList: [], frame: 0 };
      }
      player[idx].hitboxes.active = [false, false, false, false];
      player[idx].hitboxes.hitList = [];
      // Ensure input buffer exists for this slot
      while (inputBuffers.length <= idx) inputBuffers.push(nullInputs());
      ghostSlots[serverId] = idx;
      ghostServerIds[idx] = serverId;
      // Update ports so hitDetect/spatialGrid includes ghosts
      setPorts(idx + 1);
    },

    updateHumanGhost: function(serverId, state) {
      var idx = ghostSlots[serverId];
      if (idx === undefined || !player[idx]) return;
      player[idx].phys.posPrev.x = player[idx].phys.pos.x;
      player[idx].phys.posPrev.y = player[idx].phys.pos.y;
      player[idx].phys.facePrev = player[idx].phys.face;
      player[idx].phys.pos.x = state.x;
      player[idx].phys.pos.y = state.y;
      player[idx].phys.face = state.face;
      player[idx].phys.grounded = state.grounded;
      player[idx].phys.shielding = state.shielding;
      player[idx].actionState = state.actionState;
      player[idx].percent = state.percent;
      // hurtBoxState 0 = vulnerable, 1 = invincible; shielding is handled separately
      player[idx].phys.hurtBoxState = 0;
      // Update hurtbox around position (generous bounding box)
      var hbW = 8, hbH = 18;
      player[idx].phys.hurtbox = new Box2D(
        [state.x - hbW, state.y + hbH],
        [state.x + hbW, state.y]
      );
      // Clear hitList each frame so they can be hit again
      if (player[idx].hitboxes) player[idx].hitboxes.hitList = [];
    },

    removeHumanGhost: function(serverId) {
      var idx = ghostSlots[serverId];
      if (idx === undefined) return;
      playerType[idx] = -1; // deactivate
      delete ghostSlots[serverId];
      delete ghostServerIds[idx];
    },

    getHumanHits: function() {
      var hits = pendingHumanHits;
      pendingHumanHits = [];
      return hits;
    },

    getGrabEvents: function() {
      var grabs = pendingGrabs;
      pendingGrabs = [];
      return grabs;
    },

    getGrabReleaseEvents: function() {
      var releases = pendingGrabReleases;
      pendingGrabReleases = [];
      return releases;
    },

    setBlastzone: function(minX, minY, maxX, maxY) {
      var stage = getActiveStage();
      if (stage && stage.blastzone) {
        stage.blastzone.min.x = minX;
        stage.blastzone.min.y = minY;
        stage.blastzone.max.x = maxX;
        stage.blastzone.max.y = maxY;
      }
    },

    getBlastzone: function() {
      var stage = getActiveStage();
      if (stage && stage.blastzone) {
        return { minX: stage.blastzone.min.x, minY: stage.blastzone.min.y, maxX: stage.blastzone.max.x, maxY: stage.blastzone.max.y };
      }
      return null;
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

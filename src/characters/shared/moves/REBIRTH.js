import {characterSelections, player} from "main/main";
import {actionStates} from "physics/actionStateShortcuts";
import {activeStage} from "stages/activeStage";
export default {
  name : "REBIRTH",
  canBeGrabbed : false,
  ignoreCollision : true,
  init : function(p,input){
    player[p].actionState = "REBIRTH";
    player[p].timer = 1;
    // Get respawn position, clamped within current blastzone
    var rp = activeStage.respawnPoints[p] || activeStage.respawnPoints[0];
    var rx = rp.x;
    var ry = rp.y + 135;
    var bz = activeStage.blastzone;
    // Clamp x to within 80% of blastzone width (safe margin from edges)
    var bzCx = (bz.min.x + bz.max.x) / 2;
    var bzHalfW = (bz.max.x - bz.min.x) * 0.4;
    rx = Math.max(bzCx - bzHalfW, Math.min(bzCx + bzHalfW, rx));
    // Clamp y below top blastzone
    if (ry > bz.max.y - 20) ry = bz.max.y - 20;
    player[p].phys.pos.x = rx;
    player[p].phys.pos.y = ry;
    //player[p].phys.grounded = true;
    player[p].phys.cVel.x = 0;
    player[p].phys.cVel.y = -1.5;
    player[p].phys.face = (activeStage.respawnFace[p] !== undefined) ? activeStage.respawnFace[p] : (p % 2 === 0 ? 1 : -1);
    player[p].phys.doubleJumped = false;
    player[p].phys.fastfalled = false;
    player[p].phys.jumpsUsed = 0;
    player[p].phys.wallJumpCount = 0;
    player[p].phys.sideBJumpFlag = true;
    player[p].spawnWaitTime = 0;
    player[p].percent = 0;
    player[p].phys.kVel.x = 0;
    player[p].phys.kVel.y = 0;
    player[p].hit.hitstun = 0;
    player[p].phys.shieldHP = 60;
    player[p].burning = 0;
    player[p].shocked = 0;
  },
  main : function(p,input){
    player[p].timer+= 1;
    if (!actionStates[characterSelections[p]].REBIRTH.interrupt(p,input)){
      player[p].phys.outOfCameraTimer = 0;
    }
  },
  interrupt : function(p,input){
    if (player[p].timer > 90){
      actionStates[characterSelections[p]].REBIRTHWAIT.init(p,input);
      return true;
    }
    else {
      return false;
    }
  }
};


import {checkForJump, shieldSize, shieldDepletion, shieldTilt, reduceByTraction, actionStates} from "physics/actionStateShortcuts";
import {characterSelections, player} from "main/main";
export default {
  name : "GUARD",
  canEdgeCancel : true,
  canBeGrabbed : true,
  missfoot : true,
  init : function(p,input){
    player[p].actionState = "GUARD";
    player[p].timer = 0;
    player[p].phys.powerShieldActive = false;
    player[p].phys.powerShieldReflectActive = false;
    actionStates[characterSelections[p]].GUARD.main(p,input);
  },
  main : function(p,input){
    if (player[p].hit.shieldstun > 0){
      reduceByTraction(p,false);
      shieldTilt(p,true,input);
    }
    else {
      player[p].timer++;
      if (!actionStates[characterSelections[p]].GUARD.interrupt(p,input)){
        if (!player[p].inCSS){
          reduceByTraction(p,false);
          shieldDepletion(p,input);
        }
        shieldTilt(p,false,input);
        shieldSize(p,null,input);
      }
    }
  },
  interrupt : function(p,input){
    if (!player[p].inCSS){
      const j = checkForJump(p, input);
      if (j[0] || input[p][0].csY > 0.66){
        player[p].phys.shielding = false;
        actionStates[characterSelections[p]].KNEEBEND.init(p,j[1],input);
        return true;
      }
      else if (input[p][0].a && !input[p][1].a){
        player[p].phys.shielding = false;
        actionStates[characterSelections[p]].GRAB.init(p,input);
        return true;
      }
      // --- UCF Shield Drop System ---
      // Based on UCF 0.84 (github.com/AltimorTASDK/ucf)
      //
      // Three components:
      // 1. Spotdodge suppression: on platforms, when stick is at gate rim and
      //    Y is between -0.7 and -0.8, suppress spotdodge to allow shield drop.
      //    Only when roll is locked out (X held long enough).
      // 2. Extended shield drop: for controllers whose notch lands above vanilla
      //    shield drop zone. Y <= -0.6125, at rim, Y velocity > 0.55 over 2 frames,
      //    requires 2 consecutive valid frames.
      // 3. Vanilla shield drop: Y < -0.65, on platform, 6-frame history.

      // Track X hold time and extended shield drop frames
      if (player[p].phys.ucfXHoldTime === undefined) player[p].phys.ucfXHoldTime = 0;
      if (player[p].phys.ucfSdropUpFrames === undefined) player[p].phys.ucfSdropUpFrames = 0;

      // Update X hold time (how long stick has been held sideways)
      if (Math.abs(input[p][0].lsX) > 0.3) {
        player[p].phys.ucfXHoldTime++;
      } else {
        player[p].phys.ucfXHoldTime = 0;
      }

      // Rim check helper: stick magnitude squared > 0.81 (i.e. magnitude > 0.9)
      var ucfRimMag = input[p][0].lsX * input[p][0].lsX + input[p][0].lsY * input[p][0].lsY;
      var ucfAtRim = ucfRimMag > 0.81;
      var ucfOnPlatform = player[p].phys.onSurface[0] === 1;
      // Roll lockout: X held for 4+ frames (vanilla roll window)
      var ucfRollLockedOut = player[p].phys.ucfXHoldTime >= 4;

      // Y velocity check (tauKhan tilt intent for shield drop)
      var ucfRawYCur = input[p][0].rawY !== undefined ? input[p][0].rawY : input[p][0].lsY;
      var ucfRawYPrev = input[p][2].rawY !== undefined ? input[p][2].rawY : input[p][2].lsY;
      var ucfYDelta = ucfRawYCur - ucfRawYPrev;
      var ucfYVelocityHigh = ucfYDelta * ucfYDelta > 0.55 * 0.55; // 44/80 raw units

      // Y hold time (how long stick has been at current Y)
      var ucfYJustMoved = false;
      if (Math.abs(input[p][0].lsY - input[p][1].lsY) > 0.05) {
        ucfYJustMoved = true;
      }

      // 1. Spotdodge check (vanilla + UCF suppression)
      else if ((input[p][0].lsY < -0.7 && input[p][4].lsY > -0.3) || input[p][0].csY < -0.7){
        var ucfSuppressSpotdodge = false;
        if (ucfOnPlatform && input[p][0].csY >= -0.7) {
          // UCF: suppress spotdodge on platforms when at rim, Y > -0.8, and roll locked out
          if (ucfAtRim && input[p][0].lsY > -0.8 && ucfRollLockedOut) {
            ucfSuppressSpotdodge = true;
          }
        }
        if (!ucfSuppressSpotdodge) {
          player[p].phys.shielding = false;
          player[p].phys.ucfSdropUpFrames = 0;
          actionStates[characterSelections[p]].ESCAPEN.init(p,input);
          return true;
        }
        // Spotdodge suppressed — fall through to shield drop checks
      }
      else if ((input[p][0].lsX*player[p].phys.face > 0.7 && input[p][4].lsX*player[p].phys.face < 0.3) || input[p][0].csX*player[p].phys.face > 0.7){
        player[p].phys.shielding = false;
        player[p].phys.ucfSdropUpFrames = 0;
        actionStates[characterSelections[p]].ESCAPEF.init(p,input);
        return true;
      }
      else if ((input[p][0].lsX*player[p].phys.face < -0.7 && input[p][4].lsX*player[p].phys.face > -0.3) || input[p][0].csX*player[p].phys.face < -0.7){
        player[p].phys.shielding = false;
        player[p].phys.ucfSdropUpFrames = 0;
        actionStates[characterSelections[p]].ESCAPEB.init(p,input);
        return true;
      }

      // 2. Extended shield drop (UCF 0.84): for notches above vanilla zone
      // Y <= -0.6125, at rim, Y velocity high enough, 2 consecutive valid frames
      if (ucfOnPlatform && ucfAtRim && input[p][0].lsY <= -0.6125) {
        if (player[p].phys.ucfSdropUpFrames > 0 || (ucfYJustMoved && ucfYVelocityHigh)) {
          player[p].phys.ucfSdropUpFrames++;
        } else {
          player[p].phys.ucfSdropUpFrames = 0;
        }
        if (player[p].phys.ucfSdropUpFrames >= 2) {
          player[p].phys.shielding = false;
          player[p].phys.ucfSdropUpFrames = 0;
          actionStates[characterSelections[p]].PASS.init(p,input);
          return true;
        }
      } else {
        player[p].phys.ucfSdropUpFrames = 0;
      }

      // 3. Vanilla shield drop: Y < -0.65, on platform, 6-frame history
      if (input[p][0].lsY < -0.65 && input[p][6].lsY > -0.3 && ucfOnPlatform){
        player[p].phys.shielding = false;
        player[p].phys.ucfSdropUpFrames = 0;
        actionStates[characterSelections[p]].PASS.init(p,input);
        return true;
      }
      // --- End UCF Shield Drop System ---
      else if (input[p][0].lA < 0.3 && input[p][0].rA < 0.3){
        player[p].phys.shielding = false;
        actionStates[characterSelections[p]].GUARDOFF.init(p,input);
        return true;
      }
      else if (player[p].timer > 1){
        actionStates[characterSelections[p]].GUARD.init(p,input);
        return true;
      }
      else {
        return false;
      }
    }
    else {
      if (input[p][0].lA < 0.3 && input[p][0].rA < 0.3){
        player[p].phys.shielding = false;
        actionStates[characterSelections[p]].GUARDOFF.init(p,input);
        return true;
      }
      else if (player[p].timer > 1){
        actionStates[characterSelections[p]].GUARD.init(p,input);
        return true;
      }
      else {
        return false;
      }
    }
  }
};


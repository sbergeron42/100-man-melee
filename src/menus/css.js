import {
  cpuDifficulty,
  characterSelections,
  player,
  changeGamemode,
  playerType,
  bg1,
  ui,
  palettes,
  pPal,
  clearScreen,
  versusMode,
  tagText,
  pause
  ,
  hasTag
  ,
  randomTags
  ,
  layers
  ,
  togglePort
  ,
  keys
  ,
  ports
  ,
  setVersusMode
  ,
  battleRoyalePending
  ,
  startGame
  ,
  setStageSelect
  ,
  networkMode
} from "main/main";
import {sendCharacterSelect, sendHostStart, isConnected, getIsHost, getRoomPlayerCount, lobbyCountdown} from "main/multiplayer/netclient";
import {drawArrayPathCompress, twoPi} from "main/render";
import {sounds} from "main/sfx";
import {actionStates} from "physics/actionStateShortcuts";
import {setCS, gameMode} from "../main/main";
import {chars} from "../main/characters";
import {Vec2D} from "../main/util/Vec2D";
import {syncCharacter, syncGameMode, syncTagText, inServerMode} from "../main/multiplayer/streamclient";
import {gameSettings} from "../settings";
/* eslint-disable */

export const marthPic = new Image();
marthPic.src = "assets/css/marth.png";
export const puffPic = new Image();
puffPic.src = "assets/css/puff.png";
export const foxPic = new Image();
foxPic.src = "assets/css/fox.png";
export const falcoPic = new Image();
falcoPic.src = "assets/css/falco.png";
export const falconPic = new Image();
falconPic.src = "assets/css/falcon.png";
export const handPoint = new Image();
handPoint.src = "assets/hand/handpoint.png";
export const handOpen = new Image();
handOpen.src = "assets/hand/handopen.png";
export const handGrab = new Image();
handGrab.src = "assets/hand/handgrab.png";

export let choosingTag = -1;

export function setChoosingTag(val) {
  choosingTag = val;
}

export const handType = [0, 0, 0, 0];
export const handPos = [new Vec2D(140, 700), new Vec2D(365, 700), new Vec2D(590, 700), new Vec2D(815, 700)];
export const tokenPos = [new Vec2D(475 - 54, 268), new Vec2D(515 - 54, 268), new Vec2D(475 - 54, 308), new Vec2D(515 - 54, 308)];
export const chosenChar = [0, 0, 0, 0];
export const tokenGrabbed = [false, false, false, false];
export const whichTokenGrabbed = [-1, -1, -1, -1];
export const occupiedToken = [false, false, false, false];
export const bHold = [0, 0, 0, 0];

export const cpuSlider = [new Vec2D(152 + 15 + 166 + 0 - 50, 595), new Vec2D(152 + 15 + 166 + 225 - 50, 595), new Vec2D(152 + 15 + 166 + 450 - 50, 595), new Vec2D(152 + 15 + 166 + 675 - 50, 595)];

export const cpuGrabbed = [false, false, false, false];
export const whichCpuGrabbed = [-1, -1, -1, -1];
export const occupiedCpu = [false, false, false, false];

export let readyToFight = false;

function getCSSPanelCount() {
  return battleRoyalePending ? 1 : 4;
}

// Offset to center panels when fewer than 4
function getCSSPanelOffset() {
  if (!battleRoyalePending) return 0;
  // Normal: panel 0 starts at x=145. Center of 4 panels = x=600-105=495
  // Single panel center: (1200 - 210) / 2 = 495. So offset = 495 - 145 = 350
  return 350;
}

export let rtfFlash = 25;
export let rtfFlashD = 1;
const gameSettingsText = {
  turbo: "Turbo Mode",
  lCancelType: "L-Cancel Type", // 0- normal | 1 - Auto | 2 - smash 64
  blastzoneWrapping: "",
  flashOnLCancel: "Flash on L-Cancel",
  dustLessPerfectWavedash: "",
  phantomThreshold: "",
  everyCharWallJump: "Everyone Walljumps", //0 - off | 1 - on
  tapJumpOffp1: "Player 1 tap-jump",
  tapJumpOffp2: "Player 2 tap-jump",
  tapJumpOffp3: "Player 3 tap-jump",
  tapJumpOffp4: "Player 4 tap-jump",
};

const gameSettingsValueTranslation = {
  turbo: (value) => {
    return (value === 0) ? "OFF" : "ON";
  },
  lCancelType: (value) => {
    return (value === 0) ? "NORMAL" : (value === 1) ? "AUTO" : "SMASH 64";
  }, // 0- normal | 1 - Auto | 2 - smash 64
  blastzoneWrapping: "",
  flashOnLCancel: (value) => {
    return (value === 0) ? "OFF" : "ON";
  },
  dustLessPerfectWavedash: "",
  phantomThreshold: "",
  everyCharWallJump: (value) => {
    return (value === 0) ? "OFF" : "ON";
  }, //0 - off | 1 - on
  tapJumpOffp1: (value) => {
    return (value === 0) ? "OFF" : "ON";
  },
  tapJumpOffp2: (value) => {
    return (value === 0) ? "OFF" : "ON";
  },
  tapJumpOffp3: (value) => {
    return (value === 0) ? "OFF" : "ON";
  },
  tapJumpOffp4: (value) => {
    return (value === 0) ? "OFF" : "ON";
  },
};
//in order


const charIconPos = [
  //marth
  new Vec2D(475, 268),
  //puff
  new Vec2D(568, 268),
  //fox
  new Vec2D(663, 268),
  //falco
  new Vec2D(733, 268),
  //falcon
  new Vec2D(803, 268)
  ];

export function setChosenChar(index, charSelected) {
  setCS(index, charSelected);
  chosenChar[index] = charSelected;
  tokenGrabbed[index] = false;
  occupiedToken[index] = false;
  setTokenPosSnapToChar(index, charSelected);
  player[index].actionState = "WAIT";
  player[index].timer = 0;
  player[index].charAttributes = chars[characterSelections[index]].attributes;
  player[index].charHitboxes = chars[characterSelections[index]].hitboxes;
  whichTokenGrabbed[index] = -1;
}

export function setTokenPosSnapToChar(index) {
  tokenPos[index] = charIconPos[index];
}

export function setTokenPosValue(index, val) {
  if (typeof(val) === 'undefined') {
    debugger;
  }
  tokenPos[index] = val;
}

export function changeCharacter(i, c) {
  setCS(i, c);
  syncCharacter(i, c);
  player[i].actionState = "WAIT";
  player[i].timer = 0;
  player[i].charAttributes = chars[characterSelections[i]].attributes;
  player[i].charHitboxes = chars[characterSelections[i]].hitboxes;
  // Send character selection to server in network mode
  if (networkMode && i === 0) {
    sendCharacterSelect(c);
  }
}

function cancelSetTag() {
  sounds.menuSelect.play();
  tagText[choosingTag] = $("#pTagEdit" + choosingTag).val();
  syncTagText(choosingTag, tagText[choosingTag]);
  $("#pTagEdit" + choosingTag).hide();
  choosingTag = -1;
}

export function cssControls(i, input) {
  let allowRegrab = true;
  let o = 54;
  if (choosingTag == -1) {
    if (input[i][0].b) {
      bHold[i]++;
      if (bHold[i] == 30) {
        sounds.menuBack.play();
        changeGamemode(1);
      }
    } else {
      bHold[i] = 0;
    }
    handPos[i].x += input[i][0].lsX * 12;
    handPos[i].y += -input[i][0].lsY * 12;
    if (handPos[i].x > 1200) {
      handPos[i].x = 1200;
    } else if (handPos[i].x < 0) {
      handPos[i].x = 0;
    }
    if (handPos[i].y > 750) {
      handPos[i].y = 750;
    } else if (handPos[i].y < 0) {
      handPos[i].y = 0;
    }
    if (handPos[i].y < 400 && handPos[i].y > 160) {
      handType[i] = 1;
      if (input[i][0].b && !input[i][1].b && playerType[i] == 0 && whichTokenGrabbed[i] == -1) {
        handType[i] = 2;
        setTokenPosValue(i, new Vec2D(handPos[i].x, handPos[i].y));
        tokenGrabbed[i] = true;
        whichTokenGrabbed[i] = i;
        occupiedToken[i] = true;
      }
      if (tokenGrabbed[whichTokenGrabbed[i]]) {
        handType[i] = 2;
        setTokenPosValue(whichTokenGrabbed[i], new Vec2D(handPos[i].x, handPos[i].y));
        if (handPos[i].y > 240 && handPos[i].y < 335) {
          // - 43
          if (handPos[i].x > 452 - o && handPos[i].x < 547 - o) {
            if (chosenChar[whichTokenGrabbed[i]] != 0) {
              chosenChar[whichTokenGrabbed[i]] = 0;
              changeCharacter(whichTokenGrabbed[i], 0);
              sounds.menuSelect.play();
            }
            if (input[i][0].a && !input[i][1].a) {
              tokenGrabbed[whichTokenGrabbed[i]] = false;
              occupiedToken[whichTokenGrabbed[i]] = false;
              setTokenPosValue(whichTokenGrabbed[i], new Vec2D(473 - o + (whichTokenGrabbed[i] % 2) * 40, 268 + (
                  whichTokenGrabbed[i] > 1 ? 40 : 0)));
              whichTokenGrabbed[i] = -1;
              sounds.marth.play();
            }
          } else if (handPos[i].x > 547 - o && handPos[i].x < 642 - o) {
            if (chosenChar[whichTokenGrabbed[i]] != 1) {
              chosenChar[whichTokenGrabbed[i]] = 1;
              changeCharacter(whichTokenGrabbed[i], 1);
              sounds.menuSelect.play();
            }
            if (input[i][0].a && !input[i][1].a) {

              tokenGrabbed[whichTokenGrabbed[i]] = false;
              occupiedToken[whichTokenGrabbed[i]] = false;
              setTokenPosValue(whichTokenGrabbed[i], new Vec2D(568 - o + (whichTokenGrabbed[i] % 2) * 40, 268 + (
                  whichTokenGrabbed[i] > 1 ? 40 : 0)));
              whichTokenGrabbed[i] = -1;
              sounds.jigglypuff.play();
            }
          } else if (handPos[i].x > 642 - o && handPos[i].x < 737 - o) {
            if (chosenChar[whichTokenGrabbed[i]] != 2) {
              chosenChar[whichTokenGrabbed[i]] = 2;
              changeCharacter(whichTokenGrabbed[i], 2);
              sounds.menuSelect.play();
            }
            if (input[i][0].a && !input[i][1].a) {

              tokenGrabbed[whichTokenGrabbed[i]] = false;
              occupiedToken[whichTokenGrabbed[i]] = false;
              setTokenPosValue(whichTokenGrabbed[i], new Vec2D(663 - o + (whichTokenGrabbed[i] % 2) * 40, 268 + (
                  whichTokenGrabbed[i] > 1 ? 40 : 0)));
              whichTokenGrabbed[i] = -1;
              sounds.fox.play();
            }
          } else if (handPos[i].x > 737 - o && handPos[i].x < 832 - o) {
            if (chosenChar[whichTokenGrabbed[i]] != 3) {
              chosenChar[whichTokenGrabbed[i]] = 3;
              changeCharacter(whichTokenGrabbed[i], 3);
              sounds.menuSelect.play();
            }
            if (input[i][0].a && !input[i][1].a) {

              tokenGrabbed[whichTokenGrabbed[i]] = false;
              occupiedToken[whichTokenGrabbed[i]] = false;
              setTokenPosValue(whichTokenGrabbed[i], new Vec2D(758 - o + (whichTokenGrabbed[i] % 2) * 40, 268 + (
                  whichTokenGrabbed[i] > 1 ? 40 : 0)));
              whichTokenGrabbed[i] = -1;
              sounds.falco.play();
            }
          } else if (handPos[i].x > 832 - o && handPos[i].x < 927 - o) {
            if (chosenChar[whichTokenGrabbed[i]] != 4) {
              chosenChar[whichTokenGrabbed[i]] = 4;
              changeCharacter(whichTokenGrabbed[i], 4);
              sounds.menuSelect.play();
            }
            if (input[i][0].a && !input[i][1].a) {

              tokenGrabbed[whichTokenGrabbed[i]] = false;
              occupiedToken[whichTokenGrabbed[i]] = false;
              setTokenPosValue(whichTokenGrabbed[i], new Vec2D(853 - o + (whichTokenGrabbed[i] % 2) * 40, 268 + (
                  whichTokenGrabbed[i] > 1 ? 40 : 0)));
              whichTokenGrabbed[i] = -1;
              sounds.falcon.play();
            }
          }
        }
      } else {
        for (var j = 0; j < 4; j++) {
          //console.log(j+" "+occupiedToken[j]);
          if (!occupiedToken[j] && (playerType[j] == 1 || i == j)) {
            if (handPos[i].y > tokenPos[j].y - 20 && handPos[i].y < tokenPos[j].y + 20 && handPos[i].x > tokenPos[j].x -
                20 && handPos[i].x < tokenPos[j].x + 20) {
              if (input[i][0].a && !input[i][1].a) {
                handType[i] = 2;
                whichTokenGrabbed[i] = j;
                setTokenPosValue(whichTokenGrabbed[i], new Vec2D(handPos[i].x, handPos[i].y));
                tokenGrabbed[whichTokenGrabbed[i]] = true;
                occupiedToken[whichTokenGrabbed[i]] = true;
                break;
              }
            }
          }
        }

      }
    } else if (cpuGrabbed[i]) {
      handPos[i].y = cpuSlider[whichCpuGrabbed[i]].y + 15;
      if (handPos[i].x < 152 + 15 + whichCpuGrabbed[i] * 225) {
        handPos[i].x = 152 + 15 + whichCpuGrabbed[i] * 225;
      }
      if (handPos[i].x > 152 + 15 + 166 + whichCpuGrabbed[i] * 225) {
        handPos[i].x = 152 + 15 + 166 + whichCpuGrabbed[i] * 225;
      }
      cpuSlider[whichCpuGrabbed[i]].x = handPos[i].x;
      cpuDifficulty[whichCpuGrabbed[i]] = Math.round((cpuSlider[whichCpuGrabbed[i]].x - whichCpuGrabbed[i] * 225 -
          152 - 15) * 3 / 166) + 1;
      player[whichCpuGrabbed[i]].difficulty = cpuDifficulty[whichCpuGrabbed[i]];
      if (input[i][0].a && !input[i][1].a) {
        cpuGrabbed[i] = false;
        occupiedCpu[whichCpuGrabbed[i]] = false;
        whichCpuGrabbed[i] = -1;
        handType[i] = 0;
        allowRegrab = false;
      }
    } else {
      handType[i] = 0;

        setTokenPosValue(whichTokenGrabbed[i], new Vec2D(518 + (whichTokenGrabbed[i] % 2) * 40 + chosenChar[whichTokenGrabbed[
            i]] * 93, 268 + (whichTokenGrabbed[i] > 1 ? 40 : 0)));

      //tokenPos[i] = new Vec2D(518+(i%2)*40,268+(i>1?40:0));
      //tokenGrabbed[i] = false;
      if (whichTokenGrabbed[i] > -1 && tokenGrabbed[whichTokenGrabbed[i]] == true) {
        tokenGrabbed[whichTokenGrabbed[i]] = false;
        occupiedToken[whichTokenGrabbed[i]] = false;
      }
      whichTokenGrabbed[i] = -1;
      for (var j = 0; j < 4; j++) {
        if (handPos[i].y > 430 && handPos[i].y < 485 && handPos[i].x > 109 + j * 225 && handPos[i].x < 207 + j * 225) {
          if (input[i][0].a && !input[i][1].a) {
            sounds.menuSelect.play();
            togglePort(j);
            hasTag[j] = false;
          }
        }
      }
    }
    if (handPos[i].y < 160 && handPos[i].x > 920) {
      if (input[i][0].a && !input[i][1].a) {
        sounds.menuBack.play();
        changeGamemode(1);
      }
    }

    let tok;
    if (input[i][0].x && !input[i][1].x) {
      sounds.menuSelect.play();
      if (whichTokenGrabbed[i] != -1) {
        tok = whichTokenGrabbed[i];
      } else {
        tok = i;
      }
      pPal[tok]++;
      if (pPal[tok] > 6) {
        pPal[tok] = 0;
      }
    }
    if (input[i][0].y && !input[i][1].y) {
      sounds.menuSelect.play();
      if (whichTokenGrabbed[i] != -1) {
        tok = whichTokenGrabbed[i];
      } else {
        tok = i;
      }
      pPal[tok]--;
      if (pPal[tok] < 0) {
        pPal[tok] = 6;
      }
    }
    if (handPos[i].y > 100 && handPos[i].y < 160 && handPos[i].x > 380 && handPos[i].x < 910) {
      if (input[i][0].a && !input[i][1].a) {
        sounds.menuSelect.play();
        setVersusMode(1 - versusMode);
      }
    }
    if (!cpuGrabbed[i]) {
      for (var s = 0; s < 4; s++) {
        if (playerType[s] == 1) {
          if (!occupiedCpu[s]) {
            if (handPos[i].y >= cpuSlider[s].y - 25 && handPos[i].y <= cpuSlider[s].y + 25 && handPos[i].x >=
                cpuSlider[s].x - 25 && handPos[i].x <= cpuSlider[s].x + 25) {
              if (input[i][0].a && !input[i][1].a && allowRegrab) {
                cpuGrabbed[i] = true;
                whichCpuGrabbed[i] = s;
                occupiedCpu[s] = true;
                handType[i] = 2;
                break;
              }
            }
          }
        }
      }
    }

    if (handPos[i].y > 640 && handPos[i].y < 680 && handPos[i].x > 130 + i * 225 && handPos[i].x < 310 + i * 225) {
      if (gameMode !== 2) {
        cancelSetTag();
      }
      if (input[i][0].a && !input[i][1].a) {
        // do tag
        if (handPos[i].x < 154 + i * 225) {
          // random
          sounds.menuSelect.play();
          hasTag[i] = true;
          tagText[i] = randomTags[Math.round((randomTags.length - 1) * Math.random())];
          syncTagText(i, tagText[i]);
        } else if (handPos[i].x > 286 + i * 225) {
          // remove
          sounds.menuSelect.play();
          hasTag[i] = false;
        } else {
          // set
          sounds.menuSelect.play();
          hasTag[i] = true;
          choosingTag = i;
          ui.fillStyle = "rgba(0,0,0,0.8)";
          ui.fillRect(0, 0, layers.UI.width, layers.UI.height);
          $("#pTagEdit" + i).show().select();

        }
      }
    }
  } else if (choosingTag == i && ((input[i][0].a && !input[i][1].a) || keys[13])) {
    cancelSetTag();
  }
  if (readyToFight && choosingTag == -1) {
    if (pause[i][0] && !pause[i][1]) {
      sounds.menuForward.play();
      if (battleRoyalePending && networkMode) {
        // Network mode: send char selection, server auto-starts
        sendCharacterSelect(characterSelections[0]);
        // Game will start when server sends GAME_START callback
      } else if (battleRoyalePending) {
        setStageSelect(6);
        startGame();
      } else {
        changeGamemode(6);
        syncGameMode(6);
      }
    }
  } else if (choosingTag == -1 && input[i][0].du && !input[i][1].du) {
    sounds.menuForward.play();
    if (battleRoyalePending && networkMode) {
      sendCharacterSelect(characterSelections[0]);
    } else if (battleRoyalePending) {
      setStageSelect(6);
      startGame();
    } else {
      changeGamemode(6);
      syncGameMode(6);
    }
  } else if (choosingTag == -1 && input[i][0].dr && !input[i][1].dr) {
    chosenChar[i] = 3;
    changeCharacter(i, 3);
    sounds.menuSelect.play();
  }
}

export function drawCSSInit() {
  var bgGrad = bg1.createLinearGradient(0, 0, 1200, 700);
  bgGrad.addColorStop(0, "rgb(17, 12, 56)");
  bgGrad.addColorStop(1, "black");
  bg1.fillStyle = bgGrad;
  bg1.fillRect(0, 0, layers.BG1.width, layers.BG1.height);
  bg1.fillStyle = "rgb(85, 96, 107)";
  bg1.strokeStyle = "rgb(144, 152, 161)";
  if (!battleRoyalePending) {
    bg1.save();
    bg1.lineWidth = 2;
    bg1.strokeStyle = "rgb(120, 127, 161)";
    bg1.beginPath();
    bg1.moveTo(-10, 200);
    bg1.lineTo(290, 200);
    bg1.arc(290, 225, 25, Math.PI * 1.5, Math.PI * 0.5);
    bg1.lineTo(-10, 250);
    bg1.closePath();
    bg1.stroke();
    bg1.fillStyle = "rgb(29, 144, 61)";
    bg1.beginPath();
    bg1.arc(145, 225, 20, 0, twoPi);
    bg1.closePath();
    bg1.fill();
    bg1.font = "900 31px Arial";
    bg1.fillStyle = "rgb(120, 127, 161)";
    bg1.fillText("Push     to join", 37, 235);
    bg1.fillStyle = "rgb(17, 71, 32)";
    bg1.fillText("A", 133, 235);
    bg1.restore();
  }
  bg1.save();
  bg1.lineWidth = 3;
  bg1.translate(layers.BG1.width / 2, layers.BG1.height / 2 + 20);
  for (var i = 0; i < 2; i++) {
    bg1.rotate(i * Math.PI);
    bg1.beginPath();
    bg1.moveTo(-10 - layers.BG1.width / 2, -250);
    bg1.lineTo(-300, -250);
    bg1.bezierCurveTo(-240, -250, -240, -330, -180, -330);
    bg1.lineTo(10 + layers.BG1.width / 2, -330);
    bg1.lineTo(10 + layers.BG1.width / 2, -30 - layers.BG1.height / 2);
    bg1.lineTo(-10 - layers.BG1.width / 2, -30 - layers.BG1.height / 2);
    bg1.closePath();
    bg1.fill();
    bg1.stroke();
  }
  bg1.restore();
  bg1.lineWidth = 3;
  bg1.beginPath();
  bg1.moveTo(410, 80);
  bg1.lineTo(950, 80);
  bg1.lineTo(955, 105);
  bg1.lineTo(946, 130);
  bg1.lineTo(406, 130);
  bg1.lineTo(400, 105);
  bg1.closePath();
  bg1.stroke();
  bg1.lineWidth = 5;
  bg1.beginPath();
  bg1.moveTo(412, 81);
  bg1.lineTo(422, 81);
  bg1.lineTo(412, 105);
  bg1.lineTo(418, 129);
  bg1.lineTo(408, 129);
  bg1.lineTo(402, 105);
  bg1.closePath();
  bg1.fill();
  bg1.stroke();
  bg1.beginPath();
  bg1.moveTo(938, 81);
  bg1.lineTo(948, 81);
  bg1.lineTo(953, 105);
  bg1.lineTo(944, 129);
  bg1.lineTo(934, 129);
  bg1.lineTo(943, 105);
  bg1.closePath();
  bg1.fill();
  bg1.stroke();
  bg1.lineWidth = 3;
  bg1.fillStyle = "black";
  bg1.font = "italic 900 50px Arial";
  bg1.save();
  bg1.scale(1, 1.9);
  bg1.fillText("MELEE", 50, 65);
  bg1.restore();
  bg1.beginPath();
  bg1.arc(305, 85, 30, 0, twoPi);
  bg1.closePath();
  bg1.fill();
  bg1.stroke();
  bg1.fillStyle = "rgb(144, 152, 161)";
  bg1.font = "700 32px Arial";
  bg1.fillText("VS", 284, 98);
  bg1.fillStyle = "rgb(219, 219, 219)";
  bg1.fillStyle = "rgba(0,0,0,0.65)";
  bg1.beginPath();
  bg1.moveTo(1100, 0);
  bg1.lineTo(1000, 110);
  bg1.lineTo(1020, 125);
  bg1.lineTo(1200, 125);
  bg1.lineTo(1200, 0);
  bg1.closePath();
  bg1.fill();
  bg1.fillStyle = "rgb(255, 222, 0)";
  bg1.beginPath();
  bg1.moveTo(1100, 0);
  bg1.lineTo(1000, 110);
  bg1.lineTo(1020, 125);
  bg1.lineTo(1200, 125);
  bg1.lineTo(1200, 119);
  bg1.lineTo(1015, 119);
  bg1.lineTo(1002, 110);
  bg1.lineTo(1102, 0);
  bg1.closePath();
  bg1.fill();
  bg1.font = "700 27px Arial";
  bg1.fillText("BACK", 1035, 112);
  bg1.fillStyle = "rgb(194, 24, 8)";
  bg1.beginPath();
  bg1.moveTo(1025, 75);
  bg1.lineTo(992, 110);
  bg1.lineTo(1010, 125);
  bg1.lineTo(972, 110);
  bg1.closePath();
  bg1.fill();
  var bgGrad = bg1.createLinearGradient(0, 250, 0, 350);
  bgGrad.addColorStop(0, "rgb(41, 47, 68)");
  bgGrad.addColorStop(1, "rgb(85, 95, 128)");
  bg1.lineWidth = 2;
  let o = 54;
  for (var j = 0; j < 5; j++) {
    bg1.fillStyle = bgGrad;
    bg1.beginPath();
    bg1.moveTo(457 - o + j * 95, 265);
    bg1.bezierCurveTo(457 - o + j * 95, 245, 457 - o + j * 95, 245, 477 - o + j * 95, 245);
    bg1.lineTo(522 - o + j * 95, 245);
    bg1.bezierCurveTo(542 - o + j * 95, 245, 542 - o + j * 95, 245, 542 - o + j * 95, 265);
    bg1.lineTo(542 - o + j * 95, 310);
    bg1.bezierCurveTo(542 - o + j * 95, 330, 542 - o + j * 95, 330, 522 - o + j * 95, 330);
    bg1.lineTo(477 - o + j * 95, 330);
    bg1.bezierCurveTo(457 - o + j * 95, 330, 457 - o + j * 95, 330, 457 - o + j * 95, 310);
    bg1.closePath();
    bg1.fill();
    bg1.stroke();
    switch (j) {
      case 0:
        var add = 0;
        break;
      case 1:
        var add = 7;
        break;
      case 2:
        var add = 0;
        break;
      default:
        var add = 0;
        break;
    }
    bg1.fillStyle = "black";
    bg1.beginPath();
    bg1.moveTo(540 - o + j * 95, 305 - add);
    bg1.lineTo(540 - o + j * 95, 310 - add);
    bg1.bezierCurveTo(540 - o + j * 95, 328, 540 - o + j * 95, 328, 522 - o + j * 95, 328);
    bg1.lineTo(487 - o + j * 95, 328);
    bg1.bezierCurveTo(459 - o + j * 95, 328, 459 - o + j * 95, 328, 459 - o + j * 95, 310 - add);
    bg1.lineTo(459 - o + j * 95, 305 - add);
    bg1.closePath();
    bg1.fill();
    bg1.fillStyle = "rgb(180, 180, 180)";
    bg1.font = "700 18px Arial";
    switch (j) {
      case 0:
        bg1.fillText("MARTH", 467 - o + j * 95, 323);
        bg1.drawImage(marthPic, 459 - o + j * 95, 247, 81, 58);
        break;
      case 1:
        bg1.fillText("JIGGLY-", 464 - o + j * 95, 313);
        bg1.fillText("PUFF", 477 - o + j * 95, 326);
        bg1.drawImage(puffPic, 459 - o + j * 95, 247, 81, 51);
        break;
      case 2:
        bg1.fillText("  F O X ", 467 - o + j * 95, 323);
        bg1.drawImage(foxPic, 459 - o + j * 95, 247, 81, 58);
        break;
      case 3:
        bg1.fillText("FALCO", 470 - o + j * 95, 323);
        bg1.drawImage(falcoPic, 459 - o + j * 95, 247, 81, 58);
        break;
      case 4:
        bg1.font = "700 15px Arial";
        bg1.fillText("C.FALCON", 462 - o + j * 95, 323);
        bg1.drawImage(falconPic, 459 - o + j * 95, 247, 81, 58);
        bg1.font = "700 18px Arial";
        break;
      default:
        break;
    }
  }
  var panelCount = getCSSPanelCount();
  var po = getCSSPanelOffset();
  bg1.fillStyle = "rgb(49, 52, 56)";
  for (var i = 0; i < panelCount; i++) {
    bg1.fillRect(145 + po + i * 225, 430, 210, 280);
    bg1.strokeRect(145 + po + i * 225, 430, 210, 280);
  }
  bg1.fillStyle = "rgb(55, 58, 62)";
  bg1.strokeStyle = "rgb(72, 77, 85)";
  for (var i = 0; i < panelCount; i++) {
    bg1.fillRect(158 + po + i * 225, 440, 184, 260);
    bg1.strokeRect(158 + po + i * 225, 440, 184, 260);
  }
  bg1.fillStyle = "rgba(255,255,255,0.1)";
  for (var i = 0; i < panelCount; i++) {
    bg1.fillRect(158 + po + i * 225, 630, 184, 50);
  }
  bg1.strokeStyle = "rgba(0,0,0,0.2)";
  bg1.fillStyle = "rgba(0,0,0,0.2)";
  bg1.lineWidth = 15;
  for (var i = 0; i < panelCount; i++) {
    bg1.beginPath();
    bg1.moveTo(150 + po + i * 225, 435);
    bg1.lineTo(350 + po + i * 225, 705);
    bg1.closePath();
    bg1.stroke();
    bg1.beginPath();
    bg1.arc(250 + po + i * 225, 570, 60, 0, twoPi);
    bg1.closePath();
    bg1.stroke();
    bg1.beginPath();
    bg1.moveTo(150 + po + i * 225, 570);
    bg1.lineTo(350 + po + i * 225, 570);
    bg1.closePath();
    bg1.stroke();
  }
  bg1.lineWidth = 3;
  for (var i = 0; i < panelCount; i++) {
    for (var j = 0; j < 7; j++) {
      bg1.beginPath();
      bg1.arc(165 + po + i * 225 + j * 30, 450, 11, 0, twoPi);
      bg1.closePath();
      bg1.fill();
      bg1.beginPath();
      bg1.arc(165 + po + i * 225 + j * 30, 690, 10, 0, twoPi);
      bg1.closePath();
      bg1.stroke();
      if (j == 3) {
        bg1.fill();
      }
    }
  }
}

export function drawCSS() {
  clearScreen();
  ui.fillStyle = "rgb(219, 219, 219)";
  ui.save();
  ui.scale(1.25, 1);
  if (battleRoyalePending && networkMode) {
    var connStatus = isConnected() ? getRoomPlayerCount() + " players" : "Connecting...";
    var cdText = lobbyCountdown > 0 ? " - Starting in " + lobbyCountdown + "s" : "";
    ui.fillText("Online BR! " + connStatus + cdText, 350, 117);
  } else if (battleRoyalePending) {
    ui.fillText("100-Man Battle Royale!", 380, 117);
  } else if (versusMode) {
    ui.fillText("An endless KO fest!", 393, 117);
  } else {
    ui.fillText("4-man survival test!", 390, 117);
  }
  var bestHold = 0;
  bg1.lineWidth = 3;
  bg1.fillStyle = "rgb(255, 222, 0)";
  bg1.beginPath();
  bg1.moveTo(1100, 0);
  bg1.lineTo(1000, 110);
  bg1.lineTo(1020, 125);
  bg1.lineTo(1200, 125);
  bg1.lineTo(1200, 119);
  bg1.lineTo(1015, 119);
  bg1.lineTo(1002, 110);
  bg1.lineTo(1102, 0);
  bg1.closePath();
  bg1.fill();
  for (let ia = 0; ia < 4; ia++) {
    if (bHold[ia] > bestHold) {
      bestHold = bHold[ia];
    }
  }
  if (bestHold > 0) {
    var abb = 1020 + (bestHold * 6);
    bg1.fillStyle = "rgb(194, 24, 8)";
    bg1.beginPath();
    bg1.moveTo(1020, 125);
    bg1.lineTo(abb, 125);
    bg1.lineTo(abb, 119);
    bg1.lineTo(1015, 119);
    bg1.closePath();
    bg1.fill();
  }
  ui.restore();
  var dPanels = getCSSPanelCount();
  var dpo = getCSSPanelOffset();
  for (var i = 0; i < dPanels; i++) {
    if (playerType[i] > -1) {
      if (playerType[i] == 0 || playerType[i] == 2) {
        switch (i) {
          case 0:
            ui.fillStyle = "rgb(218, 51, 51)";
            break;
          case 1:
            ui.fillStyle = "rgb(51, 53, 218)";
            break;
          case 2:
            ui.fillStyle = "rgb(226, 218, 34)";
            break;
          case 3:
            ui.fillStyle = "rgb(44, 217, 29)";
            break;
          default:
            break;
        }
      } else {
        ui.fillStyle = "rgb(91, 91, 91)";
      }
      var px = dpo + i * 225;
      ui.fillRect(147 + px, 432, 206, 276);
      ui.fillStyle = "rgba(0,0,0,0.5)";
      ui.beginPath();
      ui.moveTo(152 + px, 465);
      ui.lineTo(210 + px, 465);
      ui.lineTo(230 + px, 450);
      ui.lineTo(318 + px, 450);
      ui.bezierCurveTo(338 + px, 450, 338 + px, 450, 338 + px, 470)
      ui.lineTo(338 + px, 708);
      ui.lineTo(152 + px, 708);
      ui.closePath();
      ui.fill();
      ui.save();
      ui.fillStyle = "rgba(0, 0, 0, 0.3)";
      ui.translate(250 + px, 615);
      ui.scale(1, 0.3);
      ui.beginPath();
      ui.arc(0, 0, 50, 0, twoPi);
      ui.closePath();
      ui.fill();
      ui.restore();
      ui.fillStyle = "black";
      ui.strokeStyle = "rgb(102, 102, 102)";
      ui.fillRect(152 + px, 640, 196, 60);
      ui.strokeRect(152 + px, 640, 196, 60);
      ui.save();
      ui.fillStyle = "rgb(84, 84, 84)";
      ui.font = "italic 900 45px Arial";
      ui.scale(14 / 8, 1);
      var text = "P" + (i + 1);
      if (playerType[i] == 1) {
        text = "CP";
      }
      ui.fillText(text, 87 + px / (14 / 8), 690)
      ui.restore();

      ui.textAlign = "start";
    }
  }
  ui.fillStyle = "rgb(82, 81, 81)";
  for (var i = 0; i < dPanels; i++) {
    var px2 = dpo + i * 225;
    ui.fillStyle = "rgb(82, 81, 81)";
    switch (playerType[i]) {
      case 0:
        ui.fillStyle = "rgb(201, 178, 20)";
        break;
      case 1:
        ui.fillStyle = "rgb(161, 161, 161)";
        break;
      default:
        ui.fillStyle = "rgb(82, 81, 81)";
        break;
    }
    ui.beginPath();
    ui.moveTo(139 + px2, 420);
    ui.lineTo(220 + px2, 420);
    ui.lineTo(237 + px2, 432);
    ui.lineTo(215 + px2, 455);
    ui.lineTo(142 + px2, 455);
    ui.lineTo(139 + px2, 452);
    ui.closePath();
    ui.fill();
  }
  ui.fillStyle = "rgba(0, 0, 0,0.7)";
  ui.strokeStyle = "rgba(0, 0, 0,0.7)";
  ui.lineWidth = 4;
  for (var i = 0; i < dPanels; i++) {
    var px3 = dpo + i * 225;
    ui.beginPath();
    ui.moveTo(160 + px3, 424);
    ui.lineTo(215 + px3, 424);
    ui.lineTo(228 + px3, 432);
    ui.lineTo(210 + px3, 451);
    ui.lineTo(160 + px3, 451);
    ui.closePath();
    ui.fill();
    ui.beginPath();
    ui.moveTo(139 + px3, 420);
    ui.lineTo(151 + px3, 424);
    ui.lineTo(151 + px3, 451);
    ui.lineTo(140 + px3, 451);
    ui.stroke();
  }
  ui.fillStyle = "rgb(82, 81, 81)";
  ui.font = "700 22px Arial";
  for (var i = 0; i < dPanels; i++) {
    ui.fillStyle = "rgb(82, 81, 81)";
    var text = "N/A";
    switch (playerType[i]) {
      case 0:
        text = "HMN";
        ui.fillStyle = "rgb(201, 178, 20)";
        break;
      case 1:
        text = "CPU";
        ui.fillStyle = "rgb(161, 161, 161)";
        break;
      case 2:
        text = "NET";
        ui.fillStyle = "rgb(66, 241, 244)";
        break;
      default:
        break;
    }

    ui.fillText(text, 163 + dpo + i * 225, 445);
  }
  for (var i = 0; i < dPanels; i++) {
    if (playerType[i] > -1) {
      var frame = Math.floor(player[i].timer);
      if (frame == 0) {
        frame = 1;
      }
      var face = player[i].phys.face;

      var model = animations[characterSelections[i]][actionStates[characterSelections[i]][player[i].actionState].name][frame - 1];

      switch (player[i].actionState) {
        case 15:
        case 17:
        case 20:
        case 25:
        case 61:
        case 72:
        case 94:
          var model = animations[characterSelections[i]][actionStates[characterSelections[i]][player[i].actionState].name][0];
          break;
        default:
          break;
      }
      if (actionStates[characterSelections[i]][player[i].actionState].reverseModel) {
        face *= -1;
      } else if (player[i].actionState == 4) {
        if (frame > 5) {
          face *= -1;
        }
      } else if (player[i].actionState == 6) {
        if (frame > 18) {
          face *= -1;
        }
      } else if (player[i].actionState == 34) {
        if (frame > 29) {
          face *= -1;
        }
      }

      var col = palettes[pPal[i]][0];
      if (tokenGrabbed[i]) {
        ui.globalAlpha = 0.6;
      } else {
        ui.globalAlpha = 1;
      }
      drawArrayPathCompress(ui, col, face, (player[i].phys.pos.x * 4.5 * 1.5) + 600, (player[i].phys.pos.y * -4.5) +
          480, model, player[i].charAttributes.charScale * 1.5, player[i].charAttributes.charScale * 1.5, 0, 0, 0);
      if (player[i].phys.shielding) {
        var sCol = palettes[pPal[i]][2];
        ui.fillStyle = sCol + (0.6 * player[i].phys.shieldAnalog) + ")";
        ui.beginPath();
        ui.arc((player[i].phys.shieldPositionReal.x * 4.5 * 1.5) + 600, (player[i].phys.shieldPositionReal.y * -4.5) +
            460, player[i].phys.shieldSize * 4.5 * 1.5, twoPi, 0);
        ui.fill();
      }
      ui.globalAlpha = 1;
      var px4 = dpo + i * 225;
      if (playerType[i] == 1) {
        ui.fillStyle = "rgba(0,0,0,0.5)";
        ui.strokeStyle = "rgb(102, 102, 102)";
        ui.fillRect(152 + px4, 555, 196, 85);
        ui.strokeRect(152 + px4, 555, 196, 85);
        ui.fillStyle = "rgb(177, 177, 177)";
        ui.save();
        ui.font = "900 18px Arial";
        ui.scale(1.2, 1);
        ui.fillText("CPU Level", (152 + 10 + px4) / 1.2, 575);
        ui.restore();
        var sliderGrad = ui.createLinearGradient(152 + 10 + px4, 0, 152 + 196 - 20 + px4, 0);
        sliderGrad.addColorStop(0, "rgb(0, 47, 168)");
        sliderGrad.addColorStop(0.5, "rgb(168, 162, 0)");
        sliderGrad.addColorStop(1, "rgb(168, 0, 0)");
        ui.fillStyle = sliderGrad;
        ui.fillRect(152 + 15 + px4, 592, 166, 5);
        ui.fillStyle = "black";
        ui.fillRect(152 + 18 + px4, 594, 160, 1);
        ui.fillStyle = "rgb(214, 35, 35)";
        ui.beginPath();
        ui.arc(cpuSlider[i].x + dpo, cpuSlider[i].y, 17, 0, twoPi);
        ui.closePath();
        ui.fill();
        ui.save();
        ui.fillStyle = "black";
        ui.strokeStyle = "white";
        ui.lineWidth = 2;
        ui.font = "900 30px Arial";
        ui.textAlign = "center";
        ui.strokeText(player[i].difficulty, cpuSlider[i].x + dpo, cpuSlider[i].y + 11);
        ui.fillText(player[i].difficulty, cpuSlider[i].x + dpo, cpuSlider[i].y + 11);
        ui.restore();
      }
      ui.fillStyle = "black";
      ui.strokeStyle = "rgb(102, 102, 102)";
      ui.fillRect(160 + px4, 620, 180, 40);
      ui.strokeRect(160 + px4, 620, 180, 40);
      ui.font = "900 24px Arial";
      if (playerType[i] == 0) {
        ui.fillStyle = "rgb(42, 42, 42)";
        ui.fillRect(162 + px4, 622, 22, 37);
        ui.fillRect(316 + px4, 622, 22, 37);
        ui.fillStyle = "rgb(83, 83, 83)";
        ui.fillText("?", 166 + px4, 648);
        ui.fillText("x", 319 + px4, 647);
      }
      ui.font = "500 28px Arial";
      ui.fillStyle = "white";
      switch (chosenChar[i]) {
        case 0:
          var text = "Marth";
          break;
        case 1:
          var text = "Jigglypuff";
          break;
        case 2:
          var text = "Fox";
          break;
        case 3:
          var text = "Falco";
          break;
        case 4:
          var text = "C.Falcon";
          break;
        default:
          var text = "Unknown";
          break;
      }
      if (hasTag[i]) {
        var text = tagText[i];
      }
      ui.textAlign = "center";
      ui.fillText(text, 250 + dpo + i * 225, 650);
      ui.textAlign = "start";
    }
  }
  ui.font = "900 31px Arial";
  ui.lineWidth = 2;
  let alreadyDrawn = [false, false, false, false];
  for (let i = 3; i >= 0; i--) {
    if (playerType[i] > -1) {
      if (tokenGrabbed[i] === false) {
        alreadyDrawn[i] = true;
      }
      var bgGrad = ui.createLinearGradient(tokenPos[i].x - 100, tokenPos[i].y, tokenPos[i].x + 50, tokenPos[i].y);
      bgGrad.addColorStop(0, "rgb(255, 255, 255)");
      var text = "";
      switch (playerType[i]) {
        case 0:
          text = "P" + (i + 1);
          switch (i) {
            case 0:
              bgGrad.addColorStop(1, "rgb(233, 57, 57)");
              break;
            case 1:
              bgGrad.addColorStop(1, "rgb(62, 130, 233)");
              break;
            case 2:
              bgGrad.addColorStop(1, "rgb(255, 253, 47)");
              break;
            case 3:
              bgGrad.addColorStop(1, "rgb(36, 242, 45)");
              break;
            default:
              break;
          }
          break;
        case 1:
          text = "CP";
          bgGrad.addColorStop(1, "rgb(135, 135, 135)");
        default:
          break;
      }
      ui.fillStyle = "rgba(0,0,0,0.4)";
      ui.beginPath();
      ui.arc(tokenPos[i].x, tokenPos[i].y, 34, 0, twoPi);
      ui.closePath();
      ui.fill();
      ui.fillStyle = bgGrad;
      ui.beginPath();
      ui.arc(tokenPos[i].x, tokenPos[i].y, 30, 0, twoPi);
      ui.closePath();
      ui.fill();
      ui.fillStyle = "rgba(0,0,0,0.4)";
      ui.beginPath(tokenPos[i].y);
      //ui.moveTo(tokenPos[i].x,tokenPos[i].y+4);
      ui.arc(tokenPos[i].x, tokenPos[i].y, 26, 1.2 * Math.PI, 0.4 * Math.PI);
      ui.arc(tokenPos[i].x - 3, tokenPos[i].y, 23, 0.5 * Math.PI, 1.2 * Math.PI, true);
      ui.closePath();
      ui.fill();
      ui.strokeStyle = "rgb(57, 57, 57)";
      ui.fillStyle = "rgb(207, 207, 207)";

      ui.fillText(text, tokenPos[i].x - 22, tokenPos[i].y + 13);
      ui.strokeText(text, tokenPos[i].x - 22, tokenPos[i].y + 13);
    }
  }
  for (let i = 3; i >= 0; i--) {
    if (alreadyDrawn[i] === false) {
      if (playerType[i] > -1) {
        var bgGrad = ui.createLinearGradient(tokenPos[i].x - 100, tokenPos[i].y, tokenPos[i].x + 50, tokenPos[i].y);
        bgGrad.addColorStop(0, "rgb(255, 255, 255)");
        var text = "";
        switch (playerType[i]) {
          case 0:
            text = "P" + (i + 1);
            switch (i) {
              case 0:
                bgGrad.addColorStop(1, "rgb(233, 57, 57)");
                break;
              case 1:
                bgGrad.addColorStop(1, "rgb(62, 130, 233)");
                break;
              case 2:
                bgGrad.addColorStop(1, "rgb(255, 253, 47)");
                break;
              case 3:
                bgGrad.addColorStop(1, "rgb(36, 242, 45)");
                break;
              default:
                break;
            }
            break;
          case 1:
            text = "CP";
            bgGrad.addColorStop(1, "rgb(135, 135, 135)");
          default:
            break;
        }
        ui.fillStyle = "rgba(0,0,0,0.4)";
        ui.beginPath();
        ui.arc(tokenPos[i].x, tokenPos[i].y, 34, 0, twoPi);
        ui.closePath();
        ui.fill();
        ui.fillStyle = bgGrad;
        ui.beginPath();
        ui.arc(tokenPos[i].x, tokenPos[i].y, 30, 0, twoPi);
        ui.closePath();
        ui.fill();
        ui.fillStyle = "rgba(0,0,0,0.4)";
        ui.beginPath(tokenPos[i].y);
        //ui.moveTo(tokenPos[i].x,tokenPos[i].y+4);
        ui.arc(tokenPos[i].x, tokenPos[i].y, 26, 1.2 * Math.PI, 0.4 * Math.PI);
        ui.arc(tokenPos[i].x - 3, tokenPos[i].y, 23, 0.5 * Math.PI, 1.2 * Math.PI, true);
        ui.closePath();
        ui.fill();
        ui.strokeStyle = "rgb(57, 57, 57)";
        ui.fillStyle = "rgb(207, 207, 207)";

        ui.fillText(text, tokenPos[i].x - 22, tokenPos[i].y + 13);
        ui.strokeText(text, tokenPos[i].x - 22, tokenPos[i].y + 13);
      }
    }
  }
  // 72 95
  for (var i = 0; i < Math.min(ports, dPanels); i++) {

    switch (handType[i]) {
      case 0:
        ui.drawImage(handPoint, handPos[i].x - 40, handPos[i].y - 30, 101, 133);
        break;
      case 1:
        ui.drawImage(handOpen, handPos[i].x - 40, handPos[i].y - 30, 101, 133);
        break;
      case 2:
        ui.drawImage(handGrab, handPos[i].x - 40, handPos[i].y - 30, 101, 133);
        break;
      default:
        break;
    }
    switch (i) {
      case 0:
        ui.fillStyle = "rgb(233, 57, 57)";
        break;
      case 1:
        ui.fillStyle = "rgb(62, 130, 233)";
        break;
      case 2:
        ui.fillStyle = "rgb(255, 253, 47)";
        break;
      case 3:
        ui.fillStyle = "rgb(36, 242, 45)";
        break;
      default:
        break;
    }
    ui.fillText("P" + (i + 1), handPos[i].x - 15, handPos[i].y + 60);
    ui.strokeText("P" + (i + 1), handPos[i].x - 15, handPos[i].y + 60);
  }
  var readyPlayers = 0;
  var minReady = battleRoyalePending ? 1 : 2;
  for (var k = 0; k < Math.min(ports, 4); k++) {
    if (playerType[k] > -1) {
      readyPlayers++;
      if (readyPlayers >= minReady) {
        readyToFight = true;
      } else {
        readyToFight = false;
      }
      if (occupiedToken[k]) {
        readyToFight = false;
        break;
      }
    }
  }

  if (inServerMode) {
    ui.fillStyle = "white";

    var keys = Object.keys(gameSettings);
    let spacer = 50;
    for (var j = 0; j < keys.length; j++) {
      if (gameSettingsText[keys[j]] !== "") {
        ui.fillText(gameSettingsText[keys[j]] + ":" + gameSettingsValueTranslation[keys[j]](gameSettings[keys[j]]), 820, 130 + spacer);
        spacer = spacer + 30;
      }
    }

  }

  if (readyToFight) {
    ui.save();
    ui.fillStyle = "rgba(223, 31, 31, 0.8)";
    ui.beginPath();
    ui.moveTo(50, 300);
    ui.bezierCurveTo(450, 270, 750, 270, 1150, 300);
    ui.bezierCurveTo(750, 280, 450, 280, 50, 300);
    ui.closePath();
    ui.fill();
    ui.beginPath();
    ui.moveTo(50, 370);
    ui.bezierCurveTo(450, 350, 750, 350, 1150, 370);
    //ui.bezierCurveTo(750,360,450,360,50,370);
    ui.bezierCurveTo(750, 360, 900, 365, 900, 365);
    ui.bezierCurveTo(850, 365, 830, 380, 800, 380);
    ui.lineTo(400, 380);
    ui.bezierCurveTo(370, 380, 350, 365, 300, 365);
    ui.bezierCurveTo(300, 360, 450, 370, 0, 370);
    ui.closePath();
    ui.fill();
    ui.fillStyle = "rgba(0,0,0,0.5)";
    ui.beginPath();
    ui.moveTo(50, 300);
    ui.bezierCurveTo(450, 280, 750, 280, 1150, 300);
    ui.arc(1150, 335, 35, Math.PI * 1.5, Math.PI * 0.5, true);
    //ui.lineTo(1150,370);
    ui.bezierCurveTo(750, 350, 450, 350, 50, 370);
    ui.arc(50, 335, 35, Math.PI * 0.5, Math.PI * 1.5, true);
    ui.closePath();
    ui.fill();
    ui.scale(1.4, 1);
    rtfFlash += 0.5 * rtfFlashD;
    if (rtfFlash < 25) {
      rtfFlashD = 1;
    }
    if (rtfFlash > 50) {
      rtfFlashD = -1;
    }
    ui.fillStyle = "hsl(52, 85%, " + rtfFlash + "%)";
    ui.font = "italic 600 65px Arial";
    ui.rotate(-0.03);
    ui.fillText("READY", 120, 353);
    ui.rotate(0.03);
    ui.fillText("TO", 390, 342);
    ui.rotate(0.03);
    ui.fillText("FIGHT", 520, 329);
    ui.rotate(-0.03);
    ui.fillStyle = "rgb(193, 193, 193)";
    ui.font = "900 15px Arial";
    ui.scale(2.3 / 1.4, 1);
    ui.fillText("PRESS START", 205, 373);
    ui.restore();
  }

  if (choosingTag > -1) {
    ui.fillStyle = "rgba(0,0,0,0.8)";
    ui.fillRect(0, 0, layers.UI.width, layers.UI.height);
    ui.fillStyle = "white";
    ui.textAlign = "center";
    //ui.fillText(text,250+i*225,650);
    ui.fillText("Type tag now", 250 + choosingTag * 225, 570);
    ui.fillText("Press A to finish", 250 + choosingTag * 225, 600);
    ui.textAlign = "start";
  }


}

// --- Battle Royale Character Select ---
// Must match CHARIDS order: 0=Marth, 1=Puff, 2=Fox, 3=Falco, 4=Falcon
var brCharNames = ["MARTH", "JIGGLYPUFF", "FOX", "FALCO", "C.FALCON"];
var brCharSelected = 0;
var brCharConfirmed = false;

export function brCSSInit() {
  brCharSelected = characterSelections[0] || 0;
  brCharConfirmed = false;
}

export function brCSSControls(i, input) {
  if (i !== 0) return;
  if (brCharConfirmed) return;

  // Left/right to cycle characters
  if (input[i][0].lsX > 0.7 && !(input[i][1].lsX > 0.7)) {
    brCharSelected++;
    if (brCharSelected >= brCharNames.length) brCharSelected = 0;
    sounds.menuSelect.play();
  } else if (input[i][0].lsX < -0.7 && !(input[i][1].lsX < -0.7)) {
    brCharSelected--;
    if (brCharSelected < 0) brCharSelected = brCharNames.length - 1;
    sounds.menuSelect.play();
  }

  characterSelections[0] = brCharSelected;

  // A to confirm and start
  if (input[i][0].a && !input[i][1].a) {
    brCharConfirmed = true;
    sounds.menuForward.play();
    characterSelections[0] = brCharSelected;
    // Skip stage select — go straight to game
    setStageSelect(6);
    startGame();
  }

  // B to go back
  if (input[i][0].b && !input[i][1].b) {
    sounds.menuBack.play();
    changeGamemode(1);
  }
}

// Character portrait images in CHARIDS order: Marth=0, Puff=1, Fox=2, Falco=3, Falcon=4
var brCharPics = [marthPic, puffPic, foxPic, falcoPic, falconPic];

export function drawBRCSS() {
  clearScreen();

  // Background
  bg1.fillStyle = "rgb(20, 20, 35)";
  bg1.fillRect(0, 0, 1200, 750);

  ui.save();
  ui.textAlign = "center";

  // Title
  ui.font = "900 60px Arial";
  ui.fillStyle = "rgb(255, 50, 50)";
  ui.strokeStyle = "black";
  ui.lineWidth = 4;
  ui.strokeText("100-MAN MELEE", 600, 80);
  ui.fillText("100-MAN MELEE", 600, 80);

  ui.font = "700 28px Arial";
  ui.fillStyle = "rgb(200, 200, 200)";
  ui.fillText("SELECT YOUR FIGHTER", 600, 130);

  // Character portrait boxes
  var boxW = 180;
  var boxH = 160;
  var gap = 25;
  var totalW = brCharNames.length * boxW + (brCharNames.length - 1) * gap;
  var startX = (1200 - totalW) / 2;
  var boxY = 180;

  for (var c = 0; c < brCharNames.length; c++) {
    var bx = startX + c * (boxW + gap);

    // Selection highlight
    if (c === brCharSelected) {
      ui.fillStyle = "rgb(255, 215, 0)";
      ui.fillRect(bx - 5, boxY - 5, boxW + 10, boxH + 10);
    }

    // Box background
    ui.fillStyle = c === brCharSelected ? "rgb(50, 50, 80)" : "rgb(30, 30, 50)";
    ui.fillRect(bx, boxY, boxW, boxH);

    // Character portrait
    var pic = brCharPics[c];
    if (pic) {
      var imgW = 140;
      var imgH = 100;
      ui.drawImage(pic, bx + (boxW - imgW) / 2, boxY + 10, imgW, imgH);
    }

    // Character name below portrait
    ui.fillStyle = c === brCharSelected ? "white" : "rgb(140, 140, 140)";
    ui.font = c === brCharSelected ? "900 18px Arial" : "700 16px Arial";
    ui.fillText(brCharNames[c], bx + boxW / 2, boxY + boxH - 12);
  }

  // Large preview panel below
  ui.fillStyle = "rgb(25, 25, 45)";
  ui.strokeStyle = "rgb(255, 215, 0)";
  ui.lineWidth = 3;
  ui.fillRect(350, 380, 500, 280);
  ui.strokeRect(350, 380, 500, 280);

  // Large portrait
  var selPic = brCharPics[brCharSelected];
  if (selPic) {
    ui.drawImage(selPic, 420, 400, 360, 200);
  }

  // Character name
  ui.fillStyle = "white";
  ui.font = "900 45px Arial";
  ui.strokeStyle = "black";
  ui.lineWidth = 3;
  ui.strokeText(brCharNames[brCharSelected], 600, 640);
  ui.fillText(brCharNames[brCharSelected], 600, 640);

  // Instructions
  ui.font = "700 24px Arial";
  ui.lineWidth = 1;
  ui.fillStyle = brCharConfirmed ? "rgb(100, 255, 100)" : "rgb(255, 215, 0)";
  ui.fillText(brCharConfirmed ? "STARTING..." : "A to Start  |  B to Back", 600, 710);

  ui.restore();
}
// --- End BR CSS ---

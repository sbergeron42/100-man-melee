import {Box2D} from "../../main/util/Box2D";
import {Vec2D} from "../../main/util/Vec2D";

/*eslint indent:0*/

// Mega Battlefield - a super-sized stage for 100-player battle royale
// Ground is ~5x wider than normal Battlefield
// 30 platforms in a pyramid/triangle formation (like BF but scaled up)
//
// Platform layout (viewed from front):
//
//  Row 6 (top):       [  1  ]                                    (1 platform)
//  Row 5:          [  2  ] [  3  ]                               (2 platforms)
//  Row 4:       [  4  ] [  5  ] [  6  ]                          (3 platforms)
//  Row 3:    [  7  ] [  8  ] [  9  ] [ 10 ]                      (4 platforms)
//  Row 2: [ 11 ] [ 12 ] [ 13 ] [ 14 ] [ 15 ]                    (5 platforms)
//  Row 1 (lowest, widest): 15 platforms spanning the full width
//
// Total: 1+2+3+4+5+15 = 30 platforms

function generatePlatforms() {
  const platforms = [];

  // Platform dimensions
  const platWidth = 37; // each platform width in game units

  // Pyramid section (rows 1-6 from bottom of pyramid to top)
  // These are above the main ground, forming a centered triangle
  const pyramidRows = [
    { count: 15, y: 25,  spread: 320 }, // Row 1: wide base
    { count: 5,  y: 55,  spread: 240 }, // Row 2
    { count: 4,  y: 85,  spread: 180 }, // Row 3
    { count: 3,  y: 115, spread: 120 }, // Row 4
    { count: 2,  y: 145, spread: 70 },  // Row 5
    { count: 1,  y: 175, spread: 0 },   // Row 6: apex
  ];

  for (let row = 0; row < pyramidRows.length; row++) {
    const { count, y, spread } = pyramidRows[row];
    for (let i = 0; i < count; i++) {
      let x;
      if (count === 1) {
        x = 0;
      } else {
        x = -spread + (i * (2 * spread / (count - 1)));
      }
      const halfW = platWidth / 2;
      platforms.push([new Vec2D(x - halfW, y), new Vec2D(x + halfW, y)]);
    }
  }

  return platforms;
}

const platforms = generatePlatforms();

// Ground: wide flat surface
const groundLeft = -340;
const groundRight = 340;

// Pre-generate spawn data for 100 players
const megaStartingPoints = [];
const megaStartingFaces = [];
const megaRespawnPoints = [];
const megaRespawnFaces = [];
for (let si = 0; si < 100; si++) {
  megaStartingPoints.push(new Vec2D(groundLeft + 20 + (si * (groundRight - groundLeft - 40) / 99), 50));
  megaStartingFaces.push(si % 2 === 0 ? 1 : -1);
  megaRespawnPoints.push(new Vec2D(-300 + Math.random() * 600, 60));
  megaRespawnFaces.push(si % 2 === 0 ? 1 : -1);
}

// Under-stage geometry (simplified box shape)
const underDepth = -40;
const underInset = 10;

export default {
  name: "megabattlefield",
  box: [],
  polygon: [
    [
      new Vec2D(groundLeft, 0), new Vec2D(groundRight, 0),
      new Vec2D(groundRight - underInset, underDepth/3),
      new Vec2D(groundRight - underInset*3, underDepth),
      new Vec2D(groundLeft + underInset*3, underDepth),
      new Vec2D(groundLeft + underInset, underDepth/3)
    ]
  ],
  platform: platforms,
  ground: [[new Vec2D(groundLeft, 0), new Vec2D(groundRight, 0)]],
  ceiling: [
    [new Vec2D(groundLeft + underInset, underDepth/3), new Vec2D(groundLeft + underInset*3, underDepth)],
    [new Vec2D(groundLeft + underInset*3, underDepth), new Vec2D(groundRight - underInset*3, underDepth)],
    [new Vec2D(groundRight - underInset*3, underDepth), new Vec2D(groundRight - underInset, underDepth/3)]
  ],
  wallL: [[new Vec2D(groundLeft, 0), new Vec2D(groundLeft + underInset, underDepth/3)]],
  wallR: [[new Vec2D(groundRight, 0), new Vec2D(groundRight - underInset, underDepth/3)]],
  startingPoint: megaStartingPoints,
  startingFace: megaStartingFaces,
  respawnPoints: megaRespawnPoints,
  respawnFace: megaRespawnFaces,
  // Blastzones scaled up proportionally
  blastzone: new Box2D([-500, -200], [500, 300]),
  ledge: [["ground", 0, 0], ["ground", 0, 1]],
  ledgePos: [new Vec2D(groundLeft, 0), new Vec2D(groundRight, 0)],
  // Scale down so the big stage fits on the 1200x750 canvas
  // Normal BF: scale 4.5, ground spans 136.8 units = 615px
  // Mega BF: ground spans 680 units, want ~1100px => scale ~1.6
  scale: 5,
  offset: [600, 480],
  movingPlats: [],
  movingPlatforms: function () {
  }
};

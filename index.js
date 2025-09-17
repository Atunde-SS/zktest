// ------------------- Noir Setup -------------------
import { compile, createFileManager } from "@noir-lang/noir_wasm";
import { UltraHonkBackend, BarretenbergSync } from '@aztec/bb.js';
import { Noir } from '@noir-lang/noir_js';

// ------------------- Three.js & Controls -------------------
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { gsap } from 'https://cdn.jsdelivr.net/npm/gsap@3.12.5/index.js';

// ------------------- WASM Init -------------------
import initNoirC from "@noir-lang/noirc_abi";
import initACVM from "@noir-lang/acvm_js";
import acvm from "@noir-lang/acvm_js/web/acvm_js_bg.wasm?url";
import noirc from "@noir-lang/noirc_abi/web/noirc_abi_wasm_bg.wasm?url";
await Promise.all([initACVM(fetch(acvm)), initNoirC(fetch(noirc))]);

// ------------------- Noir Circuit File Creation -------------------
function stringToReadableStream(str) {
  return new Response(new TextEncoder().encode(str)).body;
}

export async function getCircuit() {
  const fm = createFileManager("/");

  // Noir circuit: verify user path matches secret, and hash(secret) == public_hash
  const mainNr = `
use std::hash::poseidon2::Poseidon2::hash;

fn main(secret_path: [Field; 3], user_path: [Field; 3], public_hash: pub Field) {
    for i in 0..3 {
        assert(secret_path[i] == user_path[i]);
    }
    assert(hash(secret_path, 3) == public_hash);
}
`.trim();

  const nargoToml = `
[package]
name = "circuit"
type = "bin"
`.trim();

  fm.writeFile("./src/main.nr", stringToReadableStream(mainNr));
  fm.writeFile("./Nargo.toml", stringToReadableStream(nargoToml));

  return await compile(fm);
}

// ------------------- Scene Setup -------------------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);
scene.fog = new THREE.FogExp2(0x000000, 0.07);

// Camera
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 6, 9);

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Bottom base plane (for "height" illusion)
const bottomPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(20, 50),
  new THREE.MeshStandardMaterial({
    color: 0x000000,
    emissive: 0x110011,
    emissiveIntensity: 0.2,
    side: THREE.DoubleSide
  })
);
bottomPlane.rotation.x = -Math.PI / 2;
bottomPlane.position.y = -5;
scene.add(bottomPlane);

// ------------------- Controls -------------------
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableZoom = false;
controls.enablePan = false;
controls.enableRotate = false;
controls.enableDamping = true;

// ------------------- Lighting -------------------
scene.add(new THREE.AmbientLight(0xffffff, 1.5));
const directional = new THREE.DirectionalLight(0xffffff, 2);
scene.add(directional);

// Spotlight (used on success)
const successLight = new THREE.SpotLight(0xffff88, 3, 10, Math.PI / 4);
scene.add(successLight);
successLight.visible = false;

// ------------------- Player -------------------
const player = new THREE.Group();
const bodyColor = 0x26717e;
const skinColor = 0xffccaa;

const body = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.6, 0.2), new THREE.MeshStandardMaterial({ color: bodyColor }));
body.position.y = 0.6;
player.add(body);

const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 16), new THREE.MeshStandardMaterial({ color: skinColor }));
head.position.y = 1.1;
player.add(head);

const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.1), new THREE.MeshStandardMaterial({ color: bodyColor }));
leftLeg.position.set(-0.1, 0.15, 0);
player.add(leftLeg);

const rightLeg = leftLeg.clone();
rightLeg.position.x = 0.1;
player.add(rightLeg);

player.position.set(0, 0, 2);
scene.add(player);

// ------------------- Platforms -------------------
const startPlatform = new THREE.Mesh(new THREE.BoxGeometry(3, 0.5, 3), new THREE.MeshStandardMaterial({ color: 0x222222 }));
startPlatform.position.set(0, -1, 1.5);
scene.add(startPlatform);

// ------------------- Glass Bridge -------------------
const tileSize = 1;
const tileGap = 1.5;
const tileOffset = 0.8;
const numTiles = 3;
const tiles = [];
const secretPath = [];

for (let i = 0; i < numTiles; i++) {
  const z = -i * (tileSize + tileGap);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xaaffff, roughness: 0.2, metalness: 0.3, transparent: true, opacity: 0.8
  });
  const left = new THREE.Mesh(new THREE.BoxGeometry(tileSize, 0.1, tileSize), mat.clone());
  const right = new THREE.Mesh(new THREE.BoxGeometry(tileSize, 0.1, tileSize), mat.clone());

  const safeIndex = Math.random() < 0.5 ? 0 : 1;
  secretPath.push(BigInt(safeIndex));

  if (safeIndex === 0) right.userData.break = true;
  else left.userData.break = true;

  left.position.set(-tileOffset, 0, z);
  right.position.set(tileOffset, 0, z);
  scene.add(left, right);
  tiles.push(left, right);
}

// ------------------- Poseidon Hash -------------------
const api = await BarretenbergSync.initSingleton();
const publicHash = api.poseidon2Hash(secretPath);

document.getElementById("public-hash-value").textContent = publicHash.toString(16).padStart(64, "0");
document.getElementById("copy-public-hash").addEventListener("click", () => {
  const hex = publicHash.toString(16).padStart(64, "0");
  navigator.clipboard.writeText(hex);
  alert("✅ Public hash copied to clipboard!");
});

// ------------------- Goal Zone -------------------
const gateZ = -numTiles * (tileSize + tileGap) - 2;
const goalPlatform = new THREE.Mesh(new THREE.BoxGeometry(3, 0.5, 3), new THREE.MeshStandardMaterial({ color: 0x444444 }));
goalPlatform.position.set(0, -0.25, gateZ - 3);
scene.add(goalPlatform);
successLight.position.set(0, 5, gateZ - 3);
successLight.target.position.set(0, 0, gateZ - 3);

// ------------------- Decorations -------------------
function createLightLine(zStart, zEnd, x, interval = 1) {
  const group = new THREE.Group();
  const steps = Math.floor(Math.abs(zEnd - zStart) / interval);
  for (let i = 0; i <= steps; i++) {
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 8, 8),
      new THREE.MeshStandardMaterial({ emissive: 0xffddaa, emissiveIntensity: 10 })
    );
    bulb.position.set(x, 0.7, zStart - i * interval);
    group.add(bulb);
  }
  scene.add(group);
}
createLightLine(0, gateZ, -2);
createLightLine(0, gateZ, 2);

function addCurtains() {
  const curtainMaterial = new THREE.MeshStandardMaterial({ color: 0x550033, side: THREE.DoubleSide });
  const curtainGeom = new THREE.PlaneGeometry(2, 5);
  for (let i = -1; i <= 1; i += 2) {
    const curtain = new THREE.Mesh(curtainGeom, curtainMaterial);
    curtain.position.set(i * 3.5, 2.5, -4);
    curtain.rotation.y = Math.PI / 2;
    scene.add(curtain);
  }
}

function addGate() {
  const gate = new THREE.Mesh(new THREE.BoxGeometry(2, 4, 0.2), new THREE.MeshStandardMaterial({ color: 0x772288 }));
  gate.position.set(0, 2, gateZ - 3.5);
  scene.add(gate);

  for (let i = -1; i <= 1; i += 0.2) {
    const lightDot = new THREE.Mesh(
      new THREE.SphereGeometry(0.05),
      new THREE.MeshStandardMaterial({ emissive: 0xffaa00, emissiveIntensity: 5 })
    );
    lightDot.position.set(i, 4, gateZ - 3.2);
    scene.add(lightDot);
  }
}

function addCeilingCloth() {
  const colors = [0x5522aa, 0x2255aa, 0xaa2255, 0x22aa55];
  for (let i = 0; i < colors.length; i++) {
    const cloth = new THREE.Mesh(
      new THREE.PlaneGeometry(4, 2),
      new THREE.MeshStandardMaterial({ color: colors[i], side: THREE.DoubleSide })
    );
    cloth.rotation.x = Math.PI / 2;
    cloth.position.set(0, 6, gateZ + i * 1.5);
    scene.add(cloth);
  }
}

function addVerticalLights() {
  for (let side of [-3, 3]) {
    for (let y = 0.5; y < 5; y += 0.4) {
      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.05, 8, 8),
        new THREE.MeshStandardMaterial({ emissive: 0xffffcc, emissiveIntensity: 6 })
      );
      bulb.position.set(side, y, gateZ + 1);
      scene.add(bulb);
    }
  }
}

addCurtains();
addGate();
addCeilingCloth();
addVerticalLights();

// ------------------- User Interaction & Proof -------------------
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let isJumping = false;
const userPath = [];

function toHex(array) {
  return "0x" + Array.from(array).map((b) => b.toString(16).padStart(2, "0")).join("");
}

window.addEventListener("click", async (event) => {
  if (isJumping) return;
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(tiles);
  if (!intersects.length) return;

  const tile = intersects[0].object;
  const { x, z } = tile.position;
  const direction = tile.position.x < 0 ? 0 : 1;
  userPath.push(BigInt(direction));

  const dz = Math.abs(z - player.position.z);
  if (z >= player.position.z || dz > tileSize + tileGap + 0.1) return;
  isJumping = true;

  // Jump animation
  gsap.to(player.position, {
    x, z, y: 1, duration: 0.3,
    onComplete: () => {
      gsap.to(player.position, {
        y: 0.3, duration: 0.2,
        onComplete: () => { if (!tile.userData.break) isJumping = false; }
      });
    }
  });
  gsap.to(camera.position, { x, z: z + 6, y: 5.5, duration: 1 });

  const isLastTile = z === tiles[tiles.length - 1].position.z;
  if (isLastTile && !tile.userData.break) {
    setTimeout(async () => {
      gsap.to(player.position, {
        x: 0, z: gateZ - 3, y: 1, duration: 0.5,
        onComplete: async () => {
          successLight.visible = true;
          successLight.intensity = 10;
          scene.background = new THREE.Color(0x222233);
          spawnFireworks(player.position);
          document.getElementById("victory-text").style.opacity = 1;

          try {
            const { program } = await getCircuit();
            const noir = new Noir(program);
            const backend = new UltraHonkBackend(program.bytecode);
            const noirInputs = {
              secret_path: secretPath.map(v => v.toString()),
              user_path: userPath.map(v => v.toString()),
              public_hash: publicHash.toString()
            };

            const { witness } = await noir.execute(noirInputs);
            // check version of zkdev verifier and here and backend bb.js
            const { proof } = await backend.generateProof(witness, {keccak: true});
            
            document.getElementById("copy-buttons").style.display = "flex";
            document.getElementById("copy-proof").addEventListener("click", async () => {
              await navigator.clipboard.writeText(toHex(proof));
              alert("✅ Proof copied!");
            });
            // document.getElementById("copy-sol").addEventListener("click", async () => {
            //     const solCode = await fetch("/circuit/verify.sol").then(r => r.text());
            //     await navigator.clipboard.writeText(solCode);
            //     alert("✅ Verifier copied!");
            //   });
          } catch (e) {
            console.error(e);
          }
        }
      });
      gsap.to(camera.position, { x: 0, z: gateZ + 2, y: 5, duration: 1 });
    }, 800);
  }

  if (tile.userData.break) {
    setTimeout(() => fall(tile), 600);
  }
});

// ------------------- Glass Breaking Effect -------------------
function spawnShards(tile) {
  for (let i = 0; i < 6; i++) {
    const shard = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.05, 0.3),
      new THREE.MeshStandardMaterial({ color: 0xaaffff, transparent: true, opacity: 0.6 })
    );
    shard.position.set(
      tile.position.x + (Math.random() - 0.5) * 0.5,
      tile.position.y,
      tile.position.z + (Math.random() - 0.5) * 0.5
    );
    scene.add(shard);
    gsap.to(shard.position, { y: -5, duration: 1 + Math.random() });
    gsap.to(shard.rotation, { x: Math.random() * Math.PI, z: Math.random() * Math.PI });
    gsap.to(shard.material, { opacity: 0, duration: 1.5 });
  }
  tile.visible = false;
}

function fall(tile) {
  gsap.to(player.position, { y: -5, duration: 1 });
  spawnShards(tile);
  setTimeout(() => {
    alert("💥 The glass broke!");
    location.reload();
  }, 1500);
}

// ------------------- Fireworks on Win -------------------
function spawnFireworks(center) {
  for (let i = 0; i < 100; i++) {
    const geom = new THREE.SphereGeometry(0.08, 8, 8);
    const color = new THREE.Color(`hsl(${Math.random() * 360}, 100%, 70%)`);
    const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 10, transparent: true, opacity: 1 });
    const particle = new THREE.Mesh(geom, mat);
    particle.position.copy(center.clone().add(new THREE.Vector3(0, 1.5, 0)));
    scene.add(particle);
    const dir = new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 3 + 2, (Math.random() - 0.5) * 4);
    gsap.to(particle.position, {
      x: particle.position.x + dir.x,
      y: particle.position.y + dir.y,
      z: particle.position.z + dir.z,
      duration: 1.2, ease: "power2.out"
    });
    gsap.to(particle.material, {
      opacity: 0,
      duration: 1.2,
      ease: "power1.in",
      onComplete: () => scene.remove(particle)
    });
  }
}

// ------------------- Main Render Loop -------------------
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  camera.lookAt(player.position);
  directional.position.set(player.position.x + 2, player.position.y + 5, player.position.z + 2);
  renderer.render(scene, camera);
}
animate();

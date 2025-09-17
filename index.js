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
fn main(secret_path: [Field; 3], user_path: pub [Field; 3], public_hash: pub Field) {
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
// ------------------- Utility Functions -------------------
function hexToBuffer(hex) {
  if (hex.startsWith('0x')) hex = hex.slice(2);
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}
function toHex(array) {
  return "0x" + Array.from(array).map((b) => b.toString(16).padStart(2, "0")).join("");
}
// ------------------- Scene Setup -------------------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0a0a);
scene.fog = new THREE.FogExp2(0x0a0a0a, 0.05);
// Camera
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 6, 8);
// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
// Bottom base plane
const bottomPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(20, 50),
  new THREE.MeshStandardMaterial({
    color: 0x111111,
    emissive: 0x111111,
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
scene.add(new THREE.AmbientLight(0x444444, 0.5));
const directional = new THREE.DirectionalLight(0xffffff, 1.5);
scene.add(directional);
// Spotlight (used on success)
const successLight = new THREE.SpotLight(0x88ff88, 2, 10, Math.PI / 4);
successLight.visible = false;
scene.add(successLight);
// ------------------- Platforms -------------------
const startPlatform = new THREE.Mesh(new THREE.BoxGeometry(3, 0.5, 3), new THREE.MeshStandardMaterial({ color: 0x222222 }));
startPlatform.position.set(0, 0, 2);
scene.add(startPlatform);
// ------------------- Tile Grid -------------------
const numRows = 3;
const numCols = 2;
const tileSize = 1;
const tileGapZ = 1.5;
const tileOffset = 0.8;
const tileOffsets = [-tileOffset, tileOffset];
const tiles = [];
const secretPath = [];
let currentExpectedZ = 0;
for (let i = 0; i < numRows; i++) {
  const z = -i * (tileSize + tileGapZ);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x333333, roughness: 0.8, metalness: 0.1
  });
  const rowTiles = [];
  for (let j = 0; j < numCols; j++) {
    const tile = new THREE.Mesh(new THREE.BoxGeometry(tileSize, 0.1, tileSize), mat.clone());
    tile.position.set(tileOffsets[j], 0, z);
    tile.userData.colIndex = j;
    rowTiles.push(tile);
    scene.add(tile);
  }
  const safeIndex = Math.floor(Math.random() * numCols);
  secretPath.push(BigInt(safeIndex));
  rowTiles.forEach((tile, j) => {
    tile.userData.break = (j !== safeIndex);
  });
  tiles.push(...rowTiles);
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
const gateZ = -numRows * (tileSize + tileGapZ) - 2;
const goalPlatform = new THREE.Mesh(new THREE.BoxGeometry(3, 0.5, 3), new THREE.MeshStandardMaterial({ color: 0x222222 }));
goalPlatform.position.set(0, 0, gateZ - 3);
scene.add(goalPlatform);
successLight.position.set(0, 5, gateZ - 3);
successLight.target.position.set(0, 0, gateZ - 3);
// ------------------- Simplified Decorations -------------------
function createLightLine(zStart, zEnd, x, interval = 1) {
  const group = new THREE.Group();
  const steps = Math.floor(Math.abs(zEnd - zStart) / interval);
  for (let i = 0; i <= steps; i++) {
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 8, 8),
      new THREE.MeshStandardMaterial({ emissive: 0x888888, emissiveIntensity: 5 })
    );
    bulb.position.set(x, 0.7, zStart - i * interval);
    group.add(bulb);
  }
  scene.add(group);
}
createLightLine(2, gateZ, -2);
createLightLine(2, gateZ, 2);
// ------------------- Symbol Creators -------------------
function createO(color) {
  const mat = new THREE.MeshStandardMaterial({ color });
  const torus = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.05, 16, 32), mat);
  torus.rotation.x = Math.PI / 2;
  return torus;
}
function createX(color) {
  const mat = new THREE.MeshStandardMaterial({ color });
  const group = new THREE.Group();
  const bar1 = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.05, 0.05), mat);
  bar1.rotation.z = Math.PI / 4;
  const bar2 = bar1.clone();
  bar2.rotation.z = -Math.PI / 4;
  group.add(bar1, bar2);
  return group;
}
// ------------------- Reveal Tile -------------------
function revealTile(tile, isSafe) {
  tile.material.color.set(isSafe ? 0x00aa00 : 0xff0000);
  const symbolColor = isSafe ? 0x008800 : 0x880000;
  const symbol = isSafe ? createO(symbolColor) : createX(symbolColor);
  symbol.position.copy(tile.position);
  symbol.position.y += 0.05;
  scene.add(symbol);
}
// ------------------- User Interaction & Proof -------------------
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let canClick = true;
const userPath = [];
window.addEventListener("click", async (event) => {
  if (!canClick) return;
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(tiles);
  if (!intersects.length) return;
  const tile = intersects[0].object;
  const { x, z } = tile.position;
  if (Math.abs(z - currentExpectedZ) > 0.1) return;
  const direction = BigInt(tile.position.x < 0 ? 0 : 1);
  userPath.push(direction);
  canClick = false;
  const isSafe = !tile.userData.break;
  revealTile(tile, isSafe);
  gsap.to(camera.position, { z: z + 6, duration: 0.5 });
  if (!isSafe) {
    setTimeout(() => {
      alert("❌ Game Over! Wrong tile.");
      location.reload();
    }, 500);
    return;
  }
  currentExpectedZ = z - (tileSize + tileGapZ);
  canClick = true;
  const lastZ = - (numRows - 1) * (tileSize + tileGapZ);
  const isLastTile = Math.abs(z - lastZ) < 0.1;
  if (isLastTile) {
    setTimeout(async () => {
      gsap.to(camera.position, {
        z: gateZ + 2, y: 5, duration: 1,
        onComplete: async () => {
          successLight.visible = true;
          successLight.intensity = 10;
          scene.background = new THREE.Color(0x111111);
          spawnFireworks(new THREE.Vector3(0, 0, gateZ));
          document.getElementById("victory-text").style.opacity = 1;
          try {
            const { program } = await getCircuit();
            const noir = new Noir(program);
            const backend = new UltraHonkBackend(program.bytecode);
            window.backend = backend;
            const noirInputs = {
              secret_path: secretPath.map(v => v.toString()),
              user_path: userPath.map(v => v.toString()),
              public_hash: publicHash.toString()
            };
            const { witness } = await noir.execute(noirInputs);
            const { proof } = await backend.generateProof(witness, {keccak: true});
           
            // Compute proof hash (SHA-256 of the proof data)
            const proofHashBuffer = await crypto.subtle.digest('SHA-256', proof);
            const proofHash = toHex(new Uint8Array(proofHashBuffer));
           
            // Display proof hash in left panel
            document.getElementById("proof-hash-value").textContent = proofHash;
           
            document.getElementById("copy-buttons").style.display = "flex";
            document.getElementById("copy-proof").addEventListener("click", () => {
              navigator.clipboard.writeText(toHex(proof));
              alert("✅ Proof copied!");
            });
            document.getElementById("copy-proof-hash-bottom").addEventListener("click", () => {
              navigator.clipboard.writeText(proofHash);
              alert("✅ Proof hash copied!");
            });
           
            // Copy button for left panel proof hash
            document.getElementById("copy-proof-hash").addEventListener("click", () => {
              navigator.clipboard.writeText(proofHash);
              alert("✅ Proof hash copied to clipboard!");
            });
           
            // Setup verification listener (now for proof hash)
            document.getElementById("verify-btn").addEventListener("click", () => {
              const proofInput = document.getElementById("proof-input").value.trim();
              if (!proofInput) {
                alert("Paste the proof hash first!");
                return;
              }
              const valid = proofInput.toLowerCase() === proofHash.toLowerCase();
              document.getElementById("verify-result").innerHTML = valid
                ? "<span style='color: green;'>✅ Valid Proof Hash!</span>"
                : "<span style='color: red;'>❌ Invalid Proof Hash</span>";
            });
          } catch (e) {
            console.error(e);
          }
        }
      });
    }, 500);
  }
});
// ------------------- Fireworks on Win -------------------
function spawnFireworks(center) {
  for (let i = 0; i < 100; i++) {
    const geom = new THREE.SphereGeometry(0.08, 8, 8);
    const color = new THREE.Color(`hsl(${Math.random() * 360}, 100%, 50%)`);
    const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 5, transparent: true, opacity: 1 });
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
let currentLookZ = 0;
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  camera.lookAt(0, 0, currentLookZ);
  directional.position.set(0, 5, currentLookZ + 2);
  currentLookZ = THREE.MathUtils.lerp(currentLookZ, currentExpectedZ, 0.05);
  renderer.render(scene, camera);
}
animate();

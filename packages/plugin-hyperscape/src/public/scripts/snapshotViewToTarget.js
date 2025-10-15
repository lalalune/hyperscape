window.snapshotViewToTarget = async function (playerData, targetPosition) {
  // THREE is already available via import maps in index.html
  const camera = window.camera;
  const renderer = window.renderer;

  // Positions
  const playerPos = new THREE.Vector3(...playerData.position);
  const targetPos = new THREE.Vector3(...targetPosition);

  // Flatten Y values to stay on XZ plane
  playerPos.y = 0;
  targetPos.y = 0;

  // Compute direction from target to player (on XZ plane)
  const dir = new THREE.Vector3().subVectors(playerPos, targetPos).normalize();

  // Eye is a bit behind the target toward player
  const eye = new THREE.Vector3().copy(targetPos).addScaledVector(dir, 4); // move back 4 units
  eye.y = playerData.position[1] + 1; // elevate eye slightly

  const target = new THREE.Vector3(...targetPosition);
  target.y = playerData.position[1]; // match elevation

  // Set camera
  camera.position.copy(eye);
  camera.lookAt(target);
  camera.updateMatrixWorld();

  // Render
  renderer.render(window.scene, camera);

  return renderer.domElement.toDataURL("image/jpeg").split(",")[1];
};

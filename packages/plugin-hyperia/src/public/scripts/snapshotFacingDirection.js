window.snapshotFacingDirection = async function (playerData) {
  // THREE is already available via import maps in index.html
  const camera = window.camera;
  const renderer = window.renderer;

  const eye = new THREE.Vector3(...playerData.position);
  eye.y += 2;

  camera.position.copy(eye);
  camera.quaternion.set(...playerData.quaternion);

  // Move camera backward along its local forward axis with 2 units
  const backward = new THREE.Vector3(0, 0, -1).applyQuaternion(
    camera.quaternion,
  );
  camera.position.addScaledVector(backward, -2);

  camera.updateMatrixWorld();

  renderer.render(window.scene, camera);

  return renderer.domElement.toDataURL("image/jpeg").split(",")[1];
};

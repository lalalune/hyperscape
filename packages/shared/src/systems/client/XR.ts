import THREE from "../../extras/three/three";
import { SystemBase } from "../shared/infrastructure/SystemBase";
import type { World } from "../../types";
import { EventType } from "../../types/events";

import { XRControllerModelFactory } from "three/examples/jsm/webxr/XRControllerModelFactory.js";

/**
 * XR System
 *
 * - Runs on the client.
 * - Keeps track of XR sessions
 *
 */
export class XR extends SystemBase {
  session: XRSession | null;
  camera: THREE.Camera | null;
  controller1Model: THREE.Group | null;
  controller2Model: THREE.Group | null;
  supportsVR: boolean;
  supportsAR: boolean;
  controllerModelFactory: XRControllerModelFactory;

  constructor(world: World) {
    super(world, {
      name: "XR",
      dependencies: { required: [], optional: [] },
      autoCleanup: true,
    });
    this.session = null;
    this.camera = null;
    this.controller1Model = null;
    this.controller2Model = null;
    this.supportsVR = false;
    this.supportsAR = false;
    this.controllerModelFactory = new XRControllerModelFactory();
  }

  override async init() {
    if (typeof navigator !== "undefined" && navigator.xr) {
      const xr = navigator.xr;
      if (xr) {
        this.supportsVR = await xr.isSessionSupported("immersive-vr");
        this.supportsAR = await xr.isSessionSupported("immersive-ar");
      } else {
        this.supportsVR = false;
        this.supportsAR = false;
      }
    }
  }

  async enter() {
    if (typeof navigator === "undefined" || !navigator.xr) {
      console.warn("WebXR not supported");
      return;
    }
    // Strong type assumption - XR is available when enter() is called
    const xr = navigator.xr;
    const session = await xr.requestSession("immersive-vr", {
      requiredFeatures: ["local-floor"],
    });
    if (session && session.updateTargetFrameRate) {
      session.updateTargetFrameRate(72);
    }
    // Get the local player and unmount avatar for XR
    const localPlayer = this.world.entities.getLocalPlayer()!;
    if (localPlayer.avatar) {
      // Strong type assumption - avatar has unmount method
      (localPlayer.avatar as { unmount(): void }).unmount();
    }
    // Strong type assumption - graphics renderer and XR are available (XR only works with WebGLRenderer)
    const webglRenderer = this.world.graphics!.renderer as THREE.WebGLRenderer;
    webglRenderer.xr.setSession(session);
    this.camera = webglRenderer.xr.getCamera();

    // Strong type assumption - controllers are available in XR session
    const grip1 = webglRenderer.xr.getControllerGrip(0);
    this.controller1Model = new THREE.Group();
    const model1 = this.controllerModelFactory.createControllerModel(grip1);
    if (model1) this.controller1Model.add(model1);
    if (this.world.rig && this.controller1Model)
      this.world.rig.add(this.controller1Model);

    const grip2 = webglRenderer.xr.getControllerGrip(1);
    this.controller2Model = new THREE.Group();
    const model2 = this.controllerModelFactory.createControllerModel(grip2);
    if (model2) this.controller2Model.add(model2);
    if (this.world.rig && this.controller2Model)
      this.world.rig.add(this.controller2Model);
    (
      session as unknown as {
        addEventListener: (type: string, listener: () => void) => void;
      }
    ).addEventListener("end", this.onSessionEnd);
    this.session = session;
    this.emitTypedEvent(EventType.XR_SESSION, session as XRSession);
  }

  onSessionEnd = () => {
    // Get the local player and remount avatar after XR
    const localPlayer = this.world.entities.getLocalPlayer()!;
    if (localPlayer.avatar) {
      // Strong type assumption - avatar has mount method
      (localPlayer.avatar as { mount(): void }).mount();
    }
    this.world.camera!.position.set(0, 0, 0);
    this.world.camera!.rotation.set(0, 0, 0);
    if (this.world.rig && this.controller1Model)
      this.world.rig.remove(this.controller1Model);
    if (this.world.rig && this.controller2Model)
      this.world.rig.remove(this.controller2Model);
    this.session = null;
    this.camera = null;
    this.controller1Model = null;
    this.controller2Model = null;
    this.emitTypedEvent(EventType.XR_SESSION, null);
  };
}

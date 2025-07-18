import type { THREE } from '../core/extras/three';
export interface WorldOptions {
    storage?: any;
    assetsDir?: string;
    assetsUrl?: string;
    physics?: boolean;
    renderer?: 'webgl' | 'webgl2' | 'headless';
    networkRate?: number;
    maxDeltaTime?: number;
    fixedDeltaTime?: number;
}
export interface World {
    audio: any;
    controls: any;
    prefs: any;
    frame: number;
    time: number;
    accumulator: number;
    systems: System[];
    networkRate: number;
    assetsUrl: string | null;
    assetsDir: string | null;
    hot: Set<HotReloadable>;
    rig: any;
    camera: any;
    settings: Settings;
    collections: Collections;
    apps: Apps;
    anchors: Anchors;
    events: Events;
    scripts: Scripts;
    chat: Chat;
    blueprints: Blueprints;
    entities: Entities;
    physics: Physics;
    stage: Stage;
    builder?: {
        enabled: boolean;
    };
    xr?: {
        session?: XRSession;
        camera: any;
    };
    ui?: {
        toggleCode(): void;
        suppressReticle?(): () => void;
    };
    loader?: {
        get(type: string, url: string): any;
        load(type: string, url: string): Promise<any>;
        insert(type: string, url: string, data: any): void;
        getFile?(url: string): any;
        preload?(type: string, url: string): void;
        execPreload?(): void;
        preloader?: Promise<void>;
    };
    network?: {
        isClient: boolean;
        isServer: boolean;
        id: string;
        send(type: string, data: any): void;
        upload(file: File): Promise<void>;
    };
    register(key: string, SystemClass: SystemConstructor): System;
    init(options: WorldOptions): Promise<void>;
    start(): void;
    tick(time: number): void;
    destroy(): void;
    resolveURL(url: string, allowLocal?: boolean): string;
    setHot(item: HotReloadable, hot: boolean): void;
    setupMaterial(material: any): void;
    inject(runtime: any): void;
    getSystem<T extends System>(name: string): T | undefined;
    getSystemByType<T extends System>(constructor: new (world: World) => T): T | undefined;
    getEntityById(id: string): any | null;
    graphics?: {
        renderer: {
            xr: {
                setSession: (session: XRSession) => void;
                getCamera: () => THREE.Camera;
                getControllerGrip: (index: number) => THREE.Object3D;
            };
        };
    };
    emit?: (event: string, ...args: any[]) => boolean;
    on?: <T extends string | symbol>(event: T, fn: (...args: any[]) => void, context?: any) => any;
    off?: <T extends string | symbol>(event: T, fn?: (...args: any[]) => void, context?: any, once?: boolean) => any;
}
export interface System {
    world: World;
    init(options: WorldOptions): Promise<void>;
    start(): void;
    destroy(): void;
    preTick(): void;
    preFixedUpdate(willFixedStep: boolean): void;
    fixedUpdate(_delta: number): void;
    postFixedUpdate(_delta: number): void;
    preUpdate(alpha: number): void;
    update(_delta: number): void;
    postUpdate(_delta: number): void;
    lateUpdate(_delta: number): void;
    postLateUpdate(_delta: number): void;
    commit(): void;
    postTick(): void;
}
export interface SystemConstructor {
    new (world: World): System;
}
export interface Entity {
    id: string;
    name: string;
    type: string;
    world: World;
    node: any;
    components: Map<string, Component>;
    position: Vector3;
    rotation: Quaternion;
    scale: Vector3;
    velocity?: Vector3;
    isPlayer: boolean;
    addComponent(type: string, data?: any): Component;
    removeComponent(type: string): void;
    getComponent<T extends Component>(type: string): T | null;
    hasComponent(type: string): boolean;
    applyForce(force: Vector3): void;
    applyImpulse(impulse: Vector3): void;
    setVelocity(velocity: Vector3): void;
    getVelocity(): Vector3;
    fixedUpdate?(_delta: number): void;
    update?(_delta: number): void;
    lateUpdate?(_delta: number): void;
    on?(event: string, callback: Function): void;
    off?(event: string, callback: Function): void;
    serialize(): any;
    destroy(local?: boolean): void;
}
export interface Component {
    type: string;
    entity: Entity;
    data: any;
    init?(): void;
    update?(_delta: number): void;
    fixedUpdate?(_delta: number): void;
    lateUpdate?(_delta: number): void;
    destroy?(): void;
}
export interface Vector3 {
    x: number;
    y: number;
    z: number;
    copy?(vector: Vector3): this;
    set?(x: number, y: number, z: number): this;
    lerpVectors?(v1: Vector3, v2: Vector3, alpha: number): this;
}
export interface Quaternion {
    x: number;
    y: number;
    z: number;
    w: number;
    copy?(quaternion: Quaternion): this;
    slerpQuaternions?(qa: Quaternion, qb: Quaternion, t: number): this;
}
export interface Matrix4 {
    elements: number[];
    decompose?(position: Vector3, quaternion: Quaternion, scale: Vector3): this;
    copy?(matrix: Matrix4): this;
    compose?(position: Vector3, quaternion: Quaternion, scale: Vector3): this;
    multiplyMatrices?(a: Matrix4, b: Matrix4): this;
}
export interface PhysicsOptions {
    gravity?: Vector3;
    timestep?: number;
    maxSubsteps?: number;
}
export interface RigidBody {
    type: 'static' | 'dynamic' | 'kinematic';
    mass: number;
    position: Vector3;
    rotation: Quaternion;
    velocity: Vector3;
    angularVelocity: Vector3;
    applyForce(force: Vector3, point?: Vector3): void;
    applyImpulse(impulse: Vector3, point?: Vector3): void;
    setLinearVelocity(velocity: Vector3): void;
    setAngularVelocity(velocity: Vector3): void;
}
export interface Collider {
    type: 'box' | 'sphere' | 'capsule' | 'mesh';
    isTrigger: boolean;
    material?: PhysicsMaterial;
    onCollisionEnter?: (other: Collider) => void;
    onCollisionStay?: (other: Collider) => void;
    onCollisionExit?: (other: Collider) => void;
    onTriggerEnter?: (other: Collider) => void;
    onTriggerStay?: (other: Collider) => void;
    onTriggerExit?: (other: Collider) => void;
}
export interface PhysicsMaterial {
    friction: number;
    restitution: number;
}
export interface NetworkPacket {
    type: string;
    data: any;
    timestamp: number;
    reliable?: boolean;
}
export interface NetworkConnection {
    id: string;
    latency: number;
    send(packet: NetworkPacket): void;
    disconnect(): void;
}
export interface Player extends Entity {
    connection?: NetworkConnection;
    input: PlayerInput;
    stats: PlayerStats;
    avatar?: any;
    spawn(position: Vector3): void;
    respawn(): void;
    damage(amount: number, source?: Entity): void;
    heal(amount: number): void;
}
export interface PlayerInput {
    movement: Vector3;
    rotation: Quaternion;
    actions: Set<string>;
    mouse: {
        x: number;
        y: number;
    };
}
export interface PlayerStats {
    health: number;
    maxHealth: number;
    score: number;
    kills: number;
    deaths: number;
}
export interface Node {
    id: string;
    type: string;
    parent: Node | null;
    children: Node[];
    transform: Transform;
    visible: boolean;
    add(child: Node): void;
    remove(child: Node): void;
    traverse(callback: (node: Node) => void): void;
    getWorldPosition(): Vector3;
    getWorldRotation(): Quaternion;
    getWorldScale(): Vector3;
}
export interface Transform {
    position: Vector3;
    rotation: Quaternion;
    scale: Vector3;
    matrix: Matrix4;
    worldMatrix: Matrix4;
}
export interface Asset {
    id: string;
    url: string;
    type: 'model' | 'texture' | 'audio' | 'video' | 'script';
    data?: any;
    loaded: boolean;
    loading: boolean;
    error?: Error;
}
export interface GameEvent {
    type: string;
    data: any;
    timestamp: number;
    source?: Entity;
    target?: Entity;
}
export interface HotReloadable {
    fixedUpdate?(_delta: number): void;
    update?(_delta: number): void;
    lateUpdate?(_delta: number): void;
    postLateUpdate?(_delta: number): void;
}
export interface Settings extends System {
    get(key: string): any;
    set(key: string, value: any): void;
    public?: boolean;
    model?: {
        url: string;
    } | string | null;
    on?(event: string, handler: Function): void;
}
export interface Collections extends System {
    items: Map<string, any>;
}
export interface Apps extends System {
    apps: Map<string, any>;
    inject(runtime: any): void;
    worldGetters?: Map<string, any>;
    worldSetters?: Map<string, any>;
    worldMethods?: Map<string, any>;
    appGetters?: Map<string, any>;
    appSetters?: Map<string, any>;
    appMethods?: Map<string, any>;
}
export interface Anchors extends System {
    anchors: Map<string, any>;
    get(id: string): any;
}
export interface Events extends System {
    emit(event: string, data?: any): void;
    on(event: string, handler: (data: any) => void): void;
    off(event: string, handler?: (data: any) => void): void;
}
export interface Scripts extends System {
    evaluate(code: any): unknown;
    scripts: Map<string, any>;
}
export interface Chat extends System {
    messages: ChatMessage[];
    send(message: string, from?: Entity): void;
}
export interface ChatMessage {
    id: string;
    text: string;
    from?: Entity;
    timestamp: number;
}
export interface Blueprints extends System {
    blueprints: Map<string, Blueprint>;
    create(blueprintId: string, options?: any): Entity;
    get(id: string): Blueprint | null;
    modify(data: any): void;
}
export interface Blueprint {
    id: string;
    name: string;
    version: number;
    components: ComponentDefinition[];
    disabled?: boolean;
    model?: string;
    script?: string;
    props?: any;
}
export interface ComponentDefinition {
    type: string;
    data: any;
}
export interface Entities extends System {
    items: Map<string, Entity>;
    players: Map<string, Player>;
    player?: Player;
    apps: Map<string, Entity>;
    getLocalPlayer(): Player | null;
    getPlayer(id: string): Player | null;
    create(name: string, options?: any): Entity;
    destroyEntity(entityId: string): void;
    get(entityId: string): Entity | null;
    has(entityId: string): boolean;
    remove(entityId: string): void;
    set(entityId: string, entity: Entity): void;
    getAll(): Entity[];
    getAllPlayers(): Player[];
    getRemovedIds(): string[];
    setHot(entity: Entity, hot: boolean): void;
    add(data: any, local?: boolean): Entity;
}
export interface Physics extends System {
    world: any;
    physics?: any;
    raycast(origin: Vector3, direction: Vector3, maxDistance?: number, layerMask?: number): RaycastHit | null;
    sphereCast(origin: Vector3, radius: number, direction: Vector3, maxDistance?: number, layerMask?: number): RaycastHit | null;
    overlapSphere(position: Vector3, radius: number): Collider[];
    sweep(geometry: any, origin: Vector3, direction: Vector3, maxDistance: number, layerMask: number): any;
    addActor(actor: any, handle: any): any;
}
export interface RaycastHit {
    point: Vector3;
    normal: Vector3;
    distance: number;
    collider: Collider;
    entity?: Entity;
    handle?: any;
}
export interface Stage extends System {
    octree: any;
    scene: any;
    environment: any;
    clean(): void;
}

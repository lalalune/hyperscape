declare function PhysX(target?: WebAssembly.Module | BufferSource): Promise<typeof PhysX & typeof PhysX.PxTopLevelFunctions>
export default PhysX;
declare namespace PhysX {
    
    function destroy(obj: any): void;
    
    function _malloc(size: number): number;
    
    function _free(ptr: number): void;
    
    const HEAP8: Int8Array;
    
    const HEAP16: Int16Array;
    
    const HEAP32: Int32Array;
    
    const HEAPU8: Uint8Array;
    
    const HEAPU16: Uint16Array;
    
    const HEAPU32: Uint32Array;
    
    const HEAPF32: Float32Array;
    
    const HEAPF64: Float64Array;
    
    class BaseVehicle {
        initialize(): boolean;
        destroyState(): void;
        initComponentSequence(addPhysXBeginEndComponents: boolean): void;
        step(dt: number, context: PxVehicleSimulationContext): void;
        baseParams: BaseVehicleParams;
        baseState: BaseVehicleState;
        componentSequence: PxVehicleComponentSequence;
        componentSequenceSubstepGroupHandle: number;
    }
    
    class BaseVehicleParams {
        constructor();
        transformAndScale(srcFrame: PxVehicleFrame, trgFrame: PxVehicleFrame, srcScale: PxVehicleScale, trgScale: PxVehicleScale): BaseVehicleParams;
        isValid(): boolean;
        axleDescription: PxVehicleAxleDescription;
        frame: PxVehicleFrame;
        scale: PxVehicleScale;
        suspensionStateCalculationParams: PxVehicleSuspensionStateCalculationParams;
        brakeResponseParams: ReadonlyArray<PxVehicleBrakeCommandResponseParams>;
        steerResponseParams: PxVehicleSteerCommandResponseParams;
        ackermannParams: ReadonlyArray<PxVehicleAckermannParams>;
        suspensionParams: ReadonlyArray<PxVehicleSuspensionParams>;
        suspensionComplianceParams: ReadonlyArray<PxVehicleSuspensionComplianceParams>;
        suspensionForceParams: ReadonlyArray<PxVehicleSuspensionForceParams>;
        antiRollForceParams: ReadonlyArray<PxVehicleAntiRollForceParams>;
        nbAntiRollForceParams: number;
        tireForceParams: ReadonlyArray<PxVehicleTireForceParams>;
        wheelParams: ReadonlyArray<PxVehicleWheelParams>;
        rigidBodyParams: PxVehicleRigidBodyParams;
    }
    
    class BaseVehicleState {
        constructor();
        setToDefault(): void;
        brakeCommandResponseStates: ReadonlyArray<number>;
        steerCommandResponseStates: ReadonlyArray<number>;
        actuationStates: ReadonlyArray<PxVehicleWheelActuationState>;
        roadGeomStates: ReadonlyArray<PxVehicleRoadGeometryState>;
        suspensionStates: ReadonlyArray<PxVehicleSuspensionState>;
        suspensionComplianceStates: ReadonlyArray<PxVehicleSuspensionComplianceState>;
        suspensionForces: ReadonlyArray<PxVehicleSuspensionForce>;
        antiRollTorque: PxVehicleAntiRollTorque;
        tireGripStates: ReadonlyArray<PxVehicleTireGripState>;
        tireDirectionStates: ReadonlyArray<PxVehicleTireDirectionState>;
        tireSpeedStates: ReadonlyArray<PxVehicleTireSpeedState>;
        tireSlipStates: ReadonlyArray<PxVehicleTireSlipState>;
        tireCamberAngleStates: ReadonlyArray<PxVehicleTireCamberAngleState>;
        tireStickyStates: ReadonlyArray<PxVehicleTireStickyState>;
        tireForces: ReadonlyArray<PxVehicleTireForce>;
        wheelRigidBody1dStates: ReadonlyArray<PxVehicleWheelRigidBody1dState>;
        wheelLocalPoses: ReadonlyArray<PxVehicleWheelLocalPose>;
        rigidBodyState: PxVehicleRigidBodyState;
    }
    
    class BoxSupport extends Support {
        constructor(halfExtents: PxVec3, margin?: number);
        halfExtents: PxVec3;
        margin: number;
    }
    
    class CapsuleSupport extends Support {
        constructor(radius: number, halfHeight: number);
        radius: number;
        halfHeight: number;
    }
    
    class ConvexGeomSupport extends Support {
        constructor();
        constructor(geom: PxGeometry, margin?: number);
    }
    
    class ConvexMeshSupport extends Support {
        constructor(convexMesh: PxConvexMesh, scale?: PxVec3, scaleRotation?: PxQuat, margin?: number);
        scale: PxVec3;
        scaleRotation: PxQuat;
        margin: number;
    }
    
    class CustomSupport extends Support {
        getCustomMargin(): number;
        getCustomSupportLocal(dir: PxVec3, result: PxVec3): void;
    }
    
    class CustomSupportImpl {
        constructor();
        getCustomMargin(): number;
        getCustomSupportLocal(dir: PxVec3, result: PxVec3): void;
    }
    
    class DirectDriveVehicle extends PhysXActorVehicle {
        constructor();
        initialize(physics: PxPhysics, params: PxCookingParams, defaultMaterial: PxMaterial, addPhysXBeginEndComponents?: boolean): boolean;
        initComponentSequence(addPhysXBeginEndComponents: boolean): void;
        directDriveParams: DirectDrivetrainParams;
        directDriveState: DirectDrivetrainState;
        transmissionCommandState: PxVehicleDirectDriveTransmissionCommandState;
    }
    
    class DirectDrivetrainParams {
        constructor();
        transformAndScale(srcFrame: PxVehicleFrame, trgFrame: PxVehicleFrame, srcScale: PxVehicleScale, trgScale: PxVehicleScale): DirectDrivetrainParams;
        isValid(axleDesc: PxVehicleAxleDescription): boolean;
        directDriveThrottleResponseParams: PxVehicleDirectDriveThrottleCommandResponseParams;
    }
    
    class DirectDrivetrainState {
        constructor();
        setToDefault(): void;
        directDriveThrottleResponseStates: ReadonlyArray<number>;
    }
    
    class EngineDriveVehicle extends PhysXActorVehicle {
        constructor();
        initialize(physics: PxPhysics, params: PxCookingParams, defaultMaterial: PxMaterial, differentialType: EngineDriveVehicleEnum, addPhysXBeginEndComponents?: boolean): boolean;
        initComponentSequence(addPhysXBeginEndComponents: boolean): void;
        engineDriveParams: EngineDrivetrainParams;
        engineDriveState: EngineDrivetrainState;
        transmissionCommandState: PxVehicleEngineDriveTransmissionCommandState;
        tankDriveTransmissionCommandState: PxVehicleTankDriveTransmissionCommandState;
        differentialType: EngineDriveVehicleEnum;
    }
    
    class EngineDrivetrainParams {
        constructor();
        transformAndScale(srcFrame: PxVehicleFrame, trgFrame: PxVehicleFrame, srcScale: PxVehicleScale, trgScale: PxVehicleScale): EngineDrivetrainParams;
        isValid(axleDesc: PxVehicleAxleDescription): boolean;
        autoboxParams: PxVehicleAutoboxParams;
        clutchCommandResponseParams: PxVehicleClutchCommandResponseParams;
        engineParams: PxVehicleEngineParams;
        gearBoxParams: PxVehicleGearboxParams;
        multiWheelDifferentialParams: PxVehicleMultiWheelDriveDifferentialParams;
        fourWheelDifferentialParams: PxVehicleFourWheelDriveDifferentialParams;
        tankDifferentialParams: PxVehicleTankDriveDifferentialParams;
        clutchParams: PxVehicleClutchParams;
    }
    
    class EngineDrivetrainState {
        constructor();
        setToDefault(): void;
        throttleCommandResponseState: PxVehicleEngineDriveThrottleCommandResponseState;
        autoboxState: PxVehicleAutoboxState;
        clutchCommandResponseState: PxVehicleClutchCommandResponseState;
        differentialState: PxVehicleDifferentialState;
        wheelConstraintGroupState: PxVehicleWheelConstraintGroupState;
        engineState: PxVehicleEngineState;
        gearboxState: PxVehicleGearboxState;
        clutchState: PxVehicleClutchSlipState;
    }
    
    class NativeArrayHelpers {
        getU8At(base: PxU8ConstPtr, index: number): number;
        getU16At(base: PxU16ConstPtr, index: number): number;
        getU32At(base: PxU32ConstPtr, index: number): number;
        getRealAt(base: PxRealPtr, index: number): number;
        setU8At(base: unknown, index: number, value: number): void;
        setU16At(base: unknown, index: number, value: number): void;
        setU32At(base: unknown, index: number, value: number): void;
        setRealAt(base: unknown, index: number, value: number): void;
        voidToU8Ptr(voidPtr: unknown): PxU8Ptr;
        voidToU16Ptr(voidPtr: unknown): PxU16Ptr;
        voidToU32Ptr(voidPtr: unknown): PxU32Ptr;
        voidToI32Ptr(voidPtr: unknown): PxI32Ptr;
        voidToRealPtr(voidPtr: unknown): PxRealPtr;
        getActorAt(base: PxActor, index: number): PxActor;
        getBounds3At(base: PxBounds3, index: number): PxBounds3;
        getContactPairAt(base: PxContactPair, index: number): PxContactPair;
        getContactPairHeaderAt(base: PxContactPairHeader, index: number): PxContactPairHeader;
        getControllerAt(base: PxController, index: number): PxController;
        getControllerShapeHitAt(base: PxControllerShapeHit, index: number): PxControllerShapeHit;
        getControllersHitAt(base: PxControllersHit, index: number): PxControllersHit;
        getControllerObstacleHitAt(base: PxControllerObstacleHit, index: number): PxControllerObstacleHit;
        getDebugPointAt(base: PxDebugPoint, index: number): PxDebugPoint;
        getDebugLineAt(base: PxDebugLine, index: number): PxDebugLine;
        getDebugTriangleAt(base: PxDebugTriangle, index: number): PxDebugTriangle;
        getObstacleAt(base: PxObstacle, index: number): PxObstacle;
        getShapeAt(base: PxShape, index: number): PxShape;
        getTriggerPairAt(base: PxTriggerPair, index: number): PxTriggerPair;
        getVec3At(base: PxVec3, index: number): PxVec3;
    }
    
    class PassThroughFilterShader extends PxSimulationFilterShader {
        filterShader(attributes0: number, filterData0w0: number, filterData0w1: number, filterData0w2: number, filterData0w3: number, attributes1: number, filterData1w0: number, filterData1w1: number, filterData1w2: number, filterData1w3: number): number;
        outputPairFlags: number;
    }
    
    class PassThroughFilterShaderImpl {
        constructor();
        filterShader(attributes0: number, filterData0w0: number, filterData0w1: number, filterData0w2: number, filterData0w3: number, attributes1: number, filterData1w0: number, filterData1w1: number, filterData1w2: number, filterData1w3: number): number;
    }
    
    class PhysXActorVehicle extends BaseVehicle {
        initialize(physics: PxPhysics, params: PxCookingParams, defaultMaterial: PxMaterial): boolean;
        physXParams: PhysXIntegrationParams;
        physXState: PhysXIntegrationState;
        commandState: PxVehicleCommandState;
    }
    
    class PhysXIntegrationParams {
        constructor();
        transformAndScale(srcFrame: PxVehicleFrame, trgFrame: PxVehicleFrame, srcScale: PxVehicleScale, trgScale: PxVehicleScale): PhysXIntegrationParams;
        isValid(axleDesc: PxVehicleAxleDescription): boolean;
        create(axleDesc: PxVehicleAxleDescription, roadQueryFilterData: PxQueryFilterData, roadQueryFilterCallback: PxQueryFilterCallback, materialFrictions: PxVehiclePhysXMaterialFriction, nbMaterialFrictions: number, defaultFriction: number, physxActorCMassLocalPose: PxTransform, actorGeometry: PxGeometry, physxActorBoxShapeLocalPose: PxTransform, roadGeometryQueryType: PxVehiclePhysXRoadGeometryQueryTypeEnum): void;
        physxRoadGeometryQueryParams: PxVehiclePhysXRoadGeometryQueryParams;
        physxMaterialFrictionParams: ReadonlyArray<PxVehiclePhysXMaterialFrictionParams>;
        physxSuspensionLimitConstraintParams: ReadonlyArray<PxVehiclePhysXSuspensionLimitConstraintParams>;
        physxActorCMassLocalPose: PxTransform;
        physxActorGeometry: PxGeometry;
        physxActorBoxShapeLocalPose: PxTransform;
        physxWheelShapeLocalPoses: ReadonlyArray<PxTransform>;
        physxActorShapeFlags: PxShapeFlags;
        physxActorSimulationFilterData: PxFilterData;
        physxActorQueryFilterData: PxFilterData;
        physxActorWheelShapeFlags: PxShapeFlags;
        physxActorWheelSimulationFilterData: PxFilterData;
        physxActorWheelQueryFilterData: PxFilterData;
    }
    
    class PhysXIntegrationState {
        constructor();
        destroyState(): void;
        setToDefault(): void;
        create(baseParams: BaseVehicleParams, physxParams: PhysXIntegrationParams, physics: PxPhysics, params: PxCookingParams, defaultMaterial: PxMaterial): void;
        physxActor: PxVehiclePhysXActor;
        physxSteerState: PxVehiclePhysXSteerState;
        physxConstraints: PxVehiclePhysXConstraints;
    }
    
    class PxActor extends PxBase {
        getType(): PxActorTypeEnum;
        getScene(): PxScene;
        setName(name: string): void;
        getName(): string;
        getWorldBounds(inflation?: number): PxBounds3;
        setActorFlag(flag: PxActorFlagEnum, value: boolean): void;
        setActorFlags(flags: PxActorFlags): void;
        getActorFlags(): PxActorFlags;
        setDominanceGroup(dominanceGroup: number): void;
        getDominanceGroup(): number;
        setOwnerClient(inClient: number): void;
        getOwnerClient(): number;
        userData: unknown;
    }
    
    class PxActorFlags {
        constructor(flags: number);
        isSet(flag: PxActorFlagEnum): boolean;
        raise(flag: PxActorFlagEnum): void;
        clear(flag: PxActorFlagEnum): void;
    }
    
    class PxActorPtr {
    }
    
    class PxActorTypeFlags {
        constructor(flags: number);
        isSet(flag: PxActorTypeFlagEnum): boolean;
        raise(flag: PxActorTypeFlagEnum): void;
        clear(flag: PxActorTypeFlagEnum): void;
    }
    
    class PxAggregate extends PxBase {
        addActor(actor: PxActor, bvh?: PxBVH): boolean;
        removeActor(actor: PxActor): boolean;
        addArticulation(articulation: PxArticulationReducedCoordinate): boolean;
        removeArticulation(articulation: PxArticulationReducedCoordinate): boolean;
        getNbActors(): number;
        getMaxNbActors(): number;
        getMaxNbShapes(): number;
        getScene(): PxScene;
        getSelfCollision(): boolean;
    }
    
    class PxArray_PxActorPtr {
        constructor();
        constructor(size: number);
        get(index: number): PxActor;
        set(index: number, value: PxActorPtr): void;
        begin(): PxActorPtr;
        size(): number;
        pushBack(value: PxActor): void;
        clear(): void;
    }
    
    class PxArray_PxContactPairPoint {
        constructor();
        constructor(size: number);
        get(index: number): PxContactPairPoint;
        set(index: number, value: PxContactPairPoint): void;
        begin(): PxContactPairPoint;
        size(): number;
        pushBack(value: PxContactPairPoint): void;
        clear(): void;
    }
    
    class PxArray_PxHeightFieldSample {
        constructor();
        constructor(size: number);
        get(index: number): PxHeightFieldSample;
        set(index: number, value: PxHeightFieldSample): void;
        begin(): PxHeightFieldSample;
        size(): number;
        pushBack(value: PxHeightFieldSample): void;
        clear(): void;
    }
    
    class PxArray_PxMaterialConst {
        constructor();
        constructor(size: number);
        get(index: number): PxMaterial;
        set(index: number, value: PxMaterialConstPtr): void;
        begin(): PxMaterialConstPtr;
        size(): number;
        pushBack(value: PxMaterial): void;
        clear(): void;
    }
    
    class PxArray_PxRaycastHit {
        constructor();
        constructor(size: number);
        get(index: number): PxRaycastHit;
        set(index: number, value: PxRaycastHit): void;
        begin(): PxRaycastHit;
        size(): number;
        pushBack(value: PxRaycastHit): void;
        clear(): void;
    }
    
    class PxArray_PxReal {
        constructor();
        constructor(size: number);
        get(index: number): number;
        set(index: number, value: number): void;
        begin(): unknown;
        size(): number;
        pushBack(value: number): void;
        clear(): void;
    }
    
    class PxArray_PxShapePtr {
        constructor();
        constructor(size: number);
        get(index: number): PxShape;
        set(index: number, value: PxShapePtr): void;
        begin(): PxShapePtr;
        size(): number;
        pushBack(value: PxShape): void;
        clear(): void;
    }
    
    class PxArray_PxSweepHit {
        constructor();
        constructor(size: number);
        get(index: number): PxSweepHit;
        set(index: number, value: PxSweepHit): void;
        begin(): PxSweepHit;
        size(): number;
        pushBack(value: PxSweepHit): void;
        clear(): void;
    }
    
    class PxArray_PxU16 {
        constructor();
        constructor(size: number);
        get(index: number): number;
        set(index: number, value: number): void;
        begin(): unknown;
        size(): number;
        pushBack(value: number): void;
        clear(): void;
    }
    
    class PxArray_PxU32 {
        constructor();
        constructor(size: number);
        get(index: number): number;
        set(index: number, value: number): void;
        begin(): unknown;
        size(): number;
        pushBack(value: number): void;
        clear(): void;
    }
    
    class PxArray_PxU8 {
        constructor();
        constructor(size: number);
        get(index: number): number;
        set(index: number, value: number): void;
        begin(): unknown;
        size(): number;
        pushBack(value: number): void;
        setFromBuffer(buffer: unknown, size: number): void;
        clear(): void;
    }
    
    class PxArray_PxVec3 {
        constructor();
        constructor(size: number);
        get(index: number): PxVec3;
        set(index: number, value: PxVec3): void;
        begin(): PxVec3;
        size(): number;
        pushBack(value: PxVec3): void;
        clear(): void;
    }
    
    class PxArray_PxVec4 {
        constructor();
        constructor(size: number);
        get(index: number): PxVec4;
        set(index: number, value: PxVec4): void;
        begin(): PxVec4;
        size(): number;
        pushBack(value: PxVec4): void;
        clear(): void;
    }
    
    class PxArticulationAttachment {
        setRestLength(restLength: number): void;
        getRestLength(): number;
        setLimitParameters(parameters: PxArticulationTendonLimit): void;
        getLimitParameters(): PxArticulationTendonLimit;
        setRelativeOffset(offset: PxVec3): void;
        getRelativeOffset(): PxVec3;
        setCoefficient(coefficient: number): void;
        getCoefficient(): number;
        getLink(): PxArticulationLink;
        getParent(): PxArticulationAttachment;
        isLeaf(): boolean;
        getTendon(): PxArticulationSpatialTendon;
        release(): void;
        userData: unknown;
    }
    
    class PxArticulationCache {
        release(): void;
        externalForces: PxSpatialForce;
        denseJacobian: PxRealPtr;
        massMatrix: PxRealPtr;
        jointVelocity: PxRealPtr;
        jointAcceleration: PxRealPtr;
        jointPosition: PxRealPtr;
        jointForce: PxRealPtr;
        linkVelocity: PxSpatialVelocity;
        linkAcceleration: PxSpatialVelocity;
        linkIncomingJointForce: PxSpatialForce;
        rootLinkData: PxArticulationRootLinkData;
        coefficientMatrix: PxRealPtr;
        lambda: PxRealPtr;
        scratchMemory: unknown;
        scratchAllocator: unknown;
        version: number;
    }
    
    class PxArticulationCacheFlags {
        constructor(flags: number);
        isSet(flag: PxArticulationCacheFlagEnum): boolean;
        raise(flag: PxArticulationCacheFlagEnum): void;
        clear(flag: PxArticulationCacheFlagEnum): void;
    }
    
    class PxArticulationDrive {
        constructor();
        constructor(stiffness: number, damping: number, maxForce: number, driveType: PxArticulationDriveTypeEnum);
        stiffness: number;
        damping: number;
        maxForce: number;
        driveType: PxArticulationDriveTypeEnum;
    }
    
    class PxArticulationFixedTendon extends PxArticulationTendon {
        createTendonJoint(parent: PxArticulationTendonJoint, axis: PxArticulationAxisEnum, coefficient: number, recipCoefficient: number, link: PxArticulationLink): PxArticulationTendonJoint;
        getNbTendonJoints(): number;
        setRestLength(restLength: number): void;
        getRestLength(): number;
        setLimitParameters(parameter: PxArticulationTendonLimit): void;
        getLimitParameters(): PxArticulationTendonLimit;
    }
    
    class PxArticulationFlags {
        constructor(flags: number);
        isSet(flag: PxArticulationFlagEnum): boolean;
        raise(flag: PxArticulationFlagEnum): void;
        clear(flag: PxArticulationFlagEnum): void;
    }
    
    class PxArticulationJointReducedCoordinate extends PxBase {
        getParentArticulationLink(): PxArticulationLink;
        setParentPose(pose: PxTransform): void;
        getParentPose(): PxTransform;
        getChildArticulationLink(): PxArticulationLink;
        setChildPose(pose: PxTransform): void;
        getChildPose(): PxTransform;
        setJointType(jointType: PxArticulationJointTypeEnum): void;
        getJointType(): PxArticulationJointTypeEnum;
        setMotion(axis: PxArticulationAxisEnum, motion: PxArticulationMotionEnum): void;
        getMotion(axis: PxArticulationAxisEnum): PxArticulationMotionEnum;
        setLimitParams(axis: PxArticulationAxisEnum, limit: PxArticulationLimit): void;
        getLimitParams(axis: PxArticulationAxisEnum): PxArticulationLimit;
        setDriveParams(axis: PxArticulationAxisEnum, drive: PxArticulationDrive): void;
        setDriveTarget(axis: PxArticulationAxisEnum, target: number, autowake?: boolean): void;
        getDriveTarget(axis: PxArticulationAxisEnum): number;
        setDriveVelocity(axis: PxArticulationAxisEnum, targetVel: number, autowake?: boolean): void;
        getDriveVelocity(axis: PxArticulationAxisEnum): number;
        setArmature(axis: PxArticulationAxisEnum, armature: number): void;
        getArmature(axis: PxArticulationAxisEnum): number;
        setFrictionCoefficient(coefficient: number): void;
        getFrictionCoefficient(): number;
        setMaxJointVelocity(maxJointV: number): void;
        getMaxJointVelocity(): number;
        setJointPosition(axis: PxArticulationAxisEnum, jointPos: number): void;
        getJointPosition(axis: PxArticulationAxisEnum): number;
        setJointVelocity(axis: PxArticulationAxisEnum, jointVel: number): void;
        getJointVelocity(axis: PxArticulationAxisEnum): number;
    }
    
    class PxArticulationKinematicFlags {
        constructor(flags: number);
        isSet(flag: PxArticulationKinematicFlagEnum): boolean;
        raise(flag: PxArticulationKinematicFlagEnum): void;
        clear(flag: PxArticulationKinematicFlagEnum): void;
    }
    
    class PxArticulationLimit {
        constructor();
        constructor(low: number, high: number);
        low: number;
        high: number;
    }
    
    class PxArticulationLink extends PxRigidBody {
        getArticulation(): PxArticulationReducedCoordinate;
        getInboundJoint(): PxArticulationJointReducedCoordinate;
        getInboundJointDof(): number;
        getNbChildren(): number;
        getLinkIndex(): number;
        setCfmScale(cfm: number): void;
        getCfmScale(): number;
    }
    
    class PxArticulationReducedCoordinate extends PxBase {
        getScene(): PxScene;
        setSolverIterationCounts(minPositionIters: number, minVelocityIters?: number): void;
        isSleeping(): boolean;
        setSleepThreshold(threshold: number): void;
        getSleepThreshold(): number;
        setStabilizationThreshold(threshold: number): void;
        getStabilizationThreshold(): number;
        setWakeCounter(wakeCounterValue: number): void;
        getWakeCounter(): number;
        wakeUp(): void;
        putToSleep(): void;
        createLink(parent: PxArticulationLink, pose: PxTransform): PxArticulationLink;
        getNbLinks(): number;
        getNbShapes(): number;
        setName(name: string): void;
        getName(): string;
        getWorldBounds(inflation?: number): PxBounds3;
        getAggregate(): PxAggregate;
        setArticulationFlags(flags: PxArticulationFlags): void;
        setArticulationFlag(flag: PxArticulationFlagEnum, value: boolean): void;
        getArticulationFlags(): PxArticulationFlags;
        getDofs(): number;
        createCache(): PxArticulationCache;
        getCacheDataSize(): number;
        zeroCache(cache: PxArticulationCache): void;
        applyCache(cache: PxArticulationCache, flags: PxArticulationCacheFlags, autowake?: boolean): void;
        copyInternalStateToCache(cache: PxArticulationCache, flags: PxArticulationCacheFlags): void;
        commonInit(): void;
        computeGeneralizedGravityForce(cache: PxArticulationCache): void;
        computeGravityCompensation(cache: PxArticulationCache): void;
        computeCoriolisAndCentrifugalForce(cache: PxArticulationCache): void;
        computeCoriolisCompensation(cache: PxArticulationCache): void;
        computeGeneralizedExternalForce(cache: PxArticulationCache): void;
        computeJointAcceleration(cache: PxArticulationCache): void;
        computeJointForce(cache: PxArticulationCache): void;
        computeCoefficientMatrix(cache: PxArticulationCache): void;
        computeGeneralizedMassMatrix(cache: PxArticulationCache): void;
        computeMassMatrix(cache: PxArticulationCache): void;
        computeArticulationCOM(rootFrame: boolean): PxVec3;
        computeCentroidalMomentumMatrix(cache: PxArticulationCache): void;
        addLoopJoint(joint: PxConstraint): void;
        removeLoopJoint(joint: PxConstraint): void;
        getNbLoopJoints(): number;
        getCoefficientMatrixSize(): number;
        setRootGlobalPose(pose: PxTransform, autowake?: boolean): void;
        getRootGlobalPose(): PxTransform;
        setRootLinearVelocity(linearVelocity: PxVec3, autowake?: boolean): void;
        getRootLinearVelocity(): PxVec3;
        setRootAngularVelocity(angularVelocity: PxVec3, autowake?: boolean): void;
        getRootAngularVelocity(): PxVec3;
        getLinkAcceleration(linkId: number): PxSpatialVelocity;
        getGPUIndex(): number;
        createSpatialTendon(): PxArticulationSpatialTendon;
        createFixedTendon(): PxArticulationFixedTendon;
        getNbSpatialTendons(): number;
        getNbFixedTendons(): number;
        updateKinematic(flags: PxArticulationKinematicFlags): void;
    }
    
    class PxArticulationRootLinkData {
        constructor();
        transform: PxTransform;
        worldLinVel: PxVec3;
        worldAngVel: PxVec3;
        worldLinAccel: PxVec3;
        worldAngAccel: PxVec3;
    }
    
    class PxArticulationSpatialTendon extends PxArticulationTendon {
        createAttachment(parent: PxArticulationAttachment, coefficient: number, relativeOffset: PxVec3, link: PxArticulationLink): PxArticulationAttachment;
        getNbAttachments(): number;
    }
    
    class PxArticulationTendon extends PxBase {
        setStiffness(stiffness: number): void;
        getStiffness(): number;
        setDamping(damping: number): void;
        getDamping(): number;
        setLimitStiffness(stiffness: number): void;
        getLimitStiffness(): number;
        setOffset(offset: number, autowake?: boolean): void;
        getOffset(): number;
        getArticulation(): PxArticulationReducedCoordinate;
    }
    
    class PxArticulationTendonJoint {
        setCoefficient(axis: PxArticulationAxisEnum, coefficient: number, recipCoefficient: number): void;
        getLink(): PxArticulationLink;
        getParent(): PxArticulationTendonJoint;
        getTendon(): PxArticulationFixedTendon;
        release(): void;
        userData: unknown;
    }
    
    class PxArticulationTendonLimit {
        lowLimit: number;
        highLimit: number;
    }
    
    class PxBVH extends PxBase {
    }
    
    class PxBVH33MidphaseDesc {
        setToDefault(): void;
        isValid(): boolean;
        meshSizePerformanceTradeOff: number;
        meshCookingHint: PxMeshCookingHintEnum;
    }
    
    class PxBVH34MidphaseDesc {
        setToDefault(): void;
        isValid(): boolean;
        numPrimsPerLeaf: number;
    }
    
    class PxBase {
        release(): void;
        getConcreteTypeName(): string;
        getConcreteType(): number;
        setBaseFlag(flag: PxBaseFlagEnum, value: boolean): void;
        setBaseFlags(inFlags: PxBaseFlags): void;
        getBaseFlags(): PxBaseFlags;
        isReleasable(): boolean;
    }
    
    class PxBaseFlags {
        constructor(flags: number);
        isSet(flag: PxBaseFlagEnum): boolean;
        raise(flag: PxBaseFlagEnum): void;
        clear(flag: PxBaseFlagEnum): void;
    }
    
    class PxBaseMaterial extends PxRefCounted {
    }
    
    class PxBaseTask {
    }
    
    class PxBoundedData extends PxStridedData {
        constructor();
        count: number;
    }
    
    class PxBounds3 {
        constructor();
        constructor(minimum: PxVec3, maximum: PxVec3);
        setEmpty(): void;
        setMaximal(): void;
        include(v: PxVec3): void;
        isEmpty(): boolean;
        intersects(b: PxBounds3): boolean;
        intersects1D(b: PxBounds3, axis: number): boolean;
        contains(v: PxVec3): boolean;
        isInside(box: PxBounds3): boolean;
        getCenter(): PxVec3;
        getDimensions(): PxVec3;
        getExtents(): PxVec3;
        scaleSafe(scale: number): void;
        scaleFast(scale: number): void;
        fattenSafe(distance: number): void;
        fattenFast(distance: number): void;
        isFinite(): boolean;
        isValid(): boolean;
        minimum: PxVec3;
        maximum: PxVec3;
    }
    
    class PxBoxController extends PxController {
        getHalfHeight(): number;
        getHalfSideExtent(): number;
        getHalfForwardExtent(): number;
        setHalfHeight(halfHeight: number): boolean;
        setHalfSideExtent(halfSideExtent: number): boolean;
        setHalfForwardExtent(halfForwardExtent: number): boolean;
    }
    
    class PxBoxControllerDesc extends PxControllerDesc {
        constructor();
        setToDefault(): void;
        halfHeight: number;
        halfSideExtent: number;
        halfForwardExtent: number;
    }
    
    class PxBoxGeometry extends PxGeometry {
        constructor(hx: number, hy: number, hz: number);
        halfExtents: PxVec3;
    }
    
    class PxBoxObstacle extends PxObstacle {
        constructor();
        mHalfExtents: PxVec3;
    }
    
    class PxBroadPhaseCaps {
        constructor();
        mMaxNbRegions: number;
    }
    
    class PxBroadPhaseRegion {
        constructor();
        mBounds: PxBounds3;
        mUserData: unknown;
    }
    
    class PxBroadPhaseRegionInfo {
        constructor();
        mRegion: PxBroadPhaseRegion;
        mNbStaticObjects: number;
        mNbDynamicObjects: number;
        mActive: boolean;
        mOverlap: boolean;
    }
    
    class PxCapsuleController extends PxController {
        getRadius(): number;
        setRadius(radius: number): boolean;
        getHeight(): number;
        setHeight(height: number): boolean;
        getClimbingMode(): PxCapsuleClimbingModeEnum;
        setClimbingMode(mode: PxCapsuleClimbingModeEnum): boolean;
    }
    
    class PxCapsuleControllerDesc extends PxControllerDesc {
        constructor();
        setToDefault(): void;
        radius: number;
        height: number;
        climbingMode: PxCapsuleClimbingModeEnum;
    }
    
    class PxCapsuleGeometry extends PxGeometry {
        constructor(radius: number, halfHeight: number);
        radius: number;
        halfHeight: number;
    }
    
    class PxCapsuleObstacle extends PxObstacle {
        constructor();
        mHalfHeight: number;
        mRadius: number;
    }
    
    class PxCollection {
        add(obj: PxBase, id?: number): void;
        remove(obj: PxBase): void;
        contains(obj: PxBase): boolean;
        addId(obj: PxBase, id: number): void;
        removeId(id: number): void;
        getNbObjects(): number;
        getObject(index: number): PxBase;
        find(id: number): PxBase;
        getNbIds(): number;
        getId(obj: PxBase): number;
        release(): void;
    }
    
    class PxCollectionExt {
        static releaseObjects(collection: PxCollection, releaseExclusiveShapes?: boolean): void;
        static remove(collection: PxCollection, concreteType: number, to?: PxCollection): void;
        static createCollection(scene: PxScene): PxCollection;
    }
    
    class PxConstraint extends PxBase {
        getScene(): PxScene;
        setActors(actor0: PxRigidActor, actor1: PxRigidActor): void;
        markDirty(): void;
        setFlags(flags: PxConstraintFlags): void;
        getFlags(): PxConstraintFlags;
        setFlag(flag: PxConstraintFlagEnum, value: boolean): void;
        getForce(linear: PxVec3, angular: PxVec3): void;
        isValid(): boolean;
        setBreakForce(linear: number, angular: number): void;
        setMinResponseThreshold(threshold: number): void;
        getMinResponseThreshold(): number;
    }
    
    class PxConstraintConnector {
        prepareData(): void;
        updateOmniPvdProperties(): void;
        onConstraintRelease(): void;
        onComShift(actor: number): void;
        onOriginShift(shift: PxVec3): void;
        getSerializable(): PxBase;
        getPrep(): PxConstraintSolverPrep;
        getConstantBlock(): void;
        connectToConstraint(constraint: PxConstraint): void;
    }
    
    class PxConstraintFlags {
        constructor(flags: number);
        isSet(flag: PxConstraintFlagEnum): boolean;
        raise(flag: PxConstraintFlagEnum): void;
        clear(flag: PxConstraintFlagEnum): void;
    }
    
    class PxConstraintInfo {
        constraint: PxConstraint;
        externalReference: unknown;
        type: number;
    }
    
    class PxConstraintSolverPrep {
    }
    
    class PxContactBuffer {
        reset(): void;
        contact(worldPoint: PxVec3, worldNormalIn: PxVec3, separation: number, faceIndex1?: number): boolean;
        contact(pt: PxContactPoint): boolean;
        contacts: ReadonlyArray<PxContactPoint>;
        count: number;
        pad: number;
        static readonly MAX_CONTACTS: number;
    }
    
    class PxContactPair {
        extractContacts(userBuffer: PxContactPairPoint, bufferSize: number): number;
        shapes: ReadonlyArray<PxShape>;
        contactCount: number;
        patchCount: number;
        flags: PxContactPairFlags;
        events: PxPairFlags;
    }
    
    class PxContactPairFlags {
        constructor(flags: number);
        isSet(flag: PxContactPairFlagEnum): boolean;
        raise(flag: PxContactPairFlagEnum): void;
        clear(flag: PxContactPairFlagEnum): void;
    }
    
    class PxContactPairHeader {
        actors: ReadonlyArray<PxActor>;
        flags: PxContactPairHeaderFlags;
        pairs: PxContactPair;
        nbPairs: number;
    }
    
    class PxContactPairHeaderFlags {
        constructor(flags: number);
        isSet(flag: PxContactPairHeaderFlagEnum): boolean;
        raise(flag: PxContactPairHeaderFlagEnum): void;
        clear(flag: PxContactPairHeaderFlagEnum): void;
    }
    
    class PxContactPairPoint {
        position: PxVec3;
        separation: number;
        normal: PxVec3;
        internalFaceIndex0: number;
        impulse: PxVec3;
        internalFaceIndex1: number;
    }
    
    class PxContactPoint {
        constructor();
        normal: PxVec3;
        point: PxVec3;
        targetVel: PxVec3;
        separation: number;
        maxImpulse: number;
        staticFriction: number;
        materialFlags: number;
        internalFaceIndex1: number;
        dynamicFriction: number;
        restitution: number;
        damping: number;
    }
    
    class PxController {
        getType(): PxControllerShapeTypeEnum;
        release(): void;
        move(disp: PxVec3, minDist: number, elapsedTime: number, filters: PxControllerFilters, obstacles?: PxObstacleContext): PxControllerCollisionFlags;
        setPosition(position: PxExtendedVec3): boolean;
        getPosition(): PxExtendedVec3;
        setFootPosition(position: PxExtendedVec3): boolean;
        getFootPosition(): PxExtendedVec3;
        getActor(): PxRigidDynamic;
        setStepOffset(offset: number): void;
        getStepOffset(): number;
        setNonWalkableMode(flag: PxControllerNonWalkableModeEnum): void;
        getNonWalkableMode(): PxControllerNonWalkableModeEnum;
        getContactOffset(): number;
        setContactOffset(offset: number): void;
        getUpDirection(): PxVec3;
        setUpDirection(up: PxVec3): void;
        getSlopeLimit(): number;
        setSlopeLimit(slopeLimit: number): void;
        invalidateCache(): void;
        getScene(): PxScene;
        getUserData(): unknown;
        setUserData(userData: unknown): void;
        getState(state: PxControllerState): void;
        getStats(stats: PxControllerStats): void;
        resize(height: number): void;
    }
    
    class PxControllerBehaviorCallback {
    }
    
    class PxControllerBehaviorCallbackImpl {
        constructor();
        getShapeBehaviorFlags(shape: PxShape, actor: PxActor): number;
        getControllerBehaviorFlags(controller: PxController): number;
        getObstacleBehaviorFlags(obstacle: PxObstacle): number;
    }
    
    class PxControllerBehaviorFlags {
        constructor(flags: number);
        isSet(flag: PxControllerBehaviorFlagEnum): boolean;
        raise(flag: PxControllerBehaviorFlagEnum): void;
        clear(flag: PxControllerBehaviorFlagEnum): void;
    }
    
    class PxControllerCollisionFlags {
        constructor(flags: number);
        isSet(flag: PxControllerCollisionFlagEnum): boolean;
        raise(flag: PxControllerCollisionFlagEnum): void;
        clear(flag: PxControllerCollisionFlagEnum): void;
    }
    
    class PxControllerDesc {
        isValid(): boolean;
        getType(): PxControllerShapeTypeEnum;
        position: PxExtendedVec3;
        upDirection: PxVec3;
        slopeLimit: number;
        invisibleWallHeight: number;
        maxJumpHeight: number;
        contactOffset: number;
        stepOffset: number;
        density: number;
        scaleCoeff: number;
        volumeGrowth: number;
        reportCallback: PxUserControllerHitReport;
        behaviorCallback: PxControllerBehaviorCallback;
        nonWalkableMode: PxControllerNonWalkableModeEnum;
        material: PxMaterial;
        registerDeletionListener: boolean;
        userData: unknown;
    }
    
    class PxControllerFilterCallback {
        filter(a: PxController, b: PxController): boolean;
    }
    
    class PxControllerFilterCallbackImpl {
        constructor();
        filter(a: PxController, b: PxController): boolean;
    }
    
    class PxControllerFilters {
        constructor(filterData?: PxFilterData);
        mFilterData: PxFilterData;
        mFilterCallback: PxQueryFilterCallback;
        mFilterFlags: PxQueryFlags;
        mCCTFilterCallback: PxControllerFilterCallback;
    }
    
    class PxControllerHit {
        controller: PxController;
        worldPos: PxExtendedVec3;
        worldNormal: PxVec3;
        dir: PxVec3;
        length: number;
    }
    
    class PxControllerManager {
        release(): void;
        getScene(): PxScene;
        getNbControllers(): number;
        getController(index: number): PxController;
        createController(desc: PxControllerDesc): PxController;
        purgeControllers(): void;
        getNbObstacleContexts(): number;
        getObstacleContext(index: number): PxObstacleContext;
        createObstacleContext(): PxObstacleContext;
        computeInteractions(elapsedTime: number): void;
        setTessellation(flag: boolean, maxEdgeLength: number): void;
        setOverlapRecoveryModule(flag: boolean): void;
        setPreciseSweeps(flags: boolean): void;
        setPreventVerticalSlidingAgainstCeiling(flag: boolean): void;
        shiftOrigin(shift: PxVec3): void;
    }
    
    class PxControllerObstacleHit extends PxControllerHit {
        userData: unknown;
    }
    
    class PxControllerShapeHit extends PxControllerHit {
        shape: PxShape;
        actor: PxRigidActor;
        triangleIndex: number;
    }
    
    class PxControllerState {
        constructor();
        deltaXP: PxVec3;
        touchedShape: PxShape;
        touchedActor: PxRigidActor;
        touchedObstacleHandle: number;
        collisionFlags: number;
        standOnAnotherCCT: boolean;
        standOnObstacle: boolean;
        isMovingUp: boolean;
    }
    
    class PxControllerStats {
        nbIterations: number;
        nbFullUpdates: number;
        nbPartialUpdates: number;
        nbTessellation: number;
    }
    
    class PxControllersHit extends PxControllerHit {
        other: PxController;
    }
    
    class PxConvexFlags {
        constructor(flags: number);
        isSet(flag: PxConvexFlagEnum): boolean;
        raise(flag: PxConvexFlagEnum): void;
        clear(flag: PxConvexFlagEnum): void;
    }
    
    class PxConvexMesh extends PxRefCounted {
        getNbVertices(): number;
        getVertices(): PxVec3;
        getIndexBuffer(): PxU8ConstPtr;
        getNbPolygons(): number;
        getPolygonData(index: number, data: PxHullPolygon): boolean;
        getLocalBounds(): PxBounds3;
        isGpuCompatible(): boolean;
    }
    
    class PxConvexMeshDesc {
        constructor();
        points: PxBoundedData;
        flags: PxConvexFlags;
    }
    
    class PxConvexMeshGeometry extends PxGeometry {
        constructor(mesh: PxConvexMesh, scaling?: PxMeshScale, flags?: PxConvexMeshGeometryFlags);
        scale: PxMeshScale;
        convexMesh: PxConvexMesh;
        meshFlags: PxConvexMeshGeometryFlags;
    }
    
    class PxConvexMeshGeometryFlags {
        constructor(flags: number);
        isSet(flag: PxConvexMeshGeometryFlagEnum): boolean;
        raise(flag: PxConvexMeshGeometryFlagEnum): void;
        clear(flag: PxConvexMeshGeometryFlagEnum): void;
    }
    
    class PxCookingParams {
        constructor(sc: PxTolerancesScale);
        areaTestEpsilon: number;
        planeTolerance: number;
        convexMeshCookingType: PxConvexMeshCookingTypeEnum;
        suppressTriangleMeshRemapTable: boolean;
        buildTriangleAdjacencies: boolean;
        buildGPUData: boolean;
        scale: PxTolerancesScale;
        meshPreprocessParams: PxMeshPreprocessingFlags;
        meshWeldTolerance: number;
        midphaseDesc: PxMidphaseDesc;
        gaussMapLimit: number;
    }
    
    class PxCpuDispatcher {
    }
    
    class PxD6Joint extends PxJoint {
        setMotion(axis: PxD6AxisEnum, type: PxD6MotionEnum): void;
        getMotion(axis: PxD6AxisEnum): PxD6MotionEnum;
        getTwistAngle(): number;
        getSwingYAngle(): number;
        getSwingZAngle(): number;
        setDistanceLimit(limit: PxJointLinearLimit): void;
        setLinearLimit(axis: PxD6AxisEnum, limit: PxJointLinearLimitPair): void;
        setTwistLimit(limit: PxJointAngularLimitPair): void;
        setSwingLimit(limit: PxJointLimitCone): void;
        setPyramidSwingLimit(limit: PxJointLimitPyramid): void;
        setDrive(index: PxD6DriveEnum, drive: PxD6JointDrive): void;
        getDrive(index: PxD6DriveEnum): PxD6JointDrive;
        setDrivePosition(pose: PxTransform, autowake?: boolean): void;
        getDrivePosition(): PxTransform;
        setDriveVelocity(linear: PxVec3, angular: PxVec3): void;
        getDriveVelocity(linear: PxVec3, angular: PxVec3): void;
    }
    
    class PxD6JointDrive extends PxSpring {
        constructor();
        constructor(driveStiffness: number, driveDamping: number, driveForceLimit: number, isAcceleration?: boolean);
        forceLimit: number;
        flags: PxD6JointDriveFlags;
    }
    
    class PxD6JointDriveFlags {
        constructor(flags: number);
        isSet(flag: PxD6JointDriveFlagEnum): boolean;
        raise(flag: PxD6JointDriveFlagEnum): void;
        clear(flag: PxD6JointDriveFlagEnum): void;
    }
    
    class PxDebugLine {
        pos0: PxVec3;
        color0: number;
        pos1: PxVec3;
        color1: number;
    }
    
    class PxDebugPoint {
        pos: PxVec3;
        color: number;
    }
    
    class PxDebugTriangle {
        pos0: PxVec3;
        color0: number;
        pos1: PxVec3;
        color1: number;
        pos2: PxVec3;
        color2: number;
    }
    
    class PxDefaultAllocator {
        constructor();
    }
    
    class PxDefaultCpuDispatcher extends PxCpuDispatcher {
    }
    
    class PxDefaultErrorCallback extends PxErrorCallback {
        constructor();
    }
    
    class PxDefaultMemoryInputData extends PxInputData {
        constructor(data: PxU8Ptr, length: number);
        read(dest: unknown, count: number): number;
        getLength(): number;
        seek(pos: number): void;
        tell(): number;
    }
    
    class PxDefaultMemoryOutputStream extends PxOutputStream {
        constructor();
        write(src: unknown, count: number): void;
        getSize(): number;
        getData(): unknown;
    }
    
    class PxDistanceJoint extends PxJoint {
        getDistance(): number;
        setMinDistance(distance: number): void;
        getMinDistance(): number;
        setMaxDistance(distance: number): void;
        getMaxDistance(): number;
        setTolerance(tolerance: number): void;
        getTolerance(): number;
        setStiffness(stiffness: number): void;
        getStiffness(): number;
        setDamping(damping: number): void;
        getDamping(): number;
        setDistanceJointFlags(flags: PxDistanceJointFlags): void;
        setDistanceJointFlag(flag: PxDistanceJointFlagEnum, value: boolean): void;
        getDistanceJointFlags(): PxDistanceJointFlags;
    }
    
    class PxDistanceJointFlags {
        constructor(flags: number);
        isSet(flag: PxDistanceJointFlagEnum): boolean;
        raise(flag: PxDistanceJointFlagEnum): void;
        clear(flag: PxDistanceJointFlagEnum): void;
    }
    
    class PxDominanceGroupPair {
        constructor(a: number, b: number);
        dominance0: number;
        dominance1: number;
    }
    
    class PxErrorCallback {
        reportError(code: PxErrorCodeEnum, message: string, file: string, line: number): void;
    }
    
    class PxErrorCallbackImpl {
        constructor();
        reportError(code: PxErrorCodeEnum, message: string, file: string, line: number): void;
    }
    
    class PxExtendedVec3 {
        constructor();
        constructor(x: number, y: number, z: number);
        x: number;
        y: number;
        z: number;
    }
    
    class PxExtensionTopLevelFunctions {
        static CreatePlane(sdk: PxPhysics, plane: PxPlane, material: PxMaterial, filterData: PxFilterData): PxRigidStatic;
    }
    
    class PxFilterData {
        constructor();
        constructor(w0: number, w1: number, w2: number, w3: number);
        word0: number;
        word1: number;
        word2: number;
        word3: number;
    }
    
    class PxFixedJoint extends PxJoint {
    }
    
    class PxFoundation {
        release(): void;
    }
    
    class PxGearJoint extends PxJoint {
        setHinges(hinge0: PxBase, hinge1: PxBase): boolean;
        setGearRatio(ratio: number): void;
        getGearRatio(): number;
    }
    
    class PxGeomRaycastHit extends PxLocationHit {
        hadInitialOverlap(): boolean;
        u: number;
        v: number;
    }
    
    class PxGeomSweepHit extends PxLocationHit {
        hadInitialOverlap(): boolean;
    }
    
    class PxGeometry {
        getType(): PxGeometryTypeEnum;
    }
    
    class PxGeometryHolder {
        constructor();
        constructor(geometry: PxGeometry);
        getType(): PxGeometryTypeEnum;
        sphere(): PxSphereGeometry;
        plane(): PxPlaneGeometry;
        capsule(): PxCapsuleGeometry;
        box(): PxBoxGeometry;
        convexMesh(): PxConvexMeshGeometry;
        triangleMesh(): PxTriangleMeshGeometry;
        heightField(): PxHeightFieldGeometry;
        storeAny(geometry: PxGeometry): void;
    }
    
    class PxGeometryQuery {
        static sweep(unitDir: PxVec3, maxDist: number, geom0: PxGeometry, pose0: PxTransform, geom1: PxGeometry, pose1: PxTransform, sweepHit: PxSweepHit, hitFlags?: PxHitFlags, inflation?: number): boolean;
        static overlap(geom0: PxGeometry, pose0: PxTransform, geom1: PxGeometry, pose1: PxTransform): boolean;
        static raycast(origin: PxVec3, unitDir: PxVec3, geom: PxGeometry, pose: PxTransform, maxDist: number, hitFlags: PxHitFlags, maxHits: number, rayHits: PxRaycastHit): number;
        static pointDistance(point: PxVec3, geom: PxGeometry, pose: PxTransform, closestPoint?: PxVec3): number;
        static computeGeomBounds(bounds: PxBounds3, geom: PxGeometry, pose: PxTransform, inflation?: number): void;
        static isValid(geom: PxGeometry): boolean;
    }
    
    class PxGjkQuery {
        static proximityInfo(a: Support, b: Support, poseA: PxTransform, poseB: PxTransform, contactDistance: number, toleranceLength: number, result: PxGjkQueryProximityInfoResult): boolean;
        static raycast(shape: Support, pose: PxTransform, rayStart: PxVec3, unitDir: PxVec3, maxDist: number, result: PxGjkQueryRaycastResult): boolean;
        static overlap(a: Support, b: Support, poseA: PxTransform, poseB: PxTransform): boolean;
        static sweep(a: Support, b: Support, poseA: PxTransform, poseB: PxTransform, unitDir: PxVec3, maxDist: number, result: PxGjkQuerySweepResult): boolean;
    }
    
    class PxGjkQueryExt {
        static generateContacts(a: Support, b: Support, poseA: PxTransform, poseB: PxTransform, contactDistance: number, toleranceLength: number, contactBuffer: PxContactBuffer): boolean;
    }
    
    class PxGjkQueryProximityInfoResult {
        constructor();
        success: boolean;
        pointA: PxVec3;
        pointB: PxVec3;
        separatingAxis: PxVec3;
        separation: number;
    }
    
    class PxGjkQueryRaycastResult {
        constructor();
        success: boolean;
        t: number;
        n: PxVec3;
        p: PxVec3;
    }
    
    class PxGjkQuerySweepResult {
        constructor();
        success: boolean;
        t: number;
        n: PxVec3;
        p: PxVec3;
    }
    
    class PxHeightField extends PxRefCounted {
        saveCells(destBuffer: unknown, destBufferSize: number): number;
        modifySamples(startCol: number, startRow: number, subfieldDesc: PxHeightFieldDesc, shrinkBounds?: boolean): boolean;
        getNbRows(): number;
        getNbColumns(): number;
        getFormat(): PxHeightFieldFormatEnum;
        getSampleStride(): number;
        getConvexEdgeThreshold(): number;
        getFlags(): PxHeightFieldFlags;
        getHeight(x: number, z: number): number;
        getTriangleMaterialIndex(triangleIndex: number): number;
        getTriangleNormal(triangleIndex: number): PxVec3;
        getSample(row: number, column: number): PxHeightFieldSample;
        getTimestamp(): number;
    }
    
    class PxHeightFieldDesc {
        constructor();
        setToDefault(): void;
        isValid(): boolean;
        nbRows: number;
        nbColumns: number;
        format: PxHeightFieldFormatEnum;
        samples: PxStridedData;
        convexEdgeThreshold: number;
        flags: PxHeightFieldFlags;
    }
    
    class PxHeightFieldFlags {
        constructor(flags: number);
        isSet(flag: PxHeightFieldFlagEnum): boolean;
        raise(flag: PxHeightFieldFlagEnum): void;
        clear(flag: PxHeightFieldFlagEnum): void;
    }
    
    class PxHeightFieldGeometry extends PxGeometry {
        constructor();
        constructor(hf: PxHeightField, flags: PxMeshGeometryFlags, heightScale: number, rowScale: number, columnScale: number);
        isValid(): boolean;
        heightField: PxHeightField;
        heightScale: number;
        rowScale: number;
        columnScale: number;
        heightFieldFlags: PxMeshGeometryFlags;
    }
    
    class PxHeightFieldSample {
        constructor();
        tessFlag(): number;
        clearTessFlag(): void;
        setTessFlag(): void;
        height: number;
        materialIndex0: number;
        materialIndex1: number;
    }
    
    class PxHitFlags {
        constructor(flags: number);
        isSet(flag: PxHitFlagEnum): boolean;
        raise(flag: PxHitFlagEnum): void;
        clear(flag: PxHitFlagEnum): void;
    }
    
    class PxHullPolygon {
        constructor();
        mPlane: ReadonlyArray<number>;
        mNbVerts: number;
        mIndexBase: number;
    }
    
    class PxI32ConstPtr {
    }
    
    class PxI32Ptr extends PxI32ConstPtr {
    }
    
    class PxInputData {
    }
    
    class PxInsertionCallback {
    }
    
    class PxJoint extends PxBase {
        setActors(actor0: PxRigidActor, actor1: PxRigidActor): void;
        setLocalPose(actor: PxJointActorIndexEnum, localPose: PxTransform): void;
        getLocalPose(actor: PxJointActorIndexEnum): PxTransform;
        getRelativeTransform(): PxTransform;
        getRelativeLinearVelocity(): PxVec3;
        getRelativeAngularVelocity(): PxVec3;
        setBreakForce(force: number, torque: number): void;
        setConstraintFlags(flags: PxConstraintFlags): void;
        setConstraintFlag(flag: PxConstraintFlagEnum, value: boolean): void;
        getConstraintFlags(): PxConstraintFlags;
        setInvMassScale0(invMassScale: number): void;
        getInvMassScale0(): number;
        setInvMassScale1(invMassScale: number): void;
        getInvMassScale1(): number;
        getConstraint(): PxConstraint;
        setName(name: string): void;
        getName(): string;
        getScene(): PxScene;
        userData: unknown;
    }
    
    class PxJointAngularLimitPair extends PxJointLimitParameters {
        constructor(lowerLimit: number, upperLimit: number);
        constructor(lowerLimit: number, upperLimit: number, spring: PxSpring);
        upper: number;
        lower: number;
    }
    
    class PxJointLimitCone extends PxJointLimitParameters {
        constructor(yLimitAngle: number, zLimitAngle: number);
        constructor(yLimitAngle: number, zLimitAngle: number, spring: PxSpring);
        yAngle: number;
        zAngle: number;
    }
    
    class PxJointLimitParameters {
        isValid(): boolean;
        isSoft(): boolean;
        restitution: number;
        bounceThreshold: number;
        stiffness: number;
        damping: number;
    }
    
    class PxJointLimitPyramid extends PxJointLimitParameters {
        constructor(yLimitAngleMin: number, yLimitAngleMax: number, zLimitAngleMin: number, zLimitAngleMax: number);
        constructor(yLimitAngleMin: number, yLimitAngleMax: number, zLimitAngleMin: number, zLimitAngleMax: number, spring: PxSpring);
        yAngleMin: number;
        yAngleMax: number;
        zAngleMin: number;
        zAngleMax: number;
    }
    
    class PxJointLinearLimit extends PxJointLimitParameters {
        constructor(extent: number, spring: PxSpring);
        value: number;
    }
    
    class PxJointLinearLimitPair extends PxJointLimitParameters {
        constructor(lowerLimit: number, upperLimit: number, spring: PxSpring);
        upper: number;
        lower: number;
    }
    
    class PxLocationHit extends PxQueryHit {
        flags: PxHitFlags;
        position: PxVec3;
        normal: PxVec3;
        distance: number;
    }
    
    class PxMassProperties {
        constructor();
        constructor(m: number, inertiaT: PxMat33, com: PxVec3);
        constructor(geometry: PxGeometry);
        translate(t: PxVec3): void;
        static getMassSpaceInertia(inertia: PxMat33, massFrame: PxQuat): PxVec3;
        static translateInertia(inertia: PxMat33, mass: number, t: PxVec3): PxMat33;
        static rotateInertia(inertia: PxMat33, q: PxQuat): PxMat33;
        static scaleInertia(inertia: PxMat33, scaleRotation: PxQuat, scale: PxVec3): PxMat33;
        static sum(props: PxMassProperties, transforms: PxTransform, count: number): PxMassProperties;
        inertiaTensor: PxMat33;
        centerOfMass: PxVec3;
        mass: number;
    }
    
    class PxMat33 {
        constructor();
        constructor(r: PxIDENTITYEnum);
        constructor(col0: PxVec3, col1: PxVec3, col2: PxVec3);
        getTranspose(): PxMat33;
        getInverse(): PxMat33;
        getDeterminant(): number;
        transform(other: PxVec3): PxVec3;
        transformTranspose(other: PxVec3): PxVec3;
        column0: PxVec3;
        column1: PxVec3;
        column2: PxVec3;
    }
    
    class PxMaterial extends PxBaseMaterial {
        setDynamicFriction(coef: number): void;
        getDynamicFriction(): number;
        setStaticFriction(coef: number): void;
        getStaticFriction(): number;
        setRestitution(coef: number): void;
        getRestitution(): number;
        setFlag(flag: PxMaterialFlagEnum, b: boolean): void;
        setFlags(flags: PxMaterialFlags): void;
        getFlags(): PxMaterialFlags;
        setFrictionCombineMode(combMode: PxCombineModeEnum): void;
        getFrictionCombineMode(): PxCombineModeEnum;
        setRestitutionCombineMode(combMode: PxCombineModeEnum): void;
        getRestitutionCombineMode(): PxCombineModeEnum;
        userData: unknown;
    }
    
    class PxMaterialConstPtr {
    }
    
    class PxMaterialFlags {
        constructor(flags: number);
        isSet(flag: PxMaterialFlagEnum): boolean;
        raise(flag: PxMaterialFlagEnum): void;
        clear(flag: PxMaterialFlagEnum): void;
    }
    
    class PxMaterialPtr {
    }
    
    class PxMeshFlags {
        constructor(flags: number);
        isSet(flag: PxMeshFlagEnum): boolean;
        raise(flag: PxMeshFlagEnum): void;
        clear(flag: PxMeshFlagEnum): void;
    }
    
    class PxMeshGeometryFlags {
        constructor(flags: number);
        isSet(flag: PxMeshGeometryFlagEnum): boolean;
        raise(flag: PxMeshGeometryFlagEnum): void;
        clear(flag: PxMeshGeometryFlagEnum): void;
    }
    
    class PxMeshOverlapUtil {
        constructor();
        findOverlap(geom: PxGeometry, geomPose: PxTransform, meshGeom: PxTriangleMeshGeometry, meshPose: PxTransform): number;
        getResults(): PxU32ConstPtr;
        getNbResults(): number;
    }
    
    class PxMeshPreprocessingFlags {
        constructor(flags: number);
        isSet(flag: PxMeshPreprocessingFlagEnum): boolean;
        raise(flag: PxMeshPreprocessingFlagEnum): void;
        clear(flag: PxMeshPreprocessingFlagEnum): void;
    }
    
    class PxMeshScale {
        constructor();
        constructor(r: number);
        constructor(s: PxVec3, r: PxQuat);
    }
    
    class PxMidphaseDesc {
        constructor();
        getType(): PxMeshMidPhaseEnum;
        setToDefault(type: PxMeshMidPhaseEnum): void;
        isValid(): boolean;
        mBVH33Desc: PxBVH33MidphaseDesc;
        mBVH34Desc: PxBVH34MidphaseDesc;
    }
    
    class PxObstacle {
        getType(): PxGeometryTypeEnum;
        mUserData: unknown;
        mPos: PxExtendedVec3;
        mRot: PxQuat;
    }
    
    class PxObstacleContext {
        release(): void;
        getControllerManager(): PxControllerManager;
        addObstacle(obstacle: PxObstacle): number;
        removeObstacle(handle: number): boolean;
        updateObstacle(handle: number, obstacle: PxObstacle): boolean;
        getNbObstacles(): number;
        getObstacle(i: number): PxObstacle;
        getObstacleByHandle(handle: number): PxObstacle;
    }
    
    class PxOmniPvd {
        startSampling(): boolean;
        release(): void;
    }
    
    class PxOutputStream {
    }
    
    class PxOverlapBuffer10 extends PxOverlapCallback {
        constructor();
        getNbAnyHits(): number;
        getAnyHit(index: number): PxOverlapHit;
        getNbTouches(): number;
        getTouches(): PxOverlapHit;
        getTouch(index: number): PxOverlapHit;
        getMaxNbTouches(): number;
        block: PxOverlapHit;
        hasBlock: boolean;
    }
    
    class PxOverlapCallback {
        hasAnyHits(): boolean;
    }
    
    class PxOverlapHit extends PxQueryHit {
        actor: PxRigidActor;
        shape: PxShape;
    }
    
    class PxOverlapResult extends PxOverlapCallback {
        constructor();
        getNbAnyHits(): number;
        getAnyHit(index: number): PxOverlapHit;
        getNbTouches(): number;
        getTouch(index: number): PxOverlapHit;
        block: PxOverlapHit;
        hasBlock: boolean;
    }
    
    class PxPairFlags {
        constructor(flags: number);
        isSet(flag: PxPairFlagEnum): boolean;
        raise(flag: PxPairFlagEnum): void;
        clear(flag: PxPairFlagEnum): void;
    }
    
    class PxPhysics {
        release(): void;
        getFoundation(): PxFoundation;
        createAggregate(maxActor: number, maxShape: number, enableSelfCollision: boolean): PxAggregate;
        getTolerancesScale(): PxTolerancesScale;
        createScene(sceneDesc: PxSceneDesc): PxScene;
        createRigidStatic(pose: PxTransform): PxRigidStatic;
        createRigidDynamic(pose: PxTransform): PxRigidDynamic;
        createShape(geometry: PxGeometry, material: PxMaterial, isExclusive?: boolean, shapeFlags?: PxShapeFlags): PxShape;
        createTriangleMesh(stream: PxInputData): PxTriangleMesh;
        createConvexMesh(stream: PxInputData): PxConvexMesh;
        getNbShapes(): number;
        createArticulationReducedCoordinate(): PxArticulationReducedCoordinate;
        createMaterial(staticFriction: number, dynamicFriction: number, restitution: number): PxMaterial;
        getPhysicsInsertionCallback(): PxInsertionCallback;
    }
    
    class PxPlane {
        constructor();
        constructor(nx: number, ny: number, nz: number, distance: number);
        constructor(normal: PxVec3, distance: number);
        constructor(p0: PxVec3, p1: PxVec3, p2: PxVec3);
        distance(p: PxVec3): number;
        contains(p: PxVec3): boolean;
        project(p: PxVec3): PxVec3;
        pointInPlane(): PxVec3;
        normalize(): void;
        transform(pose: PxTransform): PxPlane;
        inverseTransform(pose: PxTransform): PxPlane;
        n: PxVec3;
        d: number;
    }
    
    class PxPlaneGeometry extends PxGeometry {
        constructor();
    }
    
    class PxPrismaticJoint extends PxJoint {
        getPosition(): number;
        getVelocity(): number;
        setLimit(limit: PxJointLinearLimitPair): void;
        setPrismaticJointFlags(flags: PxPrismaticJointFlags): void;
        setPrismaticJointFlag(flag: PxPrismaticJointFlagEnum, value: boolean): void;
        getPrismaticJointFlags(): PxPrismaticJointFlags;
    }
    
    class PxPrismaticJointFlags {
        constructor(flags: number);
        isSet(flag: PxPrismaticJointFlagEnum): boolean;
        raise(flag: PxPrismaticJointFlagEnum): void;
        clear(flag: PxPrismaticJointFlagEnum): void;
    }
    
    class PxPvd {
        connect(transport: PxPvdTransport, flags: PxPvdInstrumentationFlags): boolean;
        release(): void;
    }
    
    class PxPvdInstrumentationFlags {
        constructor(flags: number);
        isSet(flag: PxPvdInstrumentationFlagEnum): boolean;
        raise(flag: PxPvdInstrumentationFlagEnum): void;
        clear(flag: PxPvdInstrumentationFlagEnum): void;
    }
    
    class PxPvdTransport {
        connect(): boolean;
        isConnected(): boolean;
        disconnect(): void;
        release(): void;
        flush(): void;
    }
    
    class PxQuat {
        constructor();
        constructor(r: PxIDENTITYEnum);
        constructor(nx: number, ny: number, nz: number, nw: number);
        constructor(angleRadians: number, unitAxis: PxVec3);
        isIdentity(): boolean;
        isFinite(): boolean;
        isUnit(): boolean;
        isSane(): boolean;
        getAngle(): number;
        getAngle(q: PxQuat): number;
        magnitudeSquared(): number;
        dot(q: PxQuat): number;
        getNormalized(): PxQuat;
        magnitude(): number;
        normalize(): number;
        getConjugate(): PxQuat;
        getImaginaryPart(): PxVec3;
        getBasisVector0(): PxVec3;
        getBasisVector1(): PxVec3;
        getBasisVector2(): PxVec3;
        rotate(v: PxVec3): PxVec3;
        rotateInv(v: PxVec3): PxVec3;
        x: number;
        y: number;
        z: number;
        w: number;
    }
    
    class PxQueryFilterCallback {
    }
    
    class PxQueryFilterCallbackImpl {
        constructor();
        simplePreFilter(filterData: PxFilterData, shape: PxShape, actor: PxRigidActor, queryFlags: PxHitFlags): number;
        simplePostFilter(filterData: PxFilterData, hit: PxQueryHit, shape: PxShape, actor: PxRigidActor): number;
    }
    
    class PxQueryFilterData {
        constructor();
        constructor(fd: PxFilterData, f: PxQueryFlags);
        constructor(f: PxQueryFlags);
        data: PxFilterData;
        flags: PxQueryFlags;
    }
    
    class PxQueryFlags {
        constructor(flags: number);
        isSet(flag: PxQueryFlagEnum): boolean;
        raise(flag: PxQueryFlagEnum): void;
        clear(flag: PxQueryFlagEnum): void;
    }
    
    class PxQueryHit {
        faceIndex: number;
    }
    
    class PxRackAndPinionJoint extends PxJoint {
        setJoints(hinge: PxBase, prismatic: PxBase): boolean;
        setRatio(ratio: number): void;
        getRatio(): number;
        setData(nbRackTeeth: number, nbPinionTeeth: number, rackLength: number): boolean;
    }
    
    class PxRaycastBuffer10 extends PxRaycastCallback {
        constructor();
        getNbAnyHits(): number;
        getAnyHit(index: number): PxRaycastHit;
        getNbTouches(): number;
        getTouches(): PxRaycastHit;
        getTouch(index: number): PxRaycastHit;
        getMaxNbTouches(): number;
        block: PxRaycastHit;
        hasBlock: boolean;
    }
    
    class PxRaycastCallback {
        hasAnyHits(): boolean;
    }
    
    class PxRaycastHit extends PxGeomRaycastHit {
        constructor();
        actor: PxRigidActor;
        shape: PxShape;
    }
    
    class PxRaycastResult extends PxRaycastCallback {
        constructor();
        getNbAnyHits(): number;
        getAnyHit(index: number): PxRaycastHit;
        getNbTouches(): number;
        getTouch(index: number): PxRaycastHit;
        block: PxRaycastHit;
        hasBlock: boolean;
    }
    
    class PxRealConstPtr {
    }
    
    class PxRealPtr extends PxRealConstPtr {
    }
    
    class PxRefCounted extends PxBase {
        getReferenceCount(): number;
        acquireReference(): void;
    }
    
    class PxRenderBuffer {
        getNbPoints(): number;
        getPoints(): PxDebugPoint;
        addPoint(point: PxDebugPoint): void;
        getNbLines(): number;
        getLines(): PxDebugLine;
        addLine(line: PxDebugLine): void;
        reserveLines(nbLines: number): PxDebugLine;
        reservePoints(nbLines: number): PxDebugPoint;
        getNbTriangles(): number;
        getTriangles(): PxDebugTriangle;
        addTriangle(triangle: PxDebugTriangle): void;
        append(other: PxRenderBuffer): void;
        clear(): void;
        shift(delta: PxVec3): void;
        empty(): boolean;
    }
    
    class PxRevoluteJoint extends PxJoint {
        getAngle(): number;
        getVelocity(): number;
        setLimit(limits: PxJointAngularLimitPair): void;
        setDriveVelocity(velocity: number, autowake?: boolean): void;
        getDriveVelocity(): number;
        setDriveForceLimit(limit: number): void;
        getDriveForceLimit(): number;
        setDriveGearRatio(ratio: number): void;
        getDriveGearRatio(): number;
        setRevoluteJointFlags(flags: PxRevoluteJointFlags): void;
        setRevoluteJointFlag(flag: PxRevoluteJointFlagEnum, value: boolean): void;
        getRevoluteJointFlags(): PxRevoluteJointFlags;
    }
    
    class PxRevoluteJointFlags {
        constructor(flags: number);
        isSet(flag: PxRevoluteJointFlagEnum): boolean;
        raise(flag: PxRevoluteJointFlagEnum): void;
        clear(flag: PxRevoluteJointFlagEnum): void;
    }
    
    class PxRigidActor extends PxActor {
        getGlobalPose(): PxTransform;
        setGlobalPose(pose: PxTransform, autowake?: boolean): void;
        attachShape(shape: PxShape): boolean;
        detachShape(shape: PxShape, wakeOnLostTouch?: boolean): void;
        getNbShapes(): number;
        getShapes(userBuffer: PxShapePtr, bufferSize: number, startIndex: number): number;
        getNbConstraints(): number;
    }
    
    class PxRigidActorExt {
        static createExclusiveShape(actor: PxRigidActor, geometry: PxGeometry, material: PxMaterial, flags?: PxShapeFlags): PxShape;
    }
    
    class PxRigidBody extends PxRigidActor {
        setCMassLocalPose(pose: PxTransform): void;
        getCMassLocalPose(): PxTransform;
        setMass(mass: number): void;
        getMass(): number;
        getInvMass(): number;
        setMassSpaceInertiaTensor(m: PxVec3): void;
        getMassSpaceInertiaTensor(): PxVec3;
        getMassSpaceInvInertiaTensor(): PxVec3;
        setLinearDamping(linDamp: number): void;
        getLinearDamping(): number;
        setAngularDamping(angDamp: number): void;
        getAngularDamping(): number;
        getLinearVelocity(): PxVec3;
        getAngularVelocity(): PxVec3;
        setMaxLinearVelocity(maxLinVel: number): void;
        getMaxLinearVelocity(): number;
        setMaxAngularVelocity(maxAngVel: number): void;
        getMaxAngularVelocity(): number;
        addForce(force: PxVec3, mode?: PxForceModeEnum, autowake?: boolean): void;
        addTorque(torque: PxVec3, mode?: PxForceModeEnum, autowake?: boolean): void;
        clearForce(mode: PxForceModeEnum): void;
        clearTorque(mode: PxForceModeEnum): void;
        setForceAndTorque(force: PxVec3, torque: PxVec3, mode?: PxForceModeEnum): void;
        setRigidBodyFlag(flag: PxRigidBodyFlagEnum, value: boolean): void;
        setRigidBodyFlags(inFlags: PxRigidBodyFlags): void;
        getRigidBodyFlags(): PxRigidBodyFlags;
        setMinCCDAdvanceCoefficient(advanceCoefficient: number): void;
        getMinCCDAdvanceCoefficient(): number;
        setMaxDepenetrationVelocity(biasClamp: number): void;
        getMaxDepenetrationVelocity(): number;
        setMaxContactImpulse(maxImpulse: number): void;
        getMaxContactImpulse(): number;
        setContactSlopCoefficient(slopCoefficient: number): void;
        getContactSlopCoefficient(): number;
    }
    
    class PxRigidBodyExt {
        static updateMassAndInertia(body: PxRigidBody, density: number, massLocalPose?: PxVec3, includeNonSimShapes?: boolean): boolean;
        static setMassAndUpdateInertia(body: PxRigidBody, mass: number, massLocalPose?: PxVec3, includeNonSimShapes?: boolean): boolean;
        static addForceAtPos(body: PxRigidBody, force: PxVec3, pos: PxVec3, mode?: PxForceModeEnum, wakeup?: boolean): void;
        static addForceAtLocalPos(body: PxRigidBody, force: PxVec3, pos: PxVec3, mode?: PxForceModeEnum, wakeup?: boolean): void;
        static addLocalForceAtPos(body: PxRigidBody, force: PxVec3, pos: PxVec3, mode?: PxForceModeEnum, wakeup?: boolean): void;
        static addLocalForceAtLocalPos(body: PxRigidBody, force: PxVec3, pos: PxVec3, mode?: PxForceModeEnum, wakeup?: boolean): void;
        static getVelocityAtPos(body: PxRigidBody, pos: PxVec3): PxVec3;
        static getLocalVelocityAtLocalPos(body: PxRigidBody, pos: PxVec3): PxVec3;
        static getVelocityAtOffset(body: PxRigidBody, pos: PxVec3): PxVec3;
        static computeVelocityDeltaFromImpulse(body: PxRigidBody, impulsiveForce: PxVec3, impulsiveTorque: PxVec3, deltaLinearVelocity: PxVec3, deltaAngularVelocity: PxVec3): void;
        static computeVelocityDeltaFromImpulse(body: PxRigidBody, globalPose: PxTransform, point: PxVec3, impulse: PxVec3, invMassScale: number, invInertiaScale: number, deltaLinearVelocity: PxVec3, deltaAngularVelocity: PxVec3): void;
        static computeLinearAngularImpulse(body: PxRigidBody, globalPose: PxTransform, point: PxVec3, impulse: PxVec3, invMassScale: number, invInertiaScale: number, linearImpulse: PxVec3, angularImpulse: PxVec3): void;
    }
    
    class PxRigidBodyFlags {
        constructor(flags: number);
        isSet(flag: PxRigidBodyFlagEnum): boolean;
        raise(flag: PxRigidBodyFlagEnum): void;
        clear(flag: PxRigidBodyFlagEnum): void;
    }
    
    class PxRigidDynamic extends PxRigidBody {
        setKinematicTarget(destination: PxTransform): void;
        getKinematicTarget(target: PxTransform): boolean;
        isSleeping(): boolean;
        setSleepThreshold(threshold: number): void;
        getSleepThreshold(): number;
        setStabilizationThreshold(threshold: number): void;
        getStabilizationThreshold(): number;
        getRigidDynamicLockFlags(): PxRigidDynamicLockFlags;
        setRigidDynamicLockFlag(flag: PxRigidDynamicLockFlagEnum, value: boolean): void;
        setRigidDynamicLockFlags(flags: PxRigidDynamicLockFlags): void;
        setLinearVelocity(linVel: PxVec3, autowake?: boolean): void;
        setAngularVelocity(angVel: PxVec3, autowake?: boolean): void;
        setWakeCounter(wakeCounterValue: number): void;
        getWakeCounter(): number;
        wakeUp(): void;
        putToSleep(): void;
        setSolverIterationCounts(minPositionIters: number, minVelocityIters?: number): void;
        getContactReportThreshold(): number;
        setContactReportThreshold(threshold: number): void;
    }
    
    class PxRigidDynamicLockFlags {
        constructor(flags: number);
        isSet(flag: PxRigidDynamicLockFlagEnum): boolean;
        raise(flag: PxRigidDynamicLockFlagEnum): void;
        clear(flag: PxRigidDynamicLockFlagEnum): void;
    }
    
    class PxRigidStatic extends PxRigidActor {
    }
    
    class PxScene extends PxSceneSQSystem {
        addActor(actor: PxActor, bvh?: PxBVH): boolean;
        removeActor(actor: PxActor, wakeOnLostTouch?: boolean): void;
        addAggregate(aggregate: PxAggregate): boolean;
        removeAggregate(aggregate: PxAggregate, wakeOnLostTouch?: boolean): void;
        addCollection(collection: PxCollection): boolean;
        getWakeCounterResetValue(): number;
        shiftOrigin(shift: PxVec3): void;
        addArticulation(articulation: PxArticulationReducedCoordinate): boolean;
        removeArticulation(articulation: PxArticulationReducedCoordinate, wakeOnLostTouch?: boolean): void;
        getNbActors(types: PxActorTypeFlags): number;
        getNbArticulations(): number;
        getNbConstraints(): number;
        getNbAggregates(): number;
        setDominanceGroupPair(group1: number, group2: number, dominance: PxDominanceGroupPair): void;
        getCpuDispatcher(): PxCpuDispatcher;
        createClient(): number;
        setSimulationEventCallback(callback: PxSimulationEventCallback): void;
        getSimulationEventCallback(): PxSimulationEventCallback;
        setFilterShaderData(data: unknown, dataSize: number): void;
        getFilterShaderData(): unknown;
        getFilterShaderDataSize(): number;
        getFilterShader(): PxSimulationFilterShader;
        resetFiltering(actor: PxActor): boolean;
        getKinematicKinematicFilteringMode(): PxPairFilteringModeEnum;
        getStaticKinematicFilteringMode(): PxPairFilteringModeEnum;
        simulate(elapsedTime: number, completionTask?: PxBaseTask, scratchMemBlock?: unknown, scratchMemBlockSize?: number, controlSimulation?: boolean): boolean;
        advance(completionTask?: PxBaseTask): boolean;
        collide(elapsedTime: number, completionTask?: PxBaseTask, scratchMemBlock?: unknown, scratchMemBlockSize?: number, controlSimulation?: boolean): boolean;
        checkResults(block?: boolean): boolean;
        fetchCollision(block?: boolean): boolean;
        fetchResults(block?: boolean): boolean;
        processCallbacks(continuation: PxBaseTask): void;
        fetchResultsParticleSystem(): void;
        flushSimulation(sendPendingReports?: boolean): void;
        setGravity(vec: PxVec3): void;
        getGravity(): PxVec3;
        setBounceThresholdVelocity(t: number): void;
        getBounceThresholdVelocity(): number;
        setCCDMaxPasses(ccdMaxPasses: number): void;
        getCCDMaxPasses(): number;
        setCCDMaxSeparation(t: number): void;
        getCCDMaxSeparation(): number;
        setCCDThreshold(t: number): void;
        getCCDThreshold(): number;
        setMaxBiasCoefficient(t: number): void;
        getMaxBiasCoefficient(): number;
        setFrictionOffsetThreshold(t: number): void;
        getFrictionOffsetThreshold(): number;
        setFrictionCorrelationDistance(t: number): void;
        getFrictionCorrelationDistance(): number;
        getFrictionType(): PxFrictionTypeEnum;
        getSolverType(): PxSolverTypeEnum;
        getRenderBuffer(): PxRenderBuffer;
        setVisualizationParameter(param: PxVisualizationParameterEnum, value: number): boolean;
        getVisualizationParameter(paramEnum: PxVisualizationParameterEnum): number;
        setVisualizationCullingBox(box: PxBounds3): void;
        getVisualizationCullingBox(): PxBounds3;
        getSimulationStatistics(stats: PxSimulationStatistics): void;
        getBroadPhaseType(): PxBroadPhaseTypeEnum;
        getBroadPhaseCaps(caps: PxBroadPhaseCaps): boolean;
        getNbBroadPhaseRegions(): number;
        getBroadPhaseRegions(userBuffer: PxBroadPhaseRegionInfo, bufferSize: number, startIndex?: number): number;
        addBroadPhaseRegion(region: PxBroadPhaseRegion, populateRegion?: boolean): number;
        removeBroadPhaseRegion(handle: number): boolean;
        lockRead(file?: string, line?: number): void;
        unlockRead(): void;
        lockWrite(file?: string, line?: number): void;
        unlockWrite(): void;
        setNbContactDataBlocks(numBlocks: number): void;
        getNbContactDataBlocksUsed(): number;
        getMaxNbContactDataBlocksUsed(): number;
        getContactReportStreamBufferSize(): number;
        setSolverBatchSize(solverBatchSize: number): void;
        getSolverBatchSize(): number;
        setSolverArticulationBatchSize(solverBatchSize: number): void;
        getSolverArticulationBatchSize(): number;
        release(): void;
        setFlag(flag: PxSceneFlagEnum, value: boolean): void;
        getFlags(): PxSceneFlags;
        setLimits(limits: PxSceneLimits): void;
        getLimits(): PxSceneLimits;
        getPhysics(): PxPhysics;
        getTimestamp(): number;
        userData: unknown;
    }
    
    class PxSceneDesc {
        constructor(scale: PxTolerancesScale);
        setToDefault(scale: PxTolerancesScale): void;
        isValid(): boolean;
        gravity: PxVec3;
        simulationEventCallback: PxSimulationEventCallback;
        filterShaderData: unknown;
        filterShaderDataSize: number;
        filterShader: PxSimulationFilterShader;
        kineKineFilteringMode: PxPairFilteringModeEnum;
        staticKineFilteringMode: PxPairFilteringModeEnum;
        broadPhaseType: PxBroadPhaseTypeEnum;
        limits: PxSceneLimits;
        frictionType: PxFrictionTypeEnum;
        solverType: PxSolverTypeEnum;
        bounceThresholdVelocity: number;
        frictionOffsetThreshold: number;
        frictionCorrelationDistance: number;
        flags: PxSceneFlags;
        cpuDispatcher: PxCpuDispatcher;
        userData: unknown;
        solverBatchSize: number;
        solverArticulationBatchSize: number;
        nbContactDataBlocks: number;
        maxNbContactDataBlocks: number;
        maxBiasCoefficient: number;
        contactReportStreamBufferSize: number;
        ccdMaxPasses: number;
        ccdThreshold: number;
        ccdMaxSeparation: number;
        wakeCounterResetValue: number;
        sanityBounds: PxBounds3;
        gpuMaxNumPartitions: number;
        gpuMaxNumStaticPartitions: number;
        gpuComputeVersion: number;
        contactPairSlabSize: number;
        staticStructure: PxPruningStructureTypeEnum;
        dynamicStructure: PxPruningStructureTypeEnum;
        dynamicTreeRebuildRateHint: number;
        dynamicTreeSecondaryPruner: PxDynamicTreeSecondaryPrunerEnum;
        staticBVHBuildStrategy: PxBVHBuildStrategyEnum;
        dynamicBVHBuildStrategy: PxBVHBuildStrategyEnum;
        staticNbObjectsPerNode: number;
        dynamicNbObjectsPerNode: number;
        sceneQueryUpdateMode: PxSceneQueryUpdateModeEnum;
    }
    
    class PxSceneFlags {
        constructor(flags: number);
        isSet(flag: PxSceneFlagEnum): boolean;
        raise(flag: PxSceneFlagEnum): void;
        clear(flag: PxSceneFlagEnum): void;
    }
    
    class PxSceneLimits {
        constructor();
        setToDefault(): void;
        isValid(): boolean;
        maxNbActors: number;
        maxNbBodies: number;
        maxNbStaticShapes: number;
        maxNbDynamicShapes: number;
        maxNbAggregates: number;
        maxNbConstraints: number;
        maxNbRegions: number;
        maxNbBroadPhaseOverlaps: number;
    }
    
    class PxSceneQuerySystemBase {
        setDynamicTreeRebuildRateHint(dynamicTreeRebuildRateHint: number): void;
        getDynamicTreeRebuildRateHint(): number;
        forceRebuildDynamicTree(prunerIndex: number): void;
        setUpdateMode(updateMode: PxSceneQueryUpdateModeEnum): void;
        getUpdateMode(): PxSceneQueryUpdateModeEnum;
        getStaticTimestamp(): number;
        flushUpdates(): void;
        raycast(origin: PxVec3, unitDir: PxVec3, distance: number, hitCall: PxRaycastCallback, hitFlags?: PxHitFlags, filterData?: PxQueryFilterData): boolean;
        sweep(geometry: PxGeometry, pose: PxTransform, unitDir: PxVec3, distance: number, hitCall: PxSweepCallback, hitFlags?: PxHitFlags, filterData?: PxQueryFilterData): boolean;
        overlap(geometry: PxGeometry, pose: PxTransform, hitCall: PxOverlapCallback, filterData?: PxQueryFilterData): boolean;
    }
    
    class PxSceneSQSystem extends PxSceneQuerySystemBase {
        setSceneQueryUpdateMode(updateMode: PxSceneQueryUpdateModeEnum): void;
        getSceneQueryUpdateMode(): PxSceneQueryUpdateModeEnum;
        getSceneQueryStaticTimestamp(): number;
        flushQueryUpdates(): void;
        forceDynamicTreeRebuild(rebuildStaticStructure: boolean, rebuildDynamicStructure: boolean): void;
        getStaticStructure(): PxPruningStructureTypeEnum;
        getDynamicStructure(): PxPruningStructureTypeEnum;
        sceneQueriesUpdate(completionTask?: PxBaseTask, controlSimulation?: boolean): void;
        checkQueries(block?: boolean): boolean;
        fetchQueries(block?: boolean): boolean;
    }
    
    class PxSerialization {
        static isSerializable(collection: PxCollection, sr: PxSerializationRegistry, externalReferences?: PxCollection): boolean;
        static complete(collection: PxCollection, sr: PxSerializationRegistry, exceptFor?: PxCollection, followJoints?: boolean): void;
        static createSerialObjectIds(collection: PxCollection, base: number): void;
        static createCollectionFromXml(inputData: PxInputData, params: PxCookingParams, sr: PxSerializationRegistry, externalRefs?: PxCollection): PxCollection;
        static createCollectionFromBinary(memBlock: unknown, sr: PxSerializationRegistry, externalRefs?: PxCollection): PxCollection;
        static serializeCollectionToXml(outputStream: PxOutputStream, collection: PxCollection, sr: PxSerializationRegistry, params?: PxCookingParams, externalRefs?: PxCollection): boolean;
        static serializeCollectionToBinary(outputStream: PxOutputStream, collection: PxCollection, sr: PxSerializationRegistry, externalRefs?: PxCollection, exportNames?: boolean): boolean;
        static createSerializationRegistry(physics: PxPhysics): PxSerializationRegistry;
    }
    
    class PxSerializationRegistry {
        release(): void;
    }
    
    class PxShape extends PxRefCounted {
        setGeometry(geometry: PxGeometry): void;
        getGeometry(): PxGeometry;
        getActor(): PxRigidActor;
        setMaterials(materials: PxMaterialPtr, materialCount: number): void;
        getNbMaterials(): number;
        getMaterials(userBuffer: PxMaterialPtr, bufferSize: number, startIndex: number): number;
        getMaterialFromInternalFaceIndex(faceIndex: number): PxBaseMaterial;
        setContactOffset(contactOffset: number): void;
        getContactOffset(): number;
        setRestOffset(restOffset: number): void;
        getRestOffset(): number;
        setTorsionalPatchRadius(radius: number): void;
        getTorsionalPatchRadius(): number;
        setMinTorsionalPatchRadius(radius: number): void;
        getMinTorsionalPatchRadius(): number;
        setFlag(flag: PxShapeFlagEnum, value: boolean): void;
        setFlags(inFlags: PxShapeFlags): void;
        getFlags(): PxShapeFlags;
        isExclusive(): boolean;
        setName(name: string): void;
        getName(): string;
        setLocalPose(pose: PxTransform): void;
        getLocalPose(): PxTransform;
        setSimulationFilterData(data: PxFilterData): void;
        getSimulationFilterData(): PxFilterData;
        setQueryFilterData(data: PxFilterData): void;
        getQueryFilterData(): PxFilterData;
        userData: unknown;
    }
    
    class PxShapeExt {
        static getGlobalPose(shape: PxShape, actor: PxRigidActor): PxTransform;
        static raycast(shape: PxShape, actor: PxRigidActor, rayOrigin: PxVec3, rayDir: PxVec3, maxDist: number, hitFlags: PxHitFlags, maxHits: number, rayHits: PxRaycastHit): number;
        static overlap(shape: PxShape, actor: PxRigidActor, otherGeom: PxGeometry, otherGeomPose: PxTransform): boolean;
        static sweep(shape: PxShape, actor: PxRigidActor, unitDir: PxVec3, distance: number, otherGeom: PxGeometry, otherGeomPose: PxTransform, sweepHit: PxSweepHit, hitFlags: PxHitFlags): boolean;
        static getWorldBounds(shape: PxShape, actor: PxRigidActor, inflation?: number): PxBounds3;
    }
    
    class PxShapeFlags {
        constructor(flags: number);
        isSet(flag: PxShapeFlagEnum): boolean;
        raise(flag: PxShapeFlagEnum): void;
        clear(flag: PxShapeFlagEnum): void;
    }
    
    class PxShapePtr {
    }
    
    class PxSimpleTriangleMesh {
        constructor();
        setToDefault(): void;
        isValid(): boolean;
        points: PxBoundedData;
        triangles: PxBoundedData;
        flags: PxMeshFlags;
    }
    
    class PxSimulationEventCallback {
    }
    
    class PxSimulationEventCallbackImpl {
        constructor();
        onConstraintBreak(constraints: PxConstraintInfo, count: number): void;
        onWake(actors: PxActorPtr, count: number): void;
        onSleep(actors: PxActorPtr, count: number): void;
        onContact(pairHeader: PxContactPairHeader, pairs: PxContactPair, nbPairs: number): void;
        onTrigger(pairs: PxTriggerPair, count: number): void;
    }
    
    class PxSimulationFilterShader {
    }
    
    class PxSimulationStatistics {
        nbActiveConstraints: number;
        nbActiveDynamicBodies: number;
        nbActiveKinematicBodies: number;
        nbStaticBodies: number;
        nbDynamicBodies: number;
        nbKinematicBodies: number;
        nbShapes: ReadonlyArray<number>;
        nbAggregates: number;
        nbArticulations: number;
        nbAxisSolverConstraints: number;
        compressedContactSize: number;
        requiredContactConstraintMemory: number;
        peakConstraintMemory: number;
        nbDiscreteContactPairsTotal: number;
        nbDiscreteContactPairsWithCacheHits: number;
        nbDiscreteContactPairsWithContacts: number;
        nbNewPairs: number;
        nbLostPairs: number;
        nbNewTouches: number;
        nbLostTouches: number;
        nbPartitions: number;
        nbBroadPhaseAdds: number;
        nbBroadPhaseRemoves: number;
    }
    
    class PxSpatialForce {
        force: PxVec3;
        torque: PxVec3;
    }
    
    class PxSpatialVelocity {
        linear: PxVec3;
        angular: PxVec3;
    }
    
    class PxSphereGeometry extends PxGeometry {
        constructor(ir: number);
        radius: number;
    }
    
    class PxSphericalJoint extends PxJoint {
        setLimitCone(limitCone: PxJointLimitCone): void;
        getSwingYAngle(): number;
        getSwingZAngle(): number;
        setSphericalJointFlags(flags: PxSphericalJointFlags): void;
        setSphericalJointFlag(flag: PxSphericalJointFlagEnum, value: boolean): void;
        getSphericalJointFlags(): PxSphericalJointFlags;
    }
    
    class PxSphericalJointFlags {
        constructor(flags: number);
        isSet(flag: PxSphericalJointFlagEnum): boolean;
        raise(flag: PxSphericalJointFlagEnum): void;
        clear(flag: PxSphericalJointFlagEnum): void;
    }
    
    class PxSpring {
        constructor(stiffness: number, damping: number);
        stiffness: number;
        damping: number;
    }
    
    class PxStridedData {
        stride: number;
        data: unknown;
    }
    
    class PxSweepBuffer10 extends PxSweepCallback {
        constructor();
        getNbAnyHits(): number;
        getAnyHit(index: number): PxSweepHit;
        getNbTouches(): number;
        getTouches(): PxSweepHit;
        getTouch(index: number): PxSweepHit;
        getMaxNbTouches(): number;
        block: PxSweepHit;
        hasBlock: boolean;
    }
    
    class PxSweepCallback {
        hasAnyHits(): boolean;
    }
    
    class PxSweepHit extends PxGeomSweepHit {
        constructor();
        actor: PxRigidActor;
        shape: PxShape;
    }
    
    class PxSweepResult extends PxSweepCallback {
        constructor();
        getNbAnyHits(): number;
        getAnyHit(index: number): PxSweepHit;
        getNbTouches(): number;
        getTouch(index: number): PxSweepHit;
        block: PxSweepHit;
        hasBlock: boolean;
    }
    
    class PxTetMaker {
        static createConformingTetrahedronMesh(triangleMesh: PxSimpleTriangleMesh, outVertices: PxArray_PxVec3, outTetIndices: PxArray_PxU32, validate: boolean, volumeThreshold: number): boolean;
        static createVoxelTetrahedronMesh(tetMesh: PxTetrahedronMeshDesc, numVoxelsAlongLongestBoundingBoxAxis: number, outVertices: PxArray_PxVec3, outTetIndices: PxArray_PxU32): boolean;
        static createVoxelTetrahedronMeshFromEdgeLength(tetMesh: PxTetrahedronMeshDesc, voxelEdgeLength: number, outVertices: PxArray_PxVec3, outTetIndices: PxArray_PxU32): boolean;
        static validateTriangleMesh(triangleMesh: PxSimpleTriangleMesh, minVolumeThreshold: number, minTriangleAngleRadians: number): PxTriangleMeshAnalysisResults;
        static validateTetrahedronMesh(points: PxBoundedData, tetrahedra: PxBoundedData, minTetVolumeThreshold: number): PxTetrahedronMeshAnalysisResults;
        static simplifyTriangleMesh(inputVertices: PxArray_PxVec3, inputIndices: PxArray_PxU32, targetTriangleCount: number, maximalEdgeLength: number, outputVertices: PxArray_PxVec3, outputIndices: PxArray_PxU32, vertexMap?: PxArray_PxU32, edgeLengthCostWeight?: number, flatnessDetectionThreshold?: number, projectSimplifiedPointsOnInputMeshSurface?: boolean, outputVertexToInputTriangle?: PxArray_PxU32, removeDisconnectedPatches?: boolean): void;
        static remeshTriangleMesh(inputVertices: PxArray_PxVec3, inputIndices: PxArray_PxU32, gridResolution: number, outputVertices: PxArray_PxVec3, outputIndices: PxArray_PxU32, vertexMap?: PxArray_PxU32): void;
        static createTreeBasedTetrahedralMesh(inputVertices: PxArray_PxVec3, inputIndices: PxArray_PxU32, useTreeNodes: boolean, outputVertices: PxArray_PxVec3, outputIndices: PxArray_PxU32, volumeThreshold: number): void;
        static createRelaxedVoxelTetrahedralMesh(inputVertices: PxArray_PxVec3, inputIndices: PxArray_PxU32, outputVertices: PxArray_PxVec3, outputIndices: PxArray_PxU32, resolution: number, numRelaxationIterations?: number, relMinTetVolume?: number): void;
        static detectTriangleIslands(triangles: PxI32ConstPtr, numTriangles: number, islandIndexPerTriangle: PxArray_PxU32): void;
        static findLargestIslandId(islandIndexPerTriangle: PxU32ConstPtr, numTriangles: number): number;
    }
    
    class PxTetrahedronMesh extends PxRefCounted {
        getNbVertices(): number;
        getVertices(): PxVec3;
        getNbTetrahedrons(): number;
        getTetrahedrons(): unknown;
        getTetrahedronMeshFlags(): PxTetrahedronMeshFlags;
        getTetrahedraRemap(): PxU32ConstPtr;
        getLocalBounds(): PxBounds3;
    }
    
    class PxTetrahedronMeshAnalysisResults {
        constructor(flags: number);
        isSet(flag: PxTetrahedronMeshAnalysisResultEnum): boolean;
        raise(flag: PxTetrahedronMeshAnalysisResultEnum): void;
        clear(flag: PxTetrahedronMeshAnalysisResultEnum): void;
    }
    
    class PxTetrahedronMeshDesc {
        constructor();
        constructor(meshVertices: PxArray_PxVec3, meshTetIndices: PxArray_PxU32, meshFormat?: PxTetrahedronMeshFormatEnum, numberOfTetsPerHexElement?: number);
        isValid(): boolean;
        materialIndices: PxTypedBoundedData_PxU16;
        points: PxBoundedData;
        tetrahedrons: PxBoundedData;
        flags: PxMeshFlags;
        tetsPerElement: number;
    }
    
    class PxTetrahedronMeshExt {
        static findTetrahedronContainingPoint(mesh: PxTetrahedronMesh, point: PxVec3, bary: PxVec4, tolerance: number): number;
        static findTetrahedronClosestToPoint(mesh: PxTetrahedronMesh, point: PxVec3, bary: PxVec4): number;
        static createPointsToTetrahedronMap(tetMeshVertices: PxArray_PxVec3, tetMeshIndices: PxArray_PxU32, pointsToEmbed: PxArray_PxVec3, barycentricCoordinates: PxArray_PxVec4, tetLinks: PxArray_PxU32): void;
        static extractTetMeshSurface(mesh: PxTetrahedronMesh, surfaceTriangles: PxArray_PxU32, surfaceTriangleToTet?: PxArray_PxU32, flipTriangleOrientation?: boolean): void;
    }
    
    class PxTetrahedronMeshFlags {
        constructor(flags: number);
        isSet(flag: PxTetrahedronMeshFlagEnum): boolean;
        raise(flag: PxTetrahedronMeshFlagEnum): void;
        clear(flag: PxTetrahedronMeshFlagEnum): void;
    }
    
    class PxTetrahedronMeshGeometry extends PxGeometry {
        constructor(mesh: PxTetrahedronMesh);
        isValid(): boolean;
        tetrahedronMesh: PxTetrahedronMesh;
    }
    
    class PxTolerancesScale {
        constructor();
        isValid(): boolean;
        length: number;
        speed: number;
    }
    
    class PxTopLevelFunctions {
        static DefaultFilterShader(): PxSimulationFilterShader;
        static setupPassThroughFilterShader(sceneDesc: PxSceneDesc, filterShader: PassThroughFilterShader): void;
        static CreateControllerManager(scene: PxScene, lockingEnabled?: boolean): PxControllerManager;
        static CreateFoundation(version: number, allocator: PxDefaultAllocator, errorCallback: PxErrorCallback): PxFoundation;
        static CreatePhysics(version: number, foundation: PxFoundation, params: PxTolerancesScale, pvd?: PxPvd, omniPvd?: PxOmniPvd): PxPhysics;
        static DefaultCpuDispatcherCreate(numThreads: number): PxDefaultCpuDispatcher;
        static InitExtensions(physics: PxPhysics): boolean;
        static CloseExtensions(): void;
        static CreatePvd(foundation: PxFoundation): PxPvd;
        static D6JointCreate(physics: PxPhysics, actor0: PxRigidActor, localFrame0: PxTransform, actor1: PxRigidActor, localFrame1: PxTransform): PxD6Joint;
        static DistanceJointCreate(physics: PxPhysics, actor0: PxRigidActor, localFrame0: PxTransform, actor1: PxRigidActor, localFrame1: PxTransform): PxDistanceJoint;
        static FixedJointCreate(physics: PxPhysics, actor0: PxRigidActor, localFrame0: PxTransform, actor1: PxRigidActor, localFrame1: PxTransform): PxFixedJoint;
        static GearJointCreate(physics: PxPhysics, actor0: PxRigidActor, localFrame0: PxTransform, actor1: PxRigidActor, localFrame1: PxTransform): PxGearJoint;
        static PrismaticJointCreate(physics: PxPhysics, actor0: PxRigidActor, localFrame0: PxTransform, actor1: PxRigidActor, localFrame1: PxTransform): PxPrismaticJoint;
        static RackAndPinionJointCreate(physics: PxPhysics, actor0: PxRigidActor, localFrame0: PxTransform, actor1: PxRigidActor, localFrame1: PxTransform): PxRackAndPinionJoint;
        static RevoluteJointCreate(physics: PxPhysics, actor0: PxRigidActor, localFrame0: PxTransform, actor1: PxRigidActor, localFrame1: PxTransform): PxRevoluteJoint;
        static SphericalJointCreate(physics: PxPhysics, actor0: PxRigidActor, localFrame0: PxTransform, actor1: PxRigidActor, localFrame1: PxTransform): PxSphericalJoint;
        static CreateConvexMesh(params: PxCookingParams, desc: PxConvexMeshDesc): PxConvexMesh;
        static CreateTriangleMesh(params: PxCookingParams, desc: PxTriangleMeshDesc): PxTriangleMesh;
        static CreateHeightField(desc: PxHeightFieldDesc): PxHeightField;
        static CookTriangleMesh(params: PxCookingParams, desc: PxTriangleMeshDesc, stream: PxOutputStream): boolean;
        static CookConvexMesh(params: PxCookingParams, desc: PxConvexMeshDesc, stream: PxOutputStream): boolean;
        static CreateDynamicFromShape(sdk: PxPhysics, transform: PxTransform, shape: PxShape, density: number): PxRigidDynamic;
        static CreateDynamic(sdk: PxPhysics, transform: PxTransform, geometry: PxGeometry, material: PxMaterial, density: number, shapeOffset?: PxTransform): PxRigidDynamic;
        static CreateKinematicFromShape(sdk: PxPhysics, transform: PxTransform, shape: PxShape, density: number): PxRigidDynamic;
        static CreateKinematic(sdk: PxPhysics, transform: PxTransform, geometry: PxGeometry, material: PxMaterial, density: number, shapeOffset?: PxTransform): PxRigidDynamic;
        static CreateStaticFromShape(sdk: PxPhysics, transform: PxTransform, shape: PxShape): PxRigidStatic;
        static CreateStatic(sdk: PxPhysics, transform: PxTransform, geometry: PxGeometry, material: PxMaterial, shapeOffset: PxTransform): PxRigidStatic;
        static CreatePlane(sdk: PxPhysics, plane: PxPlane, material: PxMaterial): PxRigidStatic;
        static CloneShape(physics: PxPhysics, from: PxShape, isExclusive: boolean): PxShape;
        static CloneStatic(physicsSDK: PxPhysics, transform: PxTransform, from: PxRigidActor): PxRigidStatic;
        static CloneDynamic(physicsSDK: PxPhysics, transform: PxTransform, from: PxRigidDynamic): PxRigidDynamic;
        static ScaleRigidActor(actor: PxRigidActor, scale: number, scaleMassProps: boolean): void;
        static IntegrateTransform(curTrans: PxTransform, linvel: PxVec3, angvel: PxVec3, timeStep: number, result: PxTransform): void;
        static readonly PHYSICS_VERSION: number;
    }
    
    class PxTransform {
        constructor();
        constructor(r: PxIDENTITYEnum);
        constructor(p0: PxVec3, q0: PxQuat);
        getInverse(): PxTransform;
        transform(input: PxVec3): PxVec3;
        transformInv(input: PxVec3): PxVec3;
        isValid(): boolean;
        isSane(): boolean;
        isFinite(): boolean;
        getNormalized(): PxTransform;
        q: PxQuat;
        p: PxVec3;
    }
    
    class PxTriangle {
        constructor();
        constructor(p0: PxVec3, p1: PxVec3, p2: PxVec3);
        normal(normal: PxVec3): void;
        denormalizedNormal(normal: PxVec3): void;
        area(): number;
        pointFromUV(u: number, v: number): PxVec3;
    }
    
    class PxTriangleMesh extends PxRefCounted {
        getNbVertices(): number;
        getVertices(): PxVec3;
        getVerticesForModification(): PxVec3;
        refitBVH(): PxBounds3;
        getNbTriangles(): number;
        getTriangles(): unknown;
        getTriangleMeshFlags(): PxTriangleMeshFlags;
        getTrianglesRemap(): PxU32ConstPtr;
        getTriangleMaterialIndex(triangleIndex: number): number;
        getLocalBounds(): PxBounds3;
    }
    
    class PxTriangleMeshAnalysisResults {
        constructor(flags: number);
        isSet(flag: PxTriangleMeshAnalysisResultEnum): boolean;
        raise(flag: PxTriangleMeshAnalysisResultEnum): void;
        clear(flag: PxTriangleMeshAnalysisResultEnum): void;
    }
    
    class PxTriangleMeshDesc extends PxSimpleTriangleMesh {
        constructor();
        materialIndices: PxTypedBoundedData_PxU16Const;
    }
    
    class PxTriangleMeshFlags {
        constructor(flags: number);
        isSet(flag: PxTriangleMeshFlagEnum): boolean;
        raise(flag: PxTriangleMeshFlagEnum): void;
        clear(flag: PxTriangleMeshFlagEnum): void;
    }
    
    class PxTriangleMeshGeometry extends PxGeometry {
        constructor(mesh: PxTriangleMesh, scaling?: PxMeshScale, flags?: PxMeshGeometryFlags);
        isValid(): boolean;
        scale: PxMeshScale;
        meshFlags: PxMeshGeometryFlags;
        triangleMesh: PxTriangleMesh;
    }
    
    class PxTriggerPair {
        triggerShape: PxShape;
        triggerActor: PxActor;
        otherShape: PxShape;
        otherActor: PxActor;
        status: PxPairFlagEnum;
        flags: PxTriggerPairFlags;
    }
    
    class PxTriggerPairFlags {
        constructor(flags: number);
        isSet(flag: PxTriggerPairFlagEnum): boolean;
        raise(flag: PxTriggerPairFlagEnum): void;
        clear(flag: PxTriggerPairFlagEnum): void;
    }
    
    class PxTypedBoundedData_PxU16 {
        stride: number;
        data: PxU16Ptr;
    }
    
    class PxTypedBoundedData_PxU16Const {
        stride: number;
        data: PxU16ConstPtr;
    }
    
    class PxU16ConstPtr {
    }
    
    class PxU16Ptr extends PxU16ConstPtr {
    }
    
    class PxU32ConstPtr {
    }
    
    class PxU32Ptr extends PxU32ConstPtr {
    }
    
    class PxU8ConstPtr {
    }
    
    class PxU8Ptr extends PxU8ConstPtr {
    }
    
    class PxUserControllerHitReport {
        onShapeHit(hit: PxControllerShapeHit): void;
        onControllerHit(hit: PxControllersHit): void;
        onObstacleHit(hit: PxControllerObstacleHit): void;
    }
    
    class PxUserControllerHitReportImpl {
        constructor();
        onShapeHit(hit: PxControllerShapeHit): void;
        onControllerHit(hit: PxControllersHit): void;
        onObstacleHit(hit: PxControllerObstacleHit): void;
    }
    
    class PxVec3 {
        constructor();
        constructor(x: number, y: number, z: number);
        isZero(): boolean;
        isFinite(): boolean;
        isNormalized(): boolean;
        magnitudeSquared(): number;
        magnitude(): number;
        dot(v: PxVec3): number;
        cross(v: PxVec3): PxVec3;
        getNormalized(): PxVec3;
        normalize(): number;
        normalizeSafe(): number;
        normalizeFast(): number;
        multiply(a: PxVec3): PxVec3;
        minimum(v: PxVec3): PxVec3;
        minElement(): number;
        maximum(v: PxVec3): PxVec3;
        maxElement(): number;
        abs(): PxVec3;
        x: number;
        y: number;
        z: number;
    }
    
    class PxVec4 {
        constructor();
        constructor(x: number, y: number, z: number, w: number);
        isZero(): boolean;
        isFinite(): boolean;
        isNormalized(): boolean;
        magnitudeSquared(): number;
        magnitude(): number;
        dot(v: PxVec4): number;
        getNormalized(): PxVec4;
        normalize(): number;
        multiply(a: PxVec4): PxVec4;
        minimum(v: PxVec4): PxVec4;
        maximum(v: PxVec4): PxVec4;
        getXYZ(): PxVec3;
        x: number;
        y: number;
        z: number;
        w: number;
    }
    
    class PxVehicleAckermannParams {
        constructor();
        isValid(axleDesc: PxVehicleAxleDescription): boolean;
        transformAndScale(srcFrame: PxVehicleFrame, trgFrame: PxVehicleFrame, srcScale: PxVehicleScale, trgScale: PxVehicleScale): PxVehicleAckermannParams;
        wheelIds: ReadonlyArray<number>;
        wheelBase: number;
        trackWidth: number;
        strength: number;
    }
    
    class PxVehicleAntiRollForceParams {
        constructor();
        transformAndScale(srcFrame: PxVehicleFrame, trgFrame: PxVehicleFrame, srcScale: PxVehicleScale, trgScale: PxVehicleScale): PxVehicleAntiRollForceParams;
        isValid(axleDesc: PxVehicleAxleDescription): boolean;
        wheel0: number;
        wheel1: number;
        stiffness: number;
    }
    
    class PxVehicleAntiRollTorque {
        constructor();
        setToDefault(): void;
        antiRollTorque: PxVec3;
    }
    
    class PxVehicleAutoboxParams {
        constructor();
        transformAndScale(srcFrame: PxVehicleFrame, trgFrame: PxVehicleFrame, srcScale: PxVehicleScale, trgScale: PxVehicleScale): PxVehicleAutoboxParams;
        isValid(gearboxParams: PxVehicleGearboxParams): boolean;
        upRatios: ReadonlyArray<number>;
        downRatios: ReadonlyArray<number>;
        latency: number;
    }
    
    class PxVehicleAutoboxState {
        constructor();
        setToDefault(): void;
        timeSinceLastShift: number;
        activeAutoboxGearShift: boolean;
    }
    
    class PxVehicleAxleDescription {
        constructor();
        setToDefault(): void;
        getNbWheelsOnAxle(i: number): number;
        getWheelOnAxle(j: number, i: number): number;
        getAxle(wheelId: number): number;
        isValid(): boolean;
        nbAxles: number;
        nbWheelsPerAxle: ReadonlyArray<number>;
        axleToWheelIds: ReadonlyArray<number>;
        wheelIdsInAxleOrder: ReadonlyArray<number>;
        nbWheels: number;
    }
    
    class PxVehicleBrakeCommandResponseParams extends PxVehicleCommandResponseParams {
        constructor();
        transformAndScale(srcFrame: PxVehicleFrame, trgFrame: PxVehicleFrame, srcScale: PxVehicleScale, trgScale: PxVehicleScale): PxVehicleBrakeCommandResponseParams;
        isValid(axleDesc: PxVehicleAxleDescription): boolean;
    }
    
    class PxVehicleClutchCommandResponseParams {
        constructor();
        transformAndScale(srcFrame: PxVehicleFrame, trgFrame: PxVehicleFrame, srcScale: PxVehicleScale, trgScale: PxVehicleScale): PxVehicleClutchCommandResponseParams;
        isValid(): boolean;
        maxResponse: number;
    }
    
    class PxVehicleClutchCommandResponseState {
        constructor();
        setToDefault(): void;
        normalisedCommandResponse: number;
        commandResponse: number;
    }
    
    class PxVehicleClutchParams {
        constructor();
        transformAndScale(srcFrame: PxVehicleFrame, trgFrame: PxVehicleFrame, srcScale: PxVehicleScale, trgScale: PxVehicleScale): PxVehicleClutchParams;
        isValid(): boolean;
        accuracyMode: PxVehicleClutchAccuracyModeEnum;
        estimateIterations: number;
    }
    
    class PxVehicleClutchSlipState {
        constructor();
        setToDefault(): void;
        clutchSlip: number;
    }
    
    class PxVehicleCommandNonLinearResponseParams {
        constructor();
        clear(): void;
        addResponse(commandValueSpeedResponses: PxVehicleCommandValueResponseTable): boolean;
        speedResponses: ReadonlyArray<number>;
        nbSpeedResponses: number;
        speedResponsesPerCommandValue: ReadonlyArray<number>;
        nbSpeedResponsesPerCommandValue: ReadonlyArray<number>;
        commandValues: ReadonlyArray<number>;
        nbCommandValues: number;
    }
    
    class PxVehicleCommandResponseParams {
        constructor();
        nonlinearResponse: PxVehicleCommandNonLinearResponseParams;
        wheelResponseMultipliers: ReadonlyArray<number>;
        maxResponse: number;
    }
    
    class PxVehicleCommandState {
        constructor();
        setToDefault(): void;
        brakes: ReadonlyArray<number>;
        nbBrakes: number;
        throttle: number;
        steer: number;
    }
    
    class PxVehicleCommandValueResponseTable {
        constructor();
        commandValue: number;
    }
    
    class PxVehicleComponent {
    }
    
    class PxVehicleComponentSequence {
        constructor();
        add(component: PxVehicleComponent): boolean;
        beginSubstepGroup(nbSubSteps?: number): number;
        endSubstepGroup(): void;
        setSubsteps(subGroupHandle: number, nbSteps: number): void;
        update(dt: number, context: PxVehicleSimulationContext): void;
    }
    
    class PxVehicleConstraintConnector extends PxConstraintConnector {
        constructor();
        constructor(vehicleConstraintState: PxVehiclePhysXConstraintState);
        setConstraintState(constraintState: PxVehiclePhysXConstraintState): void;
        getConstantBlock(): void;
    }
    
    class PxVehicleDifferentialState {
        constructor();
        setToDefault(): void;
        connectedWheels: ReadonlyArray<number>;
        nbConnectedWheels: number;
        torqueRatiosAllWheels: ReadonlyArray<number>;
        aveWheelSpeedContributionAllWheels: ReadonlyArray<number>;
    }
    
    class PxVehicleDirectDriveThrottleCommandResponseParams extends PxVehicleCommandResponseParams {
        constructor();
        transformAndScale(srcFrame: PxVehicleFrame, trgFrame: PxVehicleFrame, srcScale: PxVehicleScale, trgScale: PxVehicleScale): PxVehicleDirectDriveThrottleCommandResponseParams;
        isValid(axleDesc: PxVehicleAxleDescription): boolean;
    }
    
    class PxVehicleDirectDriveTransmissionCommandState {
        constructor();
        setToDefault(): void;
        gear: PxVehicleDirectDriveTransmissionCommandStateEnum;
    }
    
    class PxVehicleEngineDriveThrottleCommandResponseState {
        constructor();
        setToDefault(): void;
        commandResponse: number;
    }
    
    class PxVehicleEngineDriveTransmissionCommandState {
        constructor();
        setToDefault(): void;
        clutch: number;
        targetGear: number;
    }
    
    class PxVehicleEngineParams {
        constructor();
        transformAndScale(srcFrame: PxVehicleFrame, trgFrame: PxVehicleFrame, srcScale: PxVehicleScale, trgScale: PxVehicleScale): PxVehicleEngineParams;
        isValid(): boolean;
        torqueCurve: PxVehicleTorqueCurveLookupTable;
        moi: number;
        peakTorque: number;
        idleOmega: number;
        maxOmega: number;
        dampingRateFullThrottle: number;
        dampingRateZeroThrottleClutchEngaged: number;
        dampingRateZeroThrottleClutchDisengaged: number;
    }
    
    class PxVehicleEngineState {
        constructor();
        setToDefault(): void;
        rotationSpeed: number;
    }
    
    class PxVehicleFixedSizeLookupTableFloat_3 {
        constructor();
        addPair(x: number, y: number): boolean;
        interpolate(x: number): number;
        clear(): void;
        isValid(): boolean;
    }
    
    class PxVehicleFixedSizeLookupTableVec3_3 {
        constructor();
        addPair(x: number, y: PxVec3): boolean;
        interpolate(x: number): PxVec3;
        clear(): void;
        isValid(): boolean;
    }
    
    class PxVehicleFourWheelDriveDifferentialParams extends PxVehicleMultiWheelDriveDifferentialParams {
        constructor();
        setToDefault(): void;
        transformAndScale(srcFrame: PxVehicleFrame, trgFrame: PxVehicleFrame, srcScale: PxVehicleScale, trgScale: PxVehicleScale): PxVehicleFourWheelDriveDifferentialParams;
        frontWheelIds: ReadonlyArray<number>;
        rearWheelIds: ReadonlyArray<number>;
        frontBias: number;
        frontTarget: number;
        rearBias: number;
        rearTarget: number;
        centerBias: number;
        centerTarget: number;
        rate: number;
    }
    
    class PxVehicleFrame {
        constructor();
        setToDefault(): void;
        getFrame(): PxMat33;
        isValid(): boolean;
        lngAxis: PxVehicleAxesEnum;
        latAxis: PxVehicleAxesEnum;
        vrtAxis: PxVehicleAxesEnum;
    }
    
    class PxVehicleGearboxParams {
        constructor();
        transformAndScale(srcFrame: PxVehicleFrame, trgFrame: PxVehicleFrame, srcScale: PxVehicleScale, trgScale: PxVehicleScale): PxVehicleGearboxParams;
        isValid(): boolean;
        neutralGear: number;
        ratios: ReadonlyArray<number>;
        finalRatio: number;
        nbRatios: number;
        switchTime: number;
    }
    
    class PxVehicleGearboxState {
        constructor();
        setToDefault(): void;
        currentGear: number;
        targetGear: number;
        gearSwitchTime: number;
    }
    
    class PxVehicleMultiWheelDriveDifferentialParams {
        constructor();
        setToDefault(): void;
        transformAndScale(srcFrame: PxVehicleFrame, trgFrame: PxVehicleFrame, srcScale: PxVehicleScale, trgScale: PxVehicleScale): PxVehicleMultiWheelDriveDifferentialParams;
        isValid(axleDesc: PxVehicleAxleDescription): boolean;
        torqueRatios: ReadonlyArray<number>;
        aveWheelSpeedRatios: ReadonlyArray<number>;
    }
    
    class PxVehiclePhysXActor {
        setToDefault(): void;
        rigidBody: PxRigidBody;
        wheelShapes: ReadonlyArray<PxShape>;
    }
    
    class PxVehiclePhysXConstraintState {
        constructor();
        setToDefault(): void;
        tireActiveStatus: ReadonlyArray<boolean>;
        tireLinears: ReadonlyArray<PxVec3>;
        tireAngulars: ReadonlyArray<PxVec3>;
        tireDamping: ReadonlyArray<number>;
        suspActiveStatus: boolean;
        suspLinear: PxVec3;
        suspAngular: PxVec3;
        suspGeometricError: number;
        restitution: number;
    }
    
    class PxVehiclePhysXConstraints {
        setToDefault(): void;
        constraintStates: ReadonlyArray<PxVehiclePhysXConstraintState>;
        constraints: ReadonlyArray<PxConstraint>;
        constraintConnectors: ReadonlyArray<PxVehicleConstraintConnector>;
    }
    
    class PxVehiclePhysXMaterialFriction {
        constructor();
        isValid(): boolean;
        material: PxMaterial;
        friction: number;
    }
    
    class PxVehiclePhysXMaterialFrictionParams {
        isValid(): boolean;
        materialFrictions: PxVehiclePhysXMaterialFriction;
        nbMaterialFrictions: number;
        defaultFriction: number;
    }
    
    class PxVehiclePhysXRoadGeometryQueryParams {
        transformAndScale(srcFrame: PxVehicleFrame, trgFrame: PxVehicleFrame, srcScale: PxVehicleScale, trgScale: PxVehicleScale): PxVehiclePhysXRoadGeometryQueryParams;
        isValid(): boolean;
        roadGeometryQueryType: PxVehiclePhysXRoadGeometryQueryTypeEnum;
        defaultFilterData: PxQueryFilterData;
        filterDataEntries: PxQueryFilterData;
        filterCallback: PxQueryFilterCallback;
    }
    
    class PxVehiclePhysXSimulationContext extends PxVehicleSimulationContext {
        constructor();
        transformAndScale(srcFrame: PxVehicleFrame, trgFrame: PxVehicleFrame, srcScale: PxVehicleScale, trgScale: PxVehicleScale): PxVehiclePhysXSimulationContext;
        physxUnitCylinderSweepMesh: PxConvexMesh;
        physxScene: PxScene;
        physxActorUpdateMode: PxVehiclePhysXActorUpdateModeEnum;
        physxActorWakeCounterResetValue: number;
        physxActorWakeCounterThreshold: number;
    }
    
    class PxVehiclePhysXSteerState {
        setToDefault(): void;
        previousSteerCommand: number;
    }
    
    class PxVehiclePhysXSuspensionLimitConstraintParams {
        transformAndScale(srcFrame: PxVehicleFrame, trgFrame: PxVehicleFrame, srcScale: PxVehicleScale, trgScale: PxVehicleScale): PxVehiclePhysXSuspensionLimitConstraintParams;
        isValid(): boolean;
        restitution: number;
        directionForSuspensionLimitConstraint: PxVehiclePhysXSuspensionLimitConstraintParamsDirectionSpecifierEnum;
    }
    
    class PxVehiclePvdContext {
    }
    
    class PxVehicleRigidBodyParams {
        constructor();
        transformAndScale(srcFrame: PxVehicleFrame, trgFrame: PxVehicleFrame, srcScale: PxVehicleScale, trgScale: PxVehicleScale): PxVehicleRigidBodyParams;
        isValid(): boolean;
        mass: number;
        moi: PxVec3;
    }
    
    class PxVehicleRigidBodyState {
        constructor();
        setToDefault(): void;
        getVerticalSpeed(frame: PxVehicleFrame): number;
        getLateralSpeed(frame: PxVehicleFrame): number;
        getLongitudinalSpeed(frame: PxVehicleFrame): number;
        pose: PxTransform;
        linearVelocity: PxVec3;
        angularVelocity: PxVec3;
        previousLinearVelocity: PxVec3;
        previousAngularVelocity: PxVec3;
        externalForce: PxVec3;
        externalTorque: PxVec3;
    }
    
    class PxVehicleRoadGeometryState {
        constructor();
        setToDefault(): void;
        plane: PxPlane;
        friction: number;
        velocity: PxVec3;
        hitState: boolean;
    }
    
    class PxVehicleScale {
        constructor();
        setToDefault(): void;
        isValid(): boolean;
        scale: number;
    }
    
    class PxVehicleSimulationContext {
        constructor();
        getType(): PxVehicleSimulationContextTypeEnum;
        setToDefault(): void;
        transformAndScale(srcFrame: PxVehicleFrame, trgFrame: PxVehicleFrame, srcScale: PxVehicleScale, trgScale: PxVehicleScale): PxVehicleSimulationContext;
        gravity: PxVec3;
        frame: PxVehicleFrame;
        scale: PxVehicleScale;
        tireSlipParams: PxVehicleTireSlipParams;
        tireStickyParams: PxVehicleTireStickyParams;
        thresholdForwardSpeedForWheelAngleIntegration: number;
        pvdContext: PxVehiclePvdContext;
    }
    
    class PxVehicleSteerCommandResponseParams extends PxVehicleCommandResponseParams {
        constructor();
        transformAndScale(srcFrame: PxVehicleFrame, trgFrame: PxVehicleFrame, srcScale: PxVehicleScale, trgScale: PxVehicleScale): PxVehicleSteerCommandResponseParams;
        isValid(axleDesc: PxVehicleAxleDescription): boolean;
    }
    
    class PxVehicleSuspensionComplianceParams {
        constructor();
        transformAndScale(srcFrame: PxVehicleFrame, trgFrame: PxVehicleFrame, srcScale: PxVehicleScale, trgScale: PxVehicleScale): PxVehicleSuspensionComplianceParams;
        isValid(): boolean;
        wheelToeAngle: PxVehicleFixedSizeLookupTableFloat_3;
        wheelCamberAngle: PxVehicleFixedSizeLookupTableFloat_3;
        suspForceAppPoint: PxVehicleFixedSizeLookupTableVec3_3;
        tireForceAppPoint: PxVehicleFixedSizeLookupTableVec3_3;
    }
    
    class PxVehicleSuspensionComplianceState {
        constructor();
        setToDefault(): void;
        toe: number;
        camber: number;
        tireForceAppPoint: PxVec3;
        suspForceAppPoint: PxVec3;
    }
    
    class PxVehicleSuspensionForce {
        constructor();
        setToDefault(): void;
        force: PxVec3;
        torque: PxVec3;
        normalForce: number;
    }
    
    class PxVehicleSuspensionForceParams {
        constructor();
        transformAndScale(srcFrame: PxVehicleFrame, trgFrame: PxVehicleFrame, srcScale: PxVehicleScale, trgScale: PxVehicleScale): PxVehicleSuspensionForceParams;
        isValid(): boolean;
        stiffness: number;
        damping: number;
        sprungMass: number;
    }
    
    class PxVehicleSuspensionParams {
        constructor();
        transformAndScale(srcFrame: PxVehicleFrame, trgFrame: PxVehicleFrame, srcScale: PxVehicleScale, trgScale: PxVehicleScale): PxVehicleSuspensionParams;
        isValid(): boolean;
        suspensionAttachment: PxTransform;
        suspensionTravelDir: PxVec3;
        suspensionTravelDist: number;
        wheelAttachment: PxTransform;
    }
    
    class PxVehicleSuspensionState {
        constructor();
        setToDefault(jounce: number, separation: number): void;
        jounce: number;
        jounceSpeed: number;
        separation: number;
    }
    
    class PxVehicleSuspensionStateCalculationParams {
        constructor();
        transformAndScale(srcFrame: PxVehicleFrame, trgFrame: PxVehicleFrame, srcScale: PxVehicleScale, trgScale: PxVehicleScale): PxVehicleSuspensionStateCalculationParams;
        isValid(): boolean;
        suspensionJounceCalculationType: PxVehicleSuspensionJounceCalculationTypeEnum;
        limitSuspensionExpansionVelocity: boolean;
    }
    
    class PxVehicleTankDriveDifferentialParams extends PxVehicleMultiWheelDriveDifferentialParams {
        constructor();
        setToDefault(): void;
        getNbWheelsInTrack(i: number): number;
        getWheelsInTrack(i: number): PxU32ConstPtr;
        getWheelInTrack(j: number, i: number): number;
        getThrustControllerIndex(i: number): number;
        transformAndScale(srcFrame: PxVehicleFrame, trgFrame: PxVehicleFrame, srcScale: PxVehicleScale, trgScale: PxVehicleScale): PxVehicleTankDriveDifferentialParams;
        nbTracks: number;
        thrustIdPerTrack: ReadonlyArray<number>;
        nbWheelsPerTrack: ReadonlyArray<number>;
        trackToWheelIds: ReadonlyArray<number>;
        wheelIdsInTrackOrder: ReadonlyArray<number>;
    }
    
    class PxVehicleTankDriveTransmissionCommandState extends PxVehicleEngineDriveTransmissionCommandState {
        constructor();
        setToDefault(): void;
        thrusts: ReadonlyArray<number>;
    }
    
    class PxVehicleTireAxisStickyParams {
        constructor();
        transformAndScale(srcFrame: PxVehicleFrame, trgFrame: PxVehicleFrame, srcScale: PxVehicleScale, trgScale: PxVehicleScale): PxVehicleTireAxisStickyParams;
        isValid(): boolean;
        thresholdSpeed: number;
        thresholdTime: number;
        damping: number;
    }
    
    class PxVehicleTireCamberAngleState {
        constructor();
        setToDefault(): void;
        camberAngle: number;
    }
    
    class PxVehicleTireDirectionState {
        constructor();
        setToDefault(): void;
        directions: ReadonlyArray<PxVec3>;
    }
    
    class PxVehicleTireForce {
        constructor();
        setToDefault(): void;
        forces: ReadonlyArray<PxVec3>;
        torques: ReadonlyArray<PxVec3>;
        aligningMoment: number;
        wheelTorque: number;
    }
    
    class PxVehicleTireForceParams {
        constructor();
        transformAndScale(srcFrame: PxVehicleFrame, trgFrame: PxVehicleFrame, srcScale: PxVehicleScale, trgScale: PxVehicleScale): PxVehicleTireForceParams;
        isValid(): boolean;
        latStiffX: number;
        latStiffY: number;
        longStiff: number;
        camberStiff: number;
        restLoad: number;
    }
    
    class PxVehicleTireForceParamsExt {
        static setFrictionVsSlip(tireForceParams: PxVehicleTireForceParams, i: number, j: number, value: number): void;
        static setLoadFilter(tireForceParams: PxVehicleTireForceParams, i: number, j: number, value: number): void;
    }
    
    class PxVehicleTireGripState {
        setToDefault(): void;
        load: number;
        friction: number;
    }
    
    class PxVehicleTireSlipParams {
        constructor();
        setToDefault(): void;
        transformAndScale(srcFrame: PxVehicleFrame, trgFrame: PxVehicleFrame, srcScale: PxVehicleScale, trgScale: PxVehicleScale): PxVehicleTireSlipParams;
        isValid(): boolean;
        minLatSlipDenominator: number;
        minPassiveLongSlipDenominator: number;
        minActiveLongSlipDenominator: number;
    }
    
    class PxVehicleTireSlipState {
        constructor();
        setToDefault(): void;
        slips: ReadonlyArray<number>;
    }
    
    class PxVehicleTireSpeedState {
        constructor();
        setToDefault(): void;
        speedStates: ReadonlyArray<number>;
    }
    
    class PxVehicleTireStickyParams {
        constructor();
        setToDefault(): void;
        transformAndScale(srcFrame: PxVehicleFrame, trgFrame: PxVehicleFrame, srcScale: PxVehicleScale, trgScale: PxVehicleScale): PxVehicleTireStickyParams;
        isValid(): boolean;
        stickyParams: ReadonlyArray<PxVehicleTireAxisStickyParams>;
    }
    
    class PxVehicleTireStickyState {
        constructor();
        setToDefault(): void;
        lowSpeedTime: ReadonlyArray<number>;
        activeStatus: ReadonlyArray<boolean>;
    }
    
    class PxVehicleTopLevelFunctions {
        static InitVehicleExtension(foundation: PxFoundation): boolean;
        static CloseVehicleExtension(): void;
        static VehicleComputeSprungMasses(nbSprungMasses: number, sprungMassCoordinates: PxArray_PxVec3, totalMass: number, gravityDirection: PxVehicleAxesEnum, sprungMasses: PxArray_PxReal): boolean;
        static VehicleUnitCylinderSweepMeshCreate(vehicleFrame: PxVehicleFrame, physics: PxPhysics, params: PxCookingParams): PxConvexMesh;
        static VehicleUnitCylinderSweepMeshDestroy(mesh: PxConvexMesh): void;
        static readonly MAX_NB_ENGINE_TORQUE_CURVE_ENTRIES: number;
    }
    
    class PxVehicleTorqueCurveLookupTable {
        constructor();
        addPair(x: number, y: number): boolean;
        interpolate(x: number): number;
        clear(): void;
        isValid(): boolean;
    }
    
    class PxVehicleWheelActuationState {
        constructor();
        setToDefault(): void;
        isBrakeApplied: boolean;
        isDriveApplied: boolean;
    }
    
    class PxVehicleWheelConstraintGroupState {
        constructor();
        setToDefault(): void;
        getNbConstraintGroups(): number;
        getNbWheelsInConstraintGroup(i: number): number;
        getWheelInConstraintGroup(j: number, i: number): number;
        getMultiplierInConstraintGroup(j: number, i: number): number;
        nbGroups: number;
        nbWheelsPerGroup: ReadonlyArray<number>;
        groupToWheelIds: ReadonlyArray<number>;
        wheelIdsInGroupOrder: ReadonlyArray<number>;
        wheelMultipliersInGroupOrder: ReadonlyArray<number>;
        nbWheelsInGroups: number;
    }
    
    class PxVehicleWheelLocalPose {
        constructor();
        setToDefault(): void;
        localPose: PxTransform;
    }
    
    class PxVehicleWheelParams {
        constructor();
        transformAndScale(srcFrame: PxVehicleFrame, trgFrame: PxVehicleFrame, srcScale: PxVehicleScale, trgScale: PxVehicleScale): PxVehicleWheelParams;
        isValid(): boolean;
        radius: number;
        halfWidth: number;
        mass: number;
        moi: number;
        dampingRate: number;
    }
    
    class PxVehicleWheelRigidBody1dState {
        constructor();
        setToDefault(): void;
        rotationSpeed: number;
        correctedRotationSpeed: number;
        rotationAngle: number;
    }
    
    class SimplPvdTransportImpl {
        constructor();
        connect(): boolean;
        isConnected(): boolean;
        disconnect(): void;
        send(inBytes: any, inLength: number): void;
        flush(): void;
    }
    
    class SimpleControllerBehaviorCallback extends PxControllerBehaviorCallback {
        getShapeBehaviorFlags(shape: PxShape, actor: PxActor): number;
        getControllerBehaviorFlags(controller: PxController): number;
        getObstacleBehaviorFlags(obstacle: PxObstacle): number;
    }
    
    class SimplePvdTransport extends PxPvdTransport {
        send(inBytes: any, inLength: number): void;
    }
    
    class SimpleQueryFilterCallback extends PxQueryFilterCallback {
        simplePreFilter(filterData: PxFilterData, shape: PxShape, actor: PxRigidActor, queryFlags: PxHitFlags): number;
        simplePostFilter(filterData: PxFilterData, hit: PxQueryHit, shape: PxShape, actor: PxRigidActor): number;
    }
    
    class SimpleSimulationEventCallback extends PxSimulationEventCallback {
        onConstraintBreak(constraints: PxConstraintInfo, count: number): void;
        onWake(actors: PxActorPtr, count: number): void;
        onSleep(actors: PxActorPtr, count: number): void;
        onContact(pairHeader: PxContactPairHeader, pairs: PxContactPair, nbPairs: number): void;
        onTrigger(pairs: PxTriggerPair, count: number): void;
    }
    
    class SphereSupport extends Support {
        constructor(radius: number);
        radius: number;
    }
    
    class Support {
        getMargin(): number;
        supportLocal(dir: PxVec3): PxVec3;
    }
    
    class SupportFunctions {
        static PxActor_getShape(actor: PxRigidActor, index: number): PxShape;
        static PxScene_getActiveActors(scene: PxScene): PxArray_PxActorPtr;
        static PxArticulationReducedCoordinate_getMinSolverPositionIterations(articulation: PxArticulationReducedCoordinate): number;
        static PxArticulationReducedCoordinate_getMinSolverVelocityIterations(articulation: PxArticulationReducedCoordinate): number;
    }
    
    class Vector_PxActorPtr {
        constructor();
        constructor(size: number);
        at(index: number): PxActor;
        data(): PxActorPtr;
        size(): number;
        push_back(value: PxActor): void;
        clear(): void;
    }
    
    class Vector_PxContactPairPoint {
        constructor();
        constructor(size: number);
        at(index: number): PxContactPairPoint;
        data(): PxContactPairPoint;
        size(): number;
        push_back(value: PxContactPairPoint): void;
        clear(): void;
    }
    
    class Vector_PxHeightFieldSample {
        constructor();
        constructor(size: number);
        at(index: number): PxHeightFieldSample;
        data(): PxHeightFieldSample;
        size(): number;
        push_back(value: PxHeightFieldSample): void;
        clear(): void;
    }
    
    class Vector_PxMaterialConst {
        constructor();
        constructor(size: number);
        at(index: number): PxMaterial;
        data(): PxMaterialConstPtr;
        size(): number;
        push_back(value: PxMaterial): void;
        clear(): void;
    }
    
    class Vector_PxRaycastHit {
        constructor();
        constructor(size: number);
        at(index: number): PxRaycastHit;
        data(): PxRaycastHit;
        size(): number;
        push_back(value: PxRaycastHit): void;
        clear(): void;
    }
    
    class Vector_PxReal {
        constructor();
        constructor(size: number);
        at(index: number): number;
        data(): unknown;
        size(): number;
        push_back(value: number): void;
        clear(): void;
    }
    
    class Vector_PxSweepHit {
        constructor();
        constructor(size: number);
        at(index: number): PxSweepHit;
        data(): PxSweepHit;
        size(): number;
        push_back(value: PxSweepHit): void;
        clear(): void;
    }
    
    class Vector_PxU16 {
        constructor();
        constructor(size: number);
        at(index: number): number;
        data(): unknown;
        size(): number;
        push_back(value: number): void;
        clear(): void;
    }
    
    class Vector_PxU32 {
        constructor();
        constructor(size: number);
        at(index: number): number;
        data(): unknown;
        size(): number;
        push_back(value: number): void;
        clear(): void;
    }
    
    class Vector_PxU8 {
        constructor();
        constructor(size: number);
        at(index: number): number;
        data(): unknown;
        size(): number;
        push_back(value: number): void;
        clear(): void;
    }
    
    class Vector_PxVec3 {
        constructor();
        constructor(size: number);
        at(index: number): PxVec3;
        data(): PxVec3;
        size(): number;
        push_back(value: PxVec3): void;
        clear(): void;
    }
    
    class Vector_PxVec4 {
        constructor();
        constructor(size: number);
        at(index: number): PxVec4;
        data(): PxVec4;
        size(): number;
        push_back(value: PxVec4): void;
        clear(): void;
    }
    enum EngineDriveVehicleEnum {
        'eDIFFTYPE_FOURWHEELDRIVE',
        'eDIFFTYPE_MULTIWHEELDRIVE',
        'eDIFFTYPE_TANKDRIVE',
    }
    enum PxActorFlagEnum {
        'eVISUALIZATION',
        'eDISABLE_GRAVITY',
        'eSEND_SLEEP_NOTIFIES',
        'eDISABLE_SIMULATION',
    }
    enum PxActorTypeEnum {
        'eRIGID_STATIC',
        'eRIGID_DYNAMIC',
        'eARTICULATION_LINK',
        'eDEFORMABLE_SURFACE',
        'eDEFORMABLE_VOLUME',
        'eSOFTBODY',
        'ePBD_PARTICLESYSTEM',
    }
    enum PxActorTypeFlagEnum {
        'eRIGID_STATIC',
        'eRIGID_DYNAMIC',
    }
    enum PxArticulationAxisEnum {
        'eTWIST',
        'eSWING1',
        'eSWING2',
        'eX',
        'eY',
        'eZ',
    }
    enum PxArticulationCacheFlagEnum {
        'eVELOCITY',
        'eACCELERATION',
        'ePOSITION',
        'eFORCE',
        'eLINK_VELOCITY',
        'eLINK_ACCELERATION',
        'eROOT_TRANSFORM',
        'eROOT_VELOCITIES',
        'eLINK_INCOMING_JOINT_FORCE',
        'eJOINT_TARGET_POSITIONS',
        'eJOINT_TARGET_VELOCITIES',
        'eALL',
    }
    enum PxArticulationDriveTypeEnum {
        'eFORCE',
        'eACCELERATION',
        'eNONE',
    }
    enum PxArticulationFlagEnum {
        'eFIX_BASE',
        'eDRIVE_LIMITS_ARE_FORCES',
        'eDISABLE_SELF_COLLISION',
    }
    enum PxArticulationJointTypeEnum {
        'eFIX',
        'ePRISMATIC',
        'eREVOLUTE',
        'eSPHERICAL',
        'eUNDEFINED',
    }
    enum PxArticulationKinematicFlagEnum {
        'ePOSITION',
        'eVELOCITY',
    }
    enum PxArticulationMotionEnum {
        'eLOCKED',
        'eLIMITED',
        'eFREE',
    }
    enum PxBVHBuildStrategyEnum {
        'eFAST',
        'eDEFAULT',
        'eSAH',
    }
    enum PxBaseFlagEnum {
        'eOWNS_MEMORY',
        'eIS_RELEASABLE',
    }
    enum PxBroadPhaseTypeEnum {
        'eSAP',
        'eMBP',
        'eABP',
        'ePABP',
        'eGPU',
    }
    enum PxCapsuleClimbingModeEnum {
        'eEASY',
        'eCONSTRAINED',
    }
    enum PxCombineModeEnum {
        'eAVERAGE',
        'eMIN',
        'eMULTIPLY',
        'eMAX',
    }
    enum PxConstraintFlagEnum {
        'eBROKEN',
        'eCOLLISION_ENABLED',
        'eVISUALIZATION',
        'eDRIVE_LIMITS_ARE_FORCES',
        'eIMPROVED_SLERP',
        'eDISABLE_PREPROCESSING',
        'eENABLE_EXTENDED_LIMITS',
        'eGPU_COMPATIBLE',
        'eALWAYS_UPDATE',
        'eDISABLE_CONSTRAINT',
    }
    enum PxContactPairFlagEnum {
        'eREMOVED_SHAPE_0',
        'eREMOVED_SHAPE_1',
        'eACTOR_PAIR_HAS_FIRST_TOUCH',
        'eACTOR_PAIR_LOST_TOUCH',
        'eINTERNAL_HAS_IMPULSES',
        'eINTERNAL_CONTACTS_ARE_FLIPPED',
    }
    enum PxContactPairHeaderFlagEnum {
        'eREMOVED_ACTOR_0',
        'eREMOVED_ACTOR_1',
    }
    enum PxControllerBehaviorFlagEnum {
        'eCCT_CAN_RIDE_ON_OBJECT',
        'eCCT_SLIDE',
        'eCCT_USER_DEFINED_RIDE',
    }
    enum PxControllerCollisionFlagEnum {
        'eCOLLISION_SIDES',
        'eCOLLISION_UP',
        'eCOLLISION_DOWN',
    }
    enum PxControllerNonWalkableModeEnum {
        'ePREVENT_CLIMBING',
        'ePREVENT_CLIMBING_AND_FORCE_SLIDING',
    }
    enum PxControllerShapeTypeEnum {
        'eBOX',
        'eCAPSULE',
    }
    enum PxConvexFlagEnum {
        'e16_BIT_INDICES',
        'eCOMPUTE_CONVEX',
        'eCHECK_ZERO_AREA_TRIANGLES',
        'eQUANTIZE_INPUT',
        'eDISABLE_MESH_VALIDATION',
        'ePLANE_SHIFTING',
        'eFAST_INERTIA_COMPUTATION',
        'eSHIFT_VERTICES',
    }
    enum PxConvexMeshCookingTypeEnum {
        'eQUICKHULL',
    }
    enum PxConvexMeshGeometryFlagEnum {
        'eTIGHT_BOUNDS',
    }
    enum PxD6AxisEnum {
        'eX',
        'eY',
        'eZ',
        'eTWIST',
        'eSWING1',
        'eSWING2',
    }
    enum PxD6DriveEnum {
        'eX',
        'eY',
        'eZ',
        'eSWING',
        'eTWIST',
        'eSLERP',
    }
    enum PxD6JointDriveFlagEnum {
        'eACCELERATION',
    }
    enum PxD6MotionEnum {
        'eLOCKED',
        'eLIMITED',
        'eFREE',
    }
    enum PxDebugColorEnum {
        'eARGB_BLACK',
        'eARGB_RED',
        'eARGB_GREEN',
        'eARGB_BLUE',
        'eARGB_YELLOW',
        'eARGB_MAGENTA',
        'eARGB_CYAN',
        'eARGB_WHITE',
        'eARGB_GREY',
        'eARGB_DARKRED',
        'eARGB_DARKGREEN',
        'eARGB_DARKBLUE',
    }
    enum PxDistanceJointFlagEnum {
        'eMAX_DISTANCE_ENABLED',
        'eMIN_DISTANCE_ENABLED',
        'eSPRING_ENABLED',
    }
    enum PxDynamicTreeSecondaryPrunerEnum {
        'eNONE',
        'eBUCKET',
        'eINCREMENTAL',
        'eBVH',
    }
    enum PxErrorCodeEnum {
        'eNO_ERROR',
        'eDEBUG_INFO',
        'eDEBUG_WARNING',
        'eINVALID_PARAMETER',
        'eINVALID_OPERATION',
        'eOUT_OF_MEMORY',
        'eINTERNAL_ERROR',
        'eABORT',
        'ePERF_WARNING',
        'eMASK_ALL',
    }
    enum PxFilterFlagEnum {
        'eKILL',
        'eSUPPRESS',
        'eCALLBACK',
        'eNOTIFY',
        'eDEFAULT',
    }
    enum PxFilterObjectFlagEnum {
        'eKINEMATIC',
        'eTRIGGER',
    }
    enum PxForceModeEnum {
        'eFORCE',
        'eIMPULSE',
        'eVELOCITY_CHANGE',
        'eACCELERATION',
    }
    enum PxFrictionTypeEnum {
        'ePATCH',
        'eFRICTION_COUNT',
    }
    enum PxGeometryTypeEnum {
        'eSPHERE',
        'ePLANE',
        'eCAPSULE',
        'eBOX',
        'eCONVEXMESH',
        'eTRIANGLEMESH',
        'eHEIGHTFIELD',
        'eCUSTOM',
    }
    enum PxHeightFieldFlagEnum {
        'eNO_BOUNDARY_EDGES',
    }
    enum PxHeightFieldFormatEnum {
        'eS16_TM',
    }
    enum PxHitFlagEnum {
        'ePOSITION',
        'eNORMAL',
        'eUV',
        'eASSUME_NO_INITIAL_OVERLAP',
        'eANY_HIT',
        'eMESH_MULTIPLE',
        'eMESH_BOTH_SIDES',
        'ePRECISE_SWEEP',
        'eMTD',
        'eFACE_INDEX',
        'eDEFAULT',
        'eMODIFIABLE_FLAGS',
    }
    enum PxIDENTITYEnum {
        'PxIdentity',
    }
    enum PxJointActorIndexEnum {
        'eACTOR0',
        'eACTOR1',
    }
    enum PxMaterialFlagEnum {
        'eDISABLE_FRICTION',
        'eDISABLE_STRONG_FRICTION',
        'eCOMPLIANT_ACCELERATION_SPRING',
    }
    enum PxMeshCookingHintEnum {
        'eSIM_PERFORMANCE',
        'eCOOKING_PERFORMANCE',
    }
    enum PxMeshFlagEnum {
        'eFLIPNORMALS',
        'e16_BIT_INDICES',
    }
    enum PxMeshGeometryFlagEnum {
        'eDOUBLE_SIDED',
    }
    enum PxMeshMidPhaseEnum {
        'eBVH33',
        'eBVH34',
    }
    enum PxMeshPreprocessingFlagEnum {
        'eWELD_VERTICES',
        'eDISABLE_CLEAN_MESH',
        'eDISABLE_ACTIVE_EDGES_PRECOMPUTE',
        'eFORCE_32BIT_INDICES',
    }
    enum PxPairFilteringModeEnum {
        'eKEEP',
        'eSUPPRESS',
        'eKILL',
        'eDEFAULT',
    }
    enum PxPairFlagEnum {
        'eSOLVE_CONTACT',
        'eMODIFY_CONTACTS',
        'eNOTIFY_TOUCH_FOUND',
        'eNOTIFY_TOUCH_PERSISTS',
        'eNOTIFY_TOUCH_LOST',
        'eNOTIFY_TOUCH_CCD',
        'eNOTIFY_THRESHOLD_FORCE_FOUND',
        'eNOTIFY_THRESHOLD_FORCE_PERSISTS',
        'eNOTIFY_THRESHOLD_FORCE_LOST',
        'eNOTIFY_CONTACT_POINTS',
        'eDETECT_DISCRETE_CONTACT',
        'eDETECT_CCD_CONTACT',
        'ePRE_SOLVER_VELOCITY',
        'ePOST_SOLVER_VELOCITY',
        'eCONTACT_EVENT_POSE',
        'eNEXT_FREE',
        'eCONTACT_DEFAULT',
        'eTRIGGER_DEFAULT',
    }
    enum PxPrismaticJointFlagEnum {
        'eLIMIT_ENABLED',
    }
    enum PxPruningStructureTypeEnum {
        'eNONE',
        'eDYNAMIC_AABB_TREE',
        'eSTATIC_AABB_TREE',
    }
    enum PxPvdInstrumentationFlagEnum {
        'eDEBUG',
        'ePROFILE',
        'eMEMORY',
        'eALL',
    }
    enum PxQueryFlagEnum {
        'eSTATIC',
        'eDYNAMIC',
        'ePREFILTER',
        'ePOSTFILTER',
        'eANY_HIT',
        'eNO_BLOCK',
    }
    enum PxQueryHitType {
        'eNONE',
        'eBLOCK',
        'eTOUCH',
    }
    enum PxRevoluteJointFlagEnum {
        'eLIMIT_ENABLED',
        'eDRIVE_ENABLED',
        'eDRIVE_FREESPIN',
    }
    enum PxRigidBodyFlagEnum {
        'eKINEMATIC',
        'eUSE_KINEMATIC_TARGET_FOR_SCENE_QUERIES',
        'eENABLE_CCD',
        'eENABLE_CCD_FRICTION',
        'eENABLE_POSE_INTEGRATION_PREVIEW',
        'eENABLE_SPECULATIVE_CCD',
        'eENABLE_CCD_MAX_CONTACT_IMPULSE',
        'eRETAIN_ACCELERATIONS',
    }
    enum PxRigidDynamicLockFlagEnum {
        'eLOCK_LINEAR_X',
        'eLOCK_LINEAR_Y',
        'eLOCK_LINEAR_Z',
        'eLOCK_ANGULAR_X',
        'eLOCK_ANGULAR_Y',
        'eLOCK_ANGULAR_Z',
    }
    enum PxSceneFlagEnum {
        'eENABLE_ACTIVE_ACTORS',
        'eENABLE_CCD',
        'eDISABLE_CCD_RESWEEP',
        'eENABLE_PCM',
        'eDISABLE_CONTACT_REPORT_BUFFER_RESIZE',
        'eDISABLE_CONTACT_CACHE',
        'eREQUIRE_RW_LOCK',
        'eENABLE_STABILIZATION',
        'eENABLE_AVERAGE_POINT',
        'eEXCLUDE_KINEMATICS_FROM_ACTIVE_ACTORS',
        'eENABLE_GPU_DYNAMICS',
        'eENABLE_ENHANCED_DETERMINISM',
        'eENABLE_FRICTION_EVERY_ITERATION',
        'eENABLE_DIRECT_GPU_API',
        'eMUTABLE_FLAGS',
    }
    enum PxSceneQueryUpdateModeEnum {
        'eBUILD_ENABLED_COMMIT_ENABLED',
        'eBUILD_ENABLED_COMMIT_DISABLED',
        'eBUILD_DISABLED_COMMIT_DISABLED',
    }
    enum PxShapeFlagEnum {
        'eSIMULATION_SHAPE',
        'eSCENE_QUERY_SHAPE',
        'eTRIGGER_SHAPE',
        'eVISUALIZATION',
    }
    enum PxSolverTypeEnum {
        'ePGS',
        'eTGS',
    }
    enum PxSphericalJointFlagEnum {
        'eLIMIT_ENABLED',
    }
    enum PxTetrahedronMeshAnalysisResultEnum {
        'eVALID',
        'eDEGENERATE_TETRAHEDRON',
        'eMESH_IS_PROBLEMATIC',
        'eMESH_IS_INVALID',
    }
    enum PxTetrahedronMeshFlagEnum {
        'e16_BIT_INDICES',
    }
    enum PxTetrahedronMeshFormatEnum {
        'eTET_MESH',
        'eHEX_MESH',
    }
    enum PxTriangleMeshAnalysisResultEnum {
        'eVALID',
        'eZERO_VOLUME',
        'eOPEN_BOUNDARIES',
        'eSELF_INTERSECTIONS',
        'eINCONSISTENT_TRIANGLE_ORIENTATION',
        'eCONTAINS_ACUTE_ANGLED_TRIANGLES',
        'eEDGE_SHARED_BY_MORE_THAN_TWO_TRIANGLES',
        'eCONTAINS_DUPLICATE_POINTS',
        'eCONTAINS_INVALID_POINTS',
        'eREQUIRES_32BIT_INDEX_BUFFER',
        'eTRIANGLE_INDEX_OUT_OF_RANGE',
        'eMESH_IS_PROBLEMATIC',
        'eMESH_IS_INVALID',
    }
    enum PxTriangleMeshFlagEnum {
        'e16_BIT_INDICES',
        'eADJACENCY_INFO',
    }
    enum PxTriggerPairFlagEnum {
        'eREMOVED_SHAPE_TRIGGER',
        'eREMOVED_SHAPE_OTHER',
        'eNEXT_FREE',
    }
    enum PxVehicleAxesEnum {
        'ePosX',
        'eNegX',
        'ePosY',
        'eNegY',
        'ePosZ',
        'eNegZ',
    }
    enum PxVehicleClutchAccuracyModeEnum {
        'eESTIMATE',
        'eBEST_POSSIBLE',
    }
    enum PxVehicleCommandNonLinearResponseParamsEnum {
        'eMAX_NB_COMMAND_VALUES',
    }
    enum PxVehicleCommandValueResponseTableEnum {
        'eMAX_NB_SPEED_RESPONSES',
    }
    enum PxVehicleDirectDriveTransmissionCommandStateEnum {
        'eREVERSE',
        'eNEUTRAL',
        'eFORWARD',
    }
    enum PxVehicleEngineDriveTransmissionCommandStateEnum {
        'eAUTOMATIC_GEAR',
    }
    enum PxVehicleGearboxParamsEnum {
        'eMAX_NB_GEARS',
    }
    enum PxVehicleLimitsEnum {
        'eMAX_NB_WHEELS',
        'eMAX_NB_AXLES',
    }
    enum PxVehiclePhysXActorUpdateModeEnum {
        'eAPPLY_VELOCITY',
        'eAPPLY_ACCELERATION',
    }
    enum PxVehiclePhysXConstraintLimitsEnum {
        'eNB_DOFS_PER_PXCONSTRAINT',
        'eNB_DOFS_PER_WHEEL',
        'eNB_WHEELS_PER_PXCONSTRAINT',
        'eNB_CONSTRAINTS_PER_VEHICLE',
    }
    enum PxVehiclePhysXRoadGeometryQueryTypeEnum {
        'eNONE',
        'eRAYCAST',
        'eSWEEP',
    }
    enum PxVehiclePhysXSuspensionLimitConstraintParamsDirectionSpecifierEnum {
        'eSUSPENSION',
        'eROAD_GEOMETRY_NORMAL',
        'eNONE',
    }
    enum PxVehicleSimulationContextTypeEnum {
        'eDEFAULT',
        'ePHYSX',
    }
    enum PxVehicleSuspensionJounceCalculationTypeEnum {
        'eRAYCAST',
        'eSWEEP',
    }
    enum PxVehicleTireDirectionModesEnum {
        'eLONGITUDINAL',
        'eLATERAL',
    }
    enum PxVisualizationParameterEnum {
        'eSCALE',
        'eWORLD_AXES',
        'eBODY_AXES',
        'eBODY_MASS_AXES',
        'eBODY_LIN_VELOCITY',
        'eBODY_ANG_VELOCITY',
        'eCONTACT_POINT',
        'eCONTACT_NORMAL',
        'eCONTACT_ERROR',
        'eCONTACT_FORCE',
        'eACTOR_AXES',
        'eCOLLISION_AABBS',
        'eCOLLISION_SHAPES',
        'eCOLLISION_AXES',
        'eCOLLISION_COMPOUNDS',
        'eCOLLISION_FNORMALS',
        'eCOLLISION_EDGES',
        'eCOLLISION_STATIC',
        'eCOLLISION_DYNAMIC',
        'eJOINT_LOCAL_FRAMES',
        'eJOINT_LIMITS',
        'eCULL_BOX',
        'eMBP_REGIONS',
        'eSIMULATION_MESH',
        'eSDF',
        'eNUM_VALUES',
        'eFORCE_DWORD',
    }
}

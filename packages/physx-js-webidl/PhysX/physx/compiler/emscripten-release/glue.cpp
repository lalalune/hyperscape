
#include <emscripten.h>
#include <stdlib.h>

EM_JS_DEPS(webidl_binder, "$intArrayFromString,$UTF8ToString,$alignMemory,$addOnInit");

class CustomSupportImpl : public CustomSupport {
public:
  float getCustomMargin()  {
    return  (float) EM_ASM_DOUBLE({
      var self = Module['getCache'](Module['CustomSupportImpl'])[$0];
      if (!self.hasOwnProperty('getCustomMargin')) throw 'a JSImplementation must implement all functions, you forgot CustomSupportImpl::getCustomMargin.';
      return self['getCustomMargin']();
    }, (ptrdiff_t)this);
  }
  void getCustomSupportLocal(const physx::PxVec3& dir, physx::PxVec3& result)  {
     (void) EM_ASM_INT({
      var self = Module['getCache'](Module['CustomSupportImpl'])[$0];
      if (!self.hasOwnProperty('getCustomSupportLocal')) throw 'a JSImplementation must implement all functions, you forgot CustomSupportImpl::getCustomSupportLocal.';
      self['getCustomSupportLocal']($1,$2);
    }, (ptrdiff_t)this, &dir, (ptrdiff_t)&result);
  }
  void __destroy__()  {
     (void) EM_ASM_INT({
      var self = Module['getCache'](Module['CustomSupportImpl'])[$0];
      if (!self.hasOwnProperty('__destroy__')) throw 'a JSImplementation must implement all functions, you forgot CustomSupportImpl::__destroy__.';
      self['__destroy__']();
    }, (ptrdiff_t)this);
  }
};

class PassThroughFilterShaderImpl : public PassThroughFilterShader {
public:
  unsigned int filterShader(unsigned int attributes0, unsigned int filterData0w0, unsigned int filterData0w1, unsigned int filterData0w2, unsigned int filterData0w3, unsigned int attributes1, unsigned int filterData1w0, unsigned int filterData1w1, unsigned int filterData1w2, unsigned int filterData1w3)  {
    return  (unsigned int) EM_ASM_INT({
      var self = Module['getCache'](Module['PassThroughFilterShaderImpl'])[$0];
      if (!self.hasOwnProperty('filterShader')) throw 'a JSImplementation must implement all functions, you forgot PassThroughFilterShaderImpl::filterShader.';
      return self['filterShader']($1,$2,$3,$4,$5,$6,$7,$8,$9,$10);
    }, (ptrdiff_t)this, attributes0, filterData0w0, filterData0w1, filterData0w2, filterData0w3, attributes1, filterData1w0, filterData1w1, filterData1w2, filterData1w3);
  }
  void __destroy__()  {
     (void) EM_ASM_INT({
      var self = Module['getCache'](Module['PassThroughFilterShaderImpl'])[$0];
      if (!self.hasOwnProperty('__destroy__')) throw 'a JSImplementation must implement all functions, you forgot PassThroughFilterShaderImpl::__destroy__.';
      self['__destroy__']();
    }, (ptrdiff_t)this);
  }
};

class PxControllerBehaviorCallbackImpl : public SimpleControllerBehaviorCallback {
public:
  unsigned int getShapeBehaviorFlags(const physx::PxShape& shape, const physx::PxActor& actor)  {
    return  (unsigned int) EM_ASM_INT({
      var self = Module['getCache'](Module['PxControllerBehaviorCallbackImpl'])[$0];
      if (!self.hasOwnProperty('getShapeBehaviorFlags')) throw 'a JSImplementation must implement all functions, you forgot PxControllerBehaviorCallbackImpl::getShapeBehaviorFlags.';
      return self['getShapeBehaviorFlags']($1,$2);
    }, (ptrdiff_t)this, &shape, &actor);
  }
  unsigned int getControllerBehaviorFlags(const physx::PxController& controller)  {
    return  (unsigned int) EM_ASM_INT({
      var self = Module['getCache'](Module['PxControllerBehaviorCallbackImpl'])[$0];
      if (!self.hasOwnProperty('getControllerBehaviorFlags')) throw 'a JSImplementation must implement all functions, you forgot PxControllerBehaviorCallbackImpl::getControllerBehaviorFlags.';
      return self['getControllerBehaviorFlags']($1);
    }, (ptrdiff_t)this, &controller);
  }
  unsigned int getObstacleBehaviorFlags(const physx::PxObstacle& obstacle)  {
    return  (unsigned int) EM_ASM_INT({
      var self = Module['getCache'](Module['PxControllerBehaviorCallbackImpl'])[$0];
      if (!self.hasOwnProperty('getObstacleBehaviorFlags')) throw 'a JSImplementation must implement all functions, you forgot PxControllerBehaviorCallbackImpl::getObstacleBehaviorFlags.';
      return self['getObstacleBehaviorFlags']($1);
    }, (ptrdiff_t)this, &obstacle);
  }
  void __destroy__()  {
     (void) EM_ASM_INT({
      var self = Module['getCache'](Module['PxControllerBehaviorCallbackImpl'])[$0];
      if (!self.hasOwnProperty('__destroy__')) throw 'a JSImplementation must implement all functions, you forgot PxControllerBehaviorCallbackImpl::__destroy__.';
      self['__destroy__']();
    }, (ptrdiff_t)this);
  }
};

class PxControllerFilterCallbackImpl : public physx::PxControllerFilterCallback {
public:
  bool filter(const physx::PxController& a, const physx::PxController& b)  {
    return  (bool) EM_ASM_INT({
      var self = Module['getCache'](Module['PxControllerFilterCallbackImpl'])[$0];
      if (!self.hasOwnProperty('filter')) throw 'a JSImplementation must implement all functions, you forgot PxControllerFilterCallbackImpl::filter.';
      return self['filter']($1,$2);
    }, (ptrdiff_t)this, &a, &b);
  }
  void __destroy__()  {
     (void) EM_ASM_INT({
      var self = Module['getCache'](Module['PxControllerFilterCallbackImpl'])[$0];
      if (!self.hasOwnProperty('__destroy__')) throw 'a JSImplementation must implement all functions, you forgot PxControllerFilterCallbackImpl::__destroy__.';
      self['__destroy__']();
    }, (ptrdiff_t)this);
  }
};

class PxErrorCallbackImpl : public physx::PxErrorCallback {
public:
  void reportError(PxErrorCodeEnum code, const char* message, const char* file, int line)  {
     (void) EM_ASM_INT({
      var self = Module['getCache'](Module['PxErrorCallbackImpl'])[$0];
      if (!self.hasOwnProperty('reportError')) throw 'a JSImplementation must implement all functions, you forgot PxErrorCallbackImpl::reportError.';
      self['reportError']($1,$2,$3,$4);
    }, (ptrdiff_t)this, code, message, file, line);
  }
  void __destroy__()  {
     (void) EM_ASM_INT({
      var self = Module['getCache'](Module['PxErrorCallbackImpl'])[$0];
      if (!self.hasOwnProperty('__destroy__')) throw 'a JSImplementation must implement all functions, you forgot PxErrorCallbackImpl::__destroy__.';
      self['__destroy__']();
    }, (ptrdiff_t)this);
  }
};

class PxQueryFilterCallbackImpl : public SimpleQueryFilterCallback {
public:
  unsigned int simplePreFilter(const physx::PxFilterData& filterData, const physx::PxShape* shape, const physx::PxRigidActor* actor, physx::PxHitFlags& queryFlags)  {
    return  (unsigned int) EM_ASM_INT({
      var self = Module['getCache'](Module['PxQueryFilterCallbackImpl'])[$0];
      if (!self.hasOwnProperty('simplePreFilter')) throw 'a JSImplementation must implement all functions, you forgot PxQueryFilterCallbackImpl::simplePreFilter.';
      return self['simplePreFilter']($1,$2,$3,$4);
    }, (ptrdiff_t)this, &filterData, shape, actor, (ptrdiff_t)&queryFlags);
  }
  unsigned int simplePostFilter(const physx::PxFilterData& filterData, const physx::PxQueryHit& hit, const physx::PxShape* shape, const physx::PxRigidActor* actor)  {
    return  (unsigned int) EM_ASM_INT({
      var self = Module['getCache'](Module['PxQueryFilterCallbackImpl'])[$0];
      if (!self.hasOwnProperty('simplePostFilter')) throw 'a JSImplementation must implement all functions, you forgot PxQueryFilterCallbackImpl::simplePostFilter.';
      return self['simplePostFilter']($1,$2,$3,$4);
    }, (ptrdiff_t)this, &filterData, &hit, shape, actor);
  }
  void __destroy__()  {
     (void) EM_ASM_INT({
      var self = Module['getCache'](Module['PxQueryFilterCallbackImpl'])[$0];
      if (!self.hasOwnProperty('__destroy__')) throw 'a JSImplementation must implement all functions, you forgot PxQueryFilterCallbackImpl::__destroy__.';
      self['__destroy__']();
    }, (ptrdiff_t)this);
  }
};

class PxSimulationEventCallbackImpl : public SimpleSimulationEventCallback {
public:
  void onConstraintBreak(physx::PxConstraintInfo* constraints, unsigned int count)  {
     (void) EM_ASM_INT({
      var self = Module['getCache'](Module['PxSimulationEventCallbackImpl'])[$0];
      if (!self.hasOwnProperty('onConstraintBreak')) throw 'a JSImplementation must implement all functions, you forgot PxSimulationEventCallbackImpl::onConstraintBreak.';
      self['onConstraintBreak']($1,$2);
    }, (ptrdiff_t)this, (ptrdiff_t)constraints, count);
  }
  void onWake(PxActorPtr* actors, unsigned int count)  {
     (void) EM_ASM_INT({
      var self = Module['getCache'](Module['PxSimulationEventCallbackImpl'])[$0];
      if (!self.hasOwnProperty('onWake')) throw 'a JSImplementation must implement all functions, you forgot PxSimulationEventCallbackImpl::onWake.';
      self['onWake']($1,$2);
    }, (ptrdiff_t)this, (ptrdiff_t)actors, count);
  }
  void onSleep(PxActorPtr* actors, unsigned int count)  {
     (void) EM_ASM_INT({
      var self = Module['getCache'](Module['PxSimulationEventCallbackImpl'])[$0];
      if (!self.hasOwnProperty('onSleep')) throw 'a JSImplementation must implement all functions, you forgot PxSimulationEventCallbackImpl::onSleep.';
      self['onSleep']($1,$2);
    }, (ptrdiff_t)this, (ptrdiff_t)actors, count);
  }
  void onContact(const physx::PxContactPairHeader& pairHeader, const physx::PxContactPair* pairs, unsigned int nbPairs)  {
     (void) EM_ASM_INT({
      var self = Module['getCache'](Module['PxSimulationEventCallbackImpl'])[$0];
      if (!self.hasOwnProperty('onContact')) throw 'a JSImplementation must implement all functions, you forgot PxSimulationEventCallbackImpl::onContact.';
      self['onContact']($1,$2,$3);
    }, (ptrdiff_t)this, &pairHeader, pairs, nbPairs);
  }
  void onTrigger(physx::PxTriggerPair* pairs, unsigned int count)  {
     (void) EM_ASM_INT({
      var self = Module['getCache'](Module['PxSimulationEventCallbackImpl'])[$0];
      if (!self.hasOwnProperty('onTrigger')) throw 'a JSImplementation must implement all functions, you forgot PxSimulationEventCallbackImpl::onTrigger.';
      self['onTrigger']($1,$2);
    }, (ptrdiff_t)this, (ptrdiff_t)pairs, count);
  }
  void __destroy__()  {
     (void) EM_ASM_INT({
      var self = Module['getCache'](Module['PxSimulationEventCallbackImpl'])[$0];
      if (!self.hasOwnProperty('__destroy__')) throw 'a JSImplementation must implement all functions, you forgot PxSimulationEventCallbackImpl::__destroy__.';
      self['__destroy__']();
    }, (ptrdiff_t)this);
  }
};

class PxUserControllerHitReportImpl : public physx::PxUserControllerHitReport {
public:
  void onShapeHit(const physx::PxControllerShapeHit& hit)  {
     (void) EM_ASM_INT({
      var self = Module['getCache'](Module['PxUserControllerHitReportImpl'])[$0];
      if (!self.hasOwnProperty('onShapeHit')) throw 'a JSImplementation must implement all functions, you forgot PxUserControllerHitReportImpl::onShapeHit.';
      self['onShapeHit']($1);
    }, (ptrdiff_t)this, &hit);
  }
  void onControllerHit(const physx::PxControllersHit& hit)  {
     (void) EM_ASM_INT({
      var self = Module['getCache'](Module['PxUserControllerHitReportImpl'])[$0];
      if (!self.hasOwnProperty('onControllerHit')) throw 'a JSImplementation must implement all functions, you forgot PxUserControllerHitReportImpl::onControllerHit.';
      self['onControllerHit']($1);
    }, (ptrdiff_t)this, &hit);
  }
  void onObstacleHit(const physx::PxControllerObstacleHit& hit)  {
     (void) EM_ASM_INT({
      var self = Module['getCache'](Module['PxUserControllerHitReportImpl'])[$0];
      if (!self.hasOwnProperty('onObstacleHit')) throw 'a JSImplementation must implement all functions, you forgot PxUserControllerHitReportImpl::onObstacleHit.';
      self['onObstacleHit']($1);
    }, (ptrdiff_t)this, &hit);
  }
  void __destroy__()  {
     (void) EM_ASM_INT({
      var self = Module['getCache'](Module['PxUserControllerHitReportImpl'])[$0];
      if (!self.hasOwnProperty('__destroy__')) throw 'a JSImplementation must implement all functions, you forgot PxUserControllerHitReportImpl::__destroy__.';
      self['__destroy__']();
    }, (ptrdiff_t)this);
  }
};

class SimplPvdTransportImpl : public SimplePvdTransport {
public:
  bool connect()  {
    return  (bool) EM_ASM_INT({
      var self = Module['getCache'](Module['SimplPvdTransportImpl'])[$0];
      if (!self.hasOwnProperty('connect')) throw 'a JSImplementation must implement all functions, you forgot SimplPvdTransportImpl::connect.';
      return self['connect']();
    }, (ptrdiff_t)this);
  }
  bool isConnected()  {
    return  (bool) EM_ASM_INT({
      var self = Module['getCache'](Module['SimplPvdTransportImpl'])[$0];
      if (!self.hasOwnProperty('isConnected')) throw 'a JSImplementation must implement all functions, you forgot SimplPvdTransportImpl::isConnected.';
      return self['isConnected']();
    }, (ptrdiff_t)this);
  }
  void disconnect()  {
     (void) EM_ASM_INT({
      var self = Module['getCache'](Module['SimplPvdTransportImpl'])[$0];
      if (!self.hasOwnProperty('disconnect')) throw 'a JSImplementation must implement all functions, you forgot SimplPvdTransportImpl::disconnect.';
      self['disconnect']();
    }, (ptrdiff_t)this);
  }
  void send(void* inBytes, unsigned int inLength)  {
     (void) EM_ASM_INT({
      var self = Module['getCache'](Module['SimplPvdTransportImpl'])[$0];
      if (!self.hasOwnProperty('send')) throw 'a JSImplementation must implement all functions, you forgot SimplPvdTransportImpl::send.';
      self['send']($1,$2);
    }, (ptrdiff_t)this, inBytes, inLength);
  }
  void flush()  {
     (void) EM_ASM_INT({
      var self = Module['getCache'](Module['SimplPvdTransportImpl'])[$0];
      if (!self.hasOwnProperty('flush')) throw 'a JSImplementation must implement all functions, you forgot SimplPvdTransportImpl::flush.';
      self['flush']();
    }, (ptrdiff_t)this);
  }
  void __destroy__()  {
     (void) EM_ASM_INT({
      var self = Module['getCache'](Module['SimplPvdTransportImpl'])[$0];
      if (!self.hasOwnProperty('__destroy__')) throw 'a JSImplementation must implement all functions, you forgot SimplPvdTransportImpl::__destroy__.';
      self['__destroy__']();
    }, (ptrdiff_t)this);
  }
};

extern "C" {

// Define custom allocator functions that we can force export using
// EMSCRIPTEN_KEEPALIVE.  This avoids all webidl users having to add
// malloc/free to -sEXPORTED_FUNCTIONS.
EMSCRIPTEN_KEEPALIVE void webidl_free(void* p) { free(p); }
EMSCRIPTEN_KEEPALIVE void* webidl_malloc(size_t len) { return malloc(len); }


// Interface: PxBase


void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBase_release_0(physx::PxBase* self) {
  self->release();
}

const char* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBase_getConcreteTypeName_0(physx::PxBase* self) {
  return self->getConcreteTypeName();
}

int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBase_getConcreteType_0(physx::PxBase* self) {
  return self->getConcreteType();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBase_setBaseFlag_2(physx::PxBase* self, PxBaseFlagEnum flag, bool value) {
  self->setBaseFlag(flag, value);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBase_setBaseFlags_1(physx::PxBase* self, physx::PxBaseFlags* inFlags) {
  self->setBaseFlags(*inFlags);
}

physx::PxBaseFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBase_getBaseFlags_0(physx::PxBase* self) {
  static thread_local physx::PxBaseFlags temp;
  return (temp = self->getBaseFlags(), &temp);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBase_isReleasable_0(physx::PxBase* self) {
  return self->isReleasable();
}

// Interface: PxActor


PxActorTypeEnum EMSCRIPTEN_KEEPALIVE emscripten_bind_PxActor_getType_0(physx::PxActor* self) {
  return self->getType();
}

physx::PxScene* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxActor_getScene_0(physx::PxActor* self) {
  return self->getScene();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxActor_setName_1(physx::PxActor* self, const char* name) {
  self->setName(name);
}

const char* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxActor_getName_0(physx::PxActor* self) {
  return self->getName();
}

physx::PxBounds3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxActor_getWorldBounds_0(physx::PxActor* self) {
  static thread_local physx::PxBounds3 temp;
  return (temp = self->getWorldBounds(), &temp);
}

physx::PxBounds3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxActor_getWorldBounds_1(physx::PxActor* self, float inflation) {
  static thread_local physx::PxBounds3 temp;
  return (temp = self->getWorldBounds(inflation), &temp);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxActor_setActorFlag_2(physx::PxActor* self, PxActorFlagEnum flag, bool value) {
  self->setActorFlag(flag, value);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxActor_setActorFlags_1(physx::PxActor* self, physx::PxActorFlags* flags) {
  self->setActorFlags(*flags);
}

physx::PxActorFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxActor_getActorFlags_0(physx::PxActor* self) {
  static thread_local physx::PxActorFlags temp;
  return (temp = self->getActorFlags(), &temp);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxActor_setDominanceGroup_1(physx::PxActor* self, unsigned char dominanceGroup) {
  self->setDominanceGroup(dominanceGroup);
}

unsigned char EMSCRIPTEN_KEEPALIVE emscripten_bind_PxActor_getDominanceGroup_0(physx::PxActor* self) {
  return self->getDominanceGroup();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxActor_setOwnerClient_1(physx::PxActor* self, unsigned char inClient) {
  self->setOwnerClient(inClient);
}

unsigned char EMSCRIPTEN_KEEPALIVE emscripten_bind_PxActor_getOwnerClient_0(physx::PxActor* self) {
  return self->getOwnerClient();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxActor_release_0(physx::PxActor* self) {
  self->release();
}

const char* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxActor_getConcreteTypeName_0(physx::PxActor* self) {
  return self->getConcreteTypeName();
}

int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxActor_getConcreteType_0(physx::PxActor* self) {
  return self->getConcreteType();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxActor_setBaseFlag_2(physx::PxActor* self, PxBaseFlagEnum flag, bool value) {
  self->setBaseFlag(flag, value);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxActor_setBaseFlags_1(physx::PxActor* self, physx::PxBaseFlags* inFlags) {
  self->setBaseFlags(*inFlags);
}

physx::PxBaseFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxActor_getBaseFlags_0(physx::PxActor* self) {
  static thread_local physx::PxBaseFlags temp;
  return (temp = self->getBaseFlags(), &temp);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxActor_isReleasable_0(physx::PxActor* self) {
  return self->isReleasable();
}

void* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxActor_get_userData_0(physx::PxActor* self) {
  return self->userData;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxActor_set_userData_1(physx::PxActor* self, void* arg0) {
  self->userData = arg0;
}

// Interface: PxQueryHit


unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxQueryHit_get_faceIndex_0(physx::PxQueryHit* self) {
  return self->faceIndex;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxQueryHit_set_faceIndex_1(physx::PxQueryHit* self, unsigned int arg0) {
  self->faceIndex = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxQueryHit___destroy___0(physx::PxQueryHit* self) {
  delete self;
}

// Interface: BaseVehicle


bool EMSCRIPTEN_KEEPALIVE emscripten_bind_BaseVehicle_initialize_0(snippetvehicle2::BaseVehicle* self) {
  return self->initialize();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_BaseVehicle_destroyState_0(snippetvehicle2::BaseVehicle* self) {
  self->destroyState();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_BaseVehicle_initComponentSequence_1(snippetvehicle2::BaseVehicle* self, bool addPhysXBeginEndComponents) {
  self->initComponentSequence(addPhysXBeginEndComponents);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_BaseVehicle_step_2(snippetvehicle2::BaseVehicle* self, float dt, const physx::vehicle2::PxVehicleSimulationContext* context) {
  self->step(dt, *context);
}

snippetvehicle2::BaseVehicleParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_BaseVehicle_get_baseParams_0(snippetvehicle2::BaseVehicle* self) {
  return &self->baseParams;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_BaseVehicle_set_baseParams_1(snippetvehicle2::BaseVehicle* self, snippetvehicle2::BaseVehicleParams* arg0) {
  self->baseParams = *arg0;
}

snippetvehicle2::BaseVehicleState* EMSCRIPTEN_KEEPALIVE emscripten_bind_BaseVehicle_get_baseState_0(snippetvehicle2::BaseVehicle* self) {
  return &self->baseState;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_BaseVehicle_set_baseState_1(snippetvehicle2::BaseVehicle* self, snippetvehicle2::BaseVehicleState* arg0) {
  self->baseState = *arg0;
}

physx::vehicle2::PxVehicleComponentSequence* EMSCRIPTEN_KEEPALIVE emscripten_bind_BaseVehicle_get_componentSequence_0(snippetvehicle2::BaseVehicle* self) {
  return &self->componentSequence;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_BaseVehicle_set_componentSequence_1(snippetvehicle2::BaseVehicle* self, physx::vehicle2::PxVehicleComponentSequence* arg0) {
  self->componentSequence = *arg0;
}

unsigned char EMSCRIPTEN_KEEPALIVE emscripten_bind_BaseVehicle_get_componentSequenceSubstepGroupHandle_0(snippetvehicle2::BaseVehicle* self) {
  return self->componentSequenceSubstepGroupHandle;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_BaseVehicle_set_componentSequenceSubstepGroupHandle_1(snippetvehicle2::BaseVehicle* self, unsigned char arg0) {
  self->componentSequenceSubstepGroupHandle = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_BaseVehicle___destroy___0(snippetvehicle2::BaseVehicle* self) {
  delete self;
}

// Interface: PxControllerBehaviorCallback


// Interface: PxLocationHit


physx::PxHitFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxLocationHit_get_flags_0(physx::PxLocationHit* self) {
  return &self->flags;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxLocationHit_set_flags_1(physx::PxLocationHit* self, physx::PxHitFlags* arg0) {
  self->flags = *arg0;
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxLocationHit_get_position_0(physx::PxLocationHit* self) {
  return &self->position;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxLocationHit_set_position_1(physx::PxLocationHit* self, physx::PxVec3* arg0) {
  self->position = *arg0;
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxLocationHit_get_normal_0(physx::PxLocationHit* self) {
  return &self->normal;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxLocationHit_set_normal_1(physx::PxLocationHit* self, physx::PxVec3* arg0) {
  self->normal = *arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxLocationHit_get_distance_0(physx::PxLocationHit* self) {
  return self->distance;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxLocationHit_set_distance_1(physx::PxLocationHit* self, float arg0) {
  self->distance = arg0;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxLocationHit_get_faceIndex_0(physx::PxLocationHit* self) {
  return self->faceIndex;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxLocationHit_set_faceIndex_1(physx::PxLocationHit* self, unsigned int arg0) {
  self->faceIndex = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxLocationHit___destroy___0(physx::PxLocationHit* self) {
  delete self;
}

// Interface: PxPvdTransport


bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxPvdTransport_connect_0(physx::PxPvdTransport* self) {
  return self->connect();
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxPvdTransport_isConnected_0(physx::PxPvdTransport* self) {
  return self->isConnected();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxPvdTransport_disconnect_0(physx::PxPvdTransport* self) {
  self->disconnect();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxPvdTransport_release_0(physx::PxPvdTransport* self) {
  self->release();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxPvdTransport_flush_0(physx::PxPvdTransport* self) {
  self->flush();
}

// Interface: PxQueryFilterCallback


void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxQueryFilterCallback___destroy___0(physx::PxQueryFilterCallback* self) {
  delete self;
}

// Interface: PxRefCounted


unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRefCounted_getReferenceCount_0(physx::PxRefCounted* self) {
  return self->getReferenceCount();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRefCounted_acquireReference_0(physx::PxRefCounted* self) {
  self->acquireReference();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRefCounted_release_0(physx::PxRefCounted* self) {
  self->release();
}

const char* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRefCounted_getConcreteTypeName_0(physx::PxRefCounted* self) {
  return self->getConcreteTypeName();
}

int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRefCounted_getConcreteType_0(physx::PxRefCounted* self) {
  return self->getConcreteType();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRefCounted_setBaseFlag_2(physx::PxRefCounted* self, PxBaseFlagEnum flag, bool value) {
  self->setBaseFlag(flag, value);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRefCounted_setBaseFlags_1(physx::PxRefCounted* self, physx::PxBaseFlags* inFlags) {
  self->setBaseFlags(*inFlags);
}

physx::PxBaseFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRefCounted_getBaseFlags_0(physx::PxRefCounted* self) {
  static thread_local physx::PxBaseFlags temp;
  return (temp = self->getBaseFlags(), &temp);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRefCounted_isReleasable_0(physx::PxRefCounted* self) {
  return self->isReleasable();
}

// Interface: PxRigidActor


physx::PxTransform* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidActor_getGlobalPose_0(physx::PxRigidActor* self) {
  static thread_local physx::PxTransform temp;
  return (temp = self->getGlobalPose(), &temp);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidActor_setGlobalPose_1(physx::PxRigidActor* self, const physx::PxTransform* pose) {
  self->setGlobalPose(*pose);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidActor_setGlobalPose_2(physx::PxRigidActor* self, const physx::PxTransform* pose, bool autowake) {
  self->setGlobalPose(*pose, autowake);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidActor_attachShape_1(physx::PxRigidActor* self, physx::PxShape* shape) {
  return self->attachShape(*shape);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidActor_detachShape_1(physx::PxRigidActor* self, physx::PxShape* shape) {
  self->detachShape(*shape);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidActor_detachShape_2(physx::PxRigidActor* self, physx::PxShape* shape, bool wakeOnLostTouch) {
  self->detachShape(*shape, wakeOnLostTouch);
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidActor_getNbShapes_0(physx::PxRigidActor* self) {
  return self->getNbShapes();
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidActor_getShapes_3(physx::PxRigidActor* self, PxShapePtr* userBuffer, unsigned int bufferSize, unsigned int startIndex) {
  return self->getShapes(userBuffer, bufferSize, startIndex);
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidActor_getNbConstraints_0(physx::PxRigidActor* self) {
  return self->getNbConstraints();
}

PxActorTypeEnum EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidActor_getType_0(physx::PxRigidActor* self) {
  return self->getType();
}

physx::PxScene* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidActor_getScene_0(physx::PxRigidActor* self) {
  return self->getScene();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidActor_setName_1(physx::PxRigidActor* self, const char* name) {
  self->setName(name);
}

const char* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidActor_getName_0(physx::PxRigidActor* self) {
  return self->getName();
}

physx::PxBounds3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidActor_getWorldBounds_0(physx::PxRigidActor* self) {
  static thread_local physx::PxBounds3 temp;
  return (temp = self->getWorldBounds(), &temp);
}

physx::PxBounds3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidActor_getWorldBounds_1(physx::PxRigidActor* self, float inflation) {
  static thread_local physx::PxBounds3 temp;
  return (temp = self->getWorldBounds(inflation), &temp);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidActor_setActorFlag_2(physx::PxRigidActor* self, PxActorFlagEnum flag, bool value) {
  self->setActorFlag(flag, value);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidActor_setActorFlags_1(physx::PxRigidActor* self, physx::PxActorFlags* flags) {
  self->setActorFlags(*flags);
}

physx::PxActorFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidActor_getActorFlags_0(physx::PxRigidActor* self) {
  static thread_local physx::PxActorFlags temp;
  return (temp = self->getActorFlags(), &temp);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidActor_setDominanceGroup_1(physx::PxRigidActor* self, unsigned char dominanceGroup) {
  self->setDominanceGroup(dominanceGroup);
}

unsigned char EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidActor_getDominanceGroup_0(physx::PxRigidActor* self) {
  return self->getDominanceGroup();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidActor_setOwnerClient_1(physx::PxRigidActor* self, unsigned char inClient) {
  self->setOwnerClient(inClient);
}

unsigned char EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidActor_getOwnerClient_0(physx::PxRigidActor* self) {
  return self->getOwnerClient();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidActor_release_0(physx::PxRigidActor* self) {
  self->release();
}

const char* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidActor_getConcreteTypeName_0(physx::PxRigidActor* self) {
  return self->getConcreteTypeName();
}

int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidActor_getConcreteType_0(physx::PxRigidActor* self) {
  return self->getConcreteType();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidActor_setBaseFlag_2(physx::PxRigidActor* self, PxBaseFlagEnum flag, bool value) {
  self->setBaseFlag(flag, value);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidActor_setBaseFlags_1(physx::PxRigidActor* self, physx::PxBaseFlags* inFlags) {
  self->setBaseFlags(*inFlags);
}

physx::PxBaseFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidActor_getBaseFlags_0(physx::PxRigidActor* self) {
  static thread_local physx::PxBaseFlags temp;
  return (temp = self->getBaseFlags(), &temp);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidActor_isReleasable_0(physx::PxRigidActor* self) {
  return self->isReleasable();
}

void* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidActor_get_userData_0(physx::PxRigidActor* self) {
  return self->userData;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidActor_set_userData_1(physx::PxRigidActor* self, void* arg0) {
  self->userData = arg0;
}

// Interface: PxSceneQuerySystemBase


void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneQuerySystemBase_setDynamicTreeRebuildRateHint_1(physx::PxSceneQuerySystemBase* self, unsigned int dynamicTreeRebuildRateHint) {
  self->setDynamicTreeRebuildRateHint(dynamicTreeRebuildRateHint);
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneQuerySystemBase_getDynamicTreeRebuildRateHint_0(physx::PxSceneQuerySystemBase* self) {
  return self->getDynamicTreeRebuildRateHint();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneQuerySystemBase_forceRebuildDynamicTree_1(physx::PxSceneQuerySystemBase* self, unsigned int prunerIndex) {
  self->forceRebuildDynamicTree(prunerIndex);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneQuerySystemBase_setUpdateMode_1(physx::PxSceneQuerySystemBase* self, PxSceneQueryUpdateModeEnum updateMode) {
  self->setUpdateMode(updateMode);
}

PxSceneQueryUpdateModeEnum EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneQuerySystemBase_getUpdateMode_0(physx::PxSceneQuerySystemBase* self) {
  return self->getUpdateMode();
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneQuerySystemBase_getStaticTimestamp_0(physx::PxSceneQuerySystemBase* self) {
  return self->getStaticTimestamp();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneQuerySystemBase_flushUpdates_0(physx::PxSceneQuerySystemBase* self) {
  self->flushUpdates();
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneQuerySystemBase_raycast_4(physx::PxSceneQuerySystemBase* self, const physx::PxVec3* origin, const physx::PxVec3* unitDir, float distance, physx::PxRaycastCallback* hitCall) {
  return self->raycast(*origin, *unitDir, distance, *hitCall);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneQuerySystemBase_raycast_5(physx::PxSceneQuerySystemBase* self, const physx::PxVec3* origin, const physx::PxVec3* unitDir, float distance, physx::PxRaycastCallback* hitCall, physx::PxHitFlags* hitFlags) {
  return self->raycast(*origin, *unitDir, distance, *hitCall, *hitFlags);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneQuerySystemBase_raycast_6(physx::PxSceneQuerySystemBase* self, const physx::PxVec3* origin, const physx::PxVec3* unitDir, float distance, physx::PxRaycastCallback* hitCall, physx::PxHitFlags* hitFlags, const physx::PxQueryFilterData* filterData) {
  return self->raycast(*origin, *unitDir, distance, *hitCall, *hitFlags, *filterData);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneQuerySystemBase_sweep_5(physx::PxSceneQuerySystemBase* self, const physx::PxGeometry* geometry, const physx::PxTransform* pose, const physx::PxVec3* unitDir, float distance, physx::PxSweepCallback* hitCall) {
  return self->sweep(*geometry, *pose, *unitDir, distance, *hitCall);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneQuerySystemBase_sweep_6(physx::PxSceneQuerySystemBase* self, const physx::PxGeometry* geometry, const physx::PxTransform* pose, const physx::PxVec3* unitDir, float distance, physx::PxSweepCallback* hitCall, physx::PxHitFlags* hitFlags) {
  return self->sweep(*geometry, *pose, *unitDir, distance, *hitCall, *hitFlags);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneQuerySystemBase_sweep_7(physx::PxSceneQuerySystemBase* self, const physx::PxGeometry* geometry, const physx::PxTransform* pose, const physx::PxVec3* unitDir, float distance, physx::PxSweepCallback* hitCall, physx::PxHitFlags* hitFlags, const physx::PxQueryFilterData* filterData) {
  return self->sweep(*geometry, *pose, *unitDir, distance, *hitCall, *hitFlags, *filterData);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneQuerySystemBase_overlap_3(physx::PxSceneQuerySystemBase* self, const physx::PxGeometry* geometry, const physx::PxTransform* pose, physx::PxOverlapCallback* hitCall) {
  return self->overlap(*geometry, *pose, *hitCall);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneQuerySystemBase_overlap_4(physx::PxSceneQuerySystemBase* self, const physx::PxGeometry* geometry, const physx::PxTransform* pose, physx::PxOverlapCallback* hitCall, const physx::PxQueryFilterData* filterData) {
  return self->overlap(*geometry, *pose, *hitCall, *filterData);
}

// Interface: PxSimulationEventCallback


void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSimulationEventCallback___destroy___0(physx::PxSimulationEventCallback* self) {
  delete self;
}

// Interface: PxSimulationFilterShader


void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSimulationFilterShader___destroy___0(physx::PxSimulationFilterShader* self) {
  delete self;
}

// Interface: Support


float EMSCRIPTEN_KEEPALIVE emscripten_bind_Support_getMargin_0(physx::PxGjkQuery::Support* self) {
  return self->getMargin();
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_Support_supportLocal_1(physx::PxGjkQuery::Support* self, const physx::PxVec3* dir) {
  static thread_local physx::PxVec3 temp;
  return (temp = self->supportLocal(*dir), &temp);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_Support___destroy___0(physx::PxGjkQuery::Support* self) {
  delete self;
}

// Interface: CustomSupport


float EMSCRIPTEN_KEEPALIVE emscripten_bind_CustomSupport_getCustomMargin_0(CustomSupport* self) {
  return self->getCustomMargin();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_CustomSupport_getCustomSupportLocal_2(CustomSupport* self, const physx::PxVec3* dir, physx::PxVec3* result) {
  self->getCustomSupportLocal(*dir, *result);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_CustomSupport_getMargin_0(CustomSupport* self) {
  return self->getMargin();
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_CustomSupport_supportLocal_1(CustomSupport* self, const physx::PxVec3* dir) {
  static thread_local physx::PxVec3 temp;
  return (temp = self->supportLocal(*dir), &temp);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_CustomSupport___destroy___0(CustomSupport* self) {
  delete self;
}

// Interface: PassThroughFilterShader


unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PassThroughFilterShader_filterShader_10(PassThroughFilterShader* self, unsigned int attributes0, unsigned int filterData0w0, unsigned int filterData0w1, unsigned int filterData0w2, unsigned int filterData0w3, unsigned int attributes1, unsigned int filterData1w0, unsigned int filterData1w1, unsigned int filterData1w2, unsigned int filterData1w3) {
  return self->filterShader(attributes0, filterData0w0, filterData0w1, filterData0w2, filterData0w3, attributes1, filterData1w0, filterData1w1, filterData1w2, filterData1w3);
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PassThroughFilterShader_get_outputPairFlags_0(PassThroughFilterShader* self) {
  return self->outputPairFlags;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PassThroughFilterShader_set_outputPairFlags_1(PassThroughFilterShader* self, unsigned int arg0) {
  self->outputPairFlags = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PassThroughFilterShader___destroy___0(PassThroughFilterShader* self) {
  delete self;
}

// Interface: PhysXActorVehicle


bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PhysXActorVehicle_initialize_3(snippetvehicle2::PhysXActorVehicle* self, physx::PxPhysics* physics, const physx::PxCookingParams* params, physx::PxMaterial* defaultMaterial) {
  return self->initialize(*physics, *params, *defaultMaterial);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PhysXActorVehicle_destroyState_0(snippetvehicle2::PhysXActorVehicle* self) {
  self->destroyState();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PhysXActorVehicle_initComponentSequence_1(snippetvehicle2::PhysXActorVehicle* self, bool addPhysXBeginEndComponents) {
  self->initComponentSequence(addPhysXBeginEndComponents);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PhysXActorVehicle_step_2(snippetvehicle2::PhysXActorVehicle* self, float dt, const physx::vehicle2::PxVehicleSimulationContext* context) {
  self->step(dt, *context);
}

snippetvehicle2::PhysXIntegrationParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_PhysXActorVehicle_get_physXParams_0(snippetvehicle2::PhysXActorVehicle* self) {
  return &self->physXParams;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PhysXActorVehicle_set_physXParams_1(snippetvehicle2::PhysXActorVehicle* self, snippetvehicle2::PhysXIntegrationParams* arg0) {
  self->physXParams = *arg0;
}

snippetvehicle2::PhysXIntegrationState* EMSCRIPTEN_KEEPALIVE emscripten_bind_PhysXActorVehicle_get_physXState_0(snippetvehicle2::PhysXActorVehicle* self) {
  return &self->physXState;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PhysXActorVehicle_set_physXState_1(snippetvehicle2::PhysXActorVehicle* self, snippetvehicle2::PhysXIntegrationState* arg0) {
  self->physXState = *arg0;
}

physx::vehicle2::PxVehicleCommandState* EMSCRIPTEN_KEEPALIVE emscripten_bind_PhysXActorVehicle_get_commandState_0(snippetvehicle2::PhysXActorVehicle* self) {
  return &self->commandState;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PhysXActorVehicle_set_commandState_1(snippetvehicle2::PhysXActorVehicle* self, physx::vehicle2::PxVehicleCommandState* arg0) {
  self->commandState = *arg0;
}

snippetvehicle2::BaseVehicleParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_PhysXActorVehicle_get_baseParams_0(snippetvehicle2::PhysXActorVehicle* self) {
  return &self->baseParams;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PhysXActorVehicle_set_baseParams_1(snippetvehicle2::PhysXActorVehicle* self, snippetvehicle2::BaseVehicleParams* arg0) {
  self->baseParams = *arg0;
}

snippetvehicle2::BaseVehicleState* EMSCRIPTEN_KEEPALIVE emscripten_bind_PhysXActorVehicle_get_baseState_0(snippetvehicle2::PhysXActorVehicle* self) {
  return &self->baseState;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PhysXActorVehicle_set_baseState_1(snippetvehicle2::PhysXActorVehicle* self, snippetvehicle2::BaseVehicleState* arg0) {
  self->baseState = *arg0;
}

physx::vehicle2::PxVehicleComponentSequence* EMSCRIPTEN_KEEPALIVE emscripten_bind_PhysXActorVehicle_get_componentSequence_0(snippetvehicle2::PhysXActorVehicle* self) {
  return &self->componentSequence;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PhysXActorVehicle_set_componentSequence_1(snippetvehicle2::PhysXActorVehicle* self, physx::vehicle2::PxVehicleComponentSequence* arg0) {
  self->componentSequence = *arg0;
}

unsigned char EMSCRIPTEN_KEEPALIVE emscripten_bind_PhysXActorVehicle_get_componentSequenceSubstepGroupHandle_0(snippetvehicle2::PhysXActorVehicle* self) {
  return self->componentSequenceSubstepGroupHandle;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PhysXActorVehicle_set_componentSequenceSubstepGroupHandle_1(snippetvehicle2::PhysXActorVehicle* self, unsigned char arg0) {
  self->componentSequenceSubstepGroupHandle = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PhysXActorVehicle___destroy___0(snippetvehicle2::PhysXActorVehicle* self) {
  delete self;
}

// Interface: PxArticulationTendon


void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationTendon_setStiffness_1(physx::PxArticulationTendon* self, float stiffness) {
  self->setStiffness(stiffness);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationTendon_getStiffness_0(physx::PxArticulationTendon* self) {
  return self->getStiffness();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationTendon_setDamping_1(physx::PxArticulationTendon* self, float damping) {
  self->setDamping(damping);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationTendon_getDamping_0(physx::PxArticulationTendon* self) {
  return self->getDamping();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationTendon_setLimitStiffness_1(physx::PxArticulationTendon* self, float stiffness) {
  self->setLimitStiffness(stiffness);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationTendon_getLimitStiffness_0(physx::PxArticulationTendon* self) {
  return self->getLimitStiffness();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationTendon_setOffset_1(physx::PxArticulationTendon* self, float offset) {
  self->setOffset(offset);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationTendon_setOffset_2(physx::PxArticulationTendon* self, float offset, bool autowake) {
  self->setOffset(offset, autowake);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationTendon_getOffset_0(physx::PxArticulationTendon* self) {
  return self->getOffset();
}

physx::PxArticulationReducedCoordinate* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationTendon_getArticulation_0(physx::PxArticulationTendon* self) {
  return self->getArticulation();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationTendon_release_0(physx::PxArticulationTendon* self) {
  self->release();
}

const char* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationTendon_getConcreteTypeName_0(physx::PxArticulationTendon* self) {
  return self->getConcreteTypeName();
}

int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationTendon_getConcreteType_0(physx::PxArticulationTendon* self) {
  return self->getConcreteType();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationTendon_setBaseFlag_2(physx::PxArticulationTendon* self, PxBaseFlagEnum flag, bool value) {
  self->setBaseFlag(flag, value);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationTendon_setBaseFlags_1(physx::PxArticulationTendon* self, physx::PxBaseFlags* inFlags) {
  self->setBaseFlags(*inFlags);
}

physx::PxBaseFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationTendon_getBaseFlags_0(physx::PxArticulationTendon* self) {
  static thread_local physx::PxBaseFlags temp;
  return (temp = self->getBaseFlags(), &temp);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationTendon_isReleasable_0(physx::PxArticulationTendon* self) {
  return self->isReleasable();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationTendon___destroy___0(physx::PxArticulationTendon* self) {
  delete self;
}

// Interface: PxBaseMaterial


void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBaseMaterial_release_0(physx::PxBaseMaterial* self) {
  self->release();
}

const char* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBaseMaterial_getConcreteTypeName_0(physx::PxBaseMaterial* self) {
  return self->getConcreteTypeName();
}

int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBaseMaterial_getConcreteType_0(physx::PxBaseMaterial* self) {
  return self->getConcreteType();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBaseMaterial_setBaseFlag_2(physx::PxBaseMaterial* self, PxBaseFlagEnum flag, bool value) {
  self->setBaseFlag(flag, value);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBaseMaterial_setBaseFlags_1(physx::PxBaseMaterial* self, physx::PxBaseFlags* inFlags) {
  self->setBaseFlags(*inFlags);
}

physx::PxBaseFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBaseMaterial_getBaseFlags_0(physx::PxBaseMaterial* self) {
  static thread_local physx::PxBaseFlags temp;
  return (temp = self->getBaseFlags(), &temp);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBaseMaterial_isReleasable_0(physx::PxBaseMaterial* self) {
  return self->isReleasable();
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBaseMaterial_getReferenceCount_0(physx::PxBaseMaterial* self) {
  return self->getReferenceCount();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBaseMaterial_acquireReference_0(physx::PxBaseMaterial* self) {
  self->acquireReference();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBaseMaterial___destroy___0(physx::PxBaseMaterial* self) {
  delete self;
}

// Interface: PxConstraintConnector


void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxConstraintConnector_prepareData_0(physx::PxConstraintConnector* self) {
  self->prepareData();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxConstraintConnector_updateOmniPvdProperties_0(physx::PxConstraintConnector* self) {
  self->updateOmniPvdProperties();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxConstraintConnector_onConstraintRelease_0(physx::PxConstraintConnector* self) {
  self->onConstraintRelease();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxConstraintConnector_onComShift_1(physx::PxConstraintConnector* self, unsigned int actor) {
  self->onComShift(actor);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxConstraintConnector_onOriginShift_1(physx::PxConstraintConnector* self, const physx::PxVec3* shift) {
  self->onOriginShift(*shift);
}

physx::PxBase* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxConstraintConnector_getSerializable_0(physx::PxConstraintConnector* self) {
  return self->getSerializable();
}

physx::PxConstraintSolverPrep* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxConstraintConnector_getPrep_0(physx::PxConstraintConnector* self) {
  static thread_local physx::PxConstraintSolverPrep temp;
  return (temp = self->getPrep(), &temp);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxConstraintConnector_getConstantBlock_0(physx::PxConstraintConnector* self) {
  self->getConstantBlock();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxConstraintConnector_connectToConstraint_1(physx::PxConstraintConnector* self, physx::PxConstraint* constraint) {
  self->connectToConstraint(constraint);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxConstraintConnector___destroy___0(physx::PxConstraintConnector* self) {
  delete self;
}

// Interface: PxController


PxControllerShapeTypeEnum EMSCRIPTEN_KEEPALIVE emscripten_bind_PxController_getType_0(physx::PxController* self) {
  return self->getType();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxController_release_0(physx::PxController* self) {
  self->release();
}

physx::PxControllerCollisionFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxController_move_4(physx::PxController* self, const physx::PxVec3* disp, float minDist, float elapsedTime, const physx::PxControllerFilters* filters) {
  static thread_local physx::PxControllerCollisionFlags temp;
  return (temp = self->move(*disp, minDist, elapsedTime, *filters), &temp);
}

physx::PxControllerCollisionFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxController_move_5(physx::PxController* self, const physx::PxVec3* disp, float minDist, float elapsedTime, const physx::PxControllerFilters* filters, const physx::PxObstacleContext* obstacles) {
  static thread_local physx::PxControllerCollisionFlags temp;
  return (temp = self->move(*disp, minDist, elapsedTime, *filters, obstacles), &temp);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxController_setPosition_1(physx::PxController* self, const physx::PxExtendedVec3* position) {
  return self->setPosition(*position);
}

const physx::PxExtendedVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxController_getPosition_0(physx::PxController* self) {
  return &self->getPosition();
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxController_setFootPosition_1(physx::PxController* self, const physx::PxExtendedVec3* position) {
  return self->setFootPosition(*position);
}

physx::PxExtendedVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxController_getFootPosition_0(physx::PxController* self) {
  static thread_local physx::PxExtendedVec3 temp;
  return (temp = self->getFootPosition(), &temp);
}

physx::PxRigidDynamic* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxController_getActor_0(physx::PxController* self) {
  return self->getActor();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxController_setStepOffset_1(physx::PxController* self, float offset) {
  self->setStepOffset(offset);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxController_getStepOffset_0(physx::PxController* self) {
  return self->getStepOffset();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxController_setNonWalkableMode_1(physx::PxController* self, PxControllerNonWalkableModeEnum flag) {
  self->setNonWalkableMode(flag);
}

PxControllerNonWalkableModeEnum EMSCRIPTEN_KEEPALIVE emscripten_bind_PxController_getNonWalkableMode_0(physx::PxController* self) {
  return self->getNonWalkableMode();
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxController_getContactOffset_0(physx::PxController* self) {
  return self->getContactOffset();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxController_setContactOffset_1(physx::PxController* self, float offset) {
  self->setContactOffset(offset);
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxController_getUpDirection_0(physx::PxController* self) {
  static thread_local physx::PxVec3 temp;
  return (temp = self->getUpDirection(), &temp);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxController_setUpDirection_1(physx::PxController* self, const physx::PxVec3* up) {
  self->setUpDirection(*up);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxController_getSlopeLimit_0(physx::PxController* self) {
  return self->getSlopeLimit();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxController_setSlopeLimit_1(physx::PxController* self, float slopeLimit) {
  self->setSlopeLimit(slopeLimit);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxController_invalidateCache_0(physx::PxController* self) {
  self->invalidateCache();
}

physx::PxScene* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxController_getScene_0(physx::PxController* self) {
  return self->getScene();
}

void* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxController_getUserData_0(physx::PxController* self) {
  return self->getUserData();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxController_setUserData_1(physx::PxController* self, void* userData) {
  self->setUserData(userData);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxController_getState_1(physx::PxController* self, physx::PxControllerState* state) {
  self->getState(*state);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxController_getStats_1(physx::PxController* self, physx::PxControllerStats* stats) {
  self->getStats(*stats);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxController_resize_1(physx::PxController* self, float height) {
  self->resize(height);
}

// Interface: PxControllerDesc


bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerDesc_isValid_0(physx::PxControllerDesc* self) {
  return self->isValid();
}

PxControllerShapeTypeEnum EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerDesc_getType_0(physx::PxControllerDesc* self) {
  return self->getType();
}

physx::PxExtendedVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerDesc_get_position_0(physx::PxControllerDesc* self) {
  return &self->position;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerDesc_set_position_1(physx::PxControllerDesc* self, physx::PxExtendedVec3* arg0) {
  self->position = *arg0;
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerDesc_get_upDirection_0(physx::PxControllerDesc* self) {
  return &self->upDirection;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerDesc_set_upDirection_1(physx::PxControllerDesc* self, physx::PxVec3* arg0) {
  self->upDirection = *arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerDesc_get_slopeLimit_0(physx::PxControllerDesc* self) {
  return self->slopeLimit;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerDesc_set_slopeLimit_1(physx::PxControllerDesc* self, float arg0) {
  self->slopeLimit = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerDesc_get_invisibleWallHeight_0(physx::PxControllerDesc* self) {
  return self->invisibleWallHeight;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerDesc_set_invisibleWallHeight_1(physx::PxControllerDesc* self, float arg0) {
  self->invisibleWallHeight = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerDesc_get_maxJumpHeight_0(physx::PxControllerDesc* self) {
  return self->maxJumpHeight;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerDesc_set_maxJumpHeight_1(physx::PxControllerDesc* self, float arg0) {
  self->maxJumpHeight = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerDesc_get_contactOffset_0(physx::PxControllerDesc* self) {
  return self->contactOffset;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerDesc_set_contactOffset_1(physx::PxControllerDesc* self, float arg0) {
  self->contactOffset = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerDesc_get_stepOffset_0(physx::PxControllerDesc* self) {
  return self->stepOffset;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerDesc_set_stepOffset_1(physx::PxControllerDesc* self, float arg0) {
  self->stepOffset = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerDesc_get_density_0(physx::PxControllerDesc* self) {
  return self->density;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerDesc_set_density_1(physx::PxControllerDesc* self, float arg0) {
  self->density = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerDesc_get_scaleCoeff_0(physx::PxControllerDesc* self) {
  return self->scaleCoeff;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerDesc_set_scaleCoeff_1(physx::PxControllerDesc* self, float arg0) {
  self->scaleCoeff = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerDesc_get_volumeGrowth_0(physx::PxControllerDesc* self) {
  return self->volumeGrowth;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerDesc_set_volumeGrowth_1(physx::PxControllerDesc* self, float arg0) {
  self->volumeGrowth = arg0;
}

physx::PxUserControllerHitReport* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerDesc_get_reportCallback_0(physx::PxControllerDesc* self) {
  return self->reportCallback;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerDesc_set_reportCallback_1(physx::PxControllerDesc* self, physx::PxUserControllerHitReport* arg0) {
  self->reportCallback = arg0;
}

physx::PxControllerBehaviorCallback* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerDesc_get_behaviorCallback_0(physx::PxControllerDesc* self) {
  return self->behaviorCallback;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerDesc_set_behaviorCallback_1(physx::PxControllerDesc* self, physx::PxControllerBehaviorCallback* arg0) {
  self->behaviorCallback = arg0;
}

PxControllerNonWalkableModeEnum EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerDesc_get_nonWalkableMode_0(physx::PxControllerDesc* self) {
  return self->nonWalkableMode;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerDesc_set_nonWalkableMode_1(physx::PxControllerDesc* self, PxControllerNonWalkableModeEnum arg0) {
  self->nonWalkableMode = arg0;
}

physx::PxMaterial* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerDesc_get_material_0(physx::PxControllerDesc* self) {
  return self->material;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerDesc_set_material_1(physx::PxControllerDesc* self, physx::PxMaterial* arg0) {
  self->material = arg0;
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerDesc_get_registerDeletionListener_0(physx::PxControllerDesc* self) {
  return self->registerDeletionListener;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerDesc_set_registerDeletionListener_1(physx::PxControllerDesc* self, bool arg0) {
  self->registerDeletionListener = arg0;
}

void* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerDesc_get_userData_0(physx::PxControllerDesc* self) {
  return self->userData;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerDesc_set_userData_1(physx::PxControllerDesc* self, void* arg0) {
  self->userData = arg0;
}

// Interface: PxControllerFilterCallback


bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerFilterCallback_filter_2(physx::PxControllerFilterCallback* self, const physx::PxController* a, const physx::PxController* b) {
  return self->filter(*a, *b);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerFilterCallback___destroy___0(physx::PxControllerFilterCallback* self) {
  delete self;
}

// Interface: PxControllerHit


physx::PxController* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerHit_get_controller_0(physx::PxControllerHit* self) {
  return self->controller;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerHit_set_controller_1(physx::PxControllerHit* self, physx::PxController* arg0) {
  self->controller = arg0;
}

physx::PxExtendedVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerHit_get_worldPos_0(physx::PxControllerHit* self) {
  return &self->worldPos;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerHit_set_worldPos_1(physx::PxControllerHit* self, physx::PxExtendedVec3* arg0) {
  self->worldPos = *arg0;
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerHit_get_worldNormal_0(physx::PxControllerHit* self) {
  return &self->worldNormal;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerHit_set_worldNormal_1(physx::PxControllerHit* self, physx::PxVec3* arg0) {
  self->worldNormal = *arg0;
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerHit_get_dir_0(physx::PxControllerHit* self) {
  return &self->dir;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerHit_set_dir_1(physx::PxControllerHit* self, physx::PxVec3* arg0) {
  self->dir = *arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerHit_get_length_0(physx::PxControllerHit* self) {
  return self->length;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerHit_set_length_1(physx::PxControllerHit* self, float arg0) {
  self->length = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerHit___destroy___0(physx::PxControllerHit* self) {
  delete self;
}

// Interface: PxCpuDispatcher


void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCpuDispatcher___destroy___0(physx::PxCpuDispatcher* self) {
  delete self;
}

// Interface: PxErrorCallback


void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxErrorCallback_reportError_4(physx::PxErrorCallback* self, PxErrorCodeEnum code, const char* message, const char* file, int line) {
  self->reportError(code, message, file, line);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxErrorCallback___destroy___0(physx::PxErrorCallback* self) {
  delete self;
}

// Interface: PxGeomRaycastHit


bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGeomRaycastHit_hadInitialOverlap_0(physx::PxGeomRaycastHit* self) {
  return self->hadInitialOverlap();
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGeomRaycastHit_get_u_0(physx::PxGeomRaycastHit* self) {
  return self->u;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGeomRaycastHit_set_u_1(physx::PxGeomRaycastHit* self, float arg0) {
  self->u = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGeomRaycastHit_get_v_0(physx::PxGeomRaycastHit* self) {
  return self->v;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGeomRaycastHit_set_v_1(physx::PxGeomRaycastHit* self, float arg0) {
  self->v = arg0;
}

physx::PxHitFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGeomRaycastHit_get_flags_0(physx::PxGeomRaycastHit* self) {
  return &self->flags;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGeomRaycastHit_set_flags_1(physx::PxGeomRaycastHit* self, physx::PxHitFlags* arg0) {
  self->flags = *arg0;
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGeomRaycastHit_get_position_0(physx::PxGeomRaycastHit* self) {
  return &self->position;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGeomRaycastHit_set_position_1(physx::PxGeomRaycastHit* self, physx::PxVec3* arg0) {
  self->position = *arg0;
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGeomRaycastHit_get_normal_0(physx::PxGeomRaycastHit* self) {
  return &self->normal;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGeomRaycastHit_set_normal_1(physx::PxGeomRaycastHit* self, physx::PxVec3* arg0) {
  self->normal = *arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGeomRaycastHit_get_distance_0(physx::PxGeomRaycastHit* self) {
  return self->distance;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGeomRaycastHit_set_distance_1(physx::PxGeomRaycastHit* self, float arg0) {
  self->distance = arg0;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGeomRaycastHit_get_faceIndex_0(physx::PxGeomRaycastHit* self) {
  return self->faceIndex;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGeomRaycastHit_set_faceIndex_1(physx::PxGeomRaycastHit* self, unsigned int arg0) {
  self->faceIndex = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGeomRaycastHit___destroy___0(physx::PxGeomRaycastHit* self) {
  delete self;
}

// Interface: PxGeomSweepHit


bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGeomSweepHit_hadInitialOverlap_0(physx::PxGeomSweepHit* self) {
  return self->hadInitialOverlap();
}

physx::PxHitFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGeomSweepHit_get_flags_0(physx::PxGeomSweepHit* self) {
  return &self->flags;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGeomSweepHit_set_flags_1(physx::PxGeomSweepHit* self, physx::PxHitFlags* arg0) {
  self->flags = *arg0;
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGeomSweepHit_get_position_0(physx::PxGeomSweepHit* self) {
  return &self->position;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGeomSweepHit_set_position_1(physx::PxGeomSweepHit* self, physx::PxVec3* arg0) {
  self->position = *arg0;
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGeomSweepHit_get_normal_0(physx::PxGeomSweepHit* self) {
  return &self->normal;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGeomSweepHit_set_normal_1(physx::PxGeomSweepHit* self, physx::PxVec3* arg0) {
  self->normal = *arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGeomSweepHit_get_distance_0(physx::PxGeomSweepHit* self) {
  return self->distance;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGeomSweepHit_set_distance_1(physx::PxGeomSweepHit* self, float arg0) {
  self->distance = arg0;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGeomSweepHit_get_faceIndex_0(physx::PxGeomSweepHit* self) {
  return self->faceIndex;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGeomSweepHit_set_faceIndex_1(physx::PxGeomSweepHit* self, unsigned int arg0) {
  self->faceIndex = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGeomSweepHit___destroy___0(physx::PxGeomSweepHit* self) {
  delete self;
}

// Interface: PxGeometry


PxGeometryTypeEnum EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGeometry_getType_0(physx::PxGeometry* self) {
  return self->getType();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGeometry___destroy___0(physx::PxGeometry* self) {
  delete self;
}

// Interface: PxI32ConstPtr


void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxI32ConstPtr___destroy___0(PxI32ConstPtr* self) {
  delete self;
}

// Interface: PxInputData


void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxInputData___destroy___0(physx::PxInputData* self) {
  delete self;
}

// Interface: PxJoint


void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJoint_setActors_2(physx::PxJoint* self, physx::PxRigidActor* actor0, physx::PxRigidActor* actor1) {
  self->setActors(actor0, actor1);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJoint_setLocalPose_2(physx::PxJoint* self, PxJointActorIndexEnum actor, const physx::PxTransform* localPose) {
  self->setLocalPose(actor, *localPose);
}

physx::PxTransform* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJoint_getLocalPose_1(physx::PxJoint* self, PxJointActorIndexEnum actor) {
  static thread_local physx::PxTransform temp;
  return (temp = self->getLocalPose(actor), &temp);
}

physx::PxTransform* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJoint_getRelativeTransform_0(physx::PxJoint* self) {
  static thread_local physx::PxTransform temp;
  return (temp = self->getRelativeTransform(), &temp);
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJoint_getRelativeLinearVelocity_0(physx::PxJoint* self) {
  static thread_local physx::PxVec3 temp;
  return (temp = self->getRelativeLinearVelocity(), &temp);
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJoint_getRelativeAngularVelocity_0(physx::PxJoint* self) {
  static thread_local physx::PxVec3 temp;
  return (temp = self->getRelativeAngularVelocity(), &temp);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJoint_setBreakForce_2(physx::PxJoint* self, float force, float torque) {
  self->setBreakForce(force, torque);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJoint_setConstraintFlags_1(physx::PxJoint* self, physx::PxConstraintFlags* flags) {
  self->setConstraintFlags(*flags);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJoint_setConstraintFlag_2(physx::PxJoint* self, PxConstraintFlagEnum flag, bool value) {
  self->setConstraintFlag(flag, value);
}

physx::PxConstraintFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJoint_getConstraintFlags_0(physx::PxJoint* self) {
  static thread_local physx::PxConstraintFlags temp;
  return (temp = self->getConstraintFlags(), &temp);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJoint_setInvMassScale0_1(physx::PxJoint* self, float invMassScale) {
  self->setInvMassScale0(invMassScale);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJoint_getInvMassScale0_0(physx::PxJoint* self) {
  return self->getInvMassScale0();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJoint_setInvMassScale1_1(physx::PxJoint* self, float invMassScale) {
  self->setInvMassScale1(invMassScale);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJoint_getInvMassScale1_0(physx::PxJoint* self) {
  return self->getInvMassScale1();
}

physx::PxConstraint* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJoint_getConstraint_0(physx::PxJoint* self) {
  return self->getConstraint();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJoint_setName_1(physx::PxJoint* self, const char* name) {
  self->setName(name);
}

const char* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJoint_getName_0(physx::PxJoint* self) {
  return self->getName();
}

physx::PxScene* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJoint_getScene_0(physx::PxJoint* self) {
  return self->getScene();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJoint_release_0(physx::PxJoint* self) {
  self->release();
}

const char* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJoint_getConcreteTypeName_0(physx::PxJoint* self) {
  return self->getConcreteTypeName();
}

int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJoint_getConcreteType_0(physx::PxJoint* self) {
  return self->getConcreteType();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJoint_setBaseFlag_2(physx::PxJoint* self, PxBaseFlagEnum flag, bool value) {
  self->setBaseFlag(flag, value);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJoint_setBaseFlags_1(physx::PxJoint* self, physx::PxBaseFlags* inFlags) {
  self->setBaseFlags(*inFlags);
}

physx::PxBaseFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJoint_getBaseFlags_0(physx::PxJoint* self) {
  static thread_local physx::PxBaseFlags temp;
  return (temp = self->getBaseFlags(), &temp);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJoint_isReleasable_0(physx::PxJoint* self) {
  return self->isReleasable();
}

void* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJoint_get_userData_0(physx::PxJoint* self) {
  return self->userData;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJoint_set_userData_1(physx::PxJoint* self, void* arg0) {
  self->userData = arg0;
}

// Interface: PxJointLimitParameters


bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointLimitParameters_isValid_0(physx::PxJointLimitParameters* self) {
  return self->isValid();
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointLimitParameters_isSoft_0(physx::PxJointLimitParameters* self) {
  return self->isSoft();
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointLimitParameters_get_restitution_0(physx::PxJointLimitParameters* self) {
  return self->restitution;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointLimitParameters_set_restitution_1(physx::PxJointLimitParameters* self, float arg0) {
  self->restitution = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointLimitParameters_get_bounceThreshold_0(physx::PxJointLimitParameters* self) {
  return self->bounceThreshold;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointLimitParameters_set_bounceThreshold_1(physx::PxJointLimitParameters* self, float arg0) {
  self->bounceThreshold = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointLimitParameters_get_stiffness_0(physx::PxJointLimitParameters* self) {
  return self->stiffness;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointLimitParameters_set_stiffness_1(physx::PxJointLimitParameters* self, float arg0) {
  self->stiffness = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointLimitParameters_get_damping_0(physx::PxJointLimitParameters* self) {
  return self->damping;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointLimitParameters_set_damping_1(physx::PxJointLimitParameters* self, float arg0) {
  self->damping = arg0;
}

// Interface: PxObstacle


PxGeometryTypeEnum EMSCRIPTEN_KEEPALIVE emscripten_bind_PxObstacle_getType_0(physx::PxObstacle* self) {
  return self->getType();
}

void* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxObstacle_get_mUserData_0(physx::PxObstacle* self) {
  return self->mUserData;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxObstacle_set_mUserData_1(physx::PxObstacle* self, void* arg0) {
  self->mUserData = arg0;
}

physx::PxExtendedVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxObstacle_get_mPos_0(physx::PxObstacle* self) {
  return &self->mPos;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxObstacle_set_mPos_1(physx::PxObstacle* self, physx::PxExtendedVec3* arg0) {
  self->mPos = *arg0;
}

physx::PxQuat* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxObstacle_get_mRot_0(physx::PxObstacle* self) {
  return &self->mRot;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxObstacle_set_mRot_1(physx::PxObstacle* self, physx::PxQuat* arg0) {
  self->mRot = *arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxObstacle___destroy___0(physx::PxObstacle* self) {
  delete self;
}

// Interface: PxOutputStream


void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxOutputStream___destroy___0(physx::PxOutputStream* self) {
  delete self;
}

// Interface: PxOverlapCallback


bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxOverlapCallback_hasAnyHits_0(physx::PxOverlapCallback* self) {
  return self->hasAnyHits();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxOverlapCallback___destroy___0(physx::PxOverlapCallback* self) {
  delete self;
}

// Interface: PxRaycastCallback


bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRaycastCallback_hasAnyHits_0(physx::PxRaycastCallback* self) {
  return self->hasAnyHits();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRaycastCallback___destroy___0(physx::PxRaycastCallback* self) {
  delete self;
}

// Interface: PxRealConstPtr


void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRealConstPtr___destroy___0(PxRealConstPtr* self) {
  delete self;
}

// Interface: PxRigidBody


void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBody_setCMassLocalPose_1(physx::PxRigidBody* self, const physx::PxTransform* pose) {
  self->setCMassLocalPose(*pose);
}

physx::PxTransform* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBody_getCMassLocalPose_0(physx::PxRigidBody* self) {
  static thread_local physx::PxTransform temp;
  return (temp = self->getCMassLocalPose(), &temp);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBody_setMass_1(physx::PxRigidBody* self, float mass) {
  self->setMass(mass);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBody_getMass_0(physx::PxRigidBody* self) {
  return self->getMass();
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBody_getInvMass_0(physx::PxRigidBody* self) {
  return self->getInvMass();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBody_setMassSpaceInertiaTensor_1(physx::PxRigidBody* self, const physx::PxVec3* m) {
  self->setMassSpaceInertiaTensor(*m);
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBody_getMassSpaceInertiaTensor_0(physx::PxRigidBody* self) {
  static thread_local physx::PxVec3 temp;
  return (temp = self->getMassSpaceInertiaTensor(), &temp);
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBody_getMassSpaceInvInertiaTensor_0(physx::PxRigidBody* self) {
  static thread_local physx::PxVec3 temp;
  return (temp = self->getMassSpaceInvInertiaTensor(), &temp);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBody_setLinearDamping_1(physx::PxRigidBody* self, float linDamp) {
  self->setLinearDamping(linDamp);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBody_getLinearDamping_0(physx::PxRigidBody* self) {
  return self->getLinearDamping();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBody_setAngularDamping_1(physx::PxRigidBody* self, float angDamp) {
  self->setAngularDamping(angDamp);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBody_getAngularDamping_0(physx::PxRigidBody* self) {
  return self->getAngularDamping();
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBody_getLinearVelocity_0(physx::PxRigidBody* self) {
  static thread_local physx::PxVec3 temp;
  return (temp = self->getLinearVelocity(), &temp);
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBody_getAngularVelocity_0(physx::PxRigidBody* self) {
  static thread_local physx::PxVec3 temp;
  return (temp = self->getAngularVelocity(), &temp);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBody_setMaxLinearVelocity_1(physx::PxRigidBody* self, float maxLinVel) {
  self->setMaxLinearVelocity(maxLinVel);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBody_getMaxLinearVelocity_0(physx::PxRigidBody* self) {
  return self->getMaxLinearVelocity();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBody_setMaxAngularVelocity_1(physx::PxRigidBody* self, float maxAngVel) {
  self->setMaxAngularVelocity(maxAngVel);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBody_getMaxAngularVelocity_0(physx::PxRigidBody* self) {
  return self->getMaxAngularVelocity();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBody_addForce_1(physx::PxRigidBody* self, const physx::PxVec3* force) {
  self->addForce(*force);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBody_addForce_2(physx::PxRigidBody* self, const physx::PxVec3* force, PxForceModeEnum mode) {
  self->addForce(*force, mode);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBody_addForce_3(physx::PxRigidBody* self, const physx::PxVec3* force, PxForceModeEnum mode, bool autowake) {
  self->addForce(*force, mode, autowake);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBody_addTorque_1(physx::PxRigidBody* self, const physx::PxVec3* torque) {
  self->addTorque(*torque);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBody_addTorque_2(physx::PxRigidBody* self, const physx::PxVec3* torque, PxForceModeEnum mode) {
  self->addTorque(*torque, mode);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBody_addTorque_3(physx::PxRigidBody* self, const physx::PxVec3* torque, PxForceModeEnum mode, bool autowake) {
  self->addTorque(*torque, mode, autowake);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBody_clearForce_1(physx::PxRigidBody* self, PxForceModeEnum mode) {
  self->clearForce(mode);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBody_clearTorque_1(physx::PxRigidBody* self, PxForceModeEnum mode) {
  self->clearTorque(mode);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBody_setForceAndTorque_2(physx::PxRigidBody* self, const physx::PxVec3* force, const physx::PxVec3* torque) {
  self->setForceAndTorque(*force, *torque);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBody_setForceAndTorque_3(physx::PxRigidBody* self, const physx::PxVec3* force, const physx::PxVec3* torque, PxForceModeEnum mode) {
  self->setForceAndTorque(*force, *torque, mode);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBody_setRigidBodyFlag_2(physx::PxRigidBody* self, PxRigidBodyFlagEnum flag, bool value) {
  self->setRigidBodyFlag(flag, value);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBody_setRigidBodyFlags_1(physx::PxRigidBody* self, physx::PxRigidBodyFlags* inFlags) {
  self->setRigidBodyFlags(*inFlags);
}

physx::PxRigidBodyFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBody_getRigidBodyFlags_0(physx::PxRigidBody* self) {
  static thread_local physx::PxRigidBodyFlags temp;
  return (temp = self->getRigidBodyFlags(), &temp);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBody_setMinCCDAdvanceCoefficient_1(physx::PxRigidBody* self, float advanceCoefficient) {
  self->setMinCCDAdvanceCoefficient(advanceCoefficient);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBody_getMinCCDAdvanceCoefficient_0(physx::PxRigidBody* self) {
  return self->getMinCCDAdvanceCoefficient();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBody_setMaxDepenetrationVelocity_1(physx::PxRigidBody* self, float biasClamp) {
  self->setMaxDepenetrationVelocity(biasClamp);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBody_getMaxDepenetrationVelocity_0(physx::PxRigidBody* self) {
  return self->getMaxDepenetrationVelocity();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBody_setMaxContactImpulse_1(physx::PxRigidBody* self, float maxImpulse) {
  self->setMaxContactImpulse(maxImpulse);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBody_getMaxContactImpulse_0(physx::PxRigidBody* self) {
  return self->getMaxContactImpulse();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBody_setContactSlopCoefficient_1(physx::PxRigidBody* self, float slopCoefficient) {
  self->setContactSlopCoefficient(slopCoefficient);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBody_getContactSlopCoefficient_0(physx::PxRigidBody* self) {
  return self->getContactSlopCoefficient();
}

PxActorTypeEnum EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBody_getType_0(physx::PxRigidBody* self) {
  return self->getType();
}

physx::PxScene* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBody_getScene_0(physx::PxRigidBody* self) {
  return self->getScene();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBody_setName_1(physx::PxRigidBody* self, const char* name) {
  self->setName(name);
}

const char* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBody_getName_0(physx::PxRigidBody* self) {
  return self->getName();
}

physx::PxBounds3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBody_getWorldBounds_0(physx::PxRigidBody* self) {
  static thread_local physx::PxBounds3 temp;
  return (temp = self->getWorldBounds(), &temp);
}

physx::PxBounds3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBody_getWorldBounds_1(physx::PxRigidBody* self, float inflation) {
  static thread_local physx::PxBounds3 temp;
  return (temp = self->getWorldBounds(inflation), &temp);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBody_setActorFlag_2(physx::PxRigidBody* self, PxActorFlagEnum flag, bool value) {
  self->setActorFlag(flag, value);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBody_setActorFlags_1(physx::PxRigidBody* self, physx::PxActorFlags* flags) {
  self->setActorFlags(*flags);
}

physx::PxActorFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBody_getActorFlags_0(physx::PxRigidBody* self) {
  static thread_local physx::PxActorFlags temp;
  return (temp = self->getActorFlags(), &temp);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBody_setDominanceGroup_1(physx::PxRigidBody* self, unsigned char dominanceGroup) {
  self->setDominanceGroup(dominanceGroup);
}

unsigned char EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBody_getDominanceGroup_0(physx::PxRigidBody* self) {
  return self->getDominanceGroup();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBody_setOwnerClient_1(physx::PxRigidBody* self, unsigned char inClient) {
  self->setOwnerClient(inClient);
}

unsigned char EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBody_getOwnerClient_0(physx::PxRigidBody* self) {
  return self->getOwnerClient();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBody_release_0(physx::PxRigidBody* self) {
  self->release();
}

const char* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBody_getConcreteTypeName_0(physx::PxRigidBody* self) {
  return self->getConcreteTypeName();
}

int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBody_getConcreteType_0(physx::PxRigidBody* self) {
  return self->getConcreteType();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBody_setBaseFlag_2(physx::PxRigidBody* self, PxBaseFlagEnum flag, bool value) {
  self->setBaseFlag(flag, value);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBody_setBaseFlags_1(physx::PxRigidBody* self, physx::PxBaseFlags* inFlags) {
  self->setBaseFlags(*inFlags);
}

physx::PxBaseFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBody_getBaseFlags_0(physx::PxRigidBody* self) {
  static thread_local physx::PxBaseFlags temp;
  return (temp = self->getBaseFlags(), &temp);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBody_isReleasable_0(physx::PxRigidBody* self) {
  return self->isReleasable();
}

physx::PxTransform* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBody_getGlobalPose_0(physx::PxRigidBody* self) {
  static thread_local physx::PxTransform temp;
  return (temp = self->getGlobalPose(), &temp);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBody_setGlobalPose_1(physx::PxRigidBody* self, const physx::PxTransform* pose) {
  self->setGlobalPose(*pose);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBody_setGlobalPose_2(physx::PxRigidBody* self, const physx::PxTransform* pose, bool autowake) {
  self->setGlobalPose(*pose, autowake);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBody_attachShape_1(physx::PxRigidBody* self, physx::PxShape* shape) {
  return self->attachShape(*shape);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBody_detachShape_1(physx::PxRigidBody* self, physx::PxShape* shape) {
  self->detachShape(*shape);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBody_detachShape_2(physx::PxRigidBody* self, physx::PxShape* shape, bool wakeOnLostTouch) {
  self->detachShape(*shape, wakeOnLostTouch);
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBody_getNbShapes_0(physx::PxRigidBody* self) {
  return self->getNbShapes();
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBody_getShapes_3(physx::PxRigidBody* self, PxShapePtr* userBuffer, unsigned int bufferSize, unsigned int startIndex) {
  return self->getShapes(userBuffer, bufferSize, startIndex);
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBody_getNbConstraints_0(physx::PxRigidBody* self) {
  return self->getNbConstraints();
}

void* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBody_get_userData_0(physx::PxRigidBody* self) {
  return self->userData;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBody_set_userData_1(physx::PxRigidBody* self, void* arg0) {
  self->userData = arg0;
}

// Interface: PxSceneSQSystem


void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneSQSystem_setSceneQueryUpdateMode_1(physx::PxSceneSQSystem* self, PxSceneQueryUpdateModeEnum updateMode) {
  self->setSceneQueryUpdateMode(updateMode);
}

PxSceneQueryUpdateModeEnum EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneSQSystem_getSceneQueryUpdateMode_0(physx::PxSceneSQSystem* self) {
  return self->getSceneQueryUpdateMode();
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneSQSystem_getSceneQueryStaticTimestamp_0(physx::PxSceneSQSystem* self) {
  return self->getSceneQueryStaticTimestamp();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneSQSystem_flushQueryUpdates_0(physx::PxSceneSQSystem* self) {
  self->flushQueryUpdates();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneSQSystem_forceDynamicTreeRebuild_2(physx::PxSceneSQSystem* self, bool rebuildStaticStructure, bool rebuildDynamicStructure) {
  self->forceDynamicTreeRebuild(rebuildStaticStructure, rebuildDynamicStructure);
}

PxPruningStructureTypeEnum EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneSQSystem_getStaticStructure_0(physx::PxSceneSQSystem* self) {
  return self->getStaticStructure();
}

PxPruningStructureTypeEnum EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneSQSystem_getDynamicStructure_0(physx::PxSceneSQSystem* self) {
  return self->getDynamicStructure();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneSQSystem_sceneQueriesUpdate_0(physx::PxSceneSQSystem* self) {
  self->sceneQueriesUpdate();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneSQSystem_sceneQueriesUpdate_1(physx::PxSceneSQSystem* self, physx::PxBaseTask* completionTask) {
  self->sceneQueriesUpdate(completionTask);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneSQSystem_sceneQueriesUpdate_2(physx::PxSceneSQSystem* self, physx::PxBaseTask* completionTask, bool controlSimulation) {
  self->sceneQueriesUpdate(completionTask, controlSimulation);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneSQSystem_checkQueries_0(physx::PxSceneSQSystem* self) {
  return self->checkQueries();
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneSQSystem_checkQueries_1(physx::PxSceneSQSystem* self, bool block) {
  return self->checkQueries(block);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneSQSystem_fetchQueries_0(physx::PxSceneSQSystem* self) {
  return self->fetchQueries();
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneSQSystem_fetchQueries_1(physx::PxSceneSQSystem* self, bool block) {
  return self->fetchQueries(block);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneSQSystem_setDynamicTreeRebuildRateHint_1(physx::PxSceneSQSystem* self, unsigned int dynamicTreeRebuildRateHint) {
  self->setDynamicTreeRebuildRateHint(dynamicTreeRebuildRateHint);
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneSQSystem_getDynamicTreeRebuildRateHint_0(physx::PxSceneSQSystem* self) {
  return self->getDynamicTreeRebuildRateHint();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneSQSystem_forceRebuildDynamicTree_1(physx::PxSceneSQSystem* self, unsigned int prunerIndex) {
  self->forceRebuildDynamicTree(prunerIndex);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneSQSystem_setUpdateMode_1(physx::PxSceneSQSystem* self, PxSceneQueryUpdateModeEnum updateMode) {
  self->setUpdateMode(updateMode);
}

PxSceneQueryUpdateModeEnum EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneSQSystem_getUpdateMode_0(physx::PxSceneSQSystem* self) {
  return self->getUpdateMode();
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneSQSystem_getStaticTimestamp_0(physx::PxSceneSQSystem* self) {
  return self->getStaticTimestamp();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneSQSystem_flushUpdates_0(physx::PxSceneSQSystem* self) {
  self->flushUpdates();
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneSQSystem_raycast_4(physx::PxSceneSQSystem* self, const physx::PxVec3* origin, const physx::PxVec3* unitDir, float distance, physx::PxRaycastCallback* hitCall) {
  return self->raycast(*origin, *unitDir, distance, *hitCall);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneSQSystem_raycast_5(physx::PxSceneSQSystem* self, const physx::PxVec3* origin, const physx::PxVec3* unitDir, float distance, physx::PxRaycastCallback* hitCall, physx::PxHitFlags* hitFlags) {
  return self->raycast(*origin, *unitDir, distance, *hitCall, *hitFlags);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneSQSystem_raycast_6(physx::PxSceneSQSystem* self, const physx::PxVec3* origin, const physx::PxVec3* unitDir, float distance, physx::PxRaycastCallback* hitCall, physx::PxHitFlags* hitFlags, const physx::PxQueryFilterData* filterData) {
  return self->raycast(*origin, *unitDir, distance, *hitCall, *hitFlags, *filterData);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneSQSystem_sweep_5(physx::PxSceneSQSystem* self, const physx::PxGeometry* geometry, const physx::PxTransform* pose, const physx::PxVec3* unitDir, float distance, physx::PxSweepCallback* hitCall) {
  return self->sweep(*geometry, *pose, *unitDir, distance, *hitCall);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneSQSystem_sweep_6(physx::PxSceneSQSystem* self, const physx::PxGeometry* geometry, const physx::PxTransform* pose, const physx::PxVec3* unitDir, float distance, physx::PxSweepCallback* hitCall, physx::PxHitFlags* hitFlags) {
  return self->sweep(*geometry, *pose, *unitDir, distance, *hitCall, *hitFlags);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneSQSystem_sweep_7(physx::PxSceneSQSystem* self, const physx::PxGeometry* geometry, const physx::PxTransform* pose, const physx::PxVec3* unitDir, float distance, physx::PxSweepCallback* hitCall, physx::PxHitFlags* hitFlags, const physx::PxQueryFilterData* filterData) {
  return self->sweep(*geometry, *pose, *unitDir, distance, *hitCall, *hitFlags, *filterData);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneSQSystem_overlap_3(physx::PxSceneSQSystem* self, const physx::PxGeometry* geometry, const physx::PxTransform* pose, physx::PxOverlapCallback* hitCall) {
  return self->overlap(*geometry, *pose, *hitCall);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneSQSystem_overlap_4(physx::PxSceneSQSystem* self, const physx::PxGeometry* geometry, const physx::PxTransform* pose, physx::PxOverlapCallback* hitCall, const physx::PxQueryFilterData* filterData) {
  return self->overlap(*geometry, *pose, *hitCall, *filterData);
}

// Interface: PxSimpleTriangleMesh


physx::PxSimpleTriangleMesh* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSimpleTriangleMesh_PxSimpleTriangleMesh_0() {
  return new physx::PxSimpleTriangleMesh();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSimpleTriangleMesh_setToDefault_0(physx::PxSimpleTriangleMesh* self) {
  self->setToDefault();
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSimpleTriangleMesh_isValid_0(physx::PxSimpleTriangleMesh* self) {
  return self->isValid();
}

physx::PxBoundedData* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSimpleTriangleMesh_get_points_0(physx::PxSimpleTriangleMesh* self) {
  return &self->points;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSimpleTriangleMesh_set_points_1(physx::PxSimpleTriangleMesh* self, physx::PxBoundedData* arg0) {
  self->points = *arg0;
}

physx::PxBoundedData* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSimpleTriangleMesh_get_triangles_0(physx::PxSimpleTriangleMesh* self) {
  return &self->triangles;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSimpleTriangleMesh_set_triangles_1(physx::PxSimpleTriangleMesh* self, physx::PxBoundedData* arg0) {
  self->triangles = *arg0;
}

physx::PxMeshFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSimpleTriangleMesh_get_flags_0(physx::PxSimpleTriangleMesh* self) {
  return &self->flags;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSimpleTriangleMesh_set_flags_1(physx::PxSimpleTriangleMesh* self, physx::PxMeshFlags* arg0) {
  self->flags = *arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSimpleTriangleMesh___destroy___0(physx::PxSimpleTriangleMesh* self) {
  delete self;
}

// Interface: PxSpring


physx::PxSpring* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSpring_PxSpring_2(float stiffness, float damping) {
  return new physx::PxSpring(stiffness, damping);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSpring_get_stiffness_0(physx::PxSpring* self) {
  return self->stiffness;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSpring_set_stiffness_1(physx::PxSpring* self, float arg0) {
  self->stiffness = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSpring_get_damping_0(physx::PxSpring* self) {
  return self->damping;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSpring_set_damping_1(physx::PxSpring* self, float arg0) {
  self->damping = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSpring___destroy___0(physx::PxSpring* self) {
  delete self;
}

// Interface: PxStridedData


unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxStridedData_get_stride_0(physx::PxStridedData* self) {
  return self->stride;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxStridedData_set_stride_1(physx::PxStridedData* self, unsigned int arg0) {
  self->stride = arg0;
}

const void* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxStridedData_get_data_0(physx::PxStridedData* self) {
  return self->data;
}

const void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxStridedData_set_data_1(physx::PxStridedData* self, void* arg0) {
  self->data = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxStridedData___destroy___0(physx::PxStridedData* self) {
  delete self;
}

// Interface: PxSweepCallback


bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSweepCallback_hasAnyHits_0(physx::PxSweepCallback* self) {
  return self->hasAnyHits();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSweepCallback___destroy___0(physx::PxSweepCallback* self) {
  delete self;
}

// Interface: PxU16ConstPtr


void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxU16ConstPtr___destroy___0(PxU16ConstPtr* self) {
  delete self;
}

// Interface: PxU32ConstPtr


void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxU32ConstPtr___destroy___0(PxU32ConstPtr* self) {
  delete self;
}

// Interface: PxU8ConstPtr


void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxU8ConstPtr___destroy___0(PxU8ConstPtr* self) {
  delete self;
}

// Interface: PxUserControllerHitReport


void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxUserControllerHitReport_onShapeHit_1(physx::PxUserControllerHitReport* self, const physx::PxControllerShapeHit* hit) {
  self->onShapeHit(*hit);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxUserControllerHitReport_onControllerHit_1(physx::PxUserControllerHitReport* self, const physx::PxControllersHit* hit) {
  self->onControllerHit(*hit);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxUserControllerHitReport_onObstacleHit_1(physx::PxUserControllerHitReport* self, const physx::PxControllerObstacleHit* hit) {
  self->onObstacleHit(*hit);
}

// Interface: PxVehicleCommandResponseParams


physx::vehicle2::PxVehicleCommandResponseParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleCommandResponseParams_PxVehicleCommandResponseParams_0() {
  return new physx::vehicle2::PxVehicleCommandResponseParams();
}

physx::vehicle2::PxVehicleCommandNonLinearResponseParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleCommandResponseParams_get_nonlinearResponse_0(physx::vehicle2::PxVehicleCommandResponseParams* self) {
  return &self->nonlinearResponse;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleCommandResponseParams_set_nonlinearResponse_1(physx::vehicle2::PxVehicleCommandResponseParams* self, physx::vehicle2::PxVehicleCommandNonLinearResponseParams* arg0) {
  self->nonlinearResponse = *arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleCommandResponseParams_get_wheelResponseMultipliers_1(physx::vehicle2::PxVehicleCommandResponseParams* self, int arg0) {
  return self->wheelResponseMultipliers[arg0];
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleCommandResponseParams_set_wheelResponseMultipliers_2(physx::vehicle2::PxVehicleCommandResponseParams* self, int arg0, float arg1) {
  self->wheelResponseMultipliers[arg0] = arg1;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleCommandResponseParams_get_maxResponse_0(physx::vehicle2::PxVehicleCommandResponseParams* self) {
  return self->maxResponse;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleCommandResponseParams_set_maxResponse_1(physx::vehicle2::PxVehicleCommandResponseParams* self, float arg0) {
  self->maxResponse = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleCommandResponseParams___destroy___0(physx::vehicle2::PxVehicleCommandResponseParams* self) {
  delete self;
}

// Interface: PxVehicleEngineDriveTransmissionCommandState


physx::vehicle2::PxVehicleEngineDriveTransmissionCommandState* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleEngineDriveTransmissionCommandState_PxVehicleEngineDriveTransmissionCommandState_0() {
  return new physx::vehicle2::PxVehicleEngineDriveTransmissionCommandState();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleEngineDriveTransmissionCommandState_setToDefault_0(physx::vehicle2::PxVehicleEngineDriveTransmissionCommandState* self) {
  self->setToDefault();
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleEngineDriveTransmissionCommandState_get_clutch_0(physx::vehicle2::PxVehicleEngineDriveTransmissionCommandState* self) {
  return self->clutch;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleEngineDriveTransmissionCommandState_set_clutch_1(physx::vehicle2::PxVehicleEngineDriveTransmissionCommandState* self, float arg0) {
  self->clutch = arg0;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleEngineDriveTransmissionCommandState_get_targetGear_0(physx::vehicle2::PxVehicleEngineDriveTransmissionCommandState* self) {
  return self->targetGear;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleEngineDriveTransmissionCommandState_set_targetGear_1(physx::vehicle2::PxVehicleEngineDriveTransmissionCommandState* self, unsigned int arg0) {
  self->targetGear = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleEngineDriveTransmissionCommandState___destroy___0(physx::vehicle2::PxVehicleEngineDriveTransmissionCommandState* self) {
  delete self;
}

// Interface: PxVehicleMultiWheelDriveDifferentialParams


physx::vehicle2::PxVehicleMultiWheelDriveDifferentialParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleMultiWheelDriveDifferentialParams_PxVehicleMultiWheelDriveDifferentialParams_0() {
  return new physx::vehicle2::PxVehicleMultiWheelDriveDifferentialParams();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleMultiWheelDriveDifferentialParams_setToDefault_0(physx::vehicle2::PxVehicleMultiWheelDriveDifferentialParams* self) {
  self->setToDefault();
}

physx::vehicle2::PxVehicleMultiWheelDriveDifferentialParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleMultiWheelDriveDifferentialParams_transformAndScale_4(physx::vehicle2::PxVehicleMultiWheelDriveDifferentialParams* self, const physx::vehicle2::PxVehicleFrame* srcFrame, const physx::vehicle2::PxVehicleFrame* trgFrame, const physx::vehicle2::PxVehicleScale* srcScale, const physx::vehicle2::PxVehicleScale* trgScale) {
  static thread_local physx::vehicle2::PxVehicleMultiWheelDriveDifferentialParams temp;
  return (temp = self->transformAndScale(*srcFrame, *trgFrame, *srcScale, *trgScale), &temp);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleMultiWheelDriveDifferentialParams_isValid_1(physx::vehicle2::PxVehicleMultiWheelDriveDifferentialParams* self, const physx::vehicle2::PxVehicleAxleDescription* axleDesc) {
  return self->isValid(*axleDesc);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleMultiWheelDriveDifferentialParams_get_torqueRatios_1(physx::vehicle2::PxVehicleMultiWheelDriveDifferentialParams* self, int arg0) {
  return self->torqueRatios[arg0];
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleMultiWheelDriveDifferentialParams_set_torqueRatios_2(physx::vehicle2::PxVehicleMultiWheelDriveDifferentialParams* self, int arg0, float arg1) {
  self->torqueRatios[arg0] = arg1;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleMultiWheelDriveDifferentialParams_get_aveWheelSpeedRatios_1(physx::vehicle2::PxVehicleMultiWheelDriveDifferentialParams* self, int arg0) {
  return self->aveWheelSpeedRatios[arg0];
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleMultiWheelDriveDifferentialParams_set_aveWheelSpeedRatios_2(physx::vehicle2::PxVehicleMultiWheelDriveDifferentialParams* self, int arg0, float arg1) {
  self->aveWheelSpeedRatios[arg0] = arg1;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleMultiWheelDriveDifferentialParams___destroy___0(physx::vehicle2::PxVehicleMultiWheelDriveDifferentialParams* self) {
  delete self;
}

// Interface: PxVehicleSimulationContext


physx::vehicle2::PxVehicleSimulationContext* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSimulationContext_PxVehicleSimulationContext_0() {
  return new physx::vehicle2::PxVehicleSimulationContext();
}

PxVehicleSimulationContextTypeEnum EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSimulationContext_getType_0(physx::vehicle2::PxVehicleSimulationContext* self) {
  return self->getType();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSimulationContext_setToDefault_0(physx::vehicle2::PxVehicleSimulationContext* self) {
  self->setToDefault();
}

physx::vehicle2::PxVehicleSimulationContext* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSimulationContext_transformAndScale_4(physx::vehicle2::PxVehicleSimulationContext* self, const physx::vehicle2::PxVehicleFrame* srcFrame, const physx::vehicle2::PxVehicleFrame* trgFrame, const physx::vehicle2::PxVehicleScale* srcScale, const physx::vehicle2::PxVehicleScale* trgScale) {
  static thread_local physx::vehicle2::PxVehicleSimulationContext temp;
  return (temp = self->transformAndScale(*srcFrame, *trgFrame, *srcScale, *trgScale), &temp);
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSimulationContext_get_gravity_0(physx::vehicle2::PxVehicleSimulationContext* self) {
  return &self->gravity;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSimulationContext_set_gravity_1(physx::vehicle2::PxVehicleSimulationContext* self, physx::PxVec3* arg0) {
  self->gravity = *arg0;
}

physx::vehicle2::PxVehicleFrame* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSimulationContext_get_frame_0(physx::vehicle2::PxVehicleSimulationContext* self) {
  return &self->frame;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSimulationContext_set_frame_1(physx::vehicle2::PxVehicleSimulationContext* self, physx::vehicle2::PxVehicleFrame* arg0) {
  self->frame = *arg0;
}

physx::vehicle2::PxVehicleScale* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSimulationContext_get_scale_0(physx::vehicle2::PxVehicleSimulationContext* self) {
  return &self->scale;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSimulationContext_set_scale_1(physx::vehicle2::PxVehicleSimulationContext* self, physx::vehicle2::PxVehicleScale* arg0) {
  self->scale = *arg0;
}

physx::vehicle2::PxVehicleTireSlipParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSimulationContext_get_tireSlipParams_0(physx::vehicle2::PxVehicleSimulationContext* self) {
  return &self->tireSlipParams;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSimulationContext_set_tireSlipParams_1(physx::vehicle2::PxVehicleSimulationContext* self, physx::vehicle2::PxVehicleTireSlipParams* arg0) {
  self->tireSlipParams = *arg0;
}

physx::vehicle2::PxVehicleTireStickyParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSimulationContext_get_tireStickyParams_0(physx::vehicle2::PxVehicleSimulationContext* self) {
  return &self->tireStickyParams;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSimulationContext_set_tireStickyParams_1(physx::vehicle2::PxVehicleSimulationContext* self, physx::vehicle2::PxVehicleTireStickyParams* arg0) {
  self->tireStickyParams = *arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSimulationContext_get_thresholdForwardSpeedForWheelAngleIntegration_0(physx::vehicle2::PxVehicleSimulationContext* self) {
  return self->thresholdForwardSpeedForWheelAngleIntegration;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSimulationContext_set_thresholdForwardSpeedForWheelAngleIntegration_1(physx::vehicle2::PxVehicleSimulationContext* self, float arg0) {
  self->thresholdForwardSpeedForWheelAngleIntegration = arg0;
}

physx::vehicle2::PxVehiclePvdContext* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSimulationContext_get_pvdContext_0(physx::vehicle2::PxVehicleSimulationContext* self) {
  return &self->pvdContext;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSimulationContext_set_pvdContext_1(physx::vehicle2::PxVehicleSimulationContext* self, physx::vehicle2::PxVehiclePvdContext* arg0) {
  self->pvdContext = *arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSimulationContext___destroy___0(physx::vehicle2::PxVehicleSimulationContext* self) {
  delete self;
}

// Interface: SimpleControllerBehaviorCallback


unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_SimpleControllerBehaviorCallback_getShapeBehaviorFlags_2(SimpleControllerBehaviorCallback* self, const physx::PxShape* shape, const physx::PxActor* actor) {
  return self->getShapeBehaviorFlags(*shape, *actor);
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_SimpleControllerBehaviorCallback_getControllerBehaviorFlags_1(SimpleControllerBehaviorCallback* self, const physx::PxController* controller) {
  return self->getControllerBehaviorFlags(*controller);
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_SimpleControllerBehaviorCallback_getObstacleBehaviorFlags_1(SimpleControllerBehaviorCallback* self, const physx::PxObstacle* obstacle) {
  return self->getObstacleBehaviorFlags(*obstacle);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_SimpleControllerBehaviorCallback___destroy___0(SimpleControllerBehaviorCallback* self) {
  delete self;
}

// Interface: SimplePvdTransport


void EMSCRIPTEN_KEEPALIVE emscripten_bind_SimplePvdTransport_send_2(SimplePvdTransport* self, void* inBytes, unsigned int inLength) {
  self->send(inBytes, inLength);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_SimplePvdTransport_connect_0(SimplePvdTransport* self) {
  return self->connect();
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_SimplePvdTransport_isConnected_0(SimplePvdTransport* self) {
  return self->isConnected();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_SimplePvdTransport_disconnect_0(SimplePvdTransport* self) {
  self->disconnect();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_SimplePvdTransport_release_0(SimplePvdTransport* self) {
  self->release();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_SimplePvdTransport_flush_0(SimplePvdTransport* self) {
  self->flush();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_SimplePvdTransport___destroy___0(SimplePvdTransport* self) {
  delete self;
}

// Interface: SimpleQueryFilterCallback


unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_SimpleQueryFilterCallback_simplePreFilter_4(SimpleQueryFilterCallback* self, const physx::PxFilterData* filterData, const physx::PxShape* shape, const physx::PxRigidActor* actor, physx::PxHitFlags* queryFlags) {
  return self->simplePreFilter(*filterData, shape, actor, *queryFlags);
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_SimpleQueryFilterCallback_simplePostFilter_4(SimpleQueryFilterCallback* self, const physx::PxFilterData* filterData, const physx::PxQueryHit* hit, const physx::PxShape* shape, const physx::PxRigidActor* actor) {
  return self->simplePostFilter(*filterData, *hit, shape, actor);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_SimpleQueryFilterCallback___destroy___0(SimpleQueryFilterCallback* self) {
  delete self;
}

// Interface: SimpleSimulationEventCallback


void EMSCRIPTEN_KEEPALIVE emscripten_bind_SimpleSimulationEventCallback_onConstraintBreak_2(SimpleSimulationEventCallback* self, physx::PxConstraintInfo* constraints, unsigned int count) {
  self->onConstraintBreak(constraints, count);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_SimpleSimulationEventCallback_onWake_2(SimpleSimulationEventCallback* self, PxActorPtr* actors, unsigned int count) {
  self->onWake(actors, count);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_SimpleSimulationEventCallback_onSleep_2(SimpleSimulationEventCallback* self, PxActorPtr* actors, unsigned int count) {
  self->onSleep(actors, count);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_SimpleSimulationEventCallback_onContact_3(SimpleSimulationEventCallback* self, const physx::PxContactPairHeader* pairHeader, const physx::PxContactPair* pairs, unsigned int nbPairs) {
  self->onContact(*pairHeader, pairs, nbPairs);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_SimpleSimulationEventCallback_onTrigger_2(SimpleSimulationEventCallback* self, physx::PxTriggerPair* pairs, unsigned int count) {
  self->onTrigger(pairs, count);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_SimpleSimulationEventCallback___destroy___0(SimpleSimulationEventCallback* self) {
  delete self;
}

// Interface: VoidPtr


void EMSCRIPTEN_KEEPALIVE emscripten_bind_VoidPtr___destroy___0(void** self) {
  delete self;
}

// Interface: BaseVehicleParams


snippetvehicle2::BaseVehicleParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_BaseVehicleParams_BaseVehicleParams_0() {
  return new snippetvehicle2::BaseVehicleParams();
}

snippetvehicle2::BaseVehicleParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_BaseVehicleParams_transformAndScale_4(snippetvehicle2::BaseVehicleParams* self, const physx::vehicle2::PxVehicleFrame* srcFrame, const physx::vehicle2::PxVehicleFrame* trgFrame, const physx::vehicle2::PxVehicleScale* srcScale, const physx::vehicle2::PxVehicleScale* trgScale) {
  static thread_local snippetvehicle2::BaseVehicleParams temp;
  return (temp = self->transformAndScale(*srcFrame, *trgFrame, *srcScale, *trgScale), &temp);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_BaseVehicleParams_isValid_0(snippetvehicle2::BaseVehicleParams* self) {
  return self->isValid();
}

physx::vehicle2::PxVehicleAxleDescription* EMSCRIPTEN_KEEPALIVE emscripten_bind_BaseVehicleParams_get_axleDescription_0(snippetvehicle2::BaseVehicleParams* self) {
  return &self->axleDescription;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_BaseVehicleParams_set_axleDescription_1(snippetvehicle2::BaseVehicleParams* self, physx::vehicle2::PxVehicleAxleDescription* arg0) {
  self->axleDescription = *arg0;
}

physx::vehicle2::PxVehicleFrame* EMSCRIPTEN_KEEPALIVE emscripten_bind_BaseVehicleParams_get_frame_0(snippetvehicle2::BaseVehicleParams* self) {
  return &self->frame;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_BaseVehicleParams_set_frame_1(snippetvehicle2::BaseVehicleParams* self, physx::vehicle2::PxVehicleFrame* arg0) {
  self->frame = *arg0;
}

physx::vehicle2::PxVehicleScale* EMSCRIPTEN_KEEPALIVE emscripten_bind_BaseVehicleParams_get_scale_0(snippetvehicle2::BaseVehicleParams* self) {
  return &self->scale;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_BaseVehicleParams_set_scale_1(snippetvehicle2::BaseVehicleParams* self, physx::vehicle2::PxVehicleScale* arg0) {
  self->scale = *arg0;
}

physx::vehicle2::PxVehicleSuspensionStateCalculationParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_BaseVehicleParams_get_suspensionStateCalculationParams_0(snippetvehicle2::BaseVehicleParams* self) {
  return &self->suspensionStateCalculationParams;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_BaseVehicleParams_set_suspensionStateCalculationParams_1(snippetvehicle2::BaseVehicleParams* self, physx::vehicle2::PxVehicleSuspensionStateCalculationParams* arg0) {
  self->suspensionStateCalculationParams = *arg0;
}

physx::vehicle2::PxVehicleBrakeCommandResponseParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_BaseVehicleParams_get_brakeResponseParams_1(snippetvehicle2::BaseVehicleParams* self, int arg0) {
  return &self->brakeResponseParams[arg0];
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_BaseVehicleParams_set_brakeResponseParams_2(snippetvehicle2::BaseVehicleParams* self, int arg0, physx::vehicle2::PxVehicleBrakeCommandResponseParams* arg1) {
  self->brakeResponseParams[arg0] = *arg1;
}

physx::vehicle2::PxVehicleSteerCommandResponseParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_BaseVehicleParams_get_steerResponseParams_0(snippetvehicle2::BaseVehicleParams* self) {
  return &self->steerResponseParams;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_BaseVehicleParams_set_steerResponseParams_1(snippetvehicle2::BaseVehicleParams* self, physx::vehicle2::PxVehicleSteerCommandResponseParams* arg0) {
  self->steerResponseParams = *arg0;
}

physx::vehicle2::PxVehicleAckermannParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_BaseVehicleParams_get_ackermannParams_1(snippetvehicle2::BaseVehicleParams* self, int arg0) {
  return &self->ackermannParams[arg0];
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_BaseVehicleParams_set_ackermannParams_2(snippetvehicle2::BaseVehicleParams* self, int arg0, physx::vehicle2::PxVehicleAckermannParams* arg1) {
  self->ackermannParams[arg0] = *arg1;
}

physx::vehicle2::PxVehicleSuspensionParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_BaseVehicleParams_get_suspensionParams_1(snippetvehicle2::BaseVehicleParams* self, int arg0) {
  return &self->suspensionParams[arg0];
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_BaseVehicleParams_set_suspensionParams_2(snippetvehicle2::BaseVehicleParams* self, int arg0, physx::vehicle2::PxVehicleSuspensionParams* arg1) {
  self->suspensionParams[arg0] = *arg1;
}

physx::vehicle2::PxVehicleSuspensionComplianceParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_BaseVehicleParams_get_suspensionComplianceParams_1(snippetvehicle2::BaseVehicleParams* self, int arg0) {
  return &self->suspensionComplianceParams[arg0];
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_BaseVehicleParams_set_suspensionComplianceParams_2(snippetvehicle2::BaseVehicleParams* self, int arg0, physx::vehicle2::PxVehicleSuspensionComplianceParams* arg1) {
  self->suspensionComplianceParams[arg0] = *arg1;
}

physx::vehicle2::PxVehicleSuspensionForceParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_BaseVehicleParams_get_suspensionForceParams_1(snippetvehicle2::BaseVehicleParams* self, int arg0) {
  return &self->suspensionForceParams[arg0];
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_BaseVehicleParams_set_suspensionForceParams_2(snippetvehicle2::BaseVehicleParams* self, int arg0, physx::vehicle2::PxVehicleSuspensionForceParams* arg1) {
  self->suspensionForceParams[arg0] = *arg1;
}

physx::vehicle2::PxVehicleAntiRollForceParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_BaseVehicleParams_get_antiRollForceParams_1(snippetvehicle2::BaseVehicleParams* self, int arg0) {
  return &self->antiRollForceParams[arg0];
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_BaseVehicleParams_set_antiRollForceParams_2(snippetvehicle2::BaseVehicleParams* self, int arg0, physx::vehicle2::PxVehicleAntiRollForceParams* arg1) {
  self->antiRollForceParams[arg0] = *arg1;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_BaseVehicleParams_get_nbAntiRollForceParams_0(snippetvehicle2::BaseVehicleParams* self) {
  return self->nbAntiRollForceParams;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_BaseVehicleParams_set_nbAntiRollForceParams_1(snippetvehicle2::BaseVehicleParams* self, unsigned int arg0) {
  self->nbAntiRollForceParams = arg0;
}

physx::vehicle2::PxVehicleTireForceParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_BaseVehicleParams_get_tireForceParams_1(snippetvehicle2::BaseVehicleParams* self, int arg0) {
  return &self->tireForceParams[arg0];
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_BaseVehicleParams_set_tireForceParams_2(snippetvehicle2::BaseVehicleParams* self, int arg0, physx::vehicle2::PxVehicleTireForceParams* arg1) {
  self->tireForceParams[arg0] = *arg1;
}

physx::vehicle2::PxVehicleWheelParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_BaseVehicleParams_get_wheelParams_1(snippetvehicle2::BaseVehicleParams* self, int arg0) {
  return &self->wheelParams[arg0];
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_BaseVehicleParams_set_wheelParams_2(snippetvehicle2::BaseVehicleParams* self, int arg0, physx::vehicle2::PxVehicleWheelParams* arg1) {
  self->wheelParams[arg0] = *arg1;
}

physx::vehicle2::PxVehicleRigidBodyParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_BaseVehicleParams_get_rigidBodyParams_0(snippetvehicle2::BaseVehicleParams* self) {
  return &self->rigidBodyParams;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_BaseVehicleParams_set_rigidBodyParams_1(snippetvehicle2::BaseVehicleParams* self, physx::vehicle2::PxVehicleRigidBodyParams* arg0) {
  self->rigidBodyParams = *arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_BaseVehicleParams___destroy___0(snippetvehicle2::BaseVehicleParams* self) {
  delete self;
}

// Interface: BaseVehicleState


snippetvehicle2::BaseVehicleState* EMSCRIPTEN_KEEPALIVE emscripten_bind_BaseVehicleState_BaseVehicleState_0() {
  return new snippetvehicle2::BaseVehicleState();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_BaseVehicleState_setToDefault_0(snippetvehicle2::BaseVehicleState* self) {
  self->setToDefault();
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_BaseVehicleState_get_brakeCommandResponseStates_1(snippetvehicle2::BaseVehicleState* self, int arg0) {
  return self->brakeCommandResponseStates[arg0];
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_BaseVehicleState_set_brakeCommandResponseStates_2(snippetvehicle2::BaseVehicleState* self, int arg0, float arg1) {
  self->brakeCommandResponseStates[arg0] = arg1;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_BaseVehicleState_get_steerCommandResponseStates_1(snippetvehicle2::BaseVehicleState* self, int arg0) {
  return self->steerCommandResponseStates[arg0];
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_BaseVehicleState_set_steerCommandResponseStates_2(snippetvehicle2::BaseVehicleState* self, int arg0, float arg1) {
  self->steerCommandResponseStates[arg0] = arg1;
}

physx::vehicle2::PxVehicleWheelActuationState* EMSCRIPTEN_KEEPALIVE emscripten_bind_BaseVehicleState_get_actuationStates_1(snippetvehicle2::BaseVehicleState* self, int arg0) {
  return &self->actuationStates[arg0];
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_BaseVehicleState_set_actuationStates_2(snippetvehicle2::BaseVehicleState* self, int arg0, physx::vehicle2::PxVehicleWheelActuationState* arg1) {
  self->actuationStates[arg0] = *arg1;
}

physx::vehicle2::PxVehicleRoadGeometryState* EMSCRIPTEN_KEEPALIVE emscripten_bind_BaseVehicleState_get_roadGeomStates_1(snippetvehicle2::BaseVehicleState* self, int arg0) {
  return &self->roadGeomStates[arg0];
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_BaseVehicleState_set_roadGeomStates_2(snippetvehicle2::BaseVehicleState* self, int arg0, physx::vehicle2::PxVehicleRoadGeometryState* arg1) {
  self->roadGeomStates[arg0] = *arg1;
}

physx::vehicle2::PxVehicleSuspensionState* EMSCRIPTEN_KEEPALIVE emscripten_bind_BaseVehicleState_get_suspensionStates_1(snippetvehicle2::BaseVehicleState* self, int arg0) {
  return &self->suspensionStates[arg0];
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_BaseVehicleState_set_suspensionStates_2(snippetvehicle2::BaseVehicleState* self, int arg0, physx::vehicle2::PxVehicleSuspensionState* arg1) {
  self->suspensionStates[arg0] = *arg1;
}

physx::vehicle2::PxVehicleSuspensionComplianceState* EMSCRIPTEN_KEEPALIVE emscripten_bind_BaseVehicleState_get_suspensionComplianceStates_1(snippetvehicle2::BaseVehicleState* self, int arg0) {
  return &self->suspensionComplianceStates[arg0];
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_BaseVehicleState_set_suspensionComplianceStates_2(snippetvehicle2::BaseVehicleState* self, int arg0, physx::vehicle2::PxVehicleSuspensionComplianceState* arg1) {
  self->suspensionComplianceStates[arg0] = *arg1;
}

physx::vehicle2::PxVehicleSuspensionForce* EMSCRIPTEN_KEEPALIVE emscripten_bind_BaseVehicleState_get_suspensionForces_1(snippetvehicle2::BaseVehicleState* self, int arg0) {
  return &self->suspensionForces[arg0];
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_BaseVehicleState_set_suspensionForces_2(snippetvehicle2::BaseVehicleState* self, int arg0, physx::vehicle2::PxVehicleSuspensionForce* arg1) {
  self->suspensionForces[arg0] = *arg1;
}

physx::vehicle2::PxVehicleAntiRollTorque* EMSCRIPTEN_KEEPALIVE emscripten_bind_BaseVehicleState_get_antiRollTorque_0(snippetvehicle2::BaseVehicleState* self) {
  return &self->antiRollTorque;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_BaseVehicleState_set_antiRollTorque_1(snippetvehicle2::BaseVehicleState* self, physx::vehicle2::PxVehicleAntiRollTorque* arg0) {
  self->antiRollTorque = *arg0;
}

physx::vehicle2::PxVehicleTireGripState* EMSCRIPTEN_KEEPALIVE emscripten_bind_BaseVehicleState_get_tireGripStates_1(snippetvehicle2::BaseVehicleState* self, int arg0) {
  return &self->tireGripStates[arg0];
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_BaseVehicleState_set_tireGripStates_2(snippetvehicle2::BaseVehicleState* self, int arg0, physx::vehicle2::PxVehicleTireGripState* arg1) {
  self->tireGripStates[arg0] = *arg1;
}

physx::vehicle2::PxVehicleTireDirectionState* EMSCRIPTEN_KEEPALIVE emscripten_bind_BaseVehicleState_get_tireDirectionStates_1(snippetvehicle2::BaseVehicleState* self, int arg0) {
  return &self->tireDirectionStates[arg0];
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_BaseVehicleState_set_tireDirectionStates_2(snippetvehicle2::BaseVehicleState* self, int arg0, physx::vehicle2::PxVehicleTireDirectionState* arg1) {
  self->tireDirectionStates[arg0] = *arg1;
}

physx::vehicle2::PxVehicleTireSpeedState* EMSCRIPTEN_KEEPALIVE emscripten_bind_BaseVehicleState_get_tireSpeedStates_1(snippetvehicle2::BaseVehicleState* self, int arg0) {
  return &self->tireSpeedStates[arg0];
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_BaseVehicleState_set_tireSpeedStates_2(snippetvehicle2::BaseVehicleState* self, int arg0, physx::vehicle2::PxVehicleTireSpeedState* arg1) {
  self->tireSpeedStates[arg0] = *arg1;
}

physx::vehicle2::PxVehicleTireSlipState* EMSCRIPTEN_KEEPALIVE emscripten_bind_BaseVehicleState_get_tireSlipStates_1(snippetvehicle2::BaseVehicleState* self, int arg0) {
  return &self->tireSlipStates[arg0];
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_BaseVehicleState_set_tireSlipStates_2(snippetvehicle2::BaseVehicleState* self, int arg0, physx::vehicle2::PxVehicleTireSlipState* arg1) {
  self->tireSlipStates[arg0] = *arg1;
}

physx::vehicle2::PxVehicleTireCamberAngleState* EMSCRIPTEN_KEEPALIVE emscripten_bind_BaseVehicleState_get_tireCamberAngleStates_1(snippetvehicle2::BaseVehicleState* self, int arg0) {
  return &self->tireCamberAngleStates[arg0];
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_BaseVehicleState_set_tireCamberAngleStates_2(snippetvehicle2::BaseVehicleState* self, int arg0, physx::vehicle2::PxVehicleTireCamberAngleState* arg1) {
  self->tireCamberAngleStates[arg0] = *arg1;
}

physx::vehicle2::PxVehicleTireStickyState* EMSCRIPTEN_KEEPALIVE emscripten_bind_BaseVehicleState_get_tireStickyStates_1(snippetvehicle2::BaseVehicleState* self, int arg0) {
  return &self->tireStickyStates[arg0];
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_BaseVehicleState_set_tireStickyStates_2(snippetvehicle2::BaseVehicleState* self, int arg0, physx::vehicle2::PxVehicleTireStickyState* arg1) {
  self->tireStickyStates[arg0] = *arg1;
}

physx::vehicle2::PxVehicleTireForce* EMSCRIPTEN_KEEPALIVE emscripten_bind_BaseVehicleState_get_tireForces_1(snippetvehicle2::BaseVehicleState* self, int arg0) {
  return &self->tireForces[arg0];
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_BaseVehicleState_set_tireForces_2(snippetvehicle2::BaseVehicleState* self, int arg0, physx::vehicle2::PxVehicleTireForce* arg1) {
  self->tireForces[arg0] = *arg1;
}

physx::vehicle2::PxVehicleWheelRigidBody1dState* EMSCRIPTEN_KEEPALIVE emscripten_bind_BaseVehicleState_get_wheelRigidBody1dStates_1(snippetvehicle2::BaseVehicleState* self, int arg0) {
  return &self->wheelRigidBody1dStates[arg0];
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_BaseVehicleState_set_wheelRigidBody1dStates_2(snippetvehicle2::BaseVehicleState* self, int arg0, physx::vehicle2::PxVehicleWheelRigidBody1dState* arg1) {
  self->wheelRigidBody1dStates[arg0] = *arg1;
}

physx::vehicle2::PxVehicleWheelLocalPose* EMSCRIPTEN_KEEPALIVE emscripten_bind_BaseVehicleState_get_wheelLocalPoses_1(snippetvehicle2::BaseVehicleState* self, int arg0) {
  return &self->wheelLocalPoses[arg0];
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_BaseVehicleState_set_wheelLocalPoses_2(snippetvehicle2::BaseVehicleState* self, int arg0, physx::vehicle2::PxVehicleWheelLocalPose* arg1) {
  self->wheelLocalPoses[arg0] = *arg1;
}

physx::vehicle2::PxVehicleRigidBodyState* EMSCRIPTEN_KEEPALIVE emscripten_bind_BaseVehicleState_get_rigidBodyState_0(snippetvehicle2::BaseVehicleState* self) {
  return &self->rigidBodyState;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_BaseVehicleState_set_rigidBodyState_1(snippetvehicle2::BaseVehicleState* self, physx::vehicle2::PxVehicleRigidBodyState* arg0) {
  self->rigidBodyState = *arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_BaseVehicleState___destroy___0(snippetvehicle2::BaseVehicleState* self) {
  delete self;
}

// Interface: BoxSupport


physx::PxGjkQueryExt::BoxSupport* EMSCRIPTEN_KEEPALIVE emscripten_bind_BoxSupport_BoxSupport_1(const physx::PxVec3* halfExtents) {
  return new physx::PxGjkQueryExt::BoxSupport(*halfExtents);
}

physx::PxGjkQueryExt::BoxSupport* EMSCRIPTEN_KEEPALIVE emscripten_bind_BoxSupport_BoxSupport_2(const physx::PxVec3* halfExtents, float margin) {
  return new physx::PxGjkQueryExt::BoxSupport(*halfExtents, margin);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_BoxSupport_getMargin_0(physx::PxGjkQueryExt::BoxSupport* self) {
  return self->getMargin();
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_BoxSupport_supportLocal_1(physx::PxGjkQueryExt::BoxSupport* self, const physx::PxVec3* dir) {
  static thread_local physx::PxVec3 temp;
  return (temp = self->supportLocal(*dir), &temp);
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_BoxSupport_get_halfExtents_0(physx::PxGjkQueryExt::BoxSupport* self) {
  return &self->halfExtents;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_BoxSupport_set_halfExtents_1(physx::PxGjkQueryExt::BoxSupport* self, physx::PxVec3* arg0) {
  self->halfExtents = *arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_BoxSupport_get_margin_0(physx::PxGjkQueryExt::BoxSupport* self) {
  return self->margin;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_BoxSupport_set_margin_1(physx::PxGjkQueryExt::BoxSupport* self, float arg0) {
  self->margin = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_BoxSupport___destroy___0(physx::PxGjkQueryExt::BoxSupport* self) {
  delete self;
}

// Interface: CapsuleSupport


physx::PxGjkQueryExt::CapsuleSupport* EMSCRIPTEN_KEEPALIVE emscripten_bind_CapsuleSupport_CapsuleSupport_2(float radius, float halfHeight) {
  return new physx::PxGjkQueryExt::CapsuleSupport(radius, halfHeight);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_CapsuleSupport_getMargin_0(physx::PxGjkQueryExt::CapsuleSupport* self) {
  return self->getMargin();
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_CapsuleSupport_supportLocal_1(physx::PxGjkQueryExt::CapsuleSupport* self, const physx::PxVec3* dir) {
  static thread_local physx::PxVec3 temp;
  return (temp = self->supportLocal(*dir), &temp);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_CapsuleSupport_get_radius_0(physx::PxGjkQueryExt::CapsuleSupport* self) {
  return self->radius;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_CapsuleSupport_set_radius_1(physx::PxGjkQueryExt::CapsuleSupport* self, float arg0) {
  self->radius = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_CapsuleSupport_get_halfHeight_0(physx::PxGjkQueryExt::CapsuleSupport* self) {
  return self->halfHeight;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_CapsuleSupport_set_halfHeight_1(physx::PxGjkQueryExt::CapsuleSupport* self, float arg0) {
  self->halfHeight = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_CapsuleSupport___destroy___0(physx::PxGjkQueryExt::CapsuleSupport* self) {
  delete self;
}

// Interface: ConvexGeomSupport


physx::PxGjkQueryExt::ConvexGeomSupport* EMSCRIPTEN_KEEPALIVE emscripten_bind_ConvexGeomSupport_ConvexGeomSupport_0() {
  return new physx::PxGjkQueryExt::ConvexGeomSupport();
}

physx::PxGjkQueryExt::ConvexGeomSupport* EMSCRIPTEN_KEEPALIVE emscripten_bind_ConvexGeomSupport_ConvexGeomSupport_1(const physx::PxGeometry* geom) {
  return new physx::PxGjkQueryExt::ConvexGeomSupport(*geom);
}

physx::PxGjkQueryExt::ConvexGeomSupport* EMSCRIPTEN_KEEPALIVE emscripten_bind_ConvexGeomSupport_ConvexGeomSupport_2(const physx::PxGeometry* geom, float margin) {
  return new physx::PxGjkQueryExt::ConvexGeomSupport(*geom, margin);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_ConvexGeomSupport_getMargin_0(physx::PxGjkQueryExt::ConvexGeomSupport* self) {
  return self->getMargin();
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_ConvexGeomSupport_supportLocal_1(physx::PxGjkQueryExt::ConvexGeomSupport* self, const physx::PxVec3* dir) {
  static thread_local physx::PxVec3 temp;
  return (temp = self->supportLocal(*dir), &temp);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_ConvexGeomSupport___destroy___0(physx::PxGjkQueryExt::ConvexGeomSupport* self) {
  delete self;
}

// Interface: ConvexMeshSupport


physx::PxGjkQueryExt::ConvexMeshSupport* EMSCRIPTEN_KEEPALIVE emscripten_bind_ConvexMeshSupport_ConvexMeshSupport_1(const physx::PxConvexMesh* convexMesh) {
  return new physx::PxGjkQueryExt::ConvexMeshSupport(*convexMesh);
}

physx::PxGjkQueryExt::ConvexMeshSupport* EMSCRIPTEN_KEEPALIVE emscripten_bind_ConvexMeshSupport_ConvexMeshSupport_2(const physx::PxConvexMesh* convexMesh, const physx::PxVec3* scale) {
  return new physx::PxGjkQueryExt::ConvexMeshSupport(*convexMesh, *scale);
}

physx::PxGjkQueryExt::ConvexMeshSupport* EMSCRIPTEN_KEEPALIVE emscripten_bind_ConvexMeshSupport_ConvexMeshSupport_3(const physx::PxConvexMesh* convexMesh, const physx::PxVec3* scale, const physx::PxQuat* scaleRotation) {
  return new physx::PxGjkQueryExt::ConvexMeshSupport(*convexMesh, *scale, *scaleRotation);
}

physx::PxGjkQueryExt::ConvexMeshSupport* EMSCRIPTEN_KEEPALIVE emscripten_bind_ConvexMeshSupport_ConvexMeshSupport_4(const physx::PxConvexMesh* convexMesh, const physx::PxVec3* scale, const physx::PxQuat* scaleRotation, float margin) {
  return new physx::PxGjkQueryExt::ConvexMeshSupport(*convexMesh, *scale, *scaleRotation, margin);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_ConvexMeshSupport_getMargin_0(physx::PxGjkQueryExt::ConvexMeshSupport* self) {
  return self->getMargin();
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_ConvexMeshSupport_supportLocal_1(physx::PxGjkQueryExt::ConvexMeshSupport* self, const physx::PxVec3* dir) {
  static thread_local physx::PxVec3 temp;
  return (temp = self->supportLocal(*dir), &temp);
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_ConvexMeshSupport_get_scale_0(physx::PxGjkQueryExt::ConvexMeshSupport* self) {
  return &self->scale;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_ConvexMeshSupport_set_scale_1(physx::PxGjkQueryExt::ConvexMeshSupport* self, physx::PxVec3* arg0) {
  self->scale = *arg0;
}

physx::PxQuat* EMSCRIPTEN_KEEPALIVE emscripten_bind_ConvexMeshSupport_get_scaleRotation_0(physx::PxGjkQueryExt::ConvexMeshSupport* self) {
  return &self->scaleRotation;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_ConvexMeshSupport_set_scaleRotation_1(physx::PxGjkQueryExt::ConvexMeshSupport* self, physx::PxQuat* arg0) {
  self->scaleRotation = *arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_ConvexMeshSupport_get_margin_0(physx::PxGjkQueryExt::ConvexMeshSupport* self) {
  return self->margin;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_ConvexMeshSupport_set_margin_1(physx::PxGjkQueryExt::ConvexMeshSupport* self, float arg0) {
  self->margin = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_ConvexMeshSupport___destroy___0(physx::PxGjkQueryExt::ConvexMeshSupport* self) {
  delete self;
}

// Interface: CustomSupportImpl


CustomSupportImpl* EMSCRIPTEN_KEEPALIVE emscripten_bind_CustomSupportImpl_CustomSupportImpl_0() {
  return new CustomSupportImpl();
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_CustomSupportImpl_getCustomMargin_0(CustomSupportImpl* self) {
  return self->getCustomMargin();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_CustomSupportImpl_getCustomSupportLocal_2(CustomSupportImpl* self, const physx::PxVec3* dir, physx::PxVec3* result) {
  self->getCustomSupportLocal(*dir, *result);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_CustomSupportImpl___destroy___0(CustomSupportImpl* self) {
  delete self;
}

// Interface: DirectDriveVehicle


snippetvehicle2::DirectDriveVehicle* EMSCRIPTEN_KEEPALIVE emscripten_bind_DirectDriveVehicle_DirectDriveVehicle_0() {
  return new snippetvehicle2::DirectDriveVehicle();
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_DirectDriveVehicle_initialize_3(snippetvehicle2::DirectDriveVehicle* self, physx::PxPhysics* physics, const physx::PxCookingParams* params, physx::PxMaterial* defaultMaterial) {
  return self->initialize(*physics, *params, *defaultMaterial);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_DirectDriveVehicle_initialize_4(snippetvehicle2::DirectDriveVehicle* self, physx::PxPhysics* physics, const physx::PxCookingParams* params, physx::PxMaterial* defaultMaterial, bool addPhysXBeginEndComponents) {
  return self->initialize(*physics, *params, *defaultMaterial, addPhysXBeginEndComponents);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_DirectDriveVehicle_initComponentSequence_1(snippetvehicle2::DirectDriveVehicle* self, bool addPhysXBeginEndComponents) {
  self->initComponentSequence(addPhysXBeginEndComponents);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_DirectDriveVehicle_destroyState_0(snippetvehicle2::DirectDriveVehicle* self) {
  self->destroyState();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_DirectDriveVehicle_step_2(snippetvehicle2::DirectDriveVehicle* self, float dt, const physx::vehicle2::PxVehicleSimulationContext* context) {
  self->step(dt, *context);
}

snippetvehicle2::DirectDrivetrainParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_DirectDriveVehicle_get_directDriveParams_0(snippetvehicle2::DirectDriveVehicle* self) {
  return &self->directDriveParams;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_DirectDriveVehicle_set_directDriveParams_1(snippetvehicle2::DirectDriveVehicle* self, snippetvehicle2::DirectDrivetrainParams* arg0) {
  self->directDriveParams = *arg0;
}

snippetvehicle2::DirectDrivetrainState* EMSCRIPTEN_KEEPALIVE emscripten_bind_DirectDriveVehicle_get_directDriveState_0(snippetvehicle2::DirectDriveVehicle* self) {
  return &self->directDriveState;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_DirectDriveVehicle_set_directDriveState_1(snippetvehicle2::DirectDriveVehicle* self, snippetvehicle2::DirectDrivetrainState* arg0) {
  self->directDriveState = *arg0;
}

physx::vehicle2::PxVehicleDirectDriveTransmissionCommandState* EMSCRIPTEN_KEEPALIVE emscripten_bind_DirectDriveVehicle_get_transmissionCommandState_0(snippetvehicle2::DirectDriveVehicle* self) {
  return &self->transmissionCommandState;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_DirectDriveVehicle_set_transmissionCommandState_1(snippetvehicle2::DirectDriveVehicle* self, physx::vehicle2::PxVehicleDirectDriveTransmissionCommandState* arg0) {
  self->transmissionCommandState = *arg0;
}

snippetvehicle2::BaseVehicleParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_DirectDriveVehicle_get_baseParams_0(snippetvehicle2::DirectDriveVehicle* self) {
  return &self->baseParams;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_DirectDriveVehicle_set_baseParams_1(snippetvehicle2::DirectDriveVehicle* self, snippetvehicle2::BaseVehicleParams* arg0) {
  self->baseParams = *arg0;
}

snippetvehicle2::BaseVehicleState* EMSCRIPTEN_KEEPALIVE emscripten_bind_DirectDriveVehicle_get_baseState_0(snippetvehicle2::DirectDriveVehicle* self) {
  return &self->baseState;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_DirectDriveVehicle_set_baseState_1(snippetvehicle2::DirectDriveVehicle* self, snippetvehicle2::BaseVehicleState* arg0) {
  self->baseState = *arg0;
}

physx::vehicle2::PxVehicleComponentSequence* EMSCRIPTEN_KEEPALIVE emscripten_bind_DirectDriveVehicle_get_componentSequence_0(snippetvehicle2::DirectDriveVehicle* self) {
  return &self->componentSequence;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_DirectDriveVehicle_set_componentSequence_1(snippetvehicle2::DirectDriveVehicle* self, physx::vehicle2::PxVehicleComponentSequence* arg0) {
  self->componentSequence = *arg0;
}

unsigned char EMSCRIPTEN_KEEPALIVE emscripten_bind_DirectDriveVehicle_get_componentSequenceSubstepGroupHandle_0(snippetvehicle2::DirectDriveVehicle* self) {
  return self->componentSequenceSubstepGroupHandle;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_DirectDriveVehicle_set_componentSequenceSubstepGroupHandle_1(snippetvehicle2::DirectDriveVehicle* self, unsigned char arg0) {
  self->componentSequenceSubstepGroupHandle = arg0;
}

snippetvehicle2::PhysXIntegrationParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_DirectDriveVehicle_get_physXParams_0(snippetvehicle2::DirectDriveVehicle* self) {
  return &self->physXParams;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_DirectDriveVehicle_set_physXParams_1(snippetvehicle2::DirectDriveVehicle* self, snippetvehicle2::PhysXIntegrationParams* arg0) {
  self->physXParams = *arg0;
}

snippetvehicle2::PhysXIntegrationState* EMSCRIPTEN_KEEPALIVE emscripten_bind_DirectDriveVehicle_get_physXState_0(snippetvehicle2::DirectDriveVehicle* self) {
  return &self->physXState;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_DirectDriveVehicle_set_physXState_1(snippetvehicle2::DirectDriveVehicle* self, snippetvehicle2::PhysXIntegrationState* arg0) {
  self->physXState = *arg0;
}

physx::vehicle2::PxVehicleCommandState* EMSCRIPTEN_KEEPALIVE emscripten_bind_DirectDriveVehicle_get_commandState_0(snippetvehicle2::DirectDriveVehicle* self) {
  return &self->commandState;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_DirectDriveVehicle_set_commandState_1(snippetvehicle2::DirectDriveVehicle* self, physx::vehicle2::PxVehicleCommandState* arg0) {
  self->commandState = *arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_DirectDriveVehicle___destroy___0(snippetvehicle2::DirectDriveVehicle* self) {
  delete self;
}

// Interface: DirectDrivetrainParams


snippetvehicle2::DirectDrivetrainParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_DirectDrivetrainParams_DirectDrivetrainParams_0() {
  return new snippetvehicle2::DirectDrivetrainParams();
}

snippetvehicle2::DirectDrivetrainParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_DirectDrivetrainParams_transformAndScale_4(snippetvehicle2::DirectDrivetrainParams* self, const physx::vehicle2::PxVehicleFrame* srcFrame, const physx::vehicle2::PxVehicleFrame* trgFrame, const physx::vehicle2::PxVehicleScale* srcScale, const physx::vehicle2::PxVehicleScale* trgScale) {
  static thread_local snippetvehicle2::DirectDrivetrainParams temp;
  return (temp = self->transformAndScale(*srcFrame, *trgFrame, *srcScale, *trgScale), &temp);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_DirectDrivetrainParams_isValid_1(snippetvehicle2::DirectDrivetrainParams* self, const physx::vehicle2::PxVehicleAxleDescription* axleDesc) {
  return self->isValid(*axleDesc);
}

physx::vehicle2::PxVehicleDirectDriveThrottleCommandResponseParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_DirectDrivetrainParams_get_directDriveThrottleResponseParams_0(snippetvehicle2::DirectDrivetrainParams* self) {
  return &self->directDriveThrottleResponseParams;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_DirectDrivetrainParams_set_directDriveThrottleResponseParams_1(snippetvehicle2::DirectDrivetrainParams* self, physx::vehicle2::PxVehicleDirectDriveThrottleCommandResponseParams* arg0) {
  self->directDriveThrottleResponseParams = *arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_DirectDrivetrainParams___destroy___0(snippetvehicle2::DirectDrivetrainParams* self) {
  delete self;
}

// Interface: DirectDrivetrainState


snippetvehicle2::DirectDrivetrainState* EMSCRIPTEN_KEEPALIVE emscripten_bind_DirectDrivetrainState_DirectDrivetrainState_0() {
  return new snippetvehicle2::DirectDrivetrainState();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_DirectDrivetrainState_setToDefault_0(snippetvehicle2::DirectDrivetrainState* self) {
  self->setToDefault();
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_DirectDrivetrainState_get_directDriveThrottleResponseStates_1(snippetvehicle2::DirectDrivetrainState* self, int arg0) {
  return self->directDriveThrottleResponseStates[arg0];
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_DirectDrivetrainState_set_directDriveThrottleResponseStates_2(snippetvehicle2::DirectDrivetrainState* self, int arg0, float arg1) {
  self->directDriveThrottleResponseStates[arg0] = arg1;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_DirectDrivetrainState___destroy___0(snippetvehicle2::DirectDrivetrainState* self) {
  delete self;
}

// Interface: EngineDriveVehicle


snippetvehicle2::EngineDriveVehicle* EMSCRIPTEN_KEEPALIVE emscripten_bind_EngineDriveVehicle_EngineDriveVehicle_0() {
  return new snippetvehicle2::EngineDriveVehicle();
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_EngineDriveVehicle_initialize_4(snippetvehicle2::EngineDriveVehicle* self, physx::PxPhysics* physics, const physx::PxCookingParams* params, physx::PxMaterial* defaultMaterial, EngineDriveVehicleEnum differentialType) {
  return self->initialize(*physics, *params, *defaultMaterial, differentialType);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_EngineDriveVehicle_initialize_5(snippetvehicle2::EngineDriveVehicle* self, physx::PxPhysics* physics, const physx::PxCookingParams* params, physx::PxMaterial* defaultMaterial, EngineDriveVehicleEnum differentialType, bool addPhysXBeginEndComponents) {
  return self->initialize(*physics, *params, *defaultMaterial, differentialType, addPhysXBeginEndComponents);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_EngineDriveVehicle_initComponentSequence_1(snippetvehicle2::EngineDriveVehicle* self, bool addPhysXBeginEndComponents) {
  self->initComponentSequence(addPhysXBeginEndComponents);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_EngineDriveVehicle_destroyState_0(snippetvehicle2::EngineDriveVehicle* self) {
  self->destroyState();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_EngineDriveVehicle_step_2(snippetvehicle2::EngineDriveVehicle* self, float dt, const physx::vehicle2::PxVehicleSimulationContext* context) {
  self->step(dt, *context);
}

snippetvehicle2::EngineDrivetrainParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_EngineDriveVehicle_get_engineDriveParams_0(snippetvehicle2::EngineDriveVehicle* self) {
  return &self->engineDriveParams;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_EngineDriveVehicle_set_engineDriveParams_1(snippetvehicle2::EngineDriveVehicle* self, snippetvehicle2::EngineDrivetrainParams* arg0) {
  self->engineDriveParams = *arg0;
}

snippetvehicle2::EngineDrivetrainState* EMSCRIPTEN_KEEPALIVE emscripten_bind_EngineDriveVehicle_get_engineDriveState_0(snippetvehicle2::EngineDriveVehicle* self) {
  return &self->engineDriveState;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_EngineDriveVehicle_set_engineDriveState_1(snippetvehicle2::EngineDriveVehicle* self, snippetvehicle2::EngineDrivetrainState* arg0) {
  self->engineDriveState = *arg0;
}

physx::vehicle2::PxVehicleEngineDriveTransmissionCommandState* EMSCRIPTEN_KEEPALIVE emscripten_bind_EngineDriveVehicle_get_transmissionCommandState_0(snippetvehicle2::EngineDriveVehicle* self) {
  return &self->transmissionCommandState;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_EngineDriveVehicle_set_transmissionCommandState_1(snippetvehicle2::EngineDriveVehicle* self, physx::vehicle2::PxVehicleEngineDriveTransmissionCommandState* arg0) {
  self->transmissionCommandState = *arg0;
}

physx::vehicle2::PxVehicleTankDriveTransmissionCommandState* EMSCRIPTEN_KEEPALIVE emscripten_bind_EngineDriveVehicle_get_tankDriveTransmissionCommandState_0(snippetvehicle2::EngineDriveVehicle* self) {
  return &self->tankDriveTransmissionCommandState;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_EngineDriveVehicle_set_tankDriveTransmissionCommandState_1(snippetvehicle2::EngineDriveVehicle* self, physx::vehicle2::PxVehicleTankDriveTransmissionCommandState* arg0) {
  self->tankDriveTransmissionCommandState = *arg0;
}

EngineDriveVehicleEnum EMSCRIPTEN_KEEPALIVE emscripten_bind_EngineDriveVehicle_get_differentialType_0(snippetvehicle2::EngineDriveVehicle* self) {
  return self->differentialType;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_EngineDriveVehicle_set_differentialType_1(snippetvehicle2::EngineDriveVehicle* self, EngineDriveVehicleEnum arg0) {
  self->differentialType = arg0;
}

snippetvehicle2::BaseVehicleParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_EngineDriveVehicle_get_baseParams_0(snippetvehicle2::EngineDriveVehicle* self) {
  return &self->baseParams;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_EngineDriveVehicle_set_baseParams_1(snippetvehicle2::EngineDriveVehicle* self, snippetvehicle2::BaseVehicleParams* arg0) {
  self->baseParams = *arg0;
}

snippetvehicle2::BaseVehicleState* EMSCRIPTEN_KEEPALIVE emscripten_bind_EngineDriveVehicle_get_baseState_0(snippetvehicle2::EngineDriveVehicle* self) {
  return &self->baseState;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_EngineDriveVehicle_set_baseState_1(snippetvehicle2::EngineDriveVehicle* self, snippetvehicle2::BaseVehicleState* arg0) {
  self->baseState = *arg0;
}

physx::vehicle2::PxVehicleComponentSequence* EMSCRIPTEN_KEEPALIVE emscripten_bind_EngineDriveVehicle_get_componentSequence_0(snippetvehicle2::EngineDriveVehicle* self) {
  return &self->componentSequence;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_EngineDriveVehicle_set_componentSequence_1(snippetvehicle2::EngineDriveVehicle* self, physx::vehicle2::PxVehicleComponentSequence* arg0) {
  self->componentSequence = *arg0;
}

unsigned char EMSCRIPTEN_KEEPALIVE emscripten_bind_EngineDriveVehicle_get_componentSequenceSubstepGroupHandle_0(snippetvehicle2::EngineDriveVehicle* self) {
  return self->componentSequenceSubstepGroupHandle;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_EngineDriveVehicle_set_componentSequenceSubstepGroupHandle_1(snippetvehicle2::EngineDriveVehicle* self, unsigned char arg0) {
  self->componentSequenceSubstepGroupHandle = arg0;
}

snippetvehicle2::PhysXIntegrationParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_EngineDriveVehicle_get_physXParams_0(snippetvehicle2::EngineDriveVehicle* self) {
  return &self->physXParams;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_EngineDriveVehicle_set_physXParams_1(snippetvehicle2::EngineDriveVehicle* self, snippetvehicle2::PhysXIntegrationParams* arg0) {
  self->physXParams = *arg0;
}

snippetvehicle2::PhysXIntegrationState* EMSCRIPTEN_KEEPALIVE emscripten_bind_EngineDriveVehicle_get_physXState_0(snippetvehicle2::EngineDriveVehicle* self) {
  return &self->physXState;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_EngineDriveVehicle_set_physXState_1(snippetvehicle2::EngineDriveVehicle* self, snippetvehicle2::PhysXIntegrationState* arg0) {
  self->physXState = *arg0;
}

physx::vehicle2::PxVehicleCommandState* EMSCRIPTEN_KEEPALIVE emscripten_bind_EngineDriveVehicle_get_commandState_0(snippetvehicle2::EngineDriveVehicle* self) {
  return &self->commandState;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_EngineDriveVehicle_set_commandState_1(snippetvehicle2::EngineDriveVehicle* self, physx::vehicle2::PxVehicleCommandState* arg0) {
  self->commandState = *arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_EngineDriveVehicle___destroy___0(snippetvehicle2::EngineDriveVehicle* self) {
  delete self;
}

// Interface: EngineDrivetrainParams


snippetvehicle2::EngineDrivetrainParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_EngineDrivetrainParams_EngineDrivetrainParams_0() {
  return new snippetvehicle2::EngineDrivetrainParams();
}

snippetvehicle2::EngineDrivetrainParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_EngineDrivetrainParams_transformAndScale_4(snippetvehicle2::EngineDrivetrainParams* self, const physx::vehicle2::PxVehicleFrame* srcFrame, const physx::vehicle2::PxVehicleFrame* trgFrame, const physx::vehicle2::PxVehicleScale* srcScale, const physx::vehicle2::PxVehicleScale* trgScale) {
  static thread_local snippetvehicle2::EngineDrivetrainParams temp;
  return (temp = self->transformAndScale(*srcFrame, *trgFrame, *srcScale, *trgScale), &temp);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_EngineDrivetrainParams_isValid_1(snippetvehicle2::EngineDrivetrainParams* self, const physx::vehicle2::PxVehicleAxleDescription* axleDesc) {
  return self->isValid(*axleDesc);
}

physx::vehicle2::PxVehicleAutoboxParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_EngineDrivetrainParams_get_autoboxParams_0(snippetvehicle2::EngineDrivetrainParams* self) {
  return &self->autoboxParams;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_EngineDrivetrainParams_set_autoboxParams_1(snippetvehicle2::EngineDrivetrainParams* self, physx::vehicle2::PxVehicleAutoboxParams* arg0) {
  self->autoboxParams = *arg0;
}

physx::vehicle2::PxVehicleClutchCommandResponseParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_EngineDrivetrainParams_get_clutchCommandResponseParams_0(snippetvehicle2::EngineDrivetrainParams* self) {
  return &self->clutchCommandResponseParams;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_EngineDrivetrainParams_set_clutchCommandResponseParams_1(snippetvehicle2::EngineDrivetrainParams* self, physx::vehicle2::PxVehicleClutchCommandResponseParams* arg0) {
  self->clutchCommandResponseParams = *arg0;
}

physx::vehicle2::PxVehicleEngineParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_EngineDrivetrainParams_get_engineParams_0(snippetvehicle2::EngineDrivetrainParams* self) {
  return &self->engineParams;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_EngineDrivetrainParams_set_engineParams_1(snippetvehicle2::EngineDrivetrainParams* self, physx::vehicle2::PxVehicleEngineParams* arg0) {
  self->engineParams = *arg0;
}

physx::vehicle2::PxVehicleGearboxParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_EngineDrivetrainParams_get_gearBoxParams_0(snippetvehicle2::EngineDrivetrainParams* self) {
  return &self->gearBoxParams;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_EngineDrivetrainParams_set_gearBoxParams_1(snippetvehicle2::EngineDrivetrainParams* self, physx::vehicle2::PxVehicleGearboxParams* arg0) {
  self->gearBoxParams = *arg0;
}

physx::vehicle2::PxVehicleMultiWheelDriveDifferentialParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_EngineDrivetrainParams_get_multiWheelDifferentialParams_0(snippetvehicle2::EngineDrivetrainParams* self) {
  return &self->multiWheelDifferentialParams;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_EngineDrivetrainParams_set_multiWheelDifferentialParams_1(snippetvehicle2::EngineDrivetrainParams* self, physx::vehicle2::PxVehicleMultiWheelDriveDifferentialParams* arg0) {
  self->multiWheelDifferentialParams = *arg0;
}

physx::vehicle2::PxVehicleFourWheelDriveDifferentialParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_EngineDrivetrainParams_get_fourWheelDifferentialParams_0(snippetvehicle2::EngineDrivetrainParams* self) {
  return &self->fourWheelDifferentialParams;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_EngineDrivetrainParams_set_fourWheelDifferentialParams_1(snippetvehicle2::EngineDrivetrainParams* self, physx::vehicle2::PxVehicleFourWheelDriveDifferentialParams* arg0) {
  self->fourWheelDifferentialParams = *arg0;
}

physx::vehicle2::PxVehicleTankDriveDifferentialParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_EngineDrivetrainParams_get_tankDifferentialParams_0(snippetvehicle2::EngineDrivetrainParams* self) {
  return &self->tankDifferentialParams;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_EngineDrivetrainParams_set_tankDifferentialParams_1(snippetvehicle2::EngineDrivetrainParams* self, physx::vehicle2::PxVehicleTankDriveDifferentialParams* arg0) {
  self->tankDifferentialParams = *arg0;
}

physx::vehicle2::PxVehicleClutchParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_EngineDrivetrainParams_get_clutchParams_0(snippetvehicle2::EngineDrivetrainParams* self) {
  return &self->clutchParams;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_EngineDrivetrainParams_set_clutchParams_1(snippetvehicle2::EngineDrivetrainParams* self, physx::vehicle2::PxVehicleClutchParams* arg0) {
  self->clutchParams = *arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_EngineDrivetrainParams___destroy___0(snippetvehicle2::EngineDrivetrainParams* self) {
  delete self;
}

// Interface: EngineDrivetrainState


snippetvehicle2::EngineDrivetrainState* EMSCRIPTEN_KEEPALIVE emscripten_bind_EngineDrivetrainState_EngineDrivetrainState_0() {
  return new snippetvehicle2::EngineDrivetrainState();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_EngineDrivetrainState_setToDefault_0(snippetvehicle2::EngineDrivetrainState* self) {
  self->setToDefault();
}

physx::vehicle2::PxVehicleEngineDriveThrottleCommandResponseState* EMSCRIPTEN_KEEPALIVE emscripten_bind_EngineDrivetrainState_get_throttleCommandResponseState_0(snippetvehicle2::EngineDrivetrainState* self) {
  return &self->throttleCommandResponseState;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_EngineDrivetrainState_set_throttleCommandResponseState_1(snippetvehicle2::EngineDrivetrainState* self, physx::vehicle2::PxVehicleEngineDriveThrottleCommandResponseState* arg0) {
  self->throttleCommandResponseState = *arg0;
}

physx::vehicle2::PxVehicleAutoboxState* EMSCRIPTEN_KEEPALIVE emscripten_bind_EngineDrivetrainState_get_autoboxState_0(snippetvehicle2::EngineDrivetrainState* self) {
  return &self->autoboxState;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_EngineDrivetrainState_set_autoboxState_1(snippetvehicle2::EngineDrivetrainState* self, physx::vehicle2::PxVehicleAutoboxState* arg0) {
  self->autoboxState = *arg0;
}

physx::vehicle2::PxVehicleClutchCommandResponseState* EMSCRIPTEN_KEEPALIVE emscripten_bind_EngineDrivetrainState_get_clutchCommandResponseState_0(snippetvehicle2::EngineDrivetrainState* self) {
  return &self->clutchCommandResponseState;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_EngineDrivetrainState_set_clutchCommandResponseState_1(snippetvehicle2::EngineDrivetrainState* self, physx::vehicle2::PxVehicleClutchCommandResponseState* arg0) {
  self->clutchCommandResponseState = *arg0;
}

physx::vehicle2::PxVehicleDifferentialState* EMSCRIPTEN_KEEPALIVE emscripten_bind_EngineDrivetrainState_get_differentialState_0(snippetvehicle2::EngineDrivetrainState* self) {
  return &self->differentialState;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_EngineDrivetrainState_set_differentialState_1(snippetvehicle2::EngineDrivetrainState* self, physx::vehicle2::PxVehicleDifferentialState* arg0) {
  self->differentialState = *arg0;
}

physx::vehicle2::PxVehicleWheelConstraintGroupState* EMSCRIPTEN_KEEPALIVE emscripten_bind_EngineDrivetrainState_get_wheelConstraintGroupState_0(snippetvehicle2::EngineDrivetrainState* self) {
  return &self->wheelConstraintGroupState;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_EngineDrivetrainState_set_wheelConstraintGroupState_1(snippetvehicle2::EngineDrivetrainState* self, physx::vehicle2::PxVehicleWheelConstraintGroupState* arg0) {
  self->wheelConstraintGroupState = *arg0;
}

physx::vehicle2::PxVehicleEngineState* EMSCRIPTEN_KEEPALIVE emscripten_bind_EngineDrivetrainState_get_engineState_0(snippetvehicle2::EngineDrivetrainState* self) {
  return &self->engineState;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_EngineDrivetrainState_set_engineState_1(snippetvehicle2::EngineDrivetrainState* self, physx::vehicle2::PxVehicleEngineState* arg0) {
  self->engineState = *arg0;
}

physx::vehicle2::PxVehicleGearboxState* EMSCRIPTEN_KEEPALIVE emscripten_bind_EngineDrivetrainState_get_gearboxState_0(snippetvehicle2::EngineDrivetrainState* self) {
  return &self->gearboxState;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_EngineDrivetrainState_set_gearboxState_1(snippetvehicle2::EngineDrivetrainState* self, physx::vehicle2::PxVehicleGearboxState* arg0) {
  self->gearboxState = *arg0;
}

physx::vehicle2::PxVehicleClutchSlipState* EMSCRIPTEN_KEEPALIVE emscripten_bind_EngineDrivetrainState_get_clutchState_0(snippetvehicle2::EngineDrivetrainState* self) {
  return &self->clutchState;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_EngineDrivetrainState_set_clutchState_1(snippetvehicle2::EngineDrivetrainState* self, physx::vehicle2::PxVehicleClutchSlipState* arg0) {
  self->clutchState = *arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_EngineDrivetrainState___destroy___0(snippetvehicle2::EngineDrivetrainState* self) {
  delete self;
}

// Interface: NativeArrayHelpers


unsigned char EMSCRIPTEN_KEEPALIVE emscripten_bind_NativeArrayHelpers_getU8At_2(PxU8ConstPtr* base, int index) {
  return NativeArrayHelpers::getU8At(*base, index);
}

unsigned short EMSCRIPTEN_KEEPALIVE emscripten_bind_NativeArrayHelpers_getU16At_2(PxU16ConstPtr* base, int index) {
  return NativeArrayHelpers::getU16At(*base, index);
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_NativeArrayHelpers_getU32At_2(PxU32ConstPtr* base, int index) {
  return NativeArrayHelpers::getU32At(*base, index);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_NativeArrayHelpers_getRealAt_2(PxRealPtr* base, int index) {
  return NativeArrayHelpers::getRealAt(*base, index);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_NativeArrayHelpers_setU8At_3(void* base, int index, unsigned char value) {
  NativeArrayHelpers::setU8At(base, index, value);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_NativeArrayHelpers_setU16At_3(void* base, int index, unsigned short value) {
  NativeArrayHelpers::setU16At(base, index, value);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_NativeArrayHelpers_setU32At_3(void* base, int index, unsigned int value) {
  NativeArrayHelpers::setU32At(base, index, value);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_NativeArrayHelpers_setRealAt_3(void* base, int index, float value) {
  NativeArrayHelpers::setRealAt(base, index, value);
}

PxU8Ptr* EMSCRIPTEN_KEEPALIVE emscripten_bind_NativeArrayHelpers_voidToU8Ptr_1(void* voidPtr) {
  static thread_local PxU8Ptr temp;
  return (temp = NativeArrayHelpers::voidToU8Ptr(voidPtr), &temp);
}

PxU16Ptr* EMSCRIPTEN_KEEPALIVE emscripten_bind_NativeArrayHelpers_voidToU16Ptr_1(void* voidPtr) {
  static thread_local PxU16Ptr temp;
  return (temp = NativeArrayHelpers::voidToU16Ptr(voidPtr), &temp);
}

PxU32Ptr* EMSCRIPTEN_KEEPALIVE emscripten_bind_NativeArrayHelpers_voidToU32Ptr_1(void* voidPtr) {
  static thread_local PxU32Ptr temp;
  return (temp = NativeArrayHelpers::voidToU32Ptr(voidPtr), &temp);
}

PxI32Ptr* EMSCRIPTEN_KEEPALIVE emscripten_bind_NativeArrayHelpers_voidToI32Ptr_1(void* voidPtr) {
  static thread_local PxI32Ptr temp;
  return (temp = NativeArrayHelpers::voidToI32Ptr(voidPtr), &temp);
}

PxRealPtr* EMSCRIPTEN_KEEPALIVE emscripten_bind_NativeArrayHelpers_voidToRealPtr_1(void* voidPtr) {
  static thread_local PxRealPtr temp;
  return (temp = NativeArrayHelpers::voidToRealPtr(voidPtr), &temp);
}

physx::PxActor* EMSCRIPTEN_KEEPALIVE emscripten_bind_NativeArrayHelpers_getActorAt_2(physx::PxActor* base, int index) {
  return NativeArrayHelpers::getActorAt(base, index);
}

physx::PxBounds3* EMSCRIPTEN_KEEPALIVE emscripten_bind_NativeArrayHelpers_getBounds3At_2(physx::PxBounds3* base, int index) {
  return NativeArrayHelpers::getBounds3At(base, index);
}

physx::PxContactPair* EMSCRIPTEN_KEEPALIVE emscripten_bind_NativeArrayHelpers_getContactPairAt_2(physx::PxContactPair* base, int index) {
  return NativeArrayHelpers::getContactPairAt(base, index);
}

physx::PxContactPairHeader* EMSCRIPTEN_KEEPALIVE emscripten_bind_NativeArrayHelpers_getContactPairHeaderAt_2(physx::PxContactPairHeader* base, int index) {
  return NativeArrayHelpers::getContactPairHeaderAt(base, index);
}

physx::PxController* EMSCRIPTEN_KEEPALIVE emscripten_bind_NativeArrayHelpers_getControllerAt_2(physx::PxController* base, int index) {
  return NativeArrayHelpers::getControllerAt(base, index);
}

physx::PxControllerShapeHit* EMSCRIPTEN_KEEPALIVE emscripten_bind_NativeArrayHelpers_getControllerShapeHitAt_2(physx::PxControllerShapeHit* base, int index) {
  return NativeArrayHelpers::getControllerShapeHitAt(base, index);
}

physx::PxControllersHit* EMSCRIPTEN_KEEPALIVE emscripten_bind_NativeArrayHelpers_getControllersHitAt_2(physx::PxControllersHit* base, int index) {
  return NativeArrayHelpers::getControllersHitAt(base, index);
}

physx::PxControllerObstacleHit* EMSCRIPTEN_KEEPALIVE emscripten_bind_NativeArrayHelpers_getControllerObstacleHitAt_2(physx::PxControllerObstacleHit* base, int index) {
  return NativeArrayHelpers::getControllerObstacleHitAt(base, index);
}

physx::PxDebugPoint* EMSCRIPTEN_KEEPALIVE emscripten_bind_NativeArrayHelpers_getDebugPointAt_2(physx::PxDebugPoint* base, int index) {
  return NativeArrayHelpers::getDebugPointAt(base, index);
}

physx::PxDebugLine* EMSCRIPTEN_KEEPALIVE emscripten_bind_NativeArrayHelpers_getDebugLineAt_2(physx::PxDebugLine* base, int index) {
  return NativeArrayHelpers::getDebugLineAt(base, index);
}

physx::PxDebugTriangle* EMSCRIPTEN_KEEPALIVE emscripten_bind_NativeArrayHelpers_getDebugTriangleAt_2(physx::PxDebugTriangle* base, int index) {
  return NativeArrayHelpers::getDebugTriangleAt(base, index);
}

physx::PxObstacle* EMSCRIPTEN_KEEPALIVE emscripten_bind_NativeArrayHelpers_getObstacleAt_2(physx::PxObstacle* base, int index) {
  return NativeArrayHelpers::getObstacleAt(base, index);
}

physx::PxShape* EMSCRIPTEN_KEEPALIVE emscripten_bind_NativeArrayHelpers_getShapeAt_2(physx::PxShape* base, int index) {
  return NativeArrayHelpers::getShapeAt(base, index);
}

physx::PxTriggerPair* EMSCRIPTEN_KEEPALIVE emscripten_bind_NativeArrayHelpers_getTriggerPairAt_2(physx::PxTriggerPair* base, int index) {
  return NativeArrayHelpers::getTriggerPairAt(base, index);
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_NativeArrayHelpers_getVec3At_2(physx::PxVec3* base, int index) {
  return NativeArrayHelpers::getVec3At(base, index);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_NativeArrayHelpers___destroy___0(NativeArrayHelpers* self) {
  delete self;
}

// Interface: PassThroughFilterShaderImpl


PassThroughFilterShaderImpl* EMSCRIPTEN_KEEPALIVE emscripten_bind_PassThroughFilterShaderImpl_PassThroughFilterShaderImpl_0() {
  return new PassThroughFilterShaderImpl();
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PassThroughFilterShaderImpl_filterShader_10(PassThroughFilterShaderImpl* self, unsigned int attributes0, unsigned int filterData0w0, unsigned int filterData0w1, unsigned int filterData0w2, unsigned int filterData0w3, unsigned int attributes1, unsigned int filterData1w0, unsigned int filterData1w1, unsigned int filterData1w2, unsigned int filterData1w3) {
  return self->filterShader(attributes0, filterData0w0, filterData0w1, filterData0w2, filterData0w3, attributes1, filterData1w0, filterData1w1, filterData1w2, filterData1w3);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PassThroughFilterShaderImpl___destroy___0(PassThroughFilterShaderImpl* self) {
  delete self;
}

// Interface: PhysXIntegrationParams


snippetvehicle2::PhysXIntegrationParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_PhysXIntegrationParams_PhysXIntegrationParams_0() {
  return new snippetvehicle2::PhysXIntegrationParams();
}

snippetvehicle2::PhysXIntegrationParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_PhysXIntegrationParams_transformAndScale_4(snippetvehicle2::PhysXIntegrationParams* self, const physx::vehicle2::PxVehicleFrame* srcFrame, const physx::vehicle2::PxVehicleFrame* trgFrame, const physx::vehicle2::PxVehicleScale* srcScale, const physx::vehicle2::PxVehicleScale* trgScale) {
  static thread_local snippetvehicle2::PhysXIntegrationParams temp;
  return (temp = self->transformAndScale(*srcFrame, *trgFrame, *srcScale, *trgScale), &temp);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PhysXIntegrationParams_isValid_1(snippetvehicle2::PhysXIntegrationParams* self, const physx::vehicle2::PxVehicleAxleDescription* axleDesc) {
  return self->isValid(*axleDesc);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PhysXIntegrationParams_create_10(snippetvehicle2::PhysXIntegrationParams* self, const physx::vehicle2::PxVehicleAxleDescription* axleDesc, const physx::PxQueryFilterData* roadQueryFilterData, physx::PxQueryFilterCallback* roadQueryFilterCallback, physx::vehicle2::PxVehiclePhysXMaterialFriction* materialFrictions, unsigned int nbMaterialFrictions, float defaultFriction, const physx::PxTransform* physxActorCMassLocalPose, physx::PxGeometry* actorGeometry, const physx::PxTransform* physxActorBoxShapeLocalPose, PxVehiclePhysXRoadGeometryQueryTypeEnum roadGeometryQueryType) {
  self->create(*axleDesc, *roadQueryFilterData, roadQueryFilterCallback, materialFrictions, nbMaterialFrictions, defaultFriction, *physxActorCMassLocalPose, *actorGeometry, *physxActorBoxShapeLocalPose, roadGeometryQueryType);
}

physx::vehicle2::PxVehiclePhysXRoadGeometryQueryParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_PhysXIntegrationParams_get_physxRoadGeometryQueryParams_0(snippetvehicle2::PhysXIntegrationParams* self) {
  return &self->physxRoadGeometryQueryParams;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PhysXIntegrationParams_set_physxRoadGeometryQueryParams_1(snippetvehicle2::PhysXIntegrationParams* self, physx::vehicle2::PxVehiclePhysXRoadGeometryQueryParams* arg0) {
  self->physxRoadGeometryQueryParams = *arg0;
}

physx::vehicle2::PxVehiclePhysXMaterialFrictionParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_PhysXIntegrationParams_get_physxMaterialFrictionParams_1(snippetvehicle2::PhysXIntegrationParams* self, int arg0) {
  return &self->physxMaterialFrictionParams[arg0];
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PhysXIntegrationParams_set_physxMaterialFrictionParams_2(snippetvehicle2::PhysXIntegrationParams* self, int arg0, physx::vehicle2::PxVehiclePhysXMaterialFrictionParams* arg1) {
  self->physxMaterialFrictionParams[arg0] = *arg1;
}

physx::vehicle2::PxVehiclePhysXSuspensionLimitConstraintParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_PhysXIntegrationParams_get_physxSuspensionLimitConstraintParams_1(snippetvehicle2::PhysXIntegrationParams* self, int arg0) {
  return &self->physxSuspensionLimitConstraintParams[arg0];
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PhysXIntegrationParams_set_physxSuspensionLimitConstraintParams_2(snippetvehicle2::PhysXIntegrationParams* self, int arg0, physx::vehicle2::PxVehiclePhysXSuspensionLimitConstraintParams* arg1) {
  self->physxSuspensionLimitConstraintParams[arg0] = *arg1;
}

physx::PxTransform* EMSCRIPTEN_KEEPALIVE emscripten_bind_PhysXIntegrationParams_get_physxActorCMassLocalPose_0(snippetvehicle2::PhysXIntegrationParams* self) {
  return &self->physxActorCMassLocalPose;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PhysXIntegrationParams_set_physxActorCMassLocalPose_1(snippetvehicle2::PhysXIntegrationParams* self, physx::PxTransform* arg0) {
  self->physxActorCMassLocalPose = *arg0;
}

physx::PxGeometry* EMSCRIPTEN_KEEPALIVE emscripten_bind_PhysXIntegrationParams_get_physxActorGeometry_0(snippetvehicle2::PhysXIntegrationParams* self) {
  return self->physxActorGeometry;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PhysXIntegrationParams_set_physxActorGeometry_1(snippetvehicle2::PhysXIntegrationParams* self, physx::PxGeometry* arg0) {
  self->physxActorGeometry = arg0;
}

physx::PxTransform* EMSCRIPTEN_KEEPALIVE emscripten_bind_PhysXIntegrationParams_get_physxActorBoxShapeLocalPose_0(snippetvehicle2::PhysXIntegrationParams* self) {
  return &self->physxActorBoxShapeLocalPose;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PhysXIntegrationParams_set_physxActorBoxShapeLocalPose_1(snippetvehicle2::PhysXIntegrationParams* self, physx::PxTransform* arg0) {
  self->physxActorBoxShapeLocalPose = *arg0;
}

physx::PxTransform* EMSCRIPTEN_KEEPALIVE emscripten_bind_PhysXIntegrationParams_get_physxWheelShapeLocalPoses_1(snippetvehicle2::PhysXIntegrationParams* self, int arg0) {
  return &self->physxWheelShapeLocalPoses[arg0];
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PhysXIntegrationParams_set_physxWheelShapeLocalPoses_2(snippetvehicle2::PhysXIntegrationParams* self, int arg0, physx::PxTransform* arg1) {
  self->physxWheelShapeLocalPoses[arg0] = *arg1;
}

physx::PxShapeFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PhysXIntegrationParams_get_physxActorShapeFlags_0(snippetvehicle2::PhysXIntegrationParams* self) {
  return &self->physxActorShapeFlags;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PhysXIntegrationParams_set_physxActorShapeFlags_1(snippetvehicle2::PhysXIntegrationParams* self, physx::PxShapeFlags* arg0) {
  self->physxActorShapeFlags = *arg0;
}

physx::PxFilterData* EMSCRIPTEN_KEEPALIVE emscripten_bind_PhysXIntegrationParams_get_physxActorSimulationFilterData_0(snippetvehicle2::PhysXIntegrationParams* self) {
  return &self->physxActorSimulationFilterData;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PhysXIntegrationParams_set_physxActorSimulationFilterData_1(snippetvehicle2::PhysXIntegrationParams* self, physx::PxFilterData* arg0) {
  self->physxActorSimulationFilterData = *arg0;
}

physx::PxFilterData* EMSCRIPTEN_KEEPALIVE emscripten_bind_PhysXIntegrationParams_get_physxActorQueryFilterData_0(snippetvehicle2::PhysXIntegrationParams* self) {
  return &self->physxActorQueryFilterData;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PhysXIntegrationParams_set_physxActorQueryFilterData_1(snippetvehicle2::PhysXIntegrationParams* self, physx::PxFilterData* arg0) {
  self->physxActorQueryFilterData = *arg0;
}

physx::PxShapeFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PhysXIntegrationParams_get_physxActorWheelShapeFlags_0(snippetvehicle2::PhysXIntegrationParams* self) {
  return &self->physxActorWheelShapeFlags;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PhysXIntegrationParams_set_physxActorWheelShapeFlags_1(snippetvehicle2::PhysXIntegrationParams* self, physx::PxShapeFlags* arg0) {
  self->physxActorWheelShapeFlags = *arg0;
}

physx::PxFilterData* EMSCRIPTEN_KEEPALIVE emscripten_bind_PhysXIntegrationParams_get_physxActorWheelSimulationFilterData_0(snippetvehicle2::PhysXIntegrationParams* self) {
  return &self->physxActorWheelSimulationFilterData;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PhysXIntegrationParams_set_physxActorWheelSimulationFilterData_1(snippetvehicle2::PhysXIntegrationParams* self, physx::PxFilterData* arg0) {
  self->physxActorWheelSimulationFilterData = *arg0;
}

physx::PxFilterData* EMSCRIPTEN_KEEPALIVE emscripten_bind_PhysXIntegrationParams_get_physxActorWheelQueryFilterData_0(snippetvehicle2::PhysXIntegrationParams* self) {
  return &self->physxActorWheelQueryFilterData;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PhysXIntegrationParams_set_physxActorWheelQueryFilterData_1(snippetvehicle2::PhysXIntegrationParams* self, physx::PxFilterData* arg0) {
  self->physxActorWheelQueryFilterData = *arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PhysXIntegrationParams___destroy___0(snippetvehicle2::PhysXIntegrationParams* self) {
  delete self;
}

// Interface: PhysXIntegrationState


snippetvehicle2::PhysXIntegrationState* EMSCRIPTEN_KEEPALIVE emscripten_bind_PhysXIntegrationState_PhysXIntegrationState_0() {
  return new snippetvehicle2::PhysXIntegrationState();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PhysXIntegrationState_destroyState_0(snippetvehicle2::PhysXIntegrationState* self) {
  self->destroyState();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PhysXIntegrationState_setToDefault_0(snippetvehicle2::PhysXIntegrationState* self) {
  self->setToDefault();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PhysXIntegrationState_create_5(snippetvehicle2::PhysXIntegrationState* self, const snippetvehicle2::BaseVehicleParams* baseParams, const snippetvehicle2::PhysXIntegrationParams* physxParams, physx::PxPhysics* physics, const physx::PxCookingParams* params, physx::PxMaterial* defaultMaterial) {
  self->create(*baseParams, *physxParams, *physics, *params, *defaultMaterial);
}

physx::vehicle2::PxVehiclePhysXActor* EMSCRIPTEN_KEEPALIVE emscripten_bind_PhysXIntegrationState_get_physxActor_0(snippetvehicle2::PhysXIntegrationState* self) {
  return &self->physxActor;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PhysXIntegrationState_set_physxActor_1(snippetvehicle2::PhysXIntegrationState* self, physx::vehicle2::PxVehiclePhysXActor* arg0) {
  self->physxActor = *arg0;
}

physx::vehicle2::PxVehiclePhysXSteerState* EMSCRIPTEN_KEEPALIVE emscripten_bind_PhysXIntegrationState_get_physxSteerState_0(snippetvehicle2::PhysXIntegrationState* self) {
  return &self->physxSteerState;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PhysXIntegrationState_set_physxSteerState_1(snippetvehicle2::PhysXIntegrationState* self, physx::vehicle2::PxVehiclePhysXSteerState* arg0) {
  self->physxSteerState = *arg0;
}

physx::vehicle2::PxVehiclePhysXConstraints* EMSCRIPTEN_KEEPALIVE emscripten_bind_PhysXIntegrationState_get_physxConstraints_0(snippetvehicle2::PhysXIntegrationState* self) {
  return &self->physxConstraints;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PhysXIntegrationState_set_physxConstraints_1(snippetvehicle2::PhysXIntegrationState* self, physx::vehicle2::PxVehiclePhysXConstraints* arg0) {
  self->physxConstraints = *arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PhysXIntegrationState___destroy___0(snippetvehicle2::PhysXIntegrationState* self) {
  delete self;
}

// Interface: PxActorFlags


physx::PxActorFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxActorFlags_PxActorFlags_1(unsigned char flags) {
  return new physx::PxActorFlags(flags);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxActorFlags_isSet_1(physx::PxActorFlags* self, PxActorFlagEnum flag) {
  return self->isSet(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxActorFlags_raise_1(physx::PxActorFlags* self, PxActorFlagEnum flag) {
  self->raise(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxActorFlags_clear_1(physx::PxActorFlags* self, PxActorFlagEnum flag) {
  self->clear(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxActorFlags___destroy___0(physx::PxActorFlags* self) {
  delete self;
}

// Interface: PxActorPtr


void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxActorPtr___destroy___0(PxActorPtr* self) {
  delete self;
}

// Interface: PxActorTypeFlags


physx::PxActorTypeFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxActorTypeFlags_PxActorTypeFlags_1(unsigned short flags) {
  return new physx::PxActorTypeFlags(flags);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxActorTypeFlags_isSet_1(physx::PxActorTypeFlags* self, PxActorTypeFlagEnum flag) {
  return self->isSet(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxActorTypeFlags_raise_1(physx::PxActorTypeFlags* self, PxActorTypeFlagEnum flag) {
  self->raise(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxActorTypeFlags_clear_1(physx::PxActorTypeFlags* self, PxActorTypeFlagEnum flag) {
  self->clear(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxActorTypeFlags___destroy___0(physx::PxActorTypeFlags* self) {
  delete self;
}

// Interface: PxAggregate


bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxAggregate_addActor_1(physx::PxAggregate* self, physx::PxActor* actor) {
  return self->addActor(*actor);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxAggregate_addActor_2(physx::PxAggregate* self, physx::PxActor* actor, const physx::PxBVH* bvh) {
  return self->addActor(*actor, bvh);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxAggregate_removeActor_1(physx::PxAggregate* self, physx::PxActor* actor) {
  return self->removeActor(*actor);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxAggregate_addArticulation_1(physx::PxAggregate* self, physx::PxArticulationReducedCoordinate* articulation) {
  return self->addArticulation(*articulation);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxAggregate_removeArticulation_1(physx::PxAggregate* self, physx::PxArticulationReducedCoordinate* articulation) {
  return self->removeArticulation(*articulation);
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxAggregate_getNbActors_0(physx::PxAggregate* self) {
  return self->getNbActors();
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxAggregate_getMaxNbActors_0(physx::PxAggregate* self) {
  return self->getMaxNbActors();
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxAggregate_getMaxNbShapes_0(physx::PxAggregate* self) {
  return self->getMaxNbShapes();
}

physx::PxScene* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxAggregate_getScene_0(physx::PxAggregate* self) {
  return self->getScene();
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxAggregate_getSelfCollision_0(physx::PxAggregate* self) {
  return self->getSelfCollision();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxAggregate_release_0(physx::PxAggregate* self) {
  self->release();
}

const char* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxAggregate_getConcreteTypeName_0(physx::PxAggregate* self) {
  return self->getConcreteTypeName();
}

int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxAggregate_getConcreteType_0(physx::PxAggregate* self) {
  return self->getConcreteType();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxAggregate_setBaseFlag_2(physx::PxAggregate* self, PxBaseFlagEnum flag, bool value) {
  self->setBaseFlag(flag, value);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxAggregate_setBaseFlags_1(physx::PxAggregate* self, physx::PxBaseFlags* inFlags) {
  self->setBaseFlags(*inFlags);
}

physx::PxBaseFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxAggregate_getBaseFlags_0(physx::PxAggregate* self) {
  static thread_local physx::PxBaseFlags temp;
  return (temp = self->getBaseFlags(), &temp);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxAggregate_isReleasable_0(physx::PxAggregate* self) {
  return self->isReleasable();
}

// Interface: PxArray_PxActorPtr


PxArray_PxActorPtr* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxActorPtr_PxArray_PxActorPtr_0() {
  return new PxArray_PxActorPtr();
}

PxArray_PxActorPtr* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxActorPtr_PxArray_PxActorPtr_1(unsigned int size) {
  return new PxArray_PxActorPtr(size);
}

physx::PxActor* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxActorPtr_get_1(PxArray_PxActorPtr* self, unsigned int index) {
  return self->get(index);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxActorPtr_set_2(PxArray_PxActorPtr* self, unsigned int index, const PxActorPtr* value) {
  self->set(index, *value);
}

PxActorPtr* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxActorPtr_begin_0(PxArray_PxActorPtr* self) {
  return self->begin();
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxActorPtr_size_0(PxArray_PxActorPtr* self) {
  return self->size();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxActorPtr_pushBack_1(PxArray_PxActorPtr* self, physx::PxActor* value) {
  self->pushBack(value);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxActorPtr_clear_0(PxArray_PxActorPtr* self) {
  self->clear();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxActorPtr___destroy___0(PxArray_PxActorPtr* self) {
  delete self;
}

// Interface: PxArray_PxContactPairPoint


PxArray_PxContactPairPoint* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxContactPairPoint_PxArray_PxContactPairPoint_0() {
  return new PxArray_PxContactPairPoint();
}

PxArray_PxContactPairPoint* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxContactPairPoint_PxArray_PxContactPairPoint_1(unsigned int size) {
  return new PxArray_PxContactPairPoint(size);
}

physx::PxContactPairPoint* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxContactPairPoint_get_1(PxArray_PxContactPairPoint* self, unsigned int index) {
  return &self->get(index);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxContactPairPoint_set_2(PxArray_PxContactPairPoint* self, unsigned int index, const physx::PxContactPairPoint* value) {
  self->set(index, *value);
}

physx::PxContactPairPoint* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxContactPairPoint_begin_0(PxArray_PxContactPairPoint* self) {
  return self->begin();
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxContactPairPoint_size_0(PxArray_PxContactPairPoint* self) {
  return self->size();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxContactPairPoint_pushBack_1(PxArray_PxContactPairPoint* self, physx::PxContactPairPoint* value) {
  self->pushBack(*value);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxContactPairPoint_clear_0(PxArray_PxContactPairPoint* self) {
  self->clear();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxContactPairPoint___destroy___0(PxArray_PxContactPairPoint* self) {
  delete self;
}

// Interface: PxArray_PxHeightFieldSample


PxArray_PxHeightFieldSample* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxHeightFieldSample_PxArray_PxHeightFieldSample_0() {
  return new PxArray_PxHeightFieldSample();
}

PxArray_PxHeightFieldSample* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxHeightFieldSample_PxArray_PxHeightFieldSample_1(unsigned int size) {
  return new PxArray_PxHeightFieldSample(size);
}

physx::PxHeightFieldSample* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxHeightFieldSample_get_1(PxArray_PxHeightFieldSample* self, unsigned int index) {
  return &self->get(index);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxHeightFieldSample_set_2(PxArray_PxHeightFieldSample* self, unsigned int index, const physx::PxHeightFieldSample* value) {
  self->set(index, *value);
}

physx::PxHeightFieldSample* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxHeightFieldSample_begin_0(PxArray_PxHeightFieldSample* self) {
  return self->begin();
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxHeightFieldSample_size_0(PxArray_PxHeightFieldSample* self) {
  return self->size();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxHeightFieldSample_pushBack_1(PxArray_PxHeightFieldSample* self, physx::PxHeightFieldSample* value) {
  self->pushBack(*value);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxHeightFieldSample_clear_0(PxArray_PxHeightFieldSample* self) {
  self->clear();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxHeightFieldSample___destroy___0(PxArray_PxHeightFieldSample* self) {
  delete self;
}

// Interface: PxArray_PxMaterialConst


PxArray_PxMaterialConst* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxMaterialConst_PxArray_PxMaterialConst_0() {
  return new PxArray_PxMaterialConst();
}

PxArray_PxMaterialConst* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxMaterialConst_PxArray_PxMaterialConst_1(unsigned int size) {
  return new PxArray_PxMaterialConst(size);
}

const physx::PxMaterial* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxMaterialConst_get_1(PxArray_PxMaterialConst* self, unsigned int index) {
  return self->get(index);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxMaterialConst_set_2(PxArray_PxMaterialConst* self, unsigned int index, const PxMaterialConstPtr* value) {
  self->set(index, *value);
}

PxMaterialConstPtr* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxMaterialConst_begin_0(PxArray_PxMaterialConst* self) {
  return self->begin();
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxMaterialConst_size_0(PxArray_PxMaterialConst* self) {
  return self->size();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxMaterialConst_pushBack_1(PxArray_PxMaterialConst* self, const physx::PxMaterial* value) {
  self->pushBack(value);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxMaterialConst_clear_0(PxArray_PxMaterialConst* self) {
  self->clear();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxMaterialConst___destroy___0(PxArray_PxMaterialConst* self) {
  delete self;
}

// Interface: PxArray_PxRaycastHit


PxArray_PxRaycastHit* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxRaycastHit_PxArray_PxRaycastHit_0() {
  return new PxArray_PxRaycastHit();
}

PxArray_PxRaycastHit* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxRaycastHit_PxArray_PxRaycastHit_1(unsigned int size) {
  return new PxArray_PxRaycastHit(size);
}

physx::PxRaycastHit* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxRaycastHit_get_1(PxArray_PxRaycastHit* self, unsigned int index) {
  return &self->get(index);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxRaycastHit_set_2(PxArray_PxRaycastHit* self, unsigned int index, const physx::PxRaycastHit* value) {
  self->set(index, *value);
}

physx::PxRaycastHit* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxRaycastHit_begin_0(PxArray_PxRaycastHit* self) {
  return self->begin();
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxRaycastHit_size_0(PxArray_PxRaycastHit* self) {
  return self->size();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxRaycastHit_pushBack_1(PxArray_PxRaycastHit* self, physx::PxRaycastHit* value) {
  self->pushBack(*value);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxRaycastHit_clear_0(PxArray_PxRaycastHit* self) {
  self->clear();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxRaycastHit___destroy___0(PxArray_PxRaycastHit* self) {
  delete self;
}

// Interface: PxArray_PxReal


PxArray_PxReal* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxReal_PxArray_PxReal_0() {
  return new PxArray_PxReal();
}

PxArray_PxReal* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxReal_PxArray_PxReal_1(unsigned int size) {
  return new PxArray_PxReal(size);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxReal_get_1(PxArray_PxReal* self, unsigned int index) {
  return self->get(index);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxReal_set_2(PxArray_PxReal* self, unsigned int index, float value) {
  self->set(index, value);
}

void* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxReal_begin_0(PxArray_PxReal* self) {
  return self->begin();
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxReal_size_0(PxArray_PxReal* self) {
  return self->size();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxReal_pushBack_1(PxArray_PxReal* self, float value) {
  self->pushBack(value);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxReal_clear_0(PxArray_PxReal* self) {
  self->clear();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxReal___destroy___0(PxArray_PxReal* self) {
  delete self;
}

// Interface: PxArray_PxShapePtr


PxArray_PxShapePtr* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxShapePtr_PxArray_PxShapePtr_0() {
  return new PxArray_PxShapePtr();
}

PxArray_PxShapePtr* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxShapePtr_PxArray_PxShapePtr_1(unsigned int size) {
  return new PxArray_PxShapePtr(size);
}

physx::PxShape* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxShapePtr_get_1(PxArray_PxShapePtr* self, unsigned int index) {
  return self->get(index);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxShapePtr_set_2(PxArray_PxShapePtr* self, unsigned int index, const PxShapePtr* value) {
  self->set(index, *value);
}

PxShapePtr* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxShapePtr_begin_0(PxArray_PxShapePtr* self) {
  return self->begin();
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxShapePtr_size_0(PxArray_PxShapePtr* self) {
  return self->size();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxShapePtr_pushBack_1(PxArray_PxShapePtr* self, physx::PxShape* value) {
  self->pushBack(value);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxShapePtr_clear_0(PxArray_PxShapePtr* self) {
  self->clear();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxShapePtr___destroy___0(PxArray_PxShapePtr* self) {
  delete self;
}

// Interface: PxArray_PxSweepHit


PxArray_PxSweepHit* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxSweepHit_PxArray_PxSweepHit_0() {
  return new PxArray_PxSweepHit();
}

PxArray_PxSweepHit* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxSweepHit_PxArray_PxSweepHit_1(unsigned int size) {
  return new PxArray_PxSweepHit(size);
}

physx::PxSweepHit* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxSweepHit_get_1(PxArray_PxSweepHit* self, unsigned int index) {
  return &self->get(index);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxSweepHit_set_2(PxArray_PxSweepHit* self, unsigned int index, const physx::PxSweepHit* value) {
  self->set(index, *value);
}

physx::PxSweepHit* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxSweepHit_begin_0(PxArray_PxSweepHit* self) {
  return self->begin();
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxSweepHit_size_0(PxArray_PxSweepHit* self) {
  return self->size();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxSweepHit_pushBack_1(PxArray_PxSweepHit* self, physx::PxSweepHit* value) {
  self->pushBack(*value);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxSweepHit_clear_0(PxArray_PxSweepHit* self) {
  self->clear();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxSweepHit___destroy___0(PxArray_PxSweepHit* self) {
  delete self;
}

// Interface: PxArray_PxU16


PxArray_PxU16* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxU16_PxArray_PxU16_0() {
  return new PxArray_PxU16();
}

PxArray_PxU16* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxU16_PxArray_PxU16_1(unsigned int size) {
  return new PxArray_PxU16(size);
}

unsigned short EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxU16_get_1(PxArray_PxU16* self, unsigned int index) {
  return self->get(index);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxU16_set_2(PxArray_PxU16* self, unsigned int index, unsigned short value) {
  self->set(index, value);
}

void* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxU16_begin_0(PxArray_PxU16* self) {
  return self->begin();
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxU16_size_0(PxArray_PxU16* self) {
  return self->size();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxU16_pushBack_1(PxArray_PxU16* self, unsigned short value) {
  self->pushBack(value);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxU16_clear_0(PxArray_PxU16* self) {
  self->clear();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxU16___destroy___0(PxArray_PxU16* self) {
  delete self;
}

// Interface: PxArray_PxU32


PxArray_PxU32* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxU32_PxArray_PxU32_0() {
  return new PxArray_PxU32();
}

PxArray_PxU32* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxU32_PxArray_PxU32_1(unsigned int size) {
  return new PxArray_PxU32(size);
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxU32_get_1(PxArray_PxU32* self, unsigned int index) {
  return self->get(index);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxU32_set_2(PxArray_PxU32* self, unsigned int index, unsigned int value) {
  self->set(index, value);
}

void* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxU32_begin_0(PxArray_PxU32* self) {
  return self->begin();
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxU32_size_0(PxArray_PxU32* self) {
  return self->size();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxU32_pushBack_1(PxArray_PxU32* self, unsigned int value) {
  self->pushBack(value);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxU32_clear_0(PxArray_PxU32* self) {
  self->clear();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxU32___destroy___0(PxArray_PxU32* self) {
  delete self;
}

// Interface: PxArray_PxU8


PxArray_PxU8* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxU8_PxArray_PxU8_0() {
  return new PxArray_PxU8();
}

PxArray_PxU8* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxU8_PxArray_PxU8_1(unsigned int size) {
  return new PxArray_PxU8(size);
}

unsigned char EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxU8_get_1(PxArray_PxU8* self, unsigned int index) {
  return self->get(index);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxU8_set_2(PxArray_PxU8* self, unsigned int index, unsigned char value) {
  self->set(index, value);
}

void* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxU8_begin_0(PxArray_PxU8* self) {
  return self->begin();
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxU8_size_0(PxArray_PxU8* self) {
  return self->size();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxU8_pushBack_1(PxArray_PxU8* self, unsigned char value) {
  self->pushBack(value);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxU8_setFromBuffer_2(PxArray_PxU8* self, void* buffer, unsigned int size) {
  self->setFromBuffer(buffer, size);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxU8_clear_0(PxArray_PxU8* self) {
  self->clear();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxU8___destroy___0(PxArray_PxU8* self) {
  delete self;
}

// Interface: PxArray_PxVec3


PxArray_PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxVec3_PxArray_PxVec3_0() {
  return new PxArray_PxVec3();
}

PxArray_PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxVec3_PxArray_PxVec3_1(unsigned int size) {
  return new PxArray_PxVec3(size);
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxVec3_get_1(PxArray_PxVec3* self, unsigned int index) {
  return &self->get(index);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxVec3_set_2(PxArray_PxVec3* self, unsigned int index, const physx::PxVec3* value) {
  self->set(index, *value);
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxVec3_begin_0(PxArray_PxVec3* self) {
  return self->begin();
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxVec3_size_0(PxArray_PxVec3* self) {
  return self->size();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxVec3_pushBack_1(PxArray_PxVec3* self, physx::PxVec3* value) {
  self->pushBack(*value);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxVec3_clear_0(PxArray_PxVec3* self) {
  self->clear();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxVec3___destroy___0(PxArray_PxVec3* self) {
  delete self;
}

// Interface: PxArray_PxVec4


PxArray_PxVec4* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxVec4_PxArray_PxVec4_0() {
  return new PxArray_PxVec4();
}

PxArray_PxVec4* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxVec4_PxArray_PxVec4_1(unsigned int size) {
  return new PxArray_PxVec4(size);
}

physx::PxVec4* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxVec4_get_1(PxArray_PxVec4* self, unsigned int index) {
  return &self->get(index);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxVec4_set_2(PxArray_PxVec4* self, unsigned int index, const physx::PxVec4* value) {
  self->set(index, *value);
}

physx::PxVec4* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxVec4_begin_0(PxArray_PxVec4* self) {
  return self->begin();
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxVec4_size_0(PxArray_PxVec4* self) {
  return self->size();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxVec4_pushBack_1(PxArray_PxVec4* self, physx::PxVec4* value) {
  self->pushBack(*value);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxVec4_clear_0(PxArray_PxVec4* self) {
  self->clear();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArray_PxVec4___destroy___0(PxArray_PxVec4* self) {
  delete self;
}

// Interface: PxArticulationAttachment


void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationAttachment_setRestLength_1(physx::PxArticulationAttachment* self, float restLength) {
  self->setRestLength(restLength);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationAttachment_getRestLength_0(physx::PxArticulationAttachment* self) {
  return self->getRestLength();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationAttachment_setLimitParameters_1(physx::PxArticulationAttachment* self, const physx::PxArticulationTendonLimit* parameters) {
  self->setLimitParameters(*parameters);
}

physx::PxArticulationTendonLimit* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationAttachment_getLimitParameters_0(physx::PxArticulationAttachment* self) {
  static thread_local physx::PxArticulationTendonLimit temp;
  return (temp = self->getLimitParameters(), &temp);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationAttachment_setRelativeOffset_1(physx::PxArticulationAttachment* self, const physx::PxVec3* offset) {
  self->setRelativeOffset(*offset);
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationAttachment_getRelativeOffset_0(physx::PxArticulationAttachment* self) {
  static thread_local physx::PxVec3 temp;
  return (temp = self->getRelativeOffset(), &temp);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationAttachment_setCoefficient_1(physx::PxArticulationAttachment* self, float coefficient) {
  self->setCoefficient(coefficient);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationAttachment_getCoefficient_0(physx::PxArticulationAttachment* self) {
  return self->getCoefficient();
}

physx::PxArticulationLink* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationAttachment_getLink_0(physx::PxArticulationAttachment* self) {
  return self->getLink();
}

physx::PxArticulationAttachment* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationAttachment_getParent_0(physx::PxArticulationAttachment* self) {
  return self->getParent();
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationAttachment_isLeaf_0(physx::PxArticulationAttachment* self) {
  return self->isLeaf();
}

physx::PxArticulationSpatialTendon* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationAttachment_getTendon_0(physx::PxArticulationAttachment* self) {
  return self->getTendon();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationAttachment_release_0(physx::PxArticulationAttachment* self) {
  self->release();
}

void* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationAttachment_get_userData_0(physx::PxArticulationAttachment* self) {
  return self->userData;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationAttachment_set_userData_1(physx::PxArticulationAttachment* self, void* arg0) {
  self->userData = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationAttachment___destroy___0(physx::PxArticulationAttachment* self) {
  delete self;
}

// Interface: PxArticulationCache


void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationCache_release_0(physx::PxArticulationCache* self) {
  self->release();
}

physx::PxSpatialForce* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationCache_get_externalForces_0(physx::PxArticulationCache* self) {
  return self->externalForces;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationCache_set_externalForces_1(physx::PxArticulationCache* self, physx::PxSpatialForce* arg0) {
  self->externalForces = arg0;
}

PxRealPtr* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationCache_get_denseJacobian_0(physx::PxArticulationCache* self) {
  return &self->denseJacobian;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationCache_set_denseJacobian_1(physx::PxArticulationCache* self, PxRealPtr* arg0) {
  self->denseJacobian = *arg0;
}

PxRealPtr* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationCache_get_massMatrix_0(physx::PxArticulationCache* self) {
  return &self->massMatrix;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationCache_set_massMatrix_1(physx::PxArticulationCache* self, PxRealPtr* arg0) {
  self->massMatrix = *arg0;
}

PxRealPtr* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationCache_get_jointVelocity_0(physx::PxArticulationCache* self) {
  return &self->jointVelocity;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationCache_set_jointVelocity_1(physx::PxArticulationCache* self, PxRealPtr* arg0) {
  self->jointVelocity = *arg0;
}

PxRealPtr* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationCache_get_jointAcceleration_0(physx::PxArticulationCache* self) {
  return &self->jointAcceleration;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationCache_set_jointAcceleration_1(physx::PxArticulationCache* self, PxRealPtr* arg0) {
  self->jointAcceleration = *arg0;
}

PxRealPtr* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationCache_get_jointPosition_0(physx::PxArticulationCache* self) {
  return &self->jointPosition;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationCache_set_jointPosition_1(physx::PxArticulationCache* self, PxRealPtr* arg0) {
  self->jointPosition = *arg0;
}

PxRealPtr* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationCache_get_jointForce_0(physx::PxArticulationCache* self) {
  return &self->jointForce;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationCache_set_jointForce_1(physx::PxArticulationCache* self, PxRealPtr* arg0) {
  self->jointForce = *arg0;
}

physx::PxSpatialVelocity* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationCache_get_linkVelocity_0(physx::PxArticulationCache* self) {
  return self->linkVelocity;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationCache_set_linkVelocity_1(physx::PxArticulationCache* self, physx::PxSpatialVelocity* arg0) {
  self->linkVelocity = arg0;
}

physx::PxSpatialVelocity* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationCache_get_linkAcceleration_0(physx::PxArticulationCache* self) {
  return self->linkAcceleration;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationCache_set_linkAcceleration_1(physx::PxArticulationCache* self, physx::PxSpatialVelocity* arg0) {
  self->linkAcceleration = arg0;
}

physx::PxSpatialForce* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationCache_get_linkIncomingJointForce_0(physx::PxArticulationCache* self) {
  return self->linkIncomingJointForce;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationCache_set_linkIncomingJointForce_1(physx::PxArticulationCache* self, physx::PxSpatialForce* arg0) {
  self->linkIncomingJointForce = arg0;
}

physx::PxArticulationRootLinkData* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationCache_get_rootLinkData_0(physx::PxArticulationCache* self) {
  return self->rootLinkData;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationCache_set_rootLinkData_1(physx::PxArticulationCache* self, physx::PxArticulationRootLinkData* arg0) {
  self->rootLinkData = arg0;
}

PxRealPtr* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationCache_get_coefficientMatrix_0(physx::PxArticulationCache* self) {
  return &self->coefficientMatrix;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationCache_set_coefficientMatrix_1(physx::PxArticulationCache* self, PxRealPtr* arg0) {
  self->coefficientMatrix = *arg0;
}

PxRealPtr* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationCache_get_lambda_0(physx::PxArticulationCache* self) {
  return &self->lambda;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationCache_set_lambda_1(physx::PxArticulationCache* self, PxRealPtr* arg0) {
  self->lambda = *arg0;
}

void* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationCache_get_scratchMemory_0(physx::PxArticulationCache* self) {
  return self->scratchMemory;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationCache_set_scratchMemory_1(physx::PxArticulationCache* self, void* arg0) {
  self->scratchMemory = arg0;
}

void* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationCache_get_scratchAllocator_0(physx::PxArticulationCache* self) {
  return self->scratchAllocator;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationCache_set_scratchAllocator_1(physx::PxArticulationCache* self, void* arg0) {
  self->scratchAllocator = arg0;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationCache_get_version_0(physx::PxArticulationCache* self) {
  return self->version;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationCache_set_version_1(physx::PxArticulationCache* self, unsigned int arg0) {
  self->version = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationCache___destroy___0(physx::PxArticulationCache* self) {
  delete self;
}

// Interface: PxArticulationCacheFlags


physx::PxArticulationCacheFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationCacheFlags_PxArticulationCacheFlags_1(unsigned int flags) {
  return new physx::PxArticulationCacheFlags(flags);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationCacheFlags_isSet_1(physx::PxArticulationCacheFlags* self, PxArticulationCacheFlagEnum flag) {
  return self->isSet(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationCacheFlags_raise_1(physx::PxArticulationCacheFlags* self, PxArticulationCacheFlagEnum flag) {
  self->raise(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationCacheFlags_clear_1(physx::PxArticulationCacheFlags* self, PxArticulationCacheFlagEnum flag) {
  self->clear(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationCacheFlags___destroy___0(physx::PxArticulationCacheFlags* self) {
  delete self;
}

// Interface: PxArticulationDrive


physx::PxArticulationDrive* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationDrive_PxArticulationDrive_0() {
  return new physx::PxArticulationDrive();
}

physx::PxArticulationDrive* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationDrive_PxArticulationDrive_4(float stiffness, float damping, float maxForce, PxArticulationDriveTypeEnum driveType) {
  return new physx::PxArticulationDrive(stiffness, damping, maxForce, driveType);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationDrive_get_stiffness_0(physx::PxArticulationDrive* self) {
  return self->stiffness;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationDrive_set_stiffness_1(physx::PxArticulationDrive* self, float arg0) {
  self->stiffness = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationDrive_get_damping_0(physx::PxArticulationDrive* self) {
  return self->damping;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationDrive_set_damping_1(physx::PxArticulationDrive* self, float arg0) {
  self->damping = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationDrive_get_maxForce_0(physx::PxArticulationDrive* self) {
  return self->maxForce;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationDrive_set_maxForce_1(physx::PxArticulationDrive* self, float arg0) {
  self->maxForce = arg0;
}

PxArticulationDriveTypeEnum EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationDrive_get_driveType_0(physx::PxArticulationDrive* self) {
  return self->driveType;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationDrive_set_driveType_1(physx::PxArticulationDrive* self, PxArticulationDriveTypeEnum arg0) {
  self->driveType = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationDrive___destroy___0(physx::PxArticulationDrive* self) {
  delete self;
}

// Interface: PxArticulationFixedTendon


physx::PxArticulationTendonJoint* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationFixedTendon_createTendonJoint_5(physx::PxArticulationFixedTendon* self, physx::PxArticulationTendonJoint* parent, PxArticulationAxisEnum axis, float coefficient, float recipCoefficient, physx::PxArticulationLink* link) {
  return self->createTendonJoint(parent, axis, coefficient, recipCoefficient, link);
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationFixedTendon_getNbTendonJoints_0(physx::PxArticulationFixedTendon* self) {
  return self->getNbTendonJoints();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationFixedTendon_setRestLength_1(physx::PxArticulationFixedTendon* self, float restLength) {
  self->setRestLength(restLength);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationFixedTendon_getRestLength_0(physx::PxArticulationFixedTendon* self) {
  return self->getRestLength();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationFixedTendon_setLimitParameters_1(physx::PxArticulationFixedTendon* self, const physx::PxArticulationTendonLimit* parameter) {
  self->setLimitParameters(*parameter);
}

physx::PxArticulationTendonLimit* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationFixedTendon_getLimitParameters_0(physx::PxArticulationFixedTendon* self) {
  static thread_local physx::PxArticulationTendonLimit temp;
  return (temp = self->getLimitParameters(), &temp);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationFixedTendon_setStiffness_1(physx::PxArticulationFixedTendon* self, float stiffness) {
  self->setStiffness(stiffness);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationFixedTendon_getStiffness_0(physx::PxArticulationFixedTendon* self) {
  return self->getStiffness();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationFixedTendon_setDamping_1(physx::PxArticulationFixedTendon* self, float damping) {
  self->setDamping(damping);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationFixedTendon_getDamping_0(physx::PxArticulationFixedTendon* self) {
  return self->getDamping();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationFixedTendon_setLimitStiffness_1(physx::PxArticulationFixedTendon* self, float stiffness) {
  self->setLimitStiffness(stiffness);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationFixedTendon_getLimitStiffness_0(physx::PxArticulationFixedTendon* self) {
  return self->getLimitStiffness();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationFixedTendon_setOffset_1(physx::PxArticulationFixedTendon* self, float offset) {
  self->setOffset(offset);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationFixedTendon_setOffset_2(physx::PxArticulationFixedTendon* self, float offset, bool autowake) {
  self->setOffset(offset, autowake);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationFixedTendon_getOffset_0(physx::PxArticulationFixedTendon* self) {
  return self->getOffset();
}

physx::PxArticulationReducedCoordinate* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationFixedTendon_getArticulation_0(physx::PxArticulationFixedTendon* self) {
  return self->getArticulation();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationFixedTendon_release_0(physx::PxArticulationFixedTendon* self) {
  self->release();
}

const char* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationFixedTendon_getConcreteTypeName_0(physx::PxArticulationFixedTendon* self) {
  return self->getConcreteTypeName();
}

int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationFixedTendon_getConcreteType_0(physx::PxArticulationFixedTendon* self) {
  return self->getConcreteType();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationFixedTendon_setBaseFlag_2(physx::PxArticulationFixedTendon* self, PxBaseFlagEnum flag, bool value) {
  self->setBaseFlag(flag, value);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationFixedTendon_setBaseFlags_1(physx::PxArticulationFixedTendon* self, physx::PxBaseFlags* inFlags) {
  self->setBaseFlags(*inFlags);
}

physx::PxBaseFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationFixedTendon_getBaseFlags_0(physx::PxArticulationFixedTendon* self) {
  static thread_local physx::PxBaseFlags temp;
  return (temp = self->getBaseFlags(), &temp);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationFixedTendon_isReleasable_0(physx::PxArticulationFixedTendon* self) {
  return self->isReleasable();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationFixedTendon___destroy___0(physx::PxArticulationFixedTendon* self) {
  delete self;
}

// Interface: PxArticulationFlags


physx::PxArticulationFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationFlags_PxArticulationFlags_1(unsigned char flags) {
  return new physx::PxArticulationFlags(flags);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationFlags_isSet_1(physx::PxArticulationFlags* self, PxArticulationFlagEnum flag) {
  return self->isSet(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationFlags_raise_1(physx::PxArticulationFlags* self, PxArticulationFlagEnum flag) {
  self->raise(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationFlags_clear_1(physx::PxArticulationFlags* self, PxArticulationFlagEnum flag) {
  self->clear(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationFlags___destroy___0(physx::PxArticulationFlags* self) {
  delete self;
}

// Interface: PxArticulationJointReducedCoordinate


physx::PxArticulationLink* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationJointReducedCoordinate_getParentArticulationLink_0(physx::PxArticulationJointReducedCoordinate* self) {
  return &self->getParentArticulationLink();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationJointReducedCoordinate_setParentPose_1(physx::PxArticulationJointReducedCoordinate* self, const physx::PxTransform* pose) {
  self->setParentPose(*pose);
}

physx::PxTransform* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationJointReducedCoordinate_getParentPose_0(physx::PxArticulationJointReducedCoordinate* self) {
  static thread_local physx::PxTransform temp;
  return (temp = self->getParentPose(), &temp);
}

physx::PxArticulationLink* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationJointReducedCoordinate_getChildArticulationLink_0(physx::PxArticulationJointReducedCoordinate* self) {
  return &self->getChildArticulationLink();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationJointReducedCoordinate_setChildPose_1(physx::PxArticulationJointReducedCoordinate* self, const physx::PxTransform* pose) {
  self->setChildPose(*pose);
}

physx::PxTransform* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationJointReducedCoordinate_getChildPose_0(physx::PxArticulationJointReducedCoordinate* self) {
  static thread_local physx::PxTransform temp;
  return (temp = self->getChildPose(), &temp);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationJointReducedCoordinate_setJointType_1(physx::PxArticulationJointReducedCoordinate* self, PxArticulationJointTypeEnum jointType) {
  self->setJointType(jointType);
}

PxArticulationJointTypeEnum EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationJointReducedCoordinate_getJointType_0(physx::PxArticulationJointReducedCoordinate* self) {
  return self->getJointType();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationJointReducedCoordinate_setMotion_2(physx::PxArticulationJointReducedCoordinate* self, PxArticulationAxisEnum axis, PxArticulationMotionEnum motion) {
  self->setMotion(axis, motion);
}

PxArticulationMotionEnum EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationJointReducedCoordinate_getMotion_1(physx::PxArticulationJointReducedCoordinate* self, PxArticulationAxisEnum axis) {
  return self->getMotion(axis);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationJointReducedCoordinate_setLimitParams_2(physx::PxArticulationJointReducedCoordinate* self, PxArticulationAxisEnum axis, const physx::PxArticulationLimit* limit) {
  self->setLimitParams(axis, *limit);
}

physx::PxArticulationLimit* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationJointReducedCoordinate_getLimitParams_1(physx::PxArticulationJointReducedCoordinate* self, PxArticulationAxisEnum axis) {
  static thread_local physx::PxArticulationLimit temp;
  return (temp = self->getLimitParams(axis), &temp);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationJointReducedCoordinate_setDriveParams_2(physx::PxArticulationJointReducedCoordinate* self, PxArticulationAxisEnum axis, const physx::PxArticulationDrive* drive) {
  self->setDriveParams(axis, *drive);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationJointReducedCoordinate_setDriveTarget_2(physx::PxArticulationJointReducedCoordinate* self, PxArticulationAxisEnum axis, float target) {
  self->setDriveTarget(axis, target);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationJointReducedCoordinate_setDriveTarget_3(physx::PxArticulationJointReducedCoordinate* self, PxArticulationAxisEnum axis, float target, bool autowake) {
  self->setDriveTarget(axis, target, autowake);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationJointReducedCoordinate_getDriveTarget_1(physx::PxArticulationJointReducedCoordinate* self, PxArticulationAxisEnum axis) {
  return self->getDriveTarget(axis);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationJointReducedCoordinate_setDriveVelocity_2(physx::PxArticulationJointReducedCoordinate* self, PxArticulationAxisEnum axis, float targetVel) {
  self->setDriveVelocity(axis, targetVel);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationJointReducedCoordinate_setDriveVelocity_3(physx::PxArticulationJointReducedCoordinate* self, PxArticulationAxisEnum axis, float targetVel, bool autowake) {
  self->setDriveVelocity(axis, targetVel, autowake);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationJointReducedCoordinate_getDriveVelocity_1(physx::PxArticulationJointReducedCoordinate* self, PxArticulationAxisEnum axis) {
  return self->getDriveVelocity(axis);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationJointReducedCoordinate_setArmature_2(physx::PxArticulationJointReducedCoordinate* self, PxArticulationAxisEnum axis, float armature) {
  self->setArmature(axis, armature);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationJointReducedCoordinate_getArmature_1(physx::PxArticulationJointReducedCoordinate* self, PxArticulationAxisEnum axis) {
  return self->getArmature(axis);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationJointReducedCoordinate_setFrictionCoefficient_1(physx::PxArticulationJointReducedCoordinate* self, float coefficient) {
  self->setFrictionCoefficient(coefficient);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationJointReducedCoordinate_getFrictionCoefficient_0(physx::PxArticulationJointReducedCoordinate* self) {
  return self->getFrictionCoefficient();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationJointReducedCoordinate_setMaxJointVelocity_1(physx::PxArticulationJointReducedCoordinate* self, float maxJointV) {
  self->setMaxJointVelocity(maxJointV);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationJointReducedCoordinate_getMaxJointVelocity_0(physx::PxArticulationJointReducedCoordinate* self) {
  return self->getMaxJointVelocity();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationJointReducedCoordinate_setJointPosition_2(physx::PxArticulationJointReducedCoordinate* self, PxArticulationAxisEnum axis, float jointPos) {
  self->setJointPosition(axis, jointPos);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationJointReducedCoordinate_getJointPosition_1(physx::PxArticulationJointReducedCoordinate* self, PxArticulationAxisEnum axis) {
  return self->getJointPosition(axis);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationJointReducedCoordinate_setJointVelocity_2(physx::PxArticulationJointReducedCoordinate* self, PxArticulationAxisEnum axis, float jointVel) {
  self->setJointVelocity(axis, jointVel);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationJointReducedCoordinate_getJointVelocity_1(physx::PxArticulationJointReducedCoordinate* self, PxArticulationAxisEnum axis) {
  return self->getJointVelocity(axis);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationJointReducedCoordinate_release_0(physx::PxArticulationJointReducedCoordinate* self) {
  self->release();
}

const char* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationJointReducedCoordinate_getConcreteTypeName_0(physx::PxArticulationJointReducedCoordinate* self) {
  return self->getConcreteTypeName();
}

int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationJointReducedCoordinate_getConcreteType_0(physx::PxArticulationJointReducedCoordinate* self) {
  return self->getConcreteType();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationJointReducedCoordinate_setBaseFlag_2(physx::PxArticulationJointReducedCoordinate* self, PxBaseFlagEnum flag, bool value) {
  self->setBaseFlag(flag, value);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationJointReducedCoordinate_setBaseFlags_1(physx::PxArticulationJointReducedCoordinate* self, physx::PxBaseFlags* inFlags) {
  self->setBaseFlags(*inFlags);
}

physx::PxBaseFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationJointReducedCoordinate_getBaseFlags_0(physx::PxArticulationJointReducedCoordinate* self) {
  static thread_local physx::PxBaseFlags temp;
  return (temp = self->getBaseFlags(), &temp);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationJointReducedCoordinate_isReleasable_0(physx::PxArticulationJointReducedCoordinate* self) {
  return self->isReleasable();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationJointReducedCoordinate___destroy___0(physx::PxArticulationJointReducedCoordinate* self) {
  delete self;
}

// Interface: PxArticulationKinematicFlags


physx::PxArticulationKinematicFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationKinematicFlags_PxArticulationKinematicFlags_1(unsigned char flags) {
  return new physx::PxArticulationKinematicFlags(flags);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationKinematicFlags_isSet_1(physx::PxArticulationKinematicFlags* self, PxArticulationKinematicFlagEnum flag) {
  return self->isSet(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationKinematicFlags_raise_1(physx::PxArticulationKinematicFlags* self, PxArticulationKinematicFlagEnum flag) {
  self->raise(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationKinematicFlags_clear_1(physx::PxArticulationKinematicFlags* self, PxArticulationKinematicFlagEnum flag) {
  self->clear(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationKinematicFlags___destroy___0(physx::PxArticulationKinematicFlags* self) {
  delete self;
}

// Interface: PxArticulationLimit


physx::PxArticulationLimit* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationLimit_PxArticulationLimit_0() {
  return new physx::PxArticulationLimit();
}

physx::PxArticulationLimit* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationLimit_PxArticulationLimit_2(float low, float high) {
  return new physx::PxArticulationLimit(low, high);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationLimit_get_low_0(physx::PxArticulationLimit* self) {
  return self->low;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationLimit_set_low_1(physx::PxArticulationLimit* self, float arg0) {
  self->low = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationLimit_get_high_0(physx::PxArticulationLimit* self) {
  return self->high;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationLimit_set_high_1(physx::PxArticulationLimit* self, float arg0) {
  self->high = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationLimit___destroy___0(physx::PxArticulationLimit* self) {
  delete self;
}

// Interface: PxArticulationLink


physx::PxArticulationReducedCoordinate* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationLink_getArticulation_0(physx::PxArticulationLink* self) {
  return &self->getArticulation();
}

physx::PxArticulationJointReducedCoordinate* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationLink_getInboundJoint_0(physx::PxArticulationLink* self) {
  return self->getInboundJoint();
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationLink_getInboundJointDof_0(physx::PxArticulationLink* self) {
  return self->getInboundJointDof();
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationLink_getNbChildren_0(physx::PxArticulationLink* self) {
  return self->getNbChildren();
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationLink_getLinkIndex_0(physx::PxArticulationLink* self) {
  return self->getLinkIndex();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationLink_setCfmScale_1(physx::PxArticulationLink* self, float cfm) {
  self->setCfmScale(cfm);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationLink_getCfmScale_0(physx::PxArticulationLink* self) {
  return self->getCfmScale();
}

PxActorTypeEnum EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationLink_getType_0(physx::PxArticulationLink* self) {
  return self->getType();
}

physx::PxScene* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationLink_getScene_0(physx::PxArticulationLink* self) {
  return self->getScene();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationLink_setName_1(physx::PxArticulationLink* self, const char* name) {
  self->setName(name);
}

const char* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationLink_getName_0(physx::PxArticulationLink* self) {
  return self->getName();
}

physx::PxBounds3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationLink_getWorldBounds_0(physx::PxArticulationLink* self) {
  static thread_local physx::PxBounds3 temp;
  return (temp = self->getWorldBounds(), &temp);
}

physx::PxBounds3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationLink_getWorldBounds_1(physx::PxArticulationLink* self, float inflation) {
  static thread_local physx::PxBounds3 temp;
  return (temp = self->getWorldBounds(inflation), &temp);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationLink_setActorFlag_2(physx::PxArticulationLink* self, PxActorFlagEnum flag, bool value) {
  self->setActorFlag(flag, value);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationLink_setActorFlags_1(physx::PxArticulationLink* self, physx::PxActorFlags* flags) {
  self->setActorFlags(*flags);
}

physx::PxActorFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationLink_getActorFlags_0(physx::PxArticulationLink* self) {
  static thread_local physx::PxActorFlags temp;
  return (temp = self->getActorFlags(), &temp);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationLink_setDominanceGroup_1(physx::PxArticulationLink* self, unsigned char dominanceGroup) {
  self->setDominanceGroup(dominanceGroup);
}

unsigned char EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationLink_getDominanceGroup_0(physx::PxArticulationLink* self) {
  return self->getDominanceGroup();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationLink_setOwnerClient_1(physx::PxArticulationLink* self, unsigned char inClient) {
  self->setOwnerClient(inClient);
}

unsigned char EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationLink_getOwnerClient_0(physx::PxArticulationLink* self) {
  return self->getOwnerClient();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationLink_release_0(physx::PxArticulationLink* self) {
  self->release();
}

const char* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationLink_getConcreteTypeName_0(physx::PxArticulationLink* self) {
  return self->getConcreteTypeName();
}

int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationLink_getConcreteType_0(physx::PxArticulationLink* self) {
  return self->getConcreteType();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationLink_setBaseFlag_2(physx::PxArticulationLink* self, PxBaseFlagEnum flag, bool value) {
  self->setBaseFlag(flag, value);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationLink_setBaseFlags_1(physx::PxArticulationLink* self, physx::PxBaseFlags* inFlags) {
  self->setBaseFlags(*inFlags);
}

physx::PxBaseFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationLink_getBaseFlags_0(physx::PxArticulationLink* self) {
  static thread_local physx::PxBaseFlags temp;
  return (temp = self->getBaseFlags(), &temp);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationLink_isReleasable_0(physx::PxArticulationLink* self) {
  return self->isReleasable();
}

physx::PxTransform* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationLink_getGlobalPose_0(physx::PxArticulationLink* self) {
  static thread_local physx::PxTransform temp;
  return (temp = self->getGlobalPose(), &temp);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationLink_setGlobalPose_1(physx::PxArticulationLink* self, const physx::PxTransform* pose) {
  self->setGlobalPose(*pose);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationLink_setGlobalPose_2(physx::PxArticulationLink* self, const physx::PxTransform* pose, bool autowake) {
  self->setGlobalPose(*pose, autowake);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationLink_attachShape_1(physx::PxArticulationLink* self, physx::PxShape* shape) {
  return self->attachShape(*shape);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationLink_detachShape_1(physx::PxArticulationLink* self, physx::PxShape* shape) {
  self->detachShape(*shape);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationLink_detachShape_2(physx::PxArticulationLink* self, physx::PxShape* shape, bool wakeOnLostTouch) {
  self->detachShape(*shape, wakeOnLostTouch);
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationLink_getNbShapes_0(physx::PxArticulationLink* self) {
  return self->getNbShapes();
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationLink_getShapes_3(physx::PxArticulationLink* self, PxShapePtr* userBuffer, unsigned int bufferSize, unsigned int startIndex) {
  return self->getShapes(userBuffer, bufferSize, startIndex);
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationLink_getNbConstraints_0(physx::PxArticulationLink* self) {
  return self->getNbConstraints();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationLink_setCMassLocalPose_1(physx::PxArticulationLink* self, const physx::PxTransform* pose) {
  self->setCMassLocalPose(*pose);
}

physx::PxTransform* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationLink_getCMassLocalPose_0(physx::PxArticulationLink* self) {
  static thread_local physx::PxTransform temp;
  return (temp = self->getCMassLocalPose(), &temp);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationLink_setMass_1(physx::PxArticulationLink* self, float mass) {
  self->setMass(mass);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationLink_getMass_0(physx::PxArticulationLink* self) {
  return self->getMass();
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationLink_getInvMass_0(physx::PxArticulationLink* self) {
  return self->getInvMass();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationLink_setMassSpaceInertiaTensor_1(physx::PxArticulationLink* self, const physx::PxVec3* m) {
  self->setMassSpaceInertiaTensor(*m);
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationLink_getMassSpaceInertiaTensor_0(physx::PxArticulationLink* self) {
  static thread_local physx::PxVec3 temp;
  return (temp = self->getMassSpaceInertiaTensor(), &temp);
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationLink_getMassSpaceInvInertiaTensor_0(physx::PxArticulationLink* self) {
  static thread_local physx::PxVec3 temp;
  return (temp = self->getMassSpaceInvInertiaTensor(), &temp);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationLink_setLinearDamping_1(physx::PxArticulationLink* self, float linDamp) {
  self->setLinearDamping(linDamp);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationLink_getLinearDamping_0(physx::PxArticulationLink* self) {
  return self->getLinearDamping();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationLink_setAngularDamping_1(physx::PxArticulationLink* self, float angDamp) {
  self->setAngularDamping(angDamp);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationLink_getAngularDamping_0(physx::PxArticulationLink* self) {
  return self->getAngularDamping();
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationLink_getLinearVelocity_0(physx::PxArticulationLink* self) {
  static thread_local physx::PxVec3 temp;
  return (temp = self->getLinearVelocity(), &temp);
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationLink_getAngularVelocity_0(physx::PxArticulationLink* self) {
  static thread_local physx::PxVec3 temp;
  return (temp = self->getAngularVelocity(), &temp);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationLink_setMaxLinearVelocity_1(physx::PxArticulationLink* self, float maxLinVel) {
  self->setMaxLinearVelocity(maxLinVel);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationLink_getMaxLinearVelocity_0(physx::PxArticulationLink* self) {
  return self->getMaxLinearVelocity();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationLink_setMaxAngularVelocity_1(physx::PxArticulationLink* self, float maxAngVel) {
  self->setMaxAngularVelocity(maxAngVel);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationLink_getMaxAngularVelocity_0(physx::PxArticulationLink* self) {
  return self->getMaxAngularVelocity();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationLink_addForce_1(physx::PxArticulationLink* self, const physx::PxVec3* force) {
  self->addForce(*force);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationLink_addForce_2(physx::PxArticulationLink* self, const physx::PxVec3* force, PxForceModeEnum mode) {
  self->addForce(*force, mode);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationLink_addForce_3(physx::PxArticulationLink* self, const physx::PxVec3* force, PxForceModeEnum mode, bool autowake) {
  self->addForce(*force, mode, autowake);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationLink_addTorque_1(physx::PxArticulationLink* self, const physx::PxVec3* torque) {
  self->addTorque(*torque);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationLink_addTorque_2(physx::PxArticulationLink* self, const physx::PxVec3* torque, PxForceModeEnum mode) {
  self->addTorque(*torque, mode);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationLink_addTorque_3(physx::PxArticulationLink* self, const physx::PxVec3* torque, PxForceModeEnum mode, bool autowake) {
  self->addTorque(*torque, mode, autowake);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationLink_clearForce_1(physx::PxArticulationLink* self, PxForceModeEnum mode) {
  self->clearForce(mode);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationLink_clearTorque_1(physx::PxArticulationLink* self, PxForceModeEnum mode) {
  self->clearTorque(mode);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationLink_setForceAndTorque_2(physx::PxArticulationLink* self, const physx::PxVec3* force, const physx::PxVec3* torque) {
  self->setForceAndTorque(*force, *torque);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationLink_setForceAndTorque_3(physx::PxArticulationLink* self, const physx::PxVec3* force, const physx::PxVec3* torque, PxForceModeEnum mode) {
  self->setForceAndTorque(*force, *torque, mode);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationLink_setRigidBodyFlag_2(physx::PxArticulationLink* self, PxRigidBodyFlagEnum flag, bool value) {
  self->setRigidBodyFlag(flag, value);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationLink_setRigidBodyFlags_1(physx::PxArticulationLink* self, physx::PxRigidBodyFlags* inFlags) {
  self->setRigidBodyFlags(*inFlags);
}

physx::PxRigidBodyFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationLink_getRigidBodyFlags_0(physx::PxArticulationLink* self) {
  static thread_local physx::PxRigidBodyFlags temp;
  return (temp = self->getRigidBodyFlags(), &temp);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationLink_setMinCCDAdvanceCoefficient_1(physx::PxArticulationLink* self, float advanceCoefficient) {
  self->setMinCCDAdvanceCoefficient(advanceCoefficient);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationLink_getMinCCDAdvanceCoefficient_0(physx::PxArticulationLink* self) {
  return self->getMinCCDAdvanceCoefficient();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationLink_setMaxDepenetrationVelocity_1(physx::PxArticulationLink* self, float biasClamp) {
  self->setMaxDepenetrationVelocity(biasClamp);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationLink_getMaxDepenetrationVelocity_0(physx::PxArticulationLink* self) {
  return self->getMaxDepenetrationVelocity();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationLink_setMaxContactImpulse_1(physx::PxArticulationLink* self, float maxImpulse) {
  self->setMaxContactImpulse(maxImpulse);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationLink_getMaxContactImpulse_0(physx::PxArticulationLink* self) {
  return self->getMaxContactImpulse();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationLink_setContactSlopCoefficient_1(physx::PxArticulationLink* self, float slopCoefficient) {
  self->setContactSlopCoefficient(slopCoefficient);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationLink_getContactSlopCoefficient_0(physx::PxArticulationLink* self) {
  return self->getContactSlopCoefficient();
}

void* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationLink_get_userData_0(physx::PxArticulationLink* self) {
  return self->userData;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationLink_set_userData_1(physx::PxArticulationLink* self, void* arg0) {
  self->userData = arg0;
}

// Interface: PxArticulationReducedCoordinate


physx::PxScene* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationReducedCoordinate_getScene_0(physx::PxArticulationReducedCoordinate* self) {
  return self->getScene();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationReducedCoordinate_setSolverIterationCounts_1(physx::PxArticulationReducedCoordinate* self, unsigned int minPositionIters) {
  self->setSolverIterationCounts(minPositionIters);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationReducedCoordinate_setSolverIterationCounts_2(physx::PxArticulationReducedCoordinate* self, unsigned int minPositionIters, unsigned int minVelocityIters) {
  self->setSolverIterationCounts(minPositionIters, minVelocityIters);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationReducedCoordinate_isSleeping_0(physx::PxArticulationReducedCoordinate* self) {
  return self->isSleeping();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationReducedCoordinate_setSleepThreshold_1(physx::PxArticulationReducedCoordinate* self, float threshold) {
  self->setSleepThreshold(threshold);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationReducedCoordinate_getSleepThreshold_0(physx::PxArticulationReducedCoordinate* self) {
  return self->getSleepThreshold();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationReducedCoordinate_setStabilizationThreshold_1(physx::PxArticulationReducedCoordinate* self, float threshold) {
  self->setStabilizationThreshold(threshold);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationReducedCoordinate_getStabilizationThreshold_0(physx::PxArticulationReducedCoordinate* self) {
  return self->getStabilizationThreshold();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationReducedCoordinate_setWakeCounter_1(physx::PxArticulationReducedCoordinate* self, float wakeCounterValue) {
  self->setWakeCounter(wakeCounterValue);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationReducedCoordinate_getWakeCounter_0(physx::PxArticulationReducedCoordinate* self) {
  return self->getWakeCounter();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationReducedCoordinate_wakeUp_0(physx::PxArticulationReducedCoordinate* self) {
  self->wakeUp();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationReducedCoordinate_putToSleep_0(physx::PxArticulationReducedCoordinate* self) {
  self->putToSleep();
}

physx::PxArticulationLink* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationReducedCoordinate_createLink_2(physx::PxArticulationReducedCoordinate* self, physx::PxArticulationLink* parent, const physx::PxTransform* pose) {
  return self->createLink(parent, *pose);
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationReducedCoordinate_getNbLinks_0(physx::PxArticulationReducedCoordinate* self) {
  return self->getNbLinks();
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationReducedCoordinate_getNbShapes_0(physx::PxArticulationReducedCoordinate* self) {
  return self->getNbShapes();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationReducedCoordinate_setName_1(physx::PxArticulationReducedCoordinate* self, const char* name) {
  self->setName(name);
}

const char* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationReducedCoordinate_getName_0(physx::PxArticulationReducedCoordinate* self) {
  return self->getName();
}

physx::PxBounds3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationReducedCoordinate_getWorldBounds_0(physx::PxArticulationReducedCoordinate* self) {
  static thread_local physx::PxBounds3 temp;
  return (temp = self->getWorldBounds(), &temp);
}

physx::PxBounds3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationReducedCoordinate_getWorldBounds_1(physx::PxArticulationReducedCoordinate* self, float inflation) {
  static thread_local physx::PxBounds3 temp;
  return (temp = self->getWorldBounds(inflation), &temp);
}

physx::PxAggregate* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationReducedCoordinate_getAggregate_0(physx::PxArticulationReducedCoordinate* self) {
  return self->getAggregate();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationReducedCoordinate_setArticulationFlags_1(physx::PxArticulationReducedCoordinate* self, physx::PxArticulationFlags* flags) {
  self->setArticulationFlags(*flags);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationReducedCoordinate_setArticulationFlag_2(physx::PxArticulationReducedCoordinate* self, PxArticulationFlagEnum flag, bool value) {
  self->setArticulationFlag(flag, value);
}

physx::PxArticulationFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationReducedCoordinate_getArticulationFlags_0(physx::PxArticulationReducedCoordinate* self) {
  static thread_local physx::PxArticulationFlags temp;
  return (temp = self->getArticulationFlags(), &temp);
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationReducedCoordinate_getDofs_0(physx::PxArticulationReducedCoordinate* self) {
  return self->getDofs();
}

physx::PxArticulationCache* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationReducedCoordinate_createCache_0(physx::PxArticulationReducedCoordinate* self) {
  return self->createCache();
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationReducedCoordinate_getCacheDataSize_0(physx::PxArticulationReducedCoordinate* self) {
  return self->getCacheDataSize();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationReducedCoordinate_zeroCache_1(physx::PxArticulationReducedCoordinate* self, physx::PxArticulationCache* cache) {
  self->zeroCache(*cache);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationReducedCoordinate_applyCache_2(physx::PxArticulationReducedCoordinate* self, physx::PxArticulationCache* cache, physx::PxArticulationCacheFlags* flags) {
  self->applyCache(*cache, *flags);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationReducedCoordinate_applyCache_3(physx::PxArticulationReducedCoordinate* self, physx::PxArticulationCache* cache, physx::PxArticulationCacheFlags* flags, bool autowake) {
  self->applyCache(*cache, *flags, autowake);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationReducedCoordinate_copyInternalStateToCache_2(physx::PxArticulationReducedCoordinate* self, physx::PxArticulationCache* cache, const physx::PxArticulationCacheFlags* flags) {
  self->copyInternalStateToCache(*cache, *flags);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationReducedCoordinate_commonInit_0(physx::PxArticulationReducedCoordinate* self) {
  self->commonInit();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationReducedCoordinate_computeGeneralizedGravityForce_1(physx::PxArticulationReducedCoordinate* self, physx::PxArticulationCache* cache) {
  self->computeGeneralizedGravityForce(*cache);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationReducedCoordinate_computeGravityCompensation_1(physx::PxArticulationReducedCoordinate* self, physx::PxArticulationCache* cache) {
  self->computeGravityCompensation(*cache);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationReducedCoordinate_computeCoriolisAndCentrifugalForce_1(physx::PxArticulationReducedCoordinate* self, physx::PxArticulationCache* cache) {
  self->computeCoriolisAndCentrifugalForce(*cache);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationReducedCoordinate_computeCoriolisCompensation_1(physx::PxArticulationReducedCoordinate* self, physx::PxArticulationCache* cache) {
  self->computeCoriolisCompensation(*cache);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationReducedCoordinate_computeGeneralizedExternalForce_1(physx::PxArticulationReducedCoordinate* self, physx::PxArticulationCache* cache) {
  self->computeGeneralizedExternalForce(*cache);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationReducedCoordinate_computeJointAcceleration_1(physx::PxArticulationReducedCoordinate* self, physx::PxArticulationCache* cache) {
  self->computeJointAcceleration(*cache);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationReducedCoordinate_computeJointForce_1(physx::PxArticulationReducedCoordinate* self, physx::PxArticulationCache* cache) {
  self->computeJointForce(*cache);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationReducedCoordinate_computeCoefficientMatrix_1(physx::PxArticulationReducedCoordinate* self, physx::PxArticulationCache* cache) {
  self->computeCoefficientMatrix(*cache);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationReducedCoordinate_computeGeneralizedMassMatrix_1(physx::PxArticulationReducedCoordinate* self, physx::PxArticulationCache* cache) {
  self->computeGeneralizedMassMatrix(*cache);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationReducedCoordinate_computeMassMatrix_1(physx::PxArticulationReducedCoordinate* self, physx::PxArticulationCache* cache) {
  self->computeMassMatrix(*cache);
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationReducedCoordinate_computeArticulationCOM_1(physx::PxArticulationReducedCoordinate* self, bool rootFrame) {
  static thread_local physx::PxVec3 temp;
  return (temp = self->computeArticulationCOM(rootFrame), &temp);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationReducedCoordinate_computeCentroidalMomentumMatrix_1(physx::PxArticulationReducedCoordinate* self, physx::PxArticulationCache* cache) {
  self->computeCentroidalMomentumMatrix(*cache);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationReducedCoordinate_addLoopJoint_1(physx::PxArticulationReducedCoordinate* self, physx::PxConstraint* joint) {
  self->addLoopJoint(joint);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationReducedCoordinate_removeLoopJoint_1(physx::PxArticulationReducedCoordinate* self, physx::PxConstraint* joint) {
  self->removeLoopJoint(joint);
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationReducedCoordinate_getNbLoopJoints_0(physx::PxArticulationReducedCoordinate* self) {
  return self->getNbLoopJoints();
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationReducedCoordinate_getCoefficientMatrixSize_0(physx::PxArticulationReducedCoordinate* self) {
  return self->getCoefficientMatrixSize();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationReducedCoordinate_setRootGlobalPose_1(physx::PxArticulationReducedCoordinate* self, const physx::PxTransform* pose) {
  self->setRootGlobalPose(*pose);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationReducedCoordinate_setRootGlobalPose_2(physx::PxArticulationReducedCoordinate* self, const physx::PxTransform* pose, bool autowake) {
  self->setRootGlobalPose(*pose, autowake);
}

physx::PxTransform* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationReducedCoordinate_getRootGlobalPose_0(physx::PxArticulationReducedCoordinate* self) {
  static thread_local physx::PxTransform temp;
  return (temp = self->getRootGlobalPose(), &temp);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationReducedCoordinate_setRootLinearVelocity_1(physx::PxArticulationReducedCoordinate* self, const physx::PxVec3* linearVelocity) {
  self->setRootLinearVelocity(*linearVelocity);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationReducedCoordinate_setRootLinearVelocity_2(physx::PxArticulationReducedCoordinate* self, const physx::PxVec3* linearVelocity, bool autowake) {
  self->setRootLinearVelocity(*linearVelocity, autowake);
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationReducedCoordinate_getRootLinearVelocity_0(physx::PxArticulationReducedCoordinate* self) {
  static thread_local physx::PxVec3 temp;
  return (temp = self->getRootLinearVelocity(), &temp);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationReducedCoordinate_setRootAngularVelocity_1(physx::PxArticulationReducedCoordinate* self, const physx::PxVec3* angularVelocity) {
  self->setRootAngularVelocity(*angularVelocity);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationReducedCoordinate_setRootAngularVelocity_2(physx::PxArticulationReducedCoordinate* self, const physx::PxVec3* angularVelocity, bool autowake) {
  self->setRootAngularVelocity(*angularVelocity, autowake);
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationReducedCoordinate_getRootAngularVelocity_0(physx::PxArticulationReducedCoordinate* self) {
  static thread_local physx::PxVec3 temp;
  return (temp = self->getRootAngularVelocity(), &temp);
}

physx::PxSpatialVelocity* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationReducedCoordinate_getLinkAcceleration_1(physx::PxArticulationReducedCoordinate* self, unsigned int linkId) {
  static thread_local physx::PxSpatialVelocity temp;
  return (temp = self->getLinkAcceleration(linkId), &temp);
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationReducedCoordinate_getGPUIndex_0(physx::PxArticulationReducedCoordinate* self) {
  return self->getGPUIndex();
}

physx::PxArticulationSpatialTendon* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationReducedCoordinate_createSpatialTendon_0(physx::PxArticulationReducedCoordinate* self) {
  return self->createSpatialTendon();
}

physx::PxArticulationFixedTendon* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationReducedCoordinate_createFixedTendon_0(physx::PxArticulationReducedCoordinate* self) {
  return self->createFixedTendon();
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationReducedCoordinate_getNbSpatialTendons_0(physx::PxArticulationReducedCoordinate* self) {
  return self->getNbSpatialTendons();
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationReducedCoordinate_getNbFixedTendons_0(physx::PxArticulationReducedCoordinate* self) {
  return self->getNbFixedTendons();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationReducedCoordinate_updateKinematic_1(physx::PxArticulationReducedCoordinate* self, physx::PxArticulationKinematicFlags* flags) {
  self->updateKinematic(*flags);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationReducedCoordinate_release_0(physx::PxArticulationReducedCoordinate* self) {
  self->release();
}

const char* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationReducedCoordinate_getConcreteTypeName_0(physx::PxArticulationReducedCoordinate* self) {
  return self->getConcreteTypeName();
}

int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationReducedCoordinate_getConcreteType_0(physx::PxArticulationReducedCoordinate* self) {
  return self->getConcreteType();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationReducedCoordinate_setBaseFlag_2(physx::PxArticulationReducedCoordinate* self, PxBaseFlagEnum flag, bool value) {
  self->setBaseFlag(flag, value);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationReducedCoordinate_setBaseFlags_1(physx::PxArticulationReducedCoordinate* self, physx::PxBaseFlags* inFlags) {
  self->setBaseFlags(*inFlags);
}

physx::PxBaseFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationReducedCoordinate_getBaseFlags_0(physx::PxArticulationReducedCoordinate* self) {
  static thread_local physx::PxBaseFlags temp;
  return (temp = self->getBaseFlags(), &temp);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationReducedCoordinate_isReleasable_0(physx::PxArticulationReducedCoordinate* self) {
  return self->isReleasable();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationReducedCoordinate___destroy___0(physx::PxArticulationReducedCoordinate* self) {
  delete self;
}

// Interface: PxArticulationRootLinkData


physx::PxArticulationRootLinkData* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationRootLinkData_PxArticulationRootLinkData_0() {
  return new physx::PxArticulationRootLinkData();
}

physx::PxTransform* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationRootLinkData_get_transform_0(physx::PxArticulationRootLinkData* self) {
  return &self->transform;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationRootLinkData_set_transform_1(physx::PxArticulationRootLinkData* self, physx::PxTransform* arg0) {
  self->transform = *arg0;
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationRootLinkData_get_worldLinVel_0(physx::PxArticulationRootLinkData* self) {
  return &self->worldLinVel;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationRootLinkData_set_worldLinVel_1(physx::PxArticulationRootLinkData* self, physx::PxVec3* arg0) {
  self->worldLinVel = *arg0;
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationRootLinkData_get_worldAngVel_0(physx::PxArticulationRootLinkData* self) {
  return &self->worldAngVel;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationRootLinkData_set_worldAngVel_1(physx::PxArticulationRootLinkData* self, physx::PxVec3* arg0) {
  self->worldAngVel = *arg0;
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationRootLinkData_get_worldLinAccel_0(physx::PxArticulationRootLinkData* self) {
  return &self->worldLinAccel;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationRootLinkData_set_worldLinAccel_1(physx::PxArticulationRootLinkData* self, physx::PxVec3* arg0) {
  self->worldLinAccel = *arg0;
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationRootLinkData_get_worldAngAccel_0(physx::PxArticulationRootLinkData* self) {
  return &self->worldAngAccel;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationRootLinkData_set_worldAngAccel_1(physx::PxArticulationRootLinkData* self, physx::PxVec3* arg0) {
  self->worldAngAccel = *arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationRootLinkData___destroy___0(physx::PxArticulationRootLinkData* self) {
  delete self;
}

// Interface: PxArticulationSpatialTendon


physx::PxArticulationAttachment* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationSpatialTendon_createAttachment_4(physx::PxArticulationSpatialTendon* self, physx::PxArticulationAttachment* parent, float coefficient, const physx::PxVec3* relativeOffset, physx::PxArticulationLink* link) {
  return self->createAttachment(parent, coefficient, *relativeOffset, link);
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationSpatialTendon_getNbAttachments_0(physx::PxArticulationSpatialTendon* self) {
  return self->getNbAttachments();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationSpatialTendon_setStiffness_1(physx::PxArticulationSpatialTendon* self, float stiffness) {
  self->setStiffness(stiffness);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationSpatialTendon_getStiffness_0(physx::PxArticulationSpatialTendon* self) {
  return self->getStiffness();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationSpatialTendon_setDamping_1(physx::PxArticulationSpatialTendon* self, float damping) {
  self->setDamping(damping);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationSpatialTendon_getDamping_0(physx::PxArticulationSpatialTendon* self) {
  return self->getDamping();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationSpatialTendon_setLimitStiffness_1(physx::PxArticulationSpatialTendon* self, float stiffness) {
  self->setLimitStiffness(stiffness);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationSpatialTendon_getLimitStiffness_0(physx::PxArticulationSpatialTendon* self) {
  return self->getLimitStiffness();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationSpatialTendon_setOffset_1(physx::PxArticulationSpatialTendon* self, float offset) {
  self->setOffset(offset);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationSpatialTendon_setOffset_2(physx::PxArticulationSpatialTendon* self, float offset, bool autowake) {
  self->setOffset(offset, autowake);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationSpatialTendon_getOffset_0(physx::PxArticulationSpatialTendon* self) {
  return self->getOffset();
}

physx::PxArticulationReducedCoordinate* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationSpatialTendon_getArticulation_0(physx::PxArticulationSpatialTendon* self) {
  return self->getArticulation();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationSpatialTendon_release_0(physx::PxArticulationSpatialTendon* self) {
  self->release();
}

const char* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationSpatialTendon_getConcreteTypeName_0(physx::PxArticulationSpatialTendon* self) {
  return self->getConcreteTypeName();
}

int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationSpatialTendon_getConcreteType_0(physx::PxArticulationSpatialTendon* self) {
  return self->getConcreteType();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationSpatialTendon_setBaseFlag_2(physx::PxArticulationSpatialTendon* self, PxBaseFlagEnum flag, bool value) {
  self->setBaseFlag(flag, value);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationSpatialTendon_setBaseFlags_1(physx::PxArticulationSpatialTendon* self, physx::PxBaseFlags* inFlags) {
  self->setBaseFlags(*inFlags);
}

physx::PxBaseFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationSpatialTendon_getBaseFlags_0(physx::PxArticulationSpatialTendon* self) {
  static thread_local physx::PxBaseFlags temp;
  return (temp = self->getBaseFlags(), &temp);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationSpatialTendon_isReleasable_0(physx::PxArticulationSpatialTendon* self) {
  return self->isReleasable();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationSpatialTendon___destroy___0(physx::PxArticulationSpatialTendon* self) {
  delete self;
}

// Interface: PxArticulationTendonJoint


void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationTendonJoint_setCoefficient_3(physx::PxArticulationTendonJoint* self, PxArticulationAxisEnum axis, float coefficient, float recipCoefficient) {
  self->setCoefficient(axis, coefficient, recipCoefficient);
}

physx::PxArticulationLink* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationTendonJoint_getLink_0(physx::PxArticulationTendonJoint* self) {
  return self->getLink();
}

physx::PxArticulationTendonJoint* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationTendonJoint_getParent_0(physx::PxArticulationTendonJoint* self) {
  return self->getParent();
}

physx::PxArticulationFixedTendon* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationTendonJoint_getTendon_0(physx::PxArticulationTendonJoint* self) {
  return self->getTendon();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationTendonJoint_release_0(physx::PxArticulationTendonJoint* self) {
  self->release();
}

void* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationTendonJoint_get_userData_0(physx::PxArticulationTendonJoint* self) {
  return self->userData;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationTendonJoint_set_userData_1(physx::PxArticulationTendonJoint* self, void* arg0) {
  self->userData = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationTendonJoint___destroy___0(physx::PxArticulationTendonJoint* self) {
  delete self;
}

// Interface: PxArticulationTendonLimit


float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationTendonLimit_get_lowLimit_0(physx::PxArticulationTendonLimit* self) {
  return self->lowLimit;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationTendonLimit_set_lowLimit_1(physx::PxArticulationTendonLimit* self, float arg0) {
  self->lowLimit = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationTendonLimit_get_highLimit_0(physx::PxArticulationTendonLimit* self) {
  return self->highLimit;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationTendonLimit_set_highLimit_1(physx::PxArticulationTendonLimit* self, float arg0) {
  self->highLimit = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxArticulationTendonLimit___destroy___0(physx::PxArticulationTendonLimit* self) {
  delete self;
}

// Interface: PxBVH


void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBVH_release_0(physx::PxBVH* self) {
  self->release();
}

const char* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBVH_getConcreteTypeName_0(physx::PxBVH* self) {
  return self->getConcreteTypeName();
}

int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBVH_getConcreteType_0(physx::PxBVH* self) {
  return self->getConcreteType();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBVH_setBaseFlag_2(physx::PxBVH* self, PxBaseFlagEnum flag, bool value) {
  self->setBaseFlag(flag, value);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBVH_setBaseFlags_1(physx::PxBVH* self, physx::PxBaseFlags* inFlags) {
  self->setBaseFlags(*inFlags);
}

physx::PxBaseFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBVH_getBaseFlags_0(physx::PxBVH* self) {
  static thread_local physx::PxBaseFlags temp;
  return (temp = self->getBaseFlags(), &temp);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBVH_isReleasable_0(physx::PxBVH* self) {
  return self->isReleasable();
}

// Interface: PxBVH33MidphaseDesc


void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBVH33MidphaseDesc_setToDefault_0(physx::PxBVH33MidphaseDesc* self) {
  self->setToDefault();
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBVH33MidphaseDesc_isValid_0(physx::PxBVH33MidphaseDesc* self) {
  return self->isValid();
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBVH33MidphaseDesc_get_meshSizePerformanceTradeOff_0(physx::PxBVH33MidphaseDesc* self) {
  return self->meshSizePerformanceTradeOff;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBVH33MidphaseDesc_set_meshSizePerformanceTradeOff_1(physx::PxBVH33MidphaseDesc* self, float arg0) {
  self->meshSizePerformanceTradeOff = arg0;
}

PxMeshCookingHintEnum EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBVH33MidphaseDesc_get_meshCookingHint_0(physx::PxBVH33MidphaseDesc* self) {
  return self->meshCookingHint;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBVH33MidphaseDesc_set_meshCookingHint_1(physx::PxBVH33MidphaseDesc* self, PxMeshCookingHintEnum arg0) {
  self->meshCookingHint = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBVH33MidphaseDesc___destroy___0(physx::PxBVH33MidphaseDesc* self) {
  delete self;
}

// Interface: PxBVH34MidphaseDesc


void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBVH34MidphaseDesc_setToDefault_0(physx::PxBVH34MidphaseDesc* self) {
  self->setToDefault();
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBVH34MidphaseDesc_isValid_0(physx::PxBVH34MidphaseDesc* self) {
  return self->isValid();
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBVH34MidphaseDesc_get_numPrimsPerLeaf_0(physx::PxBVH34MidphaseDesc* self) {
  return self->numPrimsPerLeaf;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBVH34MidphaseDesc_set_numPrimsPerLeaf_1(physx::PxBVH34MidphaseDesc* self, unsigned int arg0) {
  self->numPrimsPerLeaf = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBVH34MidphaseDesc___destroy___0(physx::PxBVH34MidphaseDesc* self) {
  delete self;
}

// Interface: PxBaseFlags


physx::PxBaseFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBaseFlags_PxBaseFlags_1(unsigned short flags) {
  return new physx::PxBaseFlags(flags);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBaseFlags_isSet_1(physx::PxBaseFlags* self, PxBaseFlagEnum flag) {
  return self->isSet(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBaseFlags_raise_1(physx::PxBaseFlags* self, PxBaseFlagEnum flag) {
  self->raise(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBaseFlags_clear_1(physx::PxBaseFlags* self, PxBaseFlagEnum flag) {
  self->clear(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBaseFlags___destroy___0(physx::PxBaseFlags* self) {
  delete self;
}

// Interface: PxBaseTask


void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBaseTask___destroy___0(physx::PxBaseTask* self) {
  delete self;
}

// Interface: PxBoundedData


physx::PxBoundedData* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoundedData_PxBoundedData_0() {
  return new physx::PxBoundedData();
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoundedData_get_count_0(physx::PxBoundedData* self) {
  return self->count;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoundedData_set_count_1(physx::PxBoundedData* self, unsigned int arg0) {
  self->count = arg0;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoundedData_get_stride_0(physx::PxBoundedData* self) {
  return self->stride;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoundedData_set_stride_1(physx::PxBoundedData* self, unsigned int arg0) {
  self->stride = arg0;
}

const void* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoundedData_get_data_0(physx::PxBoundedData* self) {
  return self->data;
}

const void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoundedData_set_data_1(physx::PxBoundedData* self, void* arg0) {
  self->data = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoundedData___destroy___0(physx::PxBoundedData* self) {
  delete self;
}

// Interface: PxBounds3


physx::PxBounds3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBounds3_PxBounds3_0() {
  return new physx::PxBounds3();
}

physx::PxBounds3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBounds3_PxBounds3_2(const physx::PxVec3* minimum, const physx::PxVec3* maximum) {
  return new physx::PxBounds3(*minimum, *maximum);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBounds3_setEmpty_0(physx::PxBounds3* self) {
  self->setEmpty();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBounds3_setMaximal_0(physx::PxBounds3* self) {
  self->setMaximal();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBounds3_include_1(physx::PxBounds3* self, const physx::PxVec3* v) {
  self->include(*v);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBounds3_isEmpty_0(physx::PxBounds3* self) {
  return self->isEmpty();
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBounds3_intersects_1(physx::PxBounds3* self, const physx::PxBounds3* b) {
  return self->intersects(*b);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBounds3_intersects1D_2(physx::PxBounds3* self, const physx::PxBounds3* b, unsigned int axis) {
  return self->intersects1D(*b, axis);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBounds3_contains_1(physx::PxBounds3* self, const physx::PxVec3* v) {
  return self->contains(*v);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBounds3_isInside_1(physx::PxBounds3* self, const physx::PxBounds3* box) {
  return self->isInside(*box);
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBounds3_getCenter_0(physx::PxBounds3* self) {
  static thread_local physx::PxVec3 temp;
  return (temp = self->getCenter(), &temp);
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBounds3_getDimensions_0(physx::PxBounds3* self) {
  static thread_local physx::PxVec3 temp;
  return (temp = self->getDimensions(), &temp);
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBounds3_getExtents_0(physx::PxBounds3* self) {
  static thread_local physx::PxVec3 temp;
  return (temp = self->getExtents(), &temp);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBounds3_scaleSafe_1(physx::PxBounds3* self, float scale) {
  self->scaleSafe(scale);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBounds3_scaleFast_1(physx::PxBounds3* self, float scale) {
  self->scaleFast(scale);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBounds3_fattenSafe_1(physx::PxBounds3* self, float distance) {
  self->fattenSafe(distance);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBounds3_fattenFast_1(physx::PxBounds3* self, float distance) {
  self->fattenFast(distance);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBounds3_isFinite_0(physx::PxBounds3* self) {
  return self->isFinite();
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBounds3_isValid_0(physx::PxBounds3* self) {
  return self->isValid();
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBounds3_get_minimum_0(physx::PxBounds3* self) {
  return &self->minimum;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBounds3_set_minimum_1(physx::PxBounds3* self, physx::PxVec3* arg0) {
  self->minimum = *arg0;
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBounds3_get_maximum_0(physx::PxBounds3* self) {
  return &self->maximum;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBounds3_set_maximum_1(physx::PxBounds3* self, physx::PxVec3* arg0) {
  self->maximum = *arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBounds3___destroy___0(physx::PxBounds3* self) {
  delete self;
}

// Interface: PxBoxController


float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoxController_getHalfHeight_0(physx::PxBoxController* self) {
  return self->getHalfHeight();
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoxController_getHalfSideExtent_0(physx::PxBoxController* self) {
  return self->getHalfSideExtent();
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoxController_getHalfForwardExtent_0(physx::PxBoxController* self) {
  return self->getHalfForwardExtent();
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoxController_setHalfHeight_1(physx::PxBoxController* self, float halfHeight) {
  return self->setHalfHeight(halfHeight);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoxController_setHalfSideExtent_1(physx::PxBoxController* self, float halfSideExtent) {
  return self->setHalfSideExtent(halfSideExtent);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoxController_setHalfForwardExtent_1(physx::PxBoxController* self, float halfForwardExtent) {
  return self->setHalfForwardExtent(halfForwardExtent);
}

PxControllerShapeTypeEnum EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoxController_getType_0(physx::PxBoxController* self) {
  return self->getType();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoxController_release_0(physx::PxBoxController* self) {
  self->release();
}

physx::PxControllerCollisionFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoxController_move_4(physx::PxBoxController* self, const physx::PxVec3* disp, float minDist, float elapsedTime, const physx::PxControllerFilters* filters) {
  static thread_local physx::PxControllerCollisionFlags temp;
  return (temp = self->move(*disp, minDist, elapsedTime, *filters), &temp);
}

physx::PxControllerCollisionFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoxController_move_5(physx::PxBoxController* self, const physx::PxVec3* disp, float minDist, float elapsedTime, const physx::PxControllerFilters* filters, const physx::PxObstacleContext* obstacles) {
  static thread_local physx::PxControllerCollisionFlags temp;
  return (temp = self->move(*disp, minDist, elapsedTime, *filters, obstacles), &temp);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoxController_setPosition_1(physx::PxBoxController* self, const physx::PxExtendedVec3* position) {
  return self->setPosition(*position);
}

const physx::PxExtendedVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoxController_getPosition_0(physx::PxBoxController* self) {
  return &self->getPosition();
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoxController_setFootPosition_1(physx::PxBoxController* self, const physx::PxExtendedVec3* position) {
  return self->setFootPosition(*position);
}

physx::PxExtendedVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoxController_getFootPosition_0(physx::PxBoxController* self) {
  static thread_local physx::PxExtendedVec3 temp;
  return (temp = self->getFootPosition(), &temp);
}

physx::PxRigidDynamic* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoxController_getActor_0(physx::PxBoxController* self) {
  return self->getActor();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoxController_setStepOffset_1(physx::PxBoxController* self, float offset) {
  self->setStepOffset(offset);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoxController_getStepOffset_0(physx::PxBoxController* self) {
  return self->getStepOffset();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoxController_setNonWalkableMode_1(physx::PxBoxController* self, PxControllerNonWalkableModeEnum flag) {
  self->setNonWalkableMode(flag);
}

PxControllerNonWalkableModeEnum EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoxController_getNonWalkableMode_0(physx::PxBoxController* self) {
  return self->getNonWalkableMode();
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoxController_getContactOffset_0(physx::PxBoxController* self) {
  return self->getContactOffset();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoxController_setContactOffset_1(physx::PxBoxController* self, float offset) {
  self->setContactOffset(offset);
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoxController_getUpDirection_0(physx::PxBoxController* self) {
  static thread_local physx::PxVec3 temp;
  return (temp = self->getUpDirection(), &temp);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoxController_setUpDirection_1(physx::PxBoxController* self, const physx::PxVec3* up) {
  self->setUpDirection(*up);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoxController_getSlopeLimit_0(physx::PxBoxController* self) {
  return self->getSlopeLimit();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoxController_setSlopeLimit_1(physx::PxBoxController* self, float slopeLimit) {
  self->setSlopeLimit(slopeLimit);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoxController_invalidateCache_0(physx::PxBoxController* self) {
  self->invalidateCache();
}

physx::PxScene* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoxController_getScene_0(physx::PxBoxController* self) {
  return self->getScene();
}

void* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoxController_getUserData_0(physx::PxBoxController* self) {
  return self->getUserData();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoxController_setUserData_1(physx::PxBoxController* self, void* userData) {
  self->setUserData(userData);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoxController_getState_1(physx::PxBoxController* self, physx::PxControllerState* state) {
  self->getState(*state);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoxController_getStats_1(physx::PxBoxController* self, physx::PxControllerStats* stats) {
  self->getStats(*stats);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoxController_resize_1(physx::PxBoxController* self, float height) {
  self->resize(height);
}

// Interface: PxBoxControllerDesc


physx::PxBoxControllerDesc* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoxControllerDesc_PxBoxControllerDesc_0() {
  return new physx::PxBoxControllerDesc();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoxControllerDesc_setToDefault_0(physx::PxBoxControllerDesc* self) {
  self->setToDefault();
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoxControllerDesc_isValid_0(physx::PxBoxControllerDesc* self) {
  return self->isValid();
}

PxControllerShapeTypeEnum EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoxControllerDesc_getType_0(physx::PxBoxControllerDesc* self) {
  return self->getType();
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoxControllerDesc_get_halfHeight_0(physx::PxBoxControllerDesc* self) {
  return self->halfHeight;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoxControllerDesc_set_halfHeight_1(physx::PxBoxControllerDesc* self, float arg0) {
  self->halfHeight = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoxControllerDesc_get_halfSideExtent_0(physx::PxBoxControllerDesc* self) {
  return self->halfSideExtent;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoxControllerDesc_set_halfSideExtent_1(physx::PxBoxControllerDesc* self, float arg0) {
  self->halfSideExtent = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoxControllerDesc_get_halfForwardExtent_0(physx::PxBoxControllerDesc* self) {
  return self->halfForwardExtent;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoxControllerDesc_set_halfForwardExtent_1(physx::PxBoxControllerDesc* self, float arg0) {
  self->halfForwardExtent = arg0;
}

physx::PxExtendedVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoxControllerDesc_get_position_0(physx::PxBoxControllerDesc* self) {
  return &self->position;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoxControllerDesc_set_position_1(physx::PxBoxControllerDesc* self, physx::PxExtendedVec3* arg0) {
  self->position = *arg0;
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoxControllerDesc_get_upDirection_0(physx::PxBoxControllerDesc* self) {
  return &self->upDirection;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoxControllerDesc_set_upDirection_1(physx::PxBoxControllerDesc* self, physx::PxVec3* arg0) {
  self->upDirection = *arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoxControllerDesc_get_slopeLimit_0(physx::PxBoxControllerDesc* self) {
  return self->slopeLimit;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoxControllerDesc_set_slopeLimit_1(physx::PxBoxControllerDesc* self, float arg0) {
  self->slopeLimit = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoxControllerDesc_get_invisibleWallHeight_0(physx::PxBoxControllerDesc* self) {
  return self->invisibleWallHeight;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoxControllerDesc_set_invisibleWallHeight_1(physx::PxBoxControllerDesc* self, float arg0) {
  self->invisibleWallHeight = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoxControllerDesc_get_maxJumpHeight_0(physx::PxBoxControllerDesc* self) {
  return self->maxJumpHeight;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoxControllerDesc_set_maxJumpHeight_1(physx::PxBoxControllerDesc* self, float arg0) {
  self->maxJumpHeight = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoxControllerDesc_get_contactOffset_0(physx::PxBoxControllerDesc* self) {
  return self->contactOffset;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoxControllerDesc_set_contactOffset_1(physx::PxBoxControllerDesc* self, float arg0) {
  self->contactOffset = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoxControllerDesc_get_stepOffset_0(physx::PxBoxControllerDesc* self) {
  return self->stepOffset;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoxControllerDesc_set_stepOffset_1(physx::PxBoxControllerDesc* self, float arg0) {
  self->stepOffset = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoxControllerDesc_get_density_0(physx::PxBoxControllerDesc* self) {
  return self->density;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoxControllerDesc_set_density_1(physx::PxBoxControllerDesc* self, float arg0) {
  self->density = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoxControllerDesc_get_scaleCoeff_0(physx::PxBoxControllerDesc* self) {
  return self->scaleCoeff;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoxControllerDesc_set_scaleCoeff_1(physx::PxBoxControllerDesc* self, float arg0) {
  self->scaleCoeff = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoxControllerDesc_get_volumeGrowth_0(physx::PxBoxControllerDesc* self) {
  return self->volumeGrowth;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoxControllerDesc_set_volumeGrowth_1(physx::PxBoxControllerDesc* self, float arg0) {
  self->volumeGrowth = arg0;
}

physx::PxUserControllerHitReport* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoxControllerDesc_get_reportCallback_0(physx::PxBoxControllerDesc* self) {
  return self->reportCallback;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoxControllerDesc_set_reportCallback_1(physx::PxBoxControllerDesc* self, physx::PxUserControllerHitReport* arg0) {
  self->reportCallback = arg0;
}

physx::PxControllerBehaviorCallback* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoxControllerDesc_get_behaviorCallback_0(physx::PxBoxControllerDesc* self) {
  return self->behaviorCallback;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoxControllerDesc_set_behaviorCallback_1(physx::PxBoxControllerDesc* self, physx::PxControllerBehaviorCallback* arg0) {
  self->behaviorCallback = arg0;
}

PxControllerNonWalkableModeEnum EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoxControllerDesc_get_nonWalkableMode_0(physx::PxBoxControllerDesc* self) {
  return self->nonWalkableMode;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoxControllerDesc_set_nonWalkableMode_1(physx::PxBoxControllerDesc* self, PxControllerNonWalkableModeEnum arg0) {
  self->nonWalkableMode = arg0;
}

physx::PxMaterial* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoxControllerDesc_get_material_0(physx::PxBoxControllerDesc* self) {
  return self->material;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoxControllerDesc_set_material_1(physx::PxBoxControllerDesc* self, physx::PxMaterial* arg0) {
  self->material = arg0;
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoxControllerDesc_get_registerDeletionListener_0(physx::PxBoxControllerDesc* self) {
  return self->registerDeletionListener;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoxControllerDesc_set_registerDeletionListener_1(physx::PxBoxControllerDesc* self, bool arg0) {
  self->registerDeletionListener = arg0;
}

void* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoxControllerDesc_get_userData_0(physx::PxBoxControllerDesc* self) {
  return self->userData;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoxControllerDesc_set_userData_1(physx::PxBoxControllerDesc* self, void* arg0) {
  self->userData = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoxControllerDesc___destroy___0(physx::PxBoxControllerDesc* self) {
  delete self;
}

// Interface: PxBoxGeometry


physx::PxBoxGeometry* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoxGeometry_PxBoxGeometry_3(float hx, float hy, float hz) {
  return new physx::PxBoxGeometry(hx, hy, hz);
}

PxGeometryTypeEnum EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoxGeometry_getType_0(physx::PxBoxGeometry* self) {
  return self->getType();
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoxGeometry_get_halfExtents_0(physx::PxBoxGeometry* self) {
  return &self->halfExtents;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoxGeometry_set_halfExtents_1(physx::PxBoxGeometry* self, physx::PxVec3* arg0) {
  self->halfExtents = *arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoxGeometry___destroy___0(physx::PxBoxGeometry* self) {
  delete self;
}

// Interface: PxBoxObstacle


physx::PxBoxObstacle* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoxObstacle_PxBoxObstacle_0() {
  return new physx::PxBoxObstacle();
}

PxGeometryTypeEnum EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoxObstacle_getType_0(physx::PxBoxObstacle* self) {
  return self->getType();
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoxObstacle_get_mHalfExtents_0(physx::PxBoxObstacle* self) {
  return &self->mHalfExtents;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoxObstacle_set_mHalfExtents_1(physx::PxBoxObstacle* self, physx::PxVec3* arg0) {
  self->mHalfExtents = *arg0;
}

void* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoxObstacle_get_mUserData_0(physx::PxBoxObstacle* self) {
  return self->mUserData;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoxObstacle_set_mUserData_1(physx::PxBoxObstacle* self, void* arg0) {
  self->mUserData = arg0;
}

physx::PxExtendedVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoxObstacle_get_mPos_0(physx::PxBoxObstacle* self) {
  return &self->mPos;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoxObstacle_set_mPos_1(physx::PxBoxObstacle* self, physx::PxExtendedVec3* arg0) {
  self->mPos = *arg0;
}

physx::PxQuat* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoxObstacle_get_mRot_0(physx::PxBoxObstacle* self) {
  return &self->mRot;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoxObstacle_set_mRot_1(physx::PxBoxObstacle* self, physx::PxQuat* arg0) {
  self->mRot = *arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBoxObstacle___destroy___0(physx::PxBoxObstacle* self) {
  delete self;
}

// Interface: PxBroadPhaseCaps


physx::PxBroadPhaseCaps* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBroadPhaseCaps_PxBroadPhaseCaps_0() {
  return new physx::PxBroadPhaseCaps();
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBroadPhaseCaps_get_mMaxNbRegions_0(physx::PxBroadPhaseCaps* self) {
  return self->mMaxNbRegions;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBroadPhaseCaps_set_mMaxNbRegions_1(physx::PxBroadPhaseCaps* self, unsigned int arg0) {
  self->mMaxNbRegions = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBroadPhaseCaps___destroy___0(physx::PxBroadPhaseCaps* self) {
  delete self;
}

// Interface: PxBroadPhaseRegion


physx::PxBroadPhaseRegion* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBroadPhaseRegion_PxBroadPhaseRegion_0() {
  return new physx::PxBroadPhaseRegion();
}

physx::PxBounds3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBroadPhaseRegion_get_mBounds_0(physx::PxBroadPhaseRegion* self) {
  return &self->mBounds;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBroadPhaseRegion_set_mBounds_1(physx::PxBroadPhaseRegion* self, physx::PxBounds3* arg0) {
  self->mBounds = *arg0;
}

void* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBroadPhaseRegion_get_mUserData_0(physx::PxBroadPhaseRegion* self) {
  return self->mUserData;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBroadPhaseRegion_set_mUserData_1(physx::PxBroadPhaseRegion* self, void* arg0) {
  self->mUserData = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBroadPhaseRegion___destroy___0(physx::PxBroadPhaseRegion* self) {
  delete self;
}

// Interface: PxBroadPhaseRegionInfo


physx::PxBroadPhaseRegionInfo* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBroadPhaseRegionInfo_PxBroadPhaseRegionInfo_0() {
  return new physx::PxBroadPhaseRegionInfo();
}

physx::PxBroadPhaseRegion* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBroadPhaseRegionInfo_get_mRegion_0(physx::PxBroadPhaseRegionInfo* self) {
  return &self->mRegion;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBroadPhaseRegionInfo_set_mRegion_1(physx::PxBroadPhaseRegionInfo* self, physx::PxBroadPhaseRegion* arg0) {
  self->mRegion = *arg0;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBroadPhaseRegionInfo_get_mNbStaticObjects_0(physx::PxBroadPhaseRegionInfo* self) {
  return self->mNbStaticObjects;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBroadPhaseRegionInfo_set_mNbStaticObjects_1(physx::PxBroadPhaseRegionInfo* self, unsigned int arg0) {
  self->mNbStaticObjects = arg0;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBroadPhaseRegionInfo_get_mNbDynamicObjects_0(physx::PxBroadPhaseRegionInfo* self) {
  return self->mNbDynamicObjects;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBroadPhaseRegionInfo_set_mNbDynamicObjects_1(physx::PxBroadPhaseRegionInfo* self, unsigned int arg0) {
  self->mNbDynamicObjects = arg0;
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBroadPhaseRegionInfo_get_mActive_0(physx::PxBroadPhaseRegionInfo* self) {
  return self->mActive;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBroadPhaseRegionInfo_set_mActive_1(physx::PxBroadPhaseRegionInfo* self, bool arg0) {
  self->mActive = arg0;
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBroadPhaseRegionInfo_get_mOverlap_0(physx::PxBroadPhaseRegionInfo* self) {
  return self->mOverlap;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBroadPhaseRegionInfo_set_mOverlap_1(physx::PxBroadPhaseRegionInfo* self, bool arg0) {
  self->mOverlap = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxBroadPhaseRegionInfo___destroy___0(physx::PxBroadPhaseRegionInfo* self) {
  delete self;
}

// Interface: PxCapsuleController


float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleController_getRadius_0(physx::PxCapsuleController* self) {
  return self->getRadius();
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleController_setRadius_1(physx::PxCapsuleController* self, float radius) {
  return self->setRadius(radius);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleController_getHeight_0(physx::PxCapsuleController* self) {
  return self->getHeight();
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleController_setHeight_1(physx::PxCapsuleController* self, float height) {
  return self->setHeight(height);
}

PxCapsuleClimbingModeEnum EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleController_getClimbingMode_0(physx::PxCapsuleController* self) {
  return self->getClimbingMode();
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleController_setClimbingMode_1(physx::PxCapsuleController* self, PxCapsuleClimbingModeEnum mode) {
  return self->setClimbingMode(mode);
}

PxControllerShapeTypeEnum EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleController_getType_0(physx::PxCapsuleController* self) {
  return self->getType();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleController_release_0(physx::PxCapsuleController* self) {
  self->release();
}

physx::PxControllerCollisionFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleController_move_4(physx::PxCapsuleController* self, const physx::PxVec3* disp, float minDist, float elapsedTime, const physx::PxControllerFilters* filters) {
  static thread_local physx::PxControllerCollisionFlags temp;
  return (temp = self->move(*disp, minDist, elapsedTime, *filters), &temp);
}

physx::PxControllerCollisionFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleController_move_5(physx::PxCapsuleController* self, const physx::PxVec3* disp, float minDist, float elapsedTime, const physx::PxControllerFilters* filters, const physx::PxObstacleContext* obstacles) {
  static thread_local physx::PxControllerCollisionFlags temp;
  return (temp = self->move(*disp, minDist, elapsedTime, *filters, obstacles), &temp);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleController_setPosition_1(physx::PxCapsuleController* self, const physx::PxExtendedVec3* position) {
  return self->setPosition(*position);
}

const physx::PxExtendedVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleController_getPosition_0(physx::PxCapsuleController* self) {
  return &self->getPosition();
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleController_setFootPosition_1(physx::PxCapsuleController* self, const physx::PxExtendedVec3* position) {
  return self->setFootPosition(*position);
}

physx::PxExtendedVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleController_getFootPosition_0(physx::PxCapsuleController* self) {
  static thread_local physx::PxExtendedVec3 temp;
  return (temp = self->getFootPosition(), &temp);
}

physx::PxRigidDynamic* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleController_getActor_0(physx::PxCapsuleController* self) {
  return self->getActor();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleController_setStepOffset_1(physx::PxCapsuleController* self, float offset) {
  self->setStepOffset(offset);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleController_getStepOffset_0(physx::PxCapsuleController* self) {
  return self->getStepOffset();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleController_setNonWalkableMode_1(physx::PxCapsuleController* self, PxControllerNonWalkableModeEnum flag) {
  self->setNonWalkableMode(flag);
}

PxControllerNonWalkableModeEnum EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleController_getNonWalkableMode_0(physx::PxCapsuleController* self) {
  return self->getNonWalkableMode();
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleController_getContactOffset_0(physx::PxCapsuleController* self) {
  return self->getContactOffset();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleController_setContactOffset_1(physx::PxCapsuleController* self, float offset) {
  self->setContactOffset(offset);
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleController_getUpDirection_0(physx::PxCapsuleController* self) {
  static thread_local physx::PxVec3 temp;
  return (temp = self->getUpDirection(), &temp);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleController_setUpDirection_1(physx::PxCapsuleController* self, const physx::PxVec3* up) {
  self->setUpDirection(*up);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleController_getSlopeLimit_0(physx::PxCapsuleController* self) {
  return self->getSlopeLimit();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleController_setSlopeLimit_1(physx::PxCapsuleController* self, float slopeLimit) {
  self->setSlopeLimit(slopeLimit);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleController_invalidateCache_0(physx::PxCapsuleController* self) {
  self->invalidateCache();
}

physx::PxScene* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleController_getScene_0(physx::PxCapsuleController* self) {
  return self->getScene();
}

void* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleController_getUserData_0(physx::PxCapsuleController* self) {
  return self->getUserData();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleController_setUserData_1(physx::PxCapsuleController* self, void* userData) {
  self->setUserData(userData);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleController_getState_1(physx::PxCapsuleController* self, physx::PxControllerState* state) {
  self->getState(*state);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleController_getStats_1(physx::PxCapsuleController* self, physx::PxControllerStats* stats) {
  self->getStats(*stats);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleController_resize_1(physx::PxCapsuleController* self, float height) {
  self->resize(height);
}

// Interface: PxCapsuleControllerDesc


physx::PxCapsuleControllerDesc* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleControllerDesc_PxCapsuleControllerDesc_0() {
  return new physx::PxCapsuleControllerDesc();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleControllerDesc_setToDefault_0(physx::PxCapsuleControllerDesc* self) {
  self->setToDefault();
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleControllerDesc_isValid_0(physx::PxCapsuleControllerDesc* self) {
  return self->isValid();
}

PxControllerShapeTypeEnum EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleControllerDesc_getType_0(physx::PxCapsuleControllerDesc* self) {
  return self->getType();
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleControllerDesc_get_radius_0(physx::PxCapsuleControllerDesc* self) {
  return self->radius;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleControllerDesc_set_radius_1(physx::PxCapsuleControllerDesc* self, float arg0) {
  self->radius = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleControllerDesc_get_height_0(physx::PxCapsuleControllerDesc* self) {
  return self->height;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleControllerDesc_set_height_1(physx::PxCapsuleControllerDesc* self, float arg0) {
  self->height = arg0;
}

PxCapsuleClimbingModeEnum EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleControllerDesc_get_climbingMode_0(physx::PxCapsuleControllerDesc* self) {
  return self->climbingMode;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleControllerDesc_set_climbingMode_1(physx::PxCapsuleControllerDesc* self, PxCapsuleClimbingModeEnum arg0) {
  self->climbingMode = arg0;
}

physx::PxExtendedVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleControllerDesc_get_position_0(physx::PxCapsuleControllerDesc* self) {
  return &self->position;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleControllerDesc_set_position_1(physx::PxCapsuleControllerDesc* self, physx::PxExtendedVec3* arg0) {
  self->position = *arg0;
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleControllerDesc_get_upDirection_0(physx::PxCapsuleControllerDesc* self) {
  return &self->upDirection;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleControllerDesc_set_upDirection_1(physx::PxCapsuleControllerDesc* self, physx::PxVec3* arg0) {
  self->upDirection = *arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleControllerDesc_get_slopeLimit_0(physx::PxCapsuleControllerDesc* self) {
  return self->slopeLimit;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleControllerDesc_set_slopeLimit_1(physx::PxCapsuleControllerDesc* self, float arg0) {
  self->slopeLimit = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleControllerDesc_get_invisibleWallHeight_0(physx::PxCapsuleControllerDesc* self) {
  return self->invisibleWallHeight;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleControllerDesc_set_invisibleWallHeight_1(physx::PxCapsuleControllerDesc* self, float arg0) {
  self->invisibleWallHeight = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleControllerDesc_get_maxJumpHeight_0(physx::PxCapsuleControllerDesc* self) {
  return self->maxJumpHeight;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleControllerDesc_set_maxJumpHeight_1(physx::PxCapsuleControllerDesc* self, float arg0) {
  self->maxJumpHeight = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleControllerDesc_get_contactOffset_0(physx::PxCapsuleControllerDesc* self) {
  return self->contactOffset;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleControllerDesc_set_contactOffset_1(physx::PxCapsuleControllerDesc* self, float arg0) {
  self->contactOffset = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleControllerDesc_get_stepOffset_0(physx::PxCapsuleControllerDesc* self) {
  return self->stepOffset;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleControllerDesc_set_stepOffset_1(physx::PxCapsuleControllerDesc* self, float arg0) {
  self->stepOffset = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleControllerDesc_get_density_0(physx::PxCapsuleControllerDesc* self) {
  return self->density;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleControllerDesc_set_density_1(physx::PxCapsuleControllerDesc* self, float arg0) {
  self->density = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleControllerDesc_get_scaleCoeff_0(physx::PxCapsuleControllerDesc* self) {
  return self->scaleCoeff;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleControllerDesc_set_scaleCoeff_1(physx::PxCapsuleControllerDesc* self, float arg0) {
  self->scaleCoeff = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleControllerDesc_get_volumeGrowth_0(physx::PxCapsuleControllerDesc* self) {
  return self->volumeGrowth;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleControllerDesc_set_volumeGrowth_1(physx::PxCapsuleControllerDesc* self, float arg0) {
  self->volumeGrowth = arg0;
}

physx::PxUserControllerHitReport* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleControllerDesc_get_reportCallback_0(physx::PxCapsuleControllerDesc* self) {
  return self->reportCallback;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleControllerDesc_set_reportCallback_1(physx::PxCapsuleControllerDesc* self, physx::PxUserControllerHitReport* arg0) {
  self->reportCallback = arg0;
}

physx::PxControllerBehaviorCallback* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleControllerDesc_get_behaviorCallback_0(physx::PxCapsuleControllerDesc* self) {
  return self->behaviorCallback;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleControllerDesc_set_behaviorCallback_1(physx::PxCapsuleControllerDesc* self, physx::PxControllerBehaviorCallback* arg0) {
  self->behaviorCallback = arg0;
}

PxControllerNonWalkableModeEnum EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleControllerDesc_get_nonWalkableMode_0(physx::PxCapsuleControllerDesc* self) {
  return self->nonWalkableMode;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleControllerDesc_set_nonWalkableMode_1(physx::PxCapsuleControllerDesc* self, PxControllerNonWalkableModeEnum arg0) {
  self->nonWalkableMode = arg0;
}

physx::PxMaterial* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleControllerDesc_get_material_0(physx::PxCapsuleControllerDesc* self) {
  return self->material;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleControllerDesc_set_material_1(physx::PxCapsuleControllerDesc* self, physx::PxMaterial* arg0) {
  self->material = arg0;
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleControllerDesc_get_registerDeletionListener_0(physx::PxCapsuleControllerDesc* self) {
  return self->registerDeletionListener;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleControllerDesc_set_registerDeletionListener_1(physx::PxCapsuleControllerDesc* self, bool arg0) {
  self->registerDeletionListener = arg0;
}

void* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleControllerDesc_get_userData_0(physx::PxCapsuleControllerDesc* self) {
  return self->userData;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleControllerDesc_set_userData_1(physx::PxCapsuleControllerDesc* self, void* arg0) {
  self->userData = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleControllerDesc___destroy___0(physx::PxCapsuleControllerDesc* self) {
  delete self;
}

// Interface: PxCapsuleGeometry


physx::PxCapsuleGeometry* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleGeometry_PxCapsuleGeometry_2(float radius, float halfHeight) {
  return new physx::PxCapsuleGeometry(radius, halfHeight);
}

PxGeometryTypeEnum EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleGeometry_getType_0(physx::PxCapsuleGeometry* self) {
  return self->getType();
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleGeometry_get_radius_0(physx::PxCapsuleGeometry* self) {
  return self->radius;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleGeometry_set_radius_1(physx::PxCapsuleGeometry* self, float arg0) {
  self->radius = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleGeometry_get_halfHeight_0(physx::PxCapsuleGeometry* self) {
  return self->halfHeight;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleGeometry_set_halfHeight_1(physx::PxCapsuleGeometry* self, float arg0) {
  self->halfHeight = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleGeometry___destroy___0(physx::PxCapsuleGeometry* self) {
  delete self;
}

// Interface: PxCapsuleObstacle


physx::PxCapsuleObstacle* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleObstacle_PxCapsuleObstacle_0() {
  return new physx::PxCapsuleObstacle();
}

PxGeometryTypeEnum EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleObstacle_getType_0(physx::PxCapsuleObstacle* self) {
  return self->getType();
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleObstacle_get_mHalfHeight_0(physx::PxCapsuleObstacle* self) {
  return self->mHalfHeight;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleObstacle_set_mHalfHeight_1(physx::PxCapsuleObstacle* self, float arg0) {
  self->mHalfHeight = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleObstacle_get_mRadius_0(physx::PxCapsuleObstacle* self) {
  return self->mRadius;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleObstacle_set_mRadius_1(physx::PxCapsuleObstacle* self, float arg0) {
  self->mRadius = arg0;
}

void* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleObstacle_get_mUserData_0(physx::PxCapsuleObstacle* self) {
  return self->mUserData;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleObstacle_set_mUserData_1(physx::PxCapsuleObstacle* self, void* arg0) {
  self->mUserData = arg0;
}

physx::PxExtendedVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleObstacle_get_mPos_0(physx::PxCapsuleObstacle* self) {
  return &self->mPos;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleObstacle_set_mPos_1(physx::PxCapsuleObstacle* self, physx::PxExtendedVec3* arg0) {
  self->mPos = *arg0;
}

physx::PxQuat* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleObstacle_get_mRot_0(physx::PxCapsuleObstacle* self) {
  return &self->mRot;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleObstacle_set_mRot_1(physx::PxCapsuleObstacle* self, physx::PxQuat* arg0) {
  self->mRot = *arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCapsuleObstacle___destroy___0(physx::PxCapsuleObstacle* self) {
  delete self;
}

// Interface: PxCollection


void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCollection_add_1(physx::PxCollection* self, physx::PxBase* obj) {
  self->add(*obj);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCollection_add_2(physx::PxCollection* self, physx::PxBase* obj, unsigned long long id) {
  self->add(*obj, id);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCollection_remove_1(physx::PxCollection* self, physx::PxBase* obj) {
  self->remove(*obj);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCollection_contains_1(physx::PxCollection* self, physx::PxBase* obj) {
  return self->contains(*obj);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCollection_addId_2(physx::PxCollection* self, physx::PxBase* obj, unsigned long long id) {
  self->addId(*obj, id);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCollection_removeId_1(physx::PxCollection* self, unsigned long long id) {
  self->removeId(id);
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCollection_getNbObjects_0(physx::PxCollection* self) {
  return self->getNbObjects();
}

physx::PxBase* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCollection_getObject_1(physx::PxCollection* self, unsigned int index) {
  return &self->getObject(index);
}

physx::PxBase* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCollection_find_1(physx::PxCollection* self, unsigned long long id) {
  return self->find(id);
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCollection_getNbIds_0(physx::PxCollection* self) {
  return self->getNbIds();
}

unsigned long long EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCollection_getId_1(physx::PxCollection* self, const physx::PxBase* obj) {
  return self->getId(*obj);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCollection_release_0(physx::PxCollection* self) {
  self->release();
}

// Interface: PxCollectionExt


void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCollectionExt_releaseObjects_1(physx::PxCollection* collection) {
  physx::PxCollectionExt::releaseObjects(*collection);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCollectionExt_releaseObjects_2(physx::PxCollection* collection, bool releaseExclusiveShapes) {
  physx::PxCollectionExt::releaseObjects(*collection, releaseExclusiveShapes);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCollectionExt_remove_2(physx::PxCollection* collection, unsigned short concreteType) {
  physx::PxCollectionExt::remove(*collection, concreteType);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCollectionExt_remove_3(physx::PxCollection* collection, unsigned short concreteType, physx::PxCollection* to) {
  physx::PxCollectionExt::remove(*collection, concreteType, to);
}

physx::PxCollection* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCollectionExt_createCollection_1(physx::PxScene* scene) {
  return physx::PxCollectionExt::createCollection(*scene);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCollectionExt___destroy___0(physx::PxCollectionExt* self) {
  delete self;
}

// Interface: PxConstraint


physx::PxScene* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxConstraint_getScene_0(physx::PxConstraint* self) {
  return self->getScene();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxConstraint_setActors_2(physx::PxConstraint* self, physx::PxRigidActor* actor0, physx::PxRigidActor* actor1) {
  self->setActors(actor0, actor1);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxConstraint_markDirty_0(physx::PxConstraint* self) {
  self->markDirty();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxConstraint_setFlags_1(physx::PxConstraint* self, physx::PxConstraintFlags* flags) {
  self->setFlags(*flags);
}

physx::PxConstraintFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxConstraint_getFlags_0(physx::PxConstraint* self) {
  static thread_local physx::PxConstraintFlags temp;
  return (temp = self->getFlags(), &temp);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxConstraint_setFlag_2(physx::PxConstraint* self, PxConstraintFlagEnum flag, bool value) {
  self->setFlag(flag, value);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxConstraint_getForce_2(physx::PxConstraint* self, physx::PxVec3* linear, physx::PxVec3* angular) {
  self->getForce(*linear, *angular);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxConstraint_isValid_0(physx::PxConstraint* self) {
  return self->isValid();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxConstraint_setBreakForce_2(physx::PxConstraint* self, float linear, float angular) {
  self->setBreakForce(linear, angular);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxConstraint_setMinResponseThreshold_1(physx::PxConstraint* self, float threshold) {
  self->setMinResponseThreshold(threshold);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxConstraint_getMinResponseThreshold_0(physx::PxConstraint* self) {
  return self->getMinResponseThreshold();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxConstraint_release_0(physx::PxConstraint* self) {
  self->release();
}

const char* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxConstraint_getConcreteTypeName_0(physx::PxConstraint* self) {
  return self->getConcreteTypeName();
}

int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxConstraint_getConcreteType_0(physx::PxConstraint* self) {
  return self->getConcreteType();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxConstraint_setBaseFlag_2(physx::PxConstraint* self, PxBaseFlagEnum flag, bool value) {
  self->setBaseFlag(flag, value);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxConstraint_setBaseFlags_1(physx::PxConstraint* self, physx::PxBaseFlags* inFlags) {
  self->setBaseFlags(*inFlags);
}

physx::PxBaseFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxConstraint_getBaseFlags_0(physx::PxConstraint* self) {
  static thread_local physx::PxBaseFlags temp;
  return (temp = self->getBaseFlags(), &temp);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxConstraint_isReleasable_0(physx::PxConstraint* self) {
  return self->isReleasable();
}

// Interface: PxConstraintFlags


physx::PxConstraintFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxConstraintFlags_PxConstraintFlags_1(unsigned short flags) {
  return new physx::PxConstraintFlags(flags);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxConstraintFlags_isSet_1(physx::PxConstraintFlags* self, PxConstraintFlagEnum flag) {
  return self->isSet(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxConstraintFlags_raise_1(physx::PxConstraintFlags* self, PxConstraintFlagEnum flag) {
  self->raise(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxConstraintFlags_clear_1(physx::PxConstraintFlags* self, PxConstraintFlagEnum flag) {
  self->clear(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxConstraintFlags___destroy___0(physx::PxConstraintFlags* self) {
  delete self;
}

// Interface: PxConstraintInfo


physx::PxConstraint* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxConstraintInfo_get_constraint_0(physx::PxConstraintInfo* self) {
  return self->constraint;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxConstraintInfo_set_constraint_1(physx::PxConstraintInfo* self, physx::PxConstraint* arg0) {
  self->constraint = arg0;
}

void* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxConstraintInfo_get_externalReference_0(physx::PxConstraintInfo* self) {
  return self->externalReference;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxConstraintInfo_set_externalReference_1(physx::PxConstraintInfo* self, void* arg0) {
  self->externalReference = arg0;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxConstraintInfo_get_type_0(physx::PxConstraintInfo* self) {
  return self->type;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxConstraintInfo_set_type_1(physx::PxConstraintInfo* self, unsigned int arg0) {
  self->type = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxConstraintInfo___destroy___0(physx::PxConstraintInfo* self) {
  delete self;
}

// Interface: PxConstraintSolverPrep


void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxConstraintSolverPrep___destroy___0(physx::PxConstraintSolverPrep* self) {
  delete self;
}

// Interface: PxContactBuffer


void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxContactBuffer_reset_0(physx::PxContactBuffer* self) {
  self->reset();
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxContactBuffer_contact_1(physx::PxContactBuffer* self, const physx::PxContactPoint* worldPoint) {
  return self->contact(*worldPoint);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxContactBuffer_contact_3(physx::PxContactBuffer* self, const physx::PxVec3* worldPoint, const physx::PxVec3* worldNormalIn, float separation) {
  return self->contact(*worldPoint, *worldNormalIn, separation);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxContactBuffer_contact_4(physx::PxContactBuffer* self, const physx::PxVec3* worldPoint, const physx::PxVec3* worldNormalIn, float separation, unsigned int faceIndex1) {
  return self->contact(*worldPoint, *worldNormalIn, separation, faceIndex1);
}

physx::PxContactPoint* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxContactBuffer_get_contacts_1(physx::PxContactBuffer* self, int arg0) {
  return &self->contacts[arg0];
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxContactBuffer_set_contacts_2(physx::PxContactBuffer* self, int arg0, physx::PxContactPoint* arg1) {
  self->contacts[arg0] = *arg1;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxContactBuffer_get_count_0(physx::PxContactBuffer* self) {
  return self->count;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxContactBuffer_set_count_1(physx::PxContactBuffer* self, unsigned int arg0) {
  self->count = arg0;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxContactBuffer_get_pad_0(physx::PxContactBuffer* self) {
  return self->pad;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxContactBuffer_set_pad_1(physx::PxContactBuffer* self, unsigned int arg0) {
  self->pad = arg0;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxContactBuffer_get_MAX_CONTACTS_0(physx::PxContactBuffer* self) {
  return self->MAX_CONTACTS;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxContactBuffer___destroy___0(physx::PxContactBuffer* self) {
  delete self;
}

// Interface: PxContactPair


unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxContactPair_extractContacts_2(physx::PxContactPair* self, physx::PxContactPairPoint* userBuffer, unsigned int bufferSize) {
  return self->extractContacts(userBuffer, bufferSize);
}

physx::PxShape* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxContactPair_get_shapes_1(physx::PxContactPair* self, int arg0) {
  return self->shapes[arg0];
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxContactPair_set_shapes_2(physx::PxContactPair* self, int arg0, physx::PxShape* arg1) {
  self->shapes[arg0] = arg1;
}

unsigned char EMSCRIPTEN_KEEPALIVE emscripten_bind_PxContactPair_get_contactCount_0(physx::PxContactPair* self) {
  return self->contactCount;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxContactPair_set_contactCount_1(physx::PxContactPair* self, unsigned char arg0) {
  self->contactCount = arg0;
}

unsigned char EMSCRIPTEN_KEEPALIVE emscripten_bind_PxContactPair_get_patchCount_0(physx::PxContactPair* self) {
  return self->patchCount;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxContactPair_set_patchCount_1(physx::PxContactPair* self, unsigned char arg0) {
  self->patchCount = arg0;
}

physx::PxContactPairFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxContactPair_get_flags_0(physx::PxContactPair* self) {
  return &self->flags;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxContactPair_set_flags_1(physx::PxContactPair* self, physx::PxContactPairFlags* arg0) {
  self->flags = *arg0;
}

physx::PxPairFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxContactPair_get_events_0(physx::PxContactPair* self) {
  return &self->events;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxContactPair_set_events_1(physx::PxContactPair* self, physx::PxPairFlags* arg0) {
  self->events = *arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxContactPair___destroy___0(physx::PxContactPair* self) {
  delete self;
}

// Interface: PxContactPairFlags


physx::PxContactPairFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxContactPairFlags_PxContactPairFlags_1(unsigned short flags) {
  return new physx::PxContactPairFlags(flags);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxContactPairFlags_isSet_1(physx::PxContactPairFlags* self, PxContactPairFlagEnum flag) {
  return self->isSet(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxContactPairFlags_raise_1(physx::PxContactPairFlags* self, PxContactPairFlagEnum flag) {
  self->raise(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxContactPairFlags_clear_1(physx::PxContactPairFlags* self, PxContactPairFlagEnum flag) {
  self->clear(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxContactPairFlags___destroy___0(physx::PxContactPairFlags* self) {
  delete self;
}

// Interface: PxContactPairHeader


physx::PxActor* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxContactPairHeader_get_actors_1(physx::PxContactPairHeader* self, int arg0) {
  return self->actors[arg0];
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxContactPairHeader_set_actors_2(physx::PxContactPairHeader* self, int arg0, physx::PxActor* arg1) {
  self->actors[arg0] = arg1;
}

physx::PxContactPairHeaderFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxContactPairHeader_get_flags_0(physx::PxContactPairHeader* self) {
  return &self->flags;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxContactPairHeader_set_flags_1(physx::PxContactPairHeader* self, physx::PxContactPairHeaderFlags* arg0) {
  self->flags = *arg0;
}

const physx::PxContactPair* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxContactPairHeader_get_pairs_0(physx::PxContactPairHeader* self) {
  return self->pairs;
}

const void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxContactPairHeader_set_pairs_1(physx::PxContactPairHeader* self, physx::PxContactPair* arg0) {
  self->pairs = arg0;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxContactPairHeader_get_nbPairs_0(physx::PxContactPairHeader* self) {
  return self->nbPairs;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxContactPairHeader_set_nbPairs_1(physx::PxContactPairHeader* self, unsigned int arg0) {
  self->nbPairs = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxContactPairHeader___destroy___0(physx::PxContactPairHeader* self) {
  delete self;
}

// Interface: PxContactPairHeaderFlags


physx::PxContactPairHeaderFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxContactPairHeaderFlags_PxContactPairHeaderFlags_1(unsigned short flags) {
  return new physx::PxContactPairHeaderFlags(flags);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxContactPairHeaderFlags_isSet_1(physx::PxContactPairHeaderFlags* self, PxContactPairHeaderFlagEnum flag) {
  return self->isSet(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxContactPairHeaderFlags_raise_1(physx::PxContactPairHeaderFlags* self, PxContactPairHeaderFlagEnum flag) {
  self->raise(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxContactPairHeaderFlags_clear_1(physx::PxContactPairHeaderFlags* self, PxContactPairHeaderFlagEnum flag) {
  self->clear(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxContactPairHeaderFlags___destroy___0(physx::PxContactPairHeaderFlags* self) {
  delete self;
}

// Interface: PxContactPairPoint


physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxContactPairPoint_get_position_0(physx::PxContactPairPoint* self) {
  return &self->position;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxContactPairPoint_set_position_1(physx::PxContactPairPoint* self, physx::PxVec3* arg0) {
  self->position = *arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxContactPairPoint_get_separation_0(physx::PxContactPairPoint* self) {
  return self->separation;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxContactPairPoint_set_separation_1(physx::PxContactPairPoint* self, float arg0) {
  self->separation = arg0;
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxContactPairPoint_get_normal_0(physx::PxContactPairPoint* self) {
  return &self->normal;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxContactPairPoint_set_normal_1(physx::PxContactPairPoint* self, physx::PxVec3* arg0) {
  self->normal = *arg0;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxContactPairPoint_get_internalFaceIndex0_0(physx::PxContactPairPoint* self) {
  return self->internalFaceIndex0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxContactPairPoint_set_internalFaceIndex0_1(physx::PxContactPairPoint* self, unsigned int arg0) {
  self->internalFaceIndex0 = arg0;
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxContactPairPoint_get_impulse_0(physx::PxContactPairPoint* self) {
  return &self->impulse;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxContactPairPoint_set_impulse_1(physx::PxContactPairPoint* self, physx::PxVec3* arg0) {
  self->impulse = *arg0;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxContactPairPoint_get_internalFaceIndex1_0(physx::PxContactPairPoint* self) {
  return self->internalFaceIndex1;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxContactPairPoint_set_internalFaceIndex1_1(physx::PxContactPairPoint* self, unsigned int arg0) {
  self->internalFaceIndex1 = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxContactPairPoint___destroy___0(physx::PxContactPairPoint* self) {
  delete self;
}

// Interface: PxContactPoint


physx::PxContactPoint* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxContactPoint_PxContactPoint_0() {
  return new physx::PxContactPoint();
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxContactPoint_get_normal_0(physx::PxContactPoint* self) {
  return &self->normal;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxContactPoint_set_normal_1(physx::PxContactPoint* self, physx::PxVec3* arg0) {
  self->normal = *arg0;
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxContactPoint_get_point_0(physx::PxContactPoint* self) {
  return &self->point;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxContactPoint_set_point_1(physx::PxContactPoint* self, physx::PxVec3* arg0) {
  self->point = *arg0;
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxContactPoint_get_targetVel_0(physx::PxContactPoint* self) {
  return &self->targetVel;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxContactPoint_set_targetVel_1(physx::PxContactPoint* self, physx::PxVec3* arg0) {
  self->targetVel = *arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxContactPoint_get_separation_0(physx::PxContactPoint* self) {
  return self->separation;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxContactPoint_set_separation_1(physx::PxContactPoint* self, float arg0) {
  self->separation = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxContactPoint_get_maxImpulse_0(physx::PxContactPoint* self) {
  return self->maxImpulse;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxContactPoint_set_maxImpulse_1(physx::PxContactPoint* self, float arg0) {
  self->maxImpulse = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxContactPoint_get_staticFriction_0(physx::PxContactPoint* self) {
  return self->staticFriction;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxContactPoint_set_staticFriction_1(physx::PxContactPoint* self, float arg0) {
  self->staticFriction = arg0;
}

unsigned char EMSCRIPTEN_KEEPALIVE emscripten_bind_PxContactPoint_get_materialFlags_0(physx::PxContactPoint* self) {
  return self->materialFlags;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxContactPoint_set_materialFlags_1(physx::PxContactPoint* self, unsigned char arg0) {
  self->materialFlags = arg0;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxContactPoint_get_internalFaceIndex1_0(physx::PxContactPoint* self) {
  return self->internalFaceIndex1;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxContactPoint_set_internalFaceIndex1_1(physx::PxContactPoint* self, unsigned int arg0) {
  self->internalFaceIndex1 = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxContactPoint_get_dynamicFriction_0(physx::PxContactPoint* self) {
  return self->dynamicFriction;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxContactPoint_set_dynamicFriction_1(physx::PxContactPoint* self, float arg0) {
  self->dynamicFriction = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxContactPoint_get_restitution_0(physx::PxContactPoint* self) {
  return self->restitution;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxContactPoint_set_restitution_1(physx::PxContactPoint* self, float arg0) {
  self->restitution = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxContactPoint_get_damping_0(physx::PxContactPoint* self) {
  return self->damping;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxContactPoint_set_damping_1(physx::PxContactPoint* self, float arg0) {
  self->damping = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxContactPoint___destroy___0(physx::PxContactPoint* self) {
  delete self;
}

// Interface: PxControllerBehaviorCallbackImpl


PxControllerBehaviorCallbackImpl* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerBehaviorCallbackImpl_PxControllerBehaviorCallbackImpl_0() {
  return new PxControllerBehaviorCallbackImpl();
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerBehaviorCallbackImpl_getShapeBehaviorFlags_2(PxControllerBehaviorCallbackImpl* self, const physx::PxShape* shape, const physx::PxActor* actor) {
  return self->getShapeBehaviorFlags(*shape, *actor);
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerBehaviorCallbackImpl_getControllerBehaviorFlags_1(PxControllerBehaviorCallbackImpl* self, const physx::PxController* controller) {
  return self->getControllerBehaviorFlags(*controller);
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerBehaviorCallbackImpl_getObstacleBehaviorFlags_1(PxControllerBehaviorCallbackImpl* self, const physx::PxObstacle* obstacle) {
  return self->getObstacleBehaviorFlags(*obstacle);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerBehaviorCallbackImpl___destroy___0(PxControllerBehaviorCallbackImpl* self) {
  delete self;
}

// Interface: PxControllerBehaviorFlags


physx::PxControllerBehaviorFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerBehaviorFlags_PxControllerBehaviorFlags_1(unsigned char flags) {
  return new physx::PxControllerBehaviorFlags(flags);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerBehaviorFlags_isSet_1(physx::PxControllerBehaviorFlags* self, PxControllerBehaviorFlagEnum flag) {
  return self->isSet(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerBehaviorFlags_raise_1(physx::PxControllerBehaviorFlags* self, PxControllerBehaviorFlagEnum flag) {
  self->raise(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerBehaviorFlags_clear_1(physx::PxControllerBehaviorFlags* self, PxControllerBehaviorFlagEnum flag) {
  self->clear(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerBehaviorFlags___destroy___0(physx::PxControllerBehaviorFlags* self) {
  delete self;
}

// Interface: PxControllerCollisionFlags


physx::PxControllerCollisionFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerCollisionFlags_PxControllerCollisionFlags_1(unsigned char flags) {
  return new physx::PxControllerCollisionFlags(flags);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerCollisionFlags_isSet_1(physx::PxControllerCollisionFlags* self, PxControllerCollisionFlagEnum flag) {
  return self->isSet(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerCollisionFlags_raise_1(physx::PxControllerCollisionFlags* self, PxControllerCollisionFlagEnum flag) {
  self->raise(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerCollisionFlags_clear_1(physx::PxControllerCollisionFlags* self, PxControllerCollisionFlagEnum flag) {
  self->clear(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerCollisionFlags___destroy___0(physx::PxControllerCollisionFlags* self) {
  delete self;
}

// Interface: PxControllerFilterCallbackImpl


PxControllerFilterCallbackImpl* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerFilterCallbackImpl_PxControllerFilterCallbackImpl_0() {
  return new PxControllerFilterCallbackImpl();
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerFilterCallbackImpl_filter_2(PxControllerFilterCallbackImpl* self, const physx::PxController* a, const physx::PxController* b) {
  return self->filter(*a, *b);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerFilterCallbackImpl___destroy___0(PxControllerFilterCallbackImpl* self) {
  delete self;
}

// Interface: PxControllerFilters


physx::PxControllerFilters* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerFilters_PxControllerFilters_0() {
  return new physx::PxControllerFilters();
}

physx::PxControllerFilters* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerFilters_PxControllerFilters_1(const physx::PxFilterData* filterData) {
  return new physx::PxControllerFilters(filterData);
}

const physx::PxFilterData* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerFilters_get_mFilterData_0(physx::PxControllerFilters* self) {
  return self->mFilterData;
}

const void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerFilters_set_mFilterData_1(physx::PxControllerFilters* self, physx::PxFilterData* arg0) {
  self->mFilterData = arg0;
}

physx::PxQueryFilterCallback* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerFilters_get_mFilterCallback_0(physx::PxControllerFilters* self) {
  return self->mFilterCallback;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerFilters_set_mFilterCallback_1(physx::PxControllerFilters* self, physx::PxQueryFilterCallback* arg0) {
  self->mFilterCallback = arg0;
}

physx::PxQueryFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerFilters_get_mFilterFlags_0(physx::PxControllerFilters* self) {
  return &self->mFilterFlags;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerFilters_set_mFilterFlags_1(physx::PxControllerFilters* self, physx::PxQueryFlags* arg0) {
  self->mFilterFlags = *arg0;
}

physx::PxControllerFilterCallback* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerFilters_get_mCCTFilterCallback_0(physx::PxControllerFilters* self) {
  return self->mCCTFilterCallback;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerFilters_set_mCCTFilterCallback_1(physx::PxControllerFilters* self, physx::PxControllerFilterCallback* arg0) {
  self->mCCTFilterCallback = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerFilters___destroy___0(physx::PxControllerFilters* self) {
  delete self;
}

// Interface: PxControllerManager


void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerManager_release_0(physx::PxControllerManager* self) {
  self->release();
}

physx::PxScene* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerManager_getScene_0(physx::PxControllerManager* self) {
  return &self->getScene();
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerManager_getNbControllers_0(physx::PxControllerManager* self) {
  return self->getNbControllers();
}

physx::PxController* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerManager_getController_1(physx::PxControllerManager* self, unsigned int index) {
  return self->getController(index);
}

physx::PxController* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerManager_createController_1(physx::PxControllerManager* self, const physx::PxControllerDesc* desc) {
  return self->createController(*desc);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerManager_purgeControllers_0(physx::PxControllerManager* self) {
  self->purgeControllers();
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerManager_getNbObstacleContexts_0(physx::PxControllerManager* self) {
  return self->getNbObstacleContexts();
}

physx::PxObstacleContext* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerManager_getObstacleContext_1(physx::PxControllerManager* self, unsigned int index) {
  return self->getObstacleContext(index);
}

physx::PxObstacleContext* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerManager_createObstacleContext_0(physx::PxControllerManager* self) {
  return self->createObstacleContext();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerManager_computeInteractions_1(physx::PxControllerManager* self, float elapsedTime) {
  self->computeInteractions(elapsedTime);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerManager_setTessellation_2(physx::PxControllerManager* self, bool flag, float maxEdgeLength) {
  self->setTessellation(flag, maxEdgeLength);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerManager_setOverlapRecoveryModule_1(physx::PxControllerManager* self, bool flag) {
  self->setOverlapRecoveryModule(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerManager_setPreciseSweeps_1(physx::PxControllerManager* self, bool flags) {
  self->setPreciseSweeps(flags);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerManager_setPreventVerticalSlidingAgainstCeiling_1(physx::PxControllerManager* self, bool flag) {
  self->setPreventVerticalSlidingAgainstCeiling(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerManager_shiftOrigin_1(physx::PxControllerManager* self, const physx::PxVec3* shift) {
  self->shiftOrigin(*shift);
}

// Interface: PxControllerObstacleHit


const void* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerObstacleHit_get_userData_0(physx::PxControllerObstacleHit* self) {
  return self->userData;
}

const void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerObstacleHit_set_userData_1(physx::PxControllerObstacleHit* self, void* arg0) {
  self->userData = arg0;
}

physx::PxController* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerObstacleHit_get_controller_0(physx::PxControllerObstacleHit* self) {
  return self->controller;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerObstacleHit_set_controller_1(physx::PxControllerObstacleHit* self, physx::PxController* arg0) {
  self->controller = arg0;
}

physx::PxExtendedVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerObstacleHit_get_worldPos_0(physx::PxControllerObstacleHit* self) {
  return &self->worldPos;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerObstacleHit_set_worldPos_1(physx::PxControllerObstacleHit* self, physx::PxExtendedVec3* arg0) {
  self->worldPos = *arg0;
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerObstacleHit_get_worldNormal_0(physx::PxControllerObstacleHit* self) {
  return &self->worldNormal;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerObstacleHit_set_worldNormal_1(physx::PxControllerObstacleHit* self, physx::PxVec3* arg0) {
  self->worldNormal = *arg0;
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerObstacleHit_get_dir_0(physx::PxControllerObstacleHit* self) {
  return &self->dir;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerObstacleHit_set_dir_1(physx::PxControllerObstacleHit* self, physx::PxVec3* arg0) {
  self->dir = *arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerObstacleHit_get_length_0(physx::PxControllerObstacleHit* self) {
  return self->length;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerObstacleHit_set_length_1(physx::PxControllerObstacleHit* self, float arg0) {
  self->length = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerObstacleHit___destroy___0(physx::PxControllerObstacleHit* self) {
  delete self;
}

// Interface: PxControllerShapeHit


physx::PxShape* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerShapeHit_get_shape_0(physx::PxControllerShapeHit* self) {
  return self->shape;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerShapeHit_set_shape_1(physx::PxControllerShapeHit* self, physx::PxShape* arg0) {
  self->shape = arg0;
}

physx::PxRigidActor* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerShapeHit_get_actor_0(physx::PxControllerShapeHit* self) {
  return self->actor;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerShapeHit_set_actor_1(physx::PxControllerShapeHit* self, physx::PxRigidActor* arg0) {
  self->actor = arg0;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerShapeHit_get_triangleIndex_0(physx::PxControllerShapeHit* self) {
  return self->triangleIndex;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerShapeHit_set_triangleIndex_1(physx::PxControllerShapeHit* self, unsigned int arg0) {
  self->triangleIndex = arg0;
}

physx::PxController* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerShapeHit_get_controller_0(physx::PxControllerShapeHit* self) {
  return self->controller;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerShapeHit_set_controller_1(physx::PxControllerShapeHit* self, physx::PxController* arg0) {
  self->controller = arg0;
}

physx::PxExtendedVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerShapeHit_get_worldPos_0(physx::PxControllerShapeHit* self) {
  return &self->worldPos;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerShapeHit_set_worldPos_1(physx::PxControllerShapeHit* self, physx::PxExtendedVec3* arg0) {
  self->worldPos = *arg0;
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerShapeHit_get_worldNormal_0(physx::PxControllerShapeHit* self) {
  return &self->worldNormal;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerShapeHit_set_worldNormal_1(physx::PxControllerShapeHit* self, physx::PxVec3* arg0) {
  self->worldNormal = *arg0;
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerShapeHit_get_dir_0(physx::PxControllerShapeHit* self) {
  return &self->dir;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerShapeHit_set_dir_1(physx::PxControllerShapeHit* self, physx::PxVec3* arg0) {
  self->dir = *arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerShapeHit_get_length_0(physx::PxControllerShapeHit* self) {
  return self->length;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerShapeHit_set_length_1(physx::PxControllerShapeHit* self, float arg0) {
  self->length = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerShapeHit___destroy___0(physx::PxControllerShapeHit* self) {
  delete self;
}

// Interface: PxControllerState


physx::PxControllerState* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerState_PxControllerState_0() {
  return new physx::PxControllerState();
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerState_get_deltaXP_0(physx::PxControllerState* self) {
  return &self->deltaXP;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerState_set_deltaXP_1(physx::PxControllerState* self, physx::PxVec3* arg0) {
  self->deltaXP = *arg0;
}

physx::PxShape* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerState_get_touchedShape_0(physx::PxControllerState* self) {
  return self->touchedShape;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerState_set_touchedShape_1(physx::PxControllerState* self, physx::PxShape* arg0) {
  self->touchedShape = arg0;
}

physx::PxRigidActor* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerState_get_touchedActor_0(physx::PxControllerState* self) {
  return self->touchedActor;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerState_set_touchedActor_1(physx::PxControllerState* self, physx::PxRigidActor* arg0) {
  self->touchedActor = arg0;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerState_get_touchedObstacleHandle_0(physx::PxControllerState* self) {
  return self->touchedObstacleHandle;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerState_set_touchedObstacleHandle_1(physx::PxControllerState* self, unsigned int arg0) {
  self->touchedObstacleHandle = arg0;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerState_get_collisionFlags_0(physx::PxControllerState* self) {
  return self->collisionFlags;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerState_set_collisionFlags_1(physx::PxControllerState* self, unsigned int arg0) {
  self->collisionFlags = arg0;
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerState_get_standOnAnotherCCT_0(physx::PxControllerState* self) {
  return self->standOnAnotherCCT;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerState_set_standOnAnotherCCT_1(physx::PxControllerState* self, bool arg0) {
  self->standOnAnotherCCT = arg0;
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerState_get_standOnObstacle_0(physx::PxControllerState* self) {
  return self->standOnObstacle;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerState_set_standOnObstacle_1(physx::PxControllerState* self, bool arg0) {
  self->standOnObstacle = arg0;
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerState_get_isMovingUp_0(physx::PxControllerState* self) {
  return self->isMovingUp;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerState_set_isMovingUp_1(physx::PxControllerState* self, bool arg0) {
  self->isMovingUp = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerState___destroy___0(physx::PxControllerState* self) {
  delete self;
}

// Interface: PxControllerStats


unsigned short EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerStats_get_nbIterations_0(physx::PxControllerStats* self) {
  return self->nbIterations;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerStats_set_nbIterations_1(physx::PxControllerStats* self, unsigned short arg0) {
  self->nbIterations = arg0;
}

unsigned short EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerStats_get_nbFullUpdates_0(physx::PxControllerStats* self) {
  return self->nbFullUpdates;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerStats_set_nbFullUpdates_1(physx::PxControllerStats* self, unsigned short arg0) {
  self->nbFullUpdates = arg0;
}

unsigned short EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerStats_get_nbPartialUpdates_0(physx::PxControllerStats* self) {
  return self->nbPartialUpdates;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerStats_set_nbPartialUpdates_1(physx::PxControllerStats* self, unsigned short arg0) {
  self->nbPartialUpdates = arg0;
}

unsigned short EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerStats_get_nbTessellation_0(physx::PxControllerStats* self) {
  return self->nbTessellation;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerStats_set_nbTessellation_1(physx::PxControllerStats* self, unsigned short arg0) {
  self->nbTessellation = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllerStats___destroy___0(physx::PxControllerStats* self) {
  delete self;
}

// Interface: PxControllersHit


physx::PxController* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllersHit_get_other_0(physx::PxControllersHit* self) {
  return self->other;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllersHit_set_other_1(physx::PxControllersHit* self, physx::PxController* arg0) {
  self->other = arg0;
}

physx::PxController* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllersHit_get_controller_0(physx::PxControllersHit* self) {
  return self->controller;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllersHit_set_controller_1(physx::PxControllersHit* self, physx::PxController* arg0) {
  self->controller = arg0;
}

physx::PxExtendedVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllersHit_get_worldPos_0(physx::PxControllersHit* self) {
  return &self->worldPos;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllersHit_set_worldPos_1(physx::PxControllersHit* self, physx::PxExtendedVec3* arg0) {
  self->worldPos = *arg0;
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllersHit_get_worldNormal_0(physx::PxControllersHit* self) {
  return &self->worldNormal;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllersHit_set_worldNormal_1(physx::PxControllersHit* self, physx::PxVec3* arg0) {
  self->worldNormal = *arg0;
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllersHit_get_dir_0(physx::PxControllersHit* self) {
  return &self->dir;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllersHit_set_dir_1(physx::PxControllersHit* self, physx::PxVec3* arg0) {
  self->dir = *arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllersHit_get_length_0(physx::PxControllersHit* self) {
  return self->length;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllersHit_set_length_1(physx::PxControllersHit* self, float arg0) {
  self->length = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxControllersHit___destroy___0(physx::PxControllersHit* self) {
  delete self;
}

// Interface: PxConvexFlags


physx::PxConvexFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxConvexFlags_PxConvexFlags_1(unsigned short flags) {
  return new physx::PxConvexFlags(flags);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxConvexFlags_isSet_1(physx::PxConvexFlags* self, PxConvexFlagEnum flag) {
  return self->isSet(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxConvexFlags_raise_1(physx::PxConvexFlags* self, PxConvexFlagEnum flag) {
  self->raise(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxConvexFlags_clear_1(physx::PxConvexFlags* self, PxConvexFlagEnum flag) {
  self->clear(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxConvexFlags___destroy___0(physx::PxConvexFlags* self) {
  delete self;
}

// Interface: PxConvexMesh


unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxConvexMesh_getNbVertices_0(physx::PxConvexMesh* self) {
  return self->getNbVertices();
}

const physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxConvexMesh_getVertices_0(physx::PxConvexMesh* self) {
  return self->getVertices();
}

PxU8ConstPtr* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxConvexMesh_getIndexBuffer_0(physx::PxConvexMesh* self) {
  static thread_local PxU8ConstPtr temp;
  return (temp = self->getIndexBuffer(), &temp);
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxConvexMesh_getNbPolygons_0(physx::PxConvexMesh* self) {
  return self->getNbPolygons();
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxConvexMesh_getPolygonData_2(physx::PxConvexMesh* self, unsigned int index, physx::PxHullPolygon* data) {
  return self->getPolygonData(index, *data);
}

physx::PxBounds3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxConvexMesh_getLocalBounds_0(physx::PxConvexMesh* self) {
  static thread_local physx::PxBounds3 temp;
  return (temp = self->getLocalBounds(), &temp);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxConvexMesh_isGpuCompatible_0(physx::PxConvexMesh* self) {
  return self->isGpuCompatible();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxConvexMesh_release_0(physx::PxConvexMesh* self) {
  self->release();
}

const char* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxConvexMesh_getConcreteTypeName_0(physx::PxConvexMesh* self) {
  return self->getConcreteTypeName();
}

int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxConvexMesh_getConcreteType_0(physx::PxConvexMesh* self) {
  return self->getConcreteType();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxConvexMesh_setBaseFlag_2(physx::PxConvexMesh* self, PxBaseFlagEnum flag, bool value) {
  self->setBaseFlag(flag, value);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxConvexMesh_setBaseFlags_1(physx::PxConvexMesh* self, physx::PxBaseFlags* inFlags) {
  self->setBaseFlags(*inFlags);
}

physx::PxBaseFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxConvexMesh_getBaseFlags_0(physx::PxConvexMesh* self) {
  static thread_local physx::PxBaseFlags temp;
  return (temp = self->getBaseFlags(), &temp);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxConvexMesh_isReleasable_0(physx::PxConvexMesh* self) {
  return self->isReleasable();
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxConvexMesh_getReferenceCount_0(physx::PxConvexMesh* self) {
  return self->getReferenceCount();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxConvexMesh_acquireReference_0(physx::PxConvexMesh* self) {
  self->acquireReference();
}

// Interface: PxConvexMeshDesc


physx::PxConvexMeshDesc* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxConvexMeshDesc_PxConvexMeshDesc_0() {
  return new physx::PxConvexMeshDesc();
}

physx::PxBoundedData* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxConvexMeshDesc_get_points_0(physx::PxConvexMeshDesc* self) {
  return &self->points;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxConvexMeshDesc_set_points_1(physx::PxConvexMeshDesc* self, physx::PxBoundedData* arg0) {
  self->points = *arg0;
}

physx::PxConvexFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxConvexMeshDesc_get_flags_0(physx::PxConvexMeshDesc* self) {
  return &self->flags;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxConvexMeshDesc_set_flags_1(physx::PxConvexMeshDesc* self, physx::PxConvexFlags* arg0) {
  self->flags = *arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxConvexMeshDesc___destroy___0(physx::PxConvexMeshDesc* self) {
  delete self;
}

// Interface: PxConvexMeshGeometry


physx::PxConvexMeshGeometry* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxConvexMeshGeometry_PxConvexMeshGeometry_1(physx::PxConvexMesh* mesh) {
  return new physx::PxConvexMeshGeometry(mesh);
}

physx::PxConvexMeshGeometry* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxConvexMeshGeometry_PxConvexMeshGeometry_2(physx::PxConvexMesh* mesh, const physx::PxMeshScale* scaling) {
  return new physx::PxConvexMeshGeometry(mesh, *scaling);
}

physx::PxConvexMeshGeometry* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxConvexMeshGeometry_PxConvexMeshGeometry_3(physx::PxConvexMesh* mesh, const physx::PxMeshScale* scaling, physx::PxConvexMeshGeometryFlags* flags) {
  return new physx::PxConvexMeshGeometry(mesh, *scaling, *flags);
}

PxGeometryTypeEnum EMSCRIPTEN_KEEPALIVE emscripten_bind_PxConvexMeshGeometry_getType_0(physx::PxConvexMeshGeometry* self) {
  return self->getType();
}

physx::PxMeshScale* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxConvexMeshGeometry_get_scale_0(physx::PxConvexMeshGeometry* self) {
  return &self->scale;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxConvexMeshGeometry_set_scale_1(physx::PxConvexMeshGeometry* self, physx::PxMeshScale* arg0) {
  self->scale = *arg0;
}

physx::PxConvexMesh* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxConvexMeshGeometry_get_convexMesh_0(physx::PxConvexMeshGeometry* self) {
  return self->convexMesh;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxConvexMeshGeometry_set_convexMesh_1(physx::PxConvexMeshGeometry* self, physx::PxConvexMesh* arg0) {
  self->convexMesh = arg0;
}

physx::PxConvexMeshGeometryFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxConvexMeshGeometry_get_meshFlags_0(physx::PxConvexMeshGeometry* self) {
  return &self->meshFlags;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxConvexMeshGeometry_set_meshFlags_1(physx::PxConvexMeshGeometry* self, physx::PxConvexMeshGeometryFlags* arg0) {
  self->meshFlags = *arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxConvexMeshGeometry___destroy___0(physx::PxConvexMeshGeometry* self) {
  delete self;
}

// Interface: PxConvexMeshGeometryFlags


physx::PxConvexMeshGeometryFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxConvexMeshGeometryFlags_PxConvexMeshGeometryFlags_1(unsigned char flags) {
  return new physx::PxConvexMeshGeometryFlags(flags);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxConvexMeshGeometryFlags_isSet_1(physx::PxConvexMeshGeometryFlags* self, PxConvexMeshGeometryFlagEnum flag) {
  return self->isSet(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxConvexMeshGeometryFlags_raise_1(physx::PxConvexMeshGeometryFlags* self, PxConvexMeshGeometryFlagEnum flag) {
  self->raise(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxConvexMeshGeometryFlags_clear_1(physx::PxConvexMeshGeometryFlags* self, PxConvexMeshGeometryFlagEnum flag) {
  self->clear(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxConvexMeshGeometryFlags___destroy___0(physx::PxConvexMeshGeometryFlags* self) {
  delete self;
}

// Interface: PxCookingParams


physx::PxCookingParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCookingParams_PxCookingParams_1(const physx::PxTolerancesScale* sc) {
  return new physx::PxCookingParams(*sc);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCookingParams_get_areaTestEpsilon_0(physx::PxCookingParams* self) {
  return self->areaTestEpsilon;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCookingParams_set_areaTestEpsilon_1(physx::PxCookingParams* self, float arg0) {
  self->areaTestEpsilon = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCookingParams_get_planeTolerance_0(physx::PxCookingParams* self) {
  return self->planeTolerance;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCookingParams_set_planeTolerance_1(physx::PxCookingParams* self, float arg0) {
  self->planeTolerance = arg0;
}

PxConvexMeshCookingTypeEnum EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCookingParams_get_convexMeshCookingType_0(physx::PxCookingParams* self) {
  return self->convexMeshCookingType;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCookingParams_set_convexMeshCookingType_1(physx::PxCookingParams* self, PxConvexMeshCookingTypeEnum arg0) {
  self->convexMeshCookingType = arg0;
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCookingParams_get_suppressTriangleMeshRemapTable_0(physx::PxCookingParams* self) {
  return self->suppressTriangleMeshRemapTable;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCookingParams_set_suppressTriangleMeshRemapTable_1(physx::PxCookingParams* self, bool arg0) {
  self->suppressTriangleMeshRemapTable = arg0;
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCookingParams_get_buildTriangleAdjacencies_0(physx::PxCookingParams* self) {
  return self->buildTriangleAdjacencies;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCookingParams_set_buildTriangleAdjacencies_1(physx::PxCookingParams* self, bool arg0) {
  self->buildTriangleAdjacencies = arg0;
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCookingParams_get_buildGPUData_0(physx::PxCookingParams* self) {
  return self->buildGPUData;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCookingParams_set_buildGPUData_1(physx::PxCookingParams* self, bool arg0) {
  self->buildGPUData = arg0;
}

physx::PxTolerancesScale* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCookingParams_get_scale_0(physx::PxCookingParams* self) {
  return &self->scale;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCookingParams_set_scale_1(physx::PxCookingParams* self, physx::PxTolerancesScale* arg0) {
  self->scale = *arg0;
}

physx::PxMeshPreprocessingFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCookingParams_get_meshPreprocessParams_0(physx::PxCookingParams* self) {
  return &self->meshPreprocessParams;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCookingParams_set_meshPreprocessParams_1(physx::PxCookingParams* self, physx::PxMeshPreprocessingFlags* arg0) {
  self->meshPreprocessParams = *arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCookingParams_get_meshWeldTolerance_0(physx::PxCookingParams* self) {
  return self->meshWeldTolerance;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCookingParams_set_meshWeldTolerance_1(physx::PxCookingParams* self, float arg0) {
  self->meshWeldTolerance = arg0;
}

physx::PxMidphaseDesc* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCookingParams_get_midphaseDesc_0(physx::PxCookingParams* self) {
  return &self->midphaseDesc;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCookingParams_set_midphaseDesc_1(physx::PxCookingParams* self, physx::PxMidphaseDesc* arg0) {
  self->midphaseDesc = *arg0;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCookingParams_get_gaussMapLimit_0(physx::PxCookingParams* self) {
  return self->gaussMapLimit;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCookingParams_set_gaussMapLimit_1(physx::PxCookingParams* self, unsigned int arg0) {
  self->gaussMapLimit = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxCookingParams___destroy___0(physx::PxCookingParams* self) {
  delete self;
}

// Interface: PxD6Joint


void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxD6Joint_setMotion_2(physx::PxD6Joint* self, PxD6AxisEnum axis, PxD6MotionEnum type) {
  self->setMotion(axis, type);
}

PxD6MotionEnum EMSCRIPTEN_KEEPALIVE emscripten_bind_PxD6Joint_getMotion_1(physx::PxD6Joint* self, PxD6AxisEnum axis) {
  return self->getMotion(axis);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxD6Joint_getTwistAngle_0(physx::PxD6Joint* self) {
  return self->getTwistAngle();
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxD6Joint_getSwingYAngle_0(physx::PxD6Joint* self) {
  return self->getSwingYAngle();
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxD6Joint_getSwingZAngle_0(physx::PxD6Joint* self) {
  return self->getSwingZAngle();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxD6Joint_setDistanceLimit_1(physx::PxD6Joint* self, const physx::PxJointLinearLimit* limit) {
  self->setDistanceLimit(*limit);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxD6Joint_setLinearLimit_2(physx::PxD6Joint* self, PxD6AxisEnum axis, const physx::PxJointLinearLimitPair* limit) {
  self->setLinearLimit(axis, *limit);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxD6Joint_setTwistLimit_1(physx::PxD6Joint* self, const physx::PxJointAngularLimitPair* limit) {
  self->setTwistLimit(*limit);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxD6Joint_setSwingLimit_1(physx::PxD6Joint* self, const physx::PxJointLimitCone* limit) {
  self->setSwingLimit(*limit);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxD6Joint_setPyramidSwingLimit_1(physx::PxD6Joint* self, const physx::PxJointLimitPyramid* limit) {
  self->setPyramidSwingLimit(*limit);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxD6Joint_setDrive_2(physx::PxD6Joint* self, PxD6DriveEnum index, const physx::PxD6JointDrive* drive) {
  self->setDrive(index, *drive);
}

physx::PxD6JointDrive* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxD6Joint_getDrive_1(physx::PxD6Joint* self, PxD6DriveEnum index) {
  static thread_local physx::PxD6JointDrive temp;
  return (temp = self->getDrive(index), &temp);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxD6Joint_setDrivePosition_1(physx::PxD6Joint* self, const physx::PxTransform* pose) {
  self->setDrivePosition(*pose);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxD6Joint_setDrivePosition_2(physx::PxD6Joint* self, const physx::PxTransform* pose, bool autowake) {
  self->setDrivePosition(*pose, autowake);
}

physx::PxTransform* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxD6Joint_getDrivePosition_0(physx::PxD6Joint* self) {
  static thread_local physx::PxTransform temp;
  return (temp = self->getDrivePosition(), &temp);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxD6Joint_setDriveVelocity_2(physx::PxD6Joint* self, const physx::PxVec3* linear, const physx::PxVec3* angular) {
  self->setDriveVelocity(*linear, *angular);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxD6Joint_getDriveVelocity_2(physx::PxD6Joint* self, physx::PxVec3* linear, physx::PxVec3* angular) {
  self->getDriveVelocity(*linear, *angular);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxD6Joint_release_0(physx::PxD6Joint* self) {
  self->release();
}

const char* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxD6Joint_getConcreteTypeName_0(physx::PxD6Joint* self) {
  return self->getConcreteTypeName();
}

int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxD6Joint_getConcreteType_0(physx::PxD6Joint* self) {
  return self->getConcreteType();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxD6Joint_setBaseFlag_2(physx::PxD6Joint* self, PxBaseFlagEnum flag, bool value) {
  self->setBaseFlag(flag, value);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxD6Joint_setBaseFlags_1(physx::PxD6Joint* self, physx::PxBaseFlags* inFlags) {
  self->setBaseFlags(*inFlags);
}

physx::PxBaseFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxD6Joint_getBaseFlags_0(physx::PxD6Joint* self) {
  static thread_local physx::PxBaseFlags temp;
  return (temp = self->getBaseFlags(), &temp);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxD6Joint_isReleasable_0(physx::PxD6Joint* self) {
  return self->isReleasable();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxD6Joint_setActors_2(physx::PxD6Joint* self, physx::PxRigidActor* actor0, physx::PxRigidActor* actor1) {
  self->setActors(actor0, actor1);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxD6Joint_setLocalPose_2(physx::PxD6Joint* self, PxJointActorIndexEnum actor, const physx::PxTransform* localPose) {
  self->setLocalPose(actor, *localPose);
}

physx::PxTransform* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxD6Joint_getLocalPose_1(physx::PxD6Joint* self, PxJointActorIndexEnum actor) {
  static thread_local physx::PxTransform temp;
  return (temp = self->getLocalPose(actor), &temp);
}

physx::PxTransform* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxD6Joint_getRelativeTransform_0(physx::PxD6Joint* self) {
  static thread_local physx::PxTransform temp;
  return (temp = self->getRelativeTransform(), &temp);
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxD6Joint_getRelativeLinearVelocity_0(physx::PxD6Joint* self) {
  static thread_local physx::PxVec3 temp;
  return (temp = self->getRelativeLinearVelocity(), &temp);
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxD6Joint_getRelativeAngularVelocity_0(physx::PxD6Joint* self) {
  static thread_local physx::PxVec3 temp;
  return (temp = self->getRelativeAngularVelocity(), &temp);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxD6Joint_setBreakForce_2(physx::PxD6Joint* self, float force, float torque) {
  self->setBreakForce(force, torque);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxD6Joint_setConstraintFlags_1(physx::PxD6Joint* self, physx::PxConstraintFlags* flags) {
  self->setConstraintFlags(*flags);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxD6Joint_setConstraintFlag_2(physx::PxD6Joint* self, PxConstraintFlagEnum flag, bool value) {
  self->setConstraintFlag(flag, value);
}

physx::PxConstraintFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxD6Joint_getConstraintFlags_0(physx::PxD6Joint* self) {
  static thread_local physx::PxConstraintFlags temp;
  return (temp = self->getConstraintFlags(), &temp);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxD6Joint_setInvMassScale0_1(physx::PxD6Joint* self, float invMassScale) {
  self->setInvMassScale0(invMassScale);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxD6Joint_getInvMassScale0_0(physx::PxD6Joint* self) {
  return self->getInvMassScale0();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxD6Joint_setInvMassScale1_1(physx::PxD6Joint* self, float invMassScale) {
  self->setInvMassScale1(invMassScale);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxD6Joint_getInvMassScale1_0(physx::PxD6Joint* self) {
  return self->getInvMassScale1();
}

physx::PxConstraint* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxD6Joint_getConstraint_0(physx::PxD6Joint* self) {
  return self->getConstraint();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxD6Joint_setName_1(physx::PxD6Joint* self, const char* name) {
  self->setName(name);
}

const char* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxD6Joint_getName_0(physx::PxD6Joint* self) {
  return self->getName();
}

physx::PxScene* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxD6Joint_getScene_0(physx::PxD6Joint* self) {
  return self->getScene();
}

void* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxD6Joint_get_userData_0(physx::PxD6Joint* self) {
  return self->userData;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxD6Joint_set_userData_1(physx::PxD6Joint* self, void* arg0) {
  self->userData = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxD6Joint___destroy___0(physx::PxD6Joint* self) {
  delete self;
}

// Interface: PxD6JointDrive


physx::PxD6JointDrive* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxD6JointDrive_PxD6JointDrive_0() {
  return new physx::PxD6JointDrive();
}

physx::PxD6JointDrive* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxD6JointDrive_PxD6JointDrive_3(float driveStiffness, float driveDamping, float driveForceLimit) {
  return new physx::PxD6JointDrive(driveStiffness, driveDamping, driveForceLimit);
}

physx::PxD6JointDrive* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxD6JointDrive_PxD6JointDrive_4(float driveStiffness, float driveDamping, float driveForceLimit, bool isAcceleration) {
  return new physx::PxD6JointDrive(driveStiffness, driveDamping, driveForceLimit, isAcceleration);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxD6JointDrive_get_forceLimit_0(physx::PxD6JointDrive* self) {
  return self->forceLimit;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxD6JointDrive_set_forceLimit_1(physx::PxD6JointDrive* self, float arg0) {
  self->forceLimit = arg0;
}

physx::PxD6JointDriveFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxD6JointDrive_get_flags_0(physx::PxD6JointDrive* self) {
  return &self->flags;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxD6JointDrive_set_flags_1(physx::PxD6JointDrive* self, physx::PxD6JointDriveFlags* arg0) {
  self->flags = *arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxD6JointDrive_get_stiffness_0(physx::PxD6JointDrive* self) {
  return self->stiffness;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxD6JointDrive_set_stiffness_1(physx::PxD6JointDrive* self, float arg0) {
  self->stiffness = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxD6JointDrive_get_damping_0(physx::PxD6JointDrive* self) {
  return self->damping;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxD6JointDrive_set_damping_1(physx::PxD6JointDrive* self, float arg0) {
  self->damping = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxD6JointDrive___destroy___0(physx::PxD6JointDrive* self) {
  delete self;
}

// Interface: PxD6JointDriveFlags


physx::PxD6JointDriveFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxD6JointDriveFlags_PxD6JointDriveFlags_1(unsigned int flags) {
  return new physx::PxD6JointDriveFlags(flags);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxD6JointDriveFlags_isSet_1(physx::PxD6JointDriveFlags* self, PxD6JointDriveFlagEnum flag) {
  return self->isSet(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxD6JointDriveFlags_raise_1(physx::PxD6JointDriveFlags* self, PxD6JointDriveFlagEnum flag) {
  self->raise(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxD6JointDriveFlags_clear_1(physx::PxD6JointDriveFlags* self, PxD6JointDriveFlagEnum flag) {
  self->clear(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxD6JointDriveFlags___destroy___0(physx::PxD6JointDriveFlags* self) {
  delete self;
}

// Interface: PxDebugLine


physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDebugLine_get_pos0_0(physx::PxDebugLine* self) {
  return &self->pos0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDebugLine_set_pos0_1(physx::PxDebugLine* self, physx::PxVec3* arg0) {
  self->pos0 = *arg0;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDebugLine_get_color0_0(physx::PxDebugLine* self) {
  return self->color0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDebugLine_set_color0_1(physx::PxDebugLine* self, unsigned int arg0) {
  self->color0 = arg0;
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDebugLine_get_pos1_0(physx::PxDebugLine* self) {
  return &self->pos1;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDebugLine_set_pos1_1(physx::PxDebugLine* self, physx::PxVec3* arg0) {
  self->pos1 = *arg0;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDebugLine_get_color1_0(physx::PxDebugLine* self) {
  return self->color1;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDebugLine_set_color1_1(physx::PxDebugLine* self, unsigned int arg0) {
  self->color1 = arg0;
}

// Interface: PxDebugPoint


physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDebugPoint_get_pos_0(physx::PxDebugPoint* self) {
  return &self->pos;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDebugPoint_set_pos_1(physx::PxDebugPoint* self, physx::PxVec3* arg0) {
  self->pos = *arg0;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDebugPoint_get_color_0(physx::PxDebugPoint* self) {
  return self->color;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDebugPoint_set_color_1(physx::PxDebugPoint* self, unsigned int arg0) {
  self->color = arg0;
}

// Interface: PxDebugTriangle


physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDebugTriangle_get_pos0_0(physx::PxDebugTriangle* self) {
  return &self->pos0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDebugTriangle_set_pos0_1(physx::PxDebugTriangle* self, physx::PxVec3* arg0) {
  self->pos0 = *arg0;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDebugTriangle_get_color0_0(physx::PxDebugTriangle* self) {
  return self->color0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDebugTriangle_set_color0_1(physx::PxDebugTriangle* self, unsigned int arg0) {
  self->color0 = arg0;
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDebugTriangle_get_pos1_0(physx::PxDebugTriangle* self) {
  return &self->pos1;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDebugTriangle_set_pos1_1(physx::PxDebugTriangle* self, physx::PxVec3* arg0) {
  self->pos1 = *arg0;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDebugTriangle_get_color1_0(physx::PxDebugTriangle* self) {
  return self->color1;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDebugTriangle_set_color1_1(physx::PxDebugTriangle* self, unsigned int arg0) {
  self->color1 = arg0;
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDebugTriangle_get_pos2_0(physx::PxDebugTriangle* self) {
  return &self->pos2;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDebugTriangle_set_pos2_1(physx::PxDebugTriangle* self, physx::PxVec3* arg0) {
  self->pos2 = *arg0;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDebugTriangle_get_color2_0(physx::PxDebugTriangle* self) {
  return self->color2;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDebugTriangle_set_color2_1(physx::PxDebugTriangle* self, unsigned int arg0) {
  self->color2 = arg0;
}

// Interface: PxDefaultAllocator


physx::PxDefaultAllocator* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDefaultAllocator_PxDefaultAllocator_0() {
  return new physx::PxDefaultAllocator();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDefaultAllocator___destroy___0(physx::PxDefaultAllocator* self) {
  delete self;
}

// Interface: PxDefaultCpuDispatcher


void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDefaultCpuDispatcher___destroy___0(physx::PxDefaultCpuDispatcher* self) {
  delete self;
}

// Interface: PxDefaultErrorCallback


physx::PxDefaultErrorCallback* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDefaultErrorCallback_PxDefaultErrorCallback_0() {
  return new physx::PxDefaultErrorCallback();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDefaultErrorCallback_reportError_4(physx::PxDefaultErrorCallback* self, PxErrorCodeEnum code, const char* message, const char* file, int line) {
  self->reportError(code, message, file, line);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDefaultErrorCallback___destroy___0(physx::PxDefaultErrorCallback* self) {
  delete self;
}

// Interface: PxDefaultMemoryInputData


physx::PxDefaultMemoryInputData* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDefaultMemoryInputData_PxDefaultMemoryInputData_2(PxU8Ptr* data, unsigned int length) {
  return new physx::PxDefaultMemoryInputData(*data, length);
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDefaultMemoryInputData_read_2(physx::PxDefaultMemoryInputData* self, void* dest, unsigned int count) {
  return self->read(dest, count);
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDefaultMemoryInputData_getLength_0(physx::PxDefaultMemoryInputData* self) {
  return self->getLength();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDefaultMemoryInputData_seek_1(physx::PxDefaultMemoryInputData* self, unsigned int pos) {
  self->seek(pos);
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDefaultMemoryInputData_tell_0(physx::PxDefaultMemoryInputData* self) {
  return self->tell();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDefaultMemoryInputData___destroy___0(physx::PxDefaultMemoryInputData* self) {
  delete self;
}

// Interface: PxDefaultMemoryOutputStream


physx::PxDefaultMemoryOutputStream* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDefaultMemoryOutputStream_PxDefaultMemoryOutputStream_0() {
  return new physx::PxDefaultMemoryOutputStream();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDefaultMemoryOutputStream_write_2(physx::PxDefaultMemoryOutputStream* self, void* src, unsigned int count) {
  self->write(src, count);
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDefaultMemoryOutputStream_getSize_0(physx::PxDefaultMemoryOutputStream* self) {
  return self->getSize();
}

void* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDefaultMemoryOutputStream_getData_0(physx::PxDefaultMemoryOutputStream* self) {
  return self->getData();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDefaultMemoryOutputStream___destroy___0(physx::PxDefaultMemoryOutputStream* self) {
  delete self;
}

// Interface: PxDistanceJoint


float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDistanceJoint_getDistance_0(physx::PxDistanceJoint* self) {
  return self->getDistance();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDistanceJoint_setMinDistance_1(physx::PxDistanceJoint* self, float distance) {
  self->setMinDistance(distance);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDistanceJoint_getMinDistance_0(physx::PxDistanceJoint* self) {
  return self->getMinDistance();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDistanceJoint_setMaxDistance_1(physx::PxDistanceJoint* self, float distance) {
  self->setMaxDistance(distance);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDistanceJoint_getMaxDistance_0(physx::PxDistanceJoint* self) {
  return self->getMaxDistance();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDistanceJoint_setTolerance_1(physx::PxDistanceJoint* self, float tolerance) {
  self->setTolerance(tolerance);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDistanceJoint_getTolerance_0(physx::PxDistanceJoint* self) {
  return self->getTolerance();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDistanceJoint_setStiffness_1(physx::PxDistanceJoint* self, float stiffness) {
  self->setStiffness(stiffness);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDistanceJoint_getStiffness_0(physx::PxDistanceJoint* self) {
  return self->getStiffness();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDistanceJoint_setDamping_1(physx::PxDistanceJoint* self, float damping) {
  self->setDamping(damping);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDistanceJoint_getDamping_0(physx::PxDistanceJoint* self) {
  return self->getDamping();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDistanceJoint_setDistanceJointFlags_1(physx::PxDistanceJoint* self, physx::PxDistanceJointFlags* flags) {
  self->setDistanceJointFlags(*flags);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDistanceJoint_setDistanceJointFlag_2(physx::PxDistanceJoint* self, PxDistanceJointFlagEnum flag, bool value) {
  self->setDistanceJointFlag(flag, value);
}

physx::PxDistanceJointFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDistanceJoint_getDistanceJointFlags_0(physx::PxDistanceJoint* self) {
  static thread_local physx::PxDistanceJointFlags temp;
  return (temp = self->getDistanceJointFlags(), &temp);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDistanceJoint_release_0(physx::PxDistanceJoint* self) {
  self->release();
}

const char* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDistanceJoint_getConcreteTypeName_0(physx::PxDistanceJoint* self) {
  return self->getConcreteTypeName();
}

int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDistanceJoint_getConcreteType_0(physx::PxDistanceJoint* self) {
  return self->getConcreteType();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDistanceJoint_setBaseFlag_2(physx::PxDistanceJoint* self, PxBaseFlagEnum flag, bool value) {
  self->setBaseFlag(flag, value);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDistanceJoint_setBaseFlags_1(physx::PxDistanceJoint* self, physx::PxBaseFlags* inFlags) {
  self->setBaseFlags(*inFlags);
}

physx::PxBaseFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDistanceJoint_getBaseFlags_0(physx::PxDistanceJoint* self) {
  static thread_local physx::PxBaseFlags temp;
  return (temp = self->getBaseFlags(), &temp);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDistanceJoint_isReleasable_0(physx::PxDistanceJoint* self) {
  return self->isReleasable();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDistanceJoint_setActors_2(physx::PxDistanceJoint* self, physx::PxRigidActor* actor0, physx::PxRigidActor* actor1) {
  self->setActors(actor0, actor1);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDistanceJoint_setLocalPose_2(physx::PxDistanceJoint* self, PxJointActorIndexEnum actor, const physx::PxTransform* localPose) {
  self->setLocalPose(actor, *localPose);
}

physx::PxTransform* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDistanceJoint_getLocalPose_1(physx::PxDistanceJoint* self, PxJointActorIndexEnum actor) {
  static thread_local physx::PxTransform temp;
  return (temp = self->getLocalPose(actor), &temp);
}

physx::PxTransform* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDistanceJoint_getRelativeTransform_0(physx::PxDistanceJoint* self) {
  static thread_local physx::PxTransform temp;
  return (temp = self->getRelativeTransform(), &temp);
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDistanceJoint_getRelativeLinearVelocity_0(physx::PxDistanceJoint* self) {
  static thread_local physx::PxVec3 temp;
  return (temp = self->getRelativeLinearVelocity(), &temp);
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDistanceJoint_getRelativeAngularVelocity_0(physx::PxDistanceJoint* self) {
  static thread_local physx::PxVec3 temp;
  return (temp = self->getRelativeAngularVelocity(), &temp);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDistanceJoint_setBreakForce_2(physx::PxDistanceJoint* self, float force, float torque) {
  self->setBreakForce(force, torque);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDistanceJoint_setConstraintFlags_1(physx::PxDistanceJoint* self, physx::PxConstraintFlags* flags) {
  self->setConstraintFlags(*flags);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDistanceJoint_setConstraintFlag_2(physx::PxDistanceJoint* self, PxConstraintFlagEnum flag, bool value) {
  self->setConstraintFlag(flag, value);
}

physx::PxConstraintFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDistanceJoint_getConstraintFlags_0(physx::PxDistanceJoint* self) {
  static thread_local physx::PxConstraintFlags temp;
  return (temp = self->getConstraintFlags(), &temp);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDistanceJoint_setInvMassScale0_1(physx::PxDistanceJoint* self, float invMassScale) {
  self->setInvMassScale0(invMassScale);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDistanceJoint_getInvMassScale0_0(physx::PxDistanceJoint* self) {
  return self->getInvMassScale0();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDistanceJoint_setInvMassScale1_1(physx::PxDistanceJoint* self, float invMassScale) {
  self->setInvMassScale1(invMassScale);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDistanceJoint_getInvMassScale1_0(physx::PxDistanceJoint* self) {
  return self->getInvMassScale1();
}

physx::PxConstraint* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDistanceJoint_getConstraint_0(physx::PxDistanceJoint* self) {
  return self->getConstraint();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDistanceJoint_setName_1(physx::PxDistanceJoint* self, const char* name) {
  self->setName(name);
}

const char* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDistanceJoint_getName_0(physx::PxDistanceJoint* self) {
  return self->getName();
}

physx::PxScene* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDistanceJoint_getScene_0(physx::PxDistanceJoint* self) {
  return self->getScene();
}

void* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDistanceJoint_get_userData_0(physx::PxDistanceJoint* self) {
  return self->userData;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDistanceJoint_set_userData_1(physx::PxDistanceJoint* self, void* arg0) {
  self->userData = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDistanceJoint___destroy___0(physx::PxDistanceJoint* self) {
  delete self;
}

// Interface: PxDistanceJointFlags


physx::PxDistanceJointFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDistanceJointFlags_PxDistanceJointFlags_1(unsigned short flags) {
  return new physx::PxDistanceJointFlags(flags);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDistanceJointFlags_isSet_1(physx::PxDistanceJointFlags* self, PxDistanceJointFlagEnum flag) {
  return self->isSet(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDistanceJointFlags_raise_1(physx::PxDistanceJointFlags* self, PxDistanceJointFlagEnum flag) {
  self->raise(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDistanceJointFlags_clear_1(physx::PxDistanceJointFlags* self, PxDistanceJointFlagEnum flag) {
  self->clear(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDistanceJointFlags___destroy___0(physx::PxDistanceJointFlags* self) {
  delete self;
}

// Interface: PxDominanceGroupPair


physx::PxDominanceGroupPair* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDominanceGroupPair_PxDominanceGroupPair_2(unsigned char a, unsigned char b) {
  return new physx::PxDominanceGroupPair(a, b);
}

unsigned char EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDominanceGroupPair_get_dominance0_0(physx::PxDominanceGroupPair* self) {
  return self->dominance0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDominanceGroupPair_set_dominance0_1(physx::PxDominanceGroupPair* self, unsigned char arg0) {
  self->dominance0 = arg0;
}

unsigned char EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDominanceGroupPair_get_dominance1_0(physx::PxDominanceGroupPair* self) {
  return self->dominance1;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDominanceGroupPair_set_dominance1_1(physx::PxDominanceGroupPair* self, unsigned char arg0) {
  self->dominance1 = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxDominanceGroupPair___destroy___0(physx::PxDominanceGroupPair* self) {
  delete self;
}

// Interface: PxErrorCallbackImpl


PxErrorCallbackImpl* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxErrorCallbackImpl_PxErrorCallbackImpl_0() {
  return new PxErrorCallbackImpl();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxErrorCallbackImpl_reportError_4(PxErrorCallbackImpl* self, PxErrorCodeEnum code, const char* message, const char* file, int line) {
  self->reportError(code, message, file, line);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxErrorCallbackImpl___destroy___0(PxErrorCallbackImpl* self) {
  delete self;
}

// Interface: PxExtendedVec3


physx::PxExtendedVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxExtendedVec3_PxExtendedVec3_0() {
  return new physx::PxExtendedVec3();
}

physx::PxExtendedVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxExtendedVec3_PxExtendedVec3_3(double x, double y, double z) {
  return new physx::PxExtendedVec3(x, y, z);
}

double EMSCRIPTEN_KEEPALIVE emscripten_bind_PxExtendedVec3_get_x_0(physx::PxExtendedVec3* self) {
  return self->x;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxExtendedVec3_set_x_1(physx::PxExtendedVec3* self, double arg0) {
  self->x = arg0;
}

double EMSCRIPTEN_KEEPALIVE emscripten_bind_PxExtendedVec3_get_y_0(physx::PxExtendedVec3* self) {
  return self->y;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxExtendedVec3_set_y_1(physx::PxExtendedVec3* self, double arg0) {
  self->y = arg0;
}

double EMSCRIPTEN_KEEPALIVE emscripten_bind_PxExtendedVec3_get_z_0(physx::PxExtendedVec3* self) {
  return self->z;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxExtendedVec3_set_z_1(physx::PxExtendedVec3* self, double arg0) {
  self->z = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxExtendedVec3___destroy___0(physx::PxExtendedVec3* self) {
  delete self;
}

// Interface: PxExtensionTopLevelFunctions


physx::PxRigidStatic* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxExtensionTopLevelFunctions_CreatePlane_4(physx::PxPhysics* sdk, const physx::PxPlane* plane, physx::PxMaterial* material, const physx::PxFilterData* filterData) {
  return PxExtensionTopLevelFunctions::CreatePlane(*sdk, *plane, *material, *filterData);
}

// Interface: PxFilterData


physx::PxFilterData* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxFilterData_PxFilterData_0() {
  return new physx::PxFilterData();
}

physx::PxFilterData* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxFilterData_PxFilterData_4(unsigned int w0, unsigned int w1, unsigned int w2, unsigned int w3) {
  return new physx::PxFilterData(w0, w1, w2, w3);
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxFilterData_get_word0_0(physx::PxFilterData* self) {
  return self->word0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxFilterData_set_word0_1(physx::PxFilterData* self, unsigned int arg0) {
  self->word0 = arg0;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxFilterData_get_word1_0(physx::PxFilterData* self) {
  return self->word1;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxFilterData_set_word1_1(physx::PxFilterData* self, unsigned int arg0) {
  self->word1 = arg0;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxFilterData_get_word2_0(physx::PxFilterData* self) {
  return self->word2;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxFilterData_set_word2_1(physx::PxFilterData* self, unsigned int arg0) {
  self->word2 = arg0;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxFilterData_get_word3_0(physx::PxFilterData* self) {
  return self->word3;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxFilterData_set_word3_1(physx::PxFilterData* self, unsigned int arg0) {
  self->word3 = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxFilterData___destroy___0(physx::PxFilterData* self) {
  delete self;
}

// Interface: PxFixedJoint


void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxFixedJoint_release_0(physx::PxFixedJoint* self) {
  self->release();
}

const char* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxFixedJoint_getConcreteTypeName_0(physx::PxFixedJoint* self) {
  return self->getConcreteTypeName();
}

int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxFixedJoint_getConcreteType_0(physx::PxFixedJoint* self) {
  return self->getConcreteType();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxFixedJoint_setBaseFlag_2(physx::PxFixedJoint* self, PxBaseFlagEnum flag, bool value) {
  self->setBaseFlag(flag, value);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxFixedJoint_setBaseFlags_1(physx::PxFixedJoint* self, physx::PxBaseFlags* inFlags) {
  self->setBaseFlags(*inFlags);
}

physx::PxBaseFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxFixedJoint_getBaseFlags_0(physx::PxFixedJoint* self) {
  static thread_local physx::PxBaseFlags temp;
  return (temp = self->getBaseFlags(), &temp);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxFixedJoint_isReleasable_0(physx::PxFixedJoint* self) {
  return self->isReleasable();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxFixedJoint_setActors_2(physx::PxFixedJoint* self, physx::PxRigidActor* actor0, physx::PxRigidActor* actor1) {
  self->setActors(actor0, actor1);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxFixedJoint_setLocalPose_2(physx::PxFixedJoint* self, PxJointActorIndexEnum actor, const physx::PxTransform* localPose) {
  self->setLocalPose(actor, *localPose);
}

physx::PxTransform* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxFixedJoint_getLocalPose_1(physx::PxFixedJoint* self, PxJointActorIndexEnum actor) {
  static thread_local physx::PxTransform temp;
  return (temp = self->getLocalPose(actor), &temp);
}

physx::PxTransform* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxFixedJoint_getRelativeTransform_0(physx::PxFixedJoint* self) {
  static thread_local physx::PxTransform temp;
  return (temp = self->getRelativeTransform(), &temp);
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxFixedJoint_getRelativeLinearVelocity_0(physx::PxFixedJoint* self) {
  static thread_local physx::PxVec3 temp;
  return (temp = self->getRelativeLinearVelocity(), &temp);
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxFixedJoint_getRelativeAngularVelocity_0(physx::PxFixedJoint* self) {
  static thread_local physx::PxVec3 temp;
  return (temp = self->getRelativeAngularVelocity(), &temp);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxFixedJoint_setBreakForce_2(physx::PxFixedJoint* self, float force, float torque) {
  self->setBreakForce(force, torque);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxFixedJoint_setConstraintFlags_1(physx::PxFixedJoint* self, physx::PxConstraintFlags* flags) {
  self->setConstraintFlags(*flags);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxFixedJoint_setConstraintFlag_2(physx::PxFixedJoint* self, PxConstraintFlagEnum flag, bool value) {
  self->setConstraintFlag(flag, value);
}

physx::PxConstraintFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxFixedJoint_getConstraintFlags_0(physx::PxFixedJoint* self) {
  static thread_local physx::PxConstraintFlags temp;
  return (temp = self->getConstraintFlags(), &temp);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxFixedJoint_setInvMassScale0_1(physx::PxFixedJoint* self, float invMassScale) {
  self->setInvMassScale0(invMassScale);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxFixedJoint_getInvMassScale0_0(physx::PxFixedJoint* self) {
  return self->getInvMassScale0();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxFixedJoint_setInvMassScale1_1(physx::PxFixedJoint* self, float invMassScale) {
  self->setInvMassScale1(invMassScale);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxFixedJoint_getInvMassScale1_0(physx::PxFixedJoint* self) {
  return self->getInvMassScale1();
}

physx::PxConstraint* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxFixedJoint_getConstraint_0(physx::PxFixedJoint* self) {
  return self->getConstraint();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxFixedJoint_setName_1(physx::PxFixedJoint* self, const char* name) {
  self->setName(name);
}

const char* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxFixedJoint_getName_0(physx::PxFixedJoint* self) {
  return self->getName();
}

physx::PxScene* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxFixedJoint_getScene_0(physx::PxFixedJoint* self) {
  return self->getScene();
}

void* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxFixedJoint_get_userData_0(physx::PxFixedJoint* self) {
  return self->userData;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxFixedJoint_set_userData_1(physx::PxFixedJoint* self, void* arg0) {
  self->userData = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxFixedJoint___destroy___0(physx::PxFixedJoint* self) {
  delete self;
}

// Interface: PxFoundation


void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxFoundation_release_0(physx::PxFoundation* self) {
  self->release();
}

// Interface: PxGearJoint


bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGearJoint_setHinges_2(physx::PxGearJoint* self, const physx::PxBase* hinge0, const physx::PxBase* hinge1) {
  return self->setHinges(hinge0, hinge1);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGearJoint_setGearRatio_1(physx::PxGearJoint* self, float ratio) {
  self->setGearRatio(ratio);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGearJoint_getGearRatio_0(physx::PxGearJoint* self) {
  return self->getGearRatio();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGearJoint_release_0(physx::PxGearJoint* self) {
  self->release();
}

const char* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGearJoint_getConcreteTypeName_0(physx::PxGearJoint* self) {
  return self->getConcreteTypeName();
}

int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGearJoint_getConcreteType_0(physx::PxGearJoint* self) {
  return self->getConcreteType();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGearJoint_setBaseFlag_2(physx::PxGearJoint* self, PxBaseFlagEnum flag, bool value) {
  self->setBaseFlag(flag, value);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGearJoint_setBaseFlags_1(physx::PxGearJoint* self, physx::PxBaseFlags* inFlags) {
  self->setBaseFlags(*inFlags);
}

physx::PxBaseFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGearJoint_getBaseFlags_0(physx::PxGearJoint* self) {
  static thread_local physx::PxBaseFlags temp;
  return (temp = self->getBaseFlags(), &temp);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGearJoint_isReleasable_0(physx::PxGearJoint* self) {
  return self->isReleasable();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGearJoint_setActors_2(physx::PxGearJoint* self, physx::PxRigidActor* actor0, physx::PxRigidActor* actor1) {
  self->setActors(actor0, actor1);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGearJoint_setLocalPose_2(physx::PxGearJoint* self, PxJointActorIndexEnum actor, const physx::PxTransform* localPose) {
  self->setLocalPose(actor, *localPose);
}

physx::PxTransform* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGearJoint_getLocalPose_1(physx::PxGearJoint* self, PxJointActorIndexEnum actor) {
  static thread_local physx::PxTransform temp;
  return (temp = self->getLocalPose(actor), &temp);
}

physx::PxTransform* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGearJoint_getRelativeTransform_0(physx::PxGearJoint* self) {
  static thread_local physx::PxTransform temp;
  return (temp = self->getRelativeTransform(), &temp);
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGearJoint_getRelativeLinearVelocity_0(physx::PxGearJoint* self) {
  static thread_local physx::PxVec3 temp;
  return (temp = self->getRelativeLinearVelocity(), &temp);
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGearJoint_getRelativeAngularVelocity_0(physx::PxGearJoint* self) {
  static thread_local physx::PxVec3 temp;
  return (temp = self->getRelativeAngularVelocity(), &temp);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGearJoint_setBreakForce_2(physx::PxGearJoint* self, float force, float torque) {
  self->setBreakForce(force, torque);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGearJoint_setConstraintFlags_1(physx::PxGearJoint* self, physx::PxConstraintFlags* flags) {
  self->setConstraintFlags(*flags);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGearJoint_setConstraintFlag_2(physx::PxGearJoint* self, PxConstraintFlagEnum flag, bool value) {
  self->setConstraintFlag(flag, value);
}

physx::PxConstraintFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGearJoint_getConstraintFlags_0(physx::PxGearJoint* self) {
  static thread_local physx::PxConstraintFlags temp;
  return (temp = self->getConstraintFlags(), &temp);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGearJoint_setInvMassScale0_1(physx::PxGearJoint* self, float invMassScale) {
  self->setInvMassScale0(invMassScale);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGearJoint_getInvMassScale0_0(physx::PxGearJoint* self) {
  return self->getInvMassScale0();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGearJoint_setInvMassScale1_1(physx::PxGearJoint* self, float invMassScale) {
  self->setInvMassScale1(invMassScale);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGearJoint_getInvMassScale1_0(physx::PxGearJoint* self) {
  return self->getInvMassScale1();
}

physx::PxConstraint* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGearJoint_getConstraint_0(physx::PxGearJoint* self) {
  return self->getConstraint();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGearJoint_setName_1(physx::PxGearJoint* self, const char* name) {
  self->setName(name);
}

const char* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGearJoint_getName_0(physx::PxGearJoint* self) {
  return self->getName();
}

physx::PxScene* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGearJoint_getScene_0(physx::PxGearJoint* self) {
  return self->getScene();
}

void* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGearJoint_get_userData_0(physx::PxGearJoint* self) {
  return self->userData;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGearJoint_set_userData_1(physx::PxGearJoint* self, void* arg0) {
  self->userData = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGearJoint___destroy___0(physx::PxGearJoint* self) {
  delete self;
}

// Interface: PxGeometryHolder


physx::PxGeometryHolder* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGeometryHolder_PxGeometryHolder_0() {
  return new physx::PxGeometryHolder();
}

physx::PxGeometryHolder* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGeometryHolder_PxGeometryHolder_1(const physx::PxGeometry* geometry) {
  return new physx::PxGeometryHolder(*geometry);
}

PxGeometryTypeEnum EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGeometryHolder_getType_0(physx::PxGeometryHolder* self) {
  return self->getType();
}

physx::PxSphereGeometry* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGeometryHolder_sphere_0(physx::PxGeometryHolder* self) {
  return &self->sphere();
}

physx::PxPlaneGeometry* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGeometryHolder_plane_0(physx::PxGeometryHolder* self) {
  return &self->plane();
}

physx::PxCapsuleGeometry* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGeometryHolder_capsule_0(physx::PxGeometryHolder* self) {
  return &self->capsule();
}

physx::PxBoxGeometry* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGeometryHolder_box_0(physx::PxGeometryHolder* self) {
  return &self->box();
}

physx::PxConvexMeshGeometry* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGeometryHolder_convexMesh_0(physx::PxGeometryHolder* self) {
  return &self->convexMesh();
}

physx::PxTriangleMeshGeometry* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGeometryHolder_triangleMesh_0(physx::PxGeometryHolder* self) {
  return &self->triangleMesh();
}

physx::PxHeightFieldGeometry* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGeometryHolder_heightField_0(physx::PxGeometryHolder* self) {
  return &self->heightField();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGeometryHolder_storeAny_1(physx::PxGeometryHolder* self, const physx::PxGeometry* geometry) {
  self->storeAny(*geometry);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGeometryHolder___destroy___0(physx::PxGeometryHolder* self) {
  delete self;
}

// Interface: PxGeometryQuery


bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGeometryQuery_sweep_7(const physx::PxVec3* unitDir, float maxDist, const physx::PxGeometry* geom0, const physx::PxTransform* pose0, const physx::PxGeometry* geom1, const physx::PxTransform* pose1, physx::PxSweepHit* sweepHit) {
  return physx::PxGeometryQuery::sweep(*unitDir, maxDist, *geom0, *pose0, *geom1, *pose1, *sweepHit);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGeometryQuery_sweep_8(const physx::PxVec3* unitDir, float maxDist, const physx::PxGeometry* geom0, const physx::PxTransform* pose0, const physx::PxGeometry* geom1, const physx::PxTransform* pose1, physx::PxSweepHit* sweepHit, physx::PxHitFlags* hitFlags) {
  return physx::PxGeometryQuery::sweep(*unitDir, maxDist, *geom0, *pose0, *geom1, *pose1, *sweepHit, *hitFlags);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGeometryQuery_sweep_9(const physx::PxVec3* unitDir, float maxDist, const physx::PxGeometry* geom0, const physx::PxTransform* pose0, const physx::PxGeometry* geom1, const physx::PxTransform* pose1, physx::PxSweepHit* sweepHit, physx::PxHitFlags* hitFlags, float inflation) {
  return physx::PxGeometryQuery::sweep(*unitDir, maxDist, *geom0, *pose0, *geom1, *pose1, *sweepHit, *hitFlags, inflation);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGeometryQuery_overlap_4(const physx::PxGeometry* geom0, const physx::PxTransform* pose0, const physx::PxGeometry* geom1, const physx::PxTransform* pose1) {
  return physx::PxGeometryQuery::overlap(*geom0, *pose0, *geom1, *pose1);
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGeometryQuery_raycast_8(const physx::PxVec3* origin, const physx::PxVec3* unitDir, const physx::PxGeometry* geom, const physx::PxTransform* pose, float maxDist, physx::PxHitFlags* hitFlags, unsigned int maxHits, physx::PxRaycastHit* rayHits) {
  return physx::PxGeometryQuery::raycast(*origin, *unitDir, *geom, *pose, maxDist, *hitFlags, maxHits, rayHits);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGeometryQuery_pointDistance_3(const physx::PxVec3* point, const physx::PxGeometry* geom, const physx::PxTransform* pose) {
  return physx::PxGeometryQuery::pointDistance(*point, *geom, *pose);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGeometryQuery_pointDistance_4(const physx::PxVec3* point, const physx::PxGeometry* geom, const physx::PxTransform* pose, physx::PxVec3* closestPoint) {
  return physx::PxGeometryQuery::pointDistance(*point, *geom, *pose, closestPoint);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGeometryQuery_computeGeomBounds_3(physx::PxBounds3* bounds, const physx::PxGeometry* geom, const physx::PxTransform* pose) {
  physx::PxGeometryQuery::computeGeomBounds(*bounds, *geom, *pose);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGeometryQuery_computeGeomBounds_4(physx::PxBounds3* bounds, const physx::PxGeometry* geom, const physx::PxTransform* pose, float inflation) {
  physx::PxGeometryQuery::computeGeomBounds(*bounds, *geom, *pose, inflation);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGeometryQuery_isValid_1(const physx::PxGeometry* geom) {
  return physx::PxGeometryQuery::isValid(*geom);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGeometryQuery___destroy___0(physx::PxGeometryQuery* self) {
  delete self;
}

// Interface: PxGjkQuery


bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGjkQuery_proximityInfo_7(const physx::PxGjkQuery::Support* a, const physx::PxGjkQuery::Support* b, const physx::PxTransform* poseA, const physx::PxTransform* poseB, float contactDistance, float toleranceLength, PxGjkQueryProximityInfoResult* result) {
  return PxGjkQuery::proximityInfo(*a, *b, *poseA, *poseB, contactDistance, toleranceLength, *result);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGjkQuery_raycast_6(const physx::PxGjkQuery::Support* shape, const physx::PxTransform* pose, const physx::PxVec3* rayStart, const physx::PxVec3* unitDir, float maxDist, PxGjkQueryRaycastResult* result) {
  return PxGjkQuery::raycast(*shape, *pose, *rayStart, *unitDir, maxDist, *result);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGjkQuery_overlap_4(const physx::PxGjkQuery::Support* a, const physx::PxGjkQuery::Support* b, const physx::PxTransform* poseA, const physx::PxTransform* poseB) {
  return PxGjkQuery::overlap(*a, *b, *poseA, *poseB);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGjkQuery_sweep_7(const physx::PxGjkQuery::Support* a, const physx::PxGjkQuery::Support* b, const physx::PxTransform* poseA, const physx::PxTransform* poseB, const physx::PxVec3* unitDir, float maxDist, PxGjkQuerySweepResult* result) {
  return PxGjkQuery::sweep(*a, *b, *poseA, *poseB, *unitDir, maxDist, *result);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGjkQuery___destroy___0(PxGjkQuery* self) {
  delete self;
}

// Interface: PxGjkQueryExt


bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGjkQueryExt_generateContacts_7(const physx::PxGjkQuery::Support* a, const physx::PxGjkQuery::Support* b, const physx::PxTransform* poseA, const physx::PxTransform* poseB, float contactDistance, float toleranceLength, physx::PxContactBuffer* contactBuffer) {
  return physx::PxGjkQueryExt::generateContacts(*a, *b, *poseA, *poseB, contactDistance, toleranceLength, *contactBuffer);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGjkQueryExt___destroy___0(physx::PxGjkQueryExt* self) {
  delete self;
}

// Interface: PxGjkQueryProximityInfoResult


PxGjkQueryProximityInfoResult* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGjkQueryProximityInfoResult_PxGjkQueryProximityInfoResult_0() {
  return new PxGjkQueryProximityInfoResult();
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGjkQueryProximityInfoResult_get_success_0(PxGjkQueryProximityInfoResult* self) {
  return self->success;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGjkQueryProximityInfoResult_set_success_1(PxGjkQueryProximityInfoResult* self, bool arg0) {
  self->success = arg0;
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGjkQueryProximityInfoResult_get_pointA_0(PxGjkQueryProximityInfoResult* self) {
  return &self->pointA;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGjkQueryProximityInfoResult_set_pointA_1(PxGjkQueryProximityInfoResult* self, physx::PxVec3* arg0) {
  self->pointA = *arg0;
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGjkQueryProximityInfoResult_get_pointB_0(PxGjkQueryProximityInfoResult* self) {
  return &self->pointB;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGjkQueryProximityInfoResult_set_pointB_1(PxGjkQueryProximityInfoResult* self, physx::PxVec3* arg0) {
  self->pointB = *arg0;
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGjkQueryProximityInfoResult_get_separatingAxis_0(PxGjkQueryProximityInfoResult* self) {
  return &self->separatingAxis;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGjkQueryProximityInfoResult_set_separatingAxis_1(PxGjkQueryProximityInfoResult* self, physx::PxVec3* arg0) {
  self->separatingAxis = *arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGjkQueryProximityInfoResult_get_separation_0(PxGjkQueryProximityInfoResult* self) {
  return self->separation;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGjkQueryProximityInfoResult_set_separation_1(PxGjkQueryProximityInfoResult* self, float arg0) {
  self->separation = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGjkQueryProximityInfoResult___destroy___0(PxGjkQueryProximityInfoResult* self) {
  delete self;
}

// Interface: PxGjkQueryRaycastResult


PxGjkQueryRaycastResult* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGjkQueryRaycastResult_PxGjkQueryRaycastResult_0() {
  return new PxGjkQueryRaycastResult();
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGjkQueryRaycastResult_get_success_0(PxGjkQueryRaycastResult* self) {
  return self->success;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGjkQueryRaycastResult_set_success_1(PxGjkQueryRaycastResult* self, bool arg0) {
  self->success = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGjkQueryRaycastResult_get_t_0(PxGjkQueryRaycastResult* self) {
  return self->t;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGjkQueryRaycastResult_set_t_1(PxGjkQueryRaycastResult* self, float arg0) {
  self->t = arg0;
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGjkQueryRaycastResult_get_n_0(PxGjkQueryRaycastResult* self) {
  return &self->n;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGjkQueryRaycastResult_set_n_1(PxGjkQueryRaycastResult* self, physx::PxVec3* arg0) {
  self->n = *arg0;
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGjkQueryRaycastResult_get_p_0(PxGjkQueryRaycastResult* self) {
  return &self->p;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGjkQueryRaycastResult_set_p_1(PxGjkQueryRaycastResult* self, physx::PxVec3* arg0) {
  self->p = *arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGjkQueryRaycastResult___destroy___0(PxGjkQueryRaycastResult* self) {
  delete self;
}

// Interface: PxGjkQuerySweepResult


PxGjkQuerySweepResult* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGjkQuerySweepResult_PxGjkQuerySweepResult_0() {
  return new PxGjkQuerySweepResult();
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGjkQuerySweepResult_get_success_0(PxGjkQuerySweepResult* self) {
  return self->success;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGjkQuerySweepResult_set_success_1(PxGjkQuerySweepResult* self, bool arg0) {
  self->success = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGjkQuerySweepResult_get_t_0(PxGjkQuerySweepResult* self) {
  return self->t;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGjkQuerySweepResult_set_t_1(PxGjkQuerySweepResult* self, float arg0) {
  self->t = arg0;
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGjkQuerySweepResult_get_n_0(PxGjkQuerySweepResult* self) {
  return &self->n;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGjkQuerySweepResult_set_n_1(PxGjkQuerySweepResult* self, physx::PxVec3* arg0) {
  self->n = *arg0;
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGjkQuerySweepResult_get_p_0(PxGjkQuerySweepResult* self) {
  return &self->p;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGjkQuerySweepResult_set_p_1(PxGjkQuerySweepResult* self, physx::PxVec3* arg0) {
  self->p = *arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxGjkQuerySweepResult___destroy___0(PxGjkQuerySweepResult* self) {
  delete self;
}

// Interface: PxHeightField


unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxHeightField_saveCells_2(physx::PxHeightField* self, void* destBuffer, unsigned int destBufferSize) {
  return self->saveCells(destBuffer, destBufferSize);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxHeightField_modifySamples_3(physx::PxHeightField* self, int startCol, int startRow, const physx::PxHeightFieldDesc* subfieldDesc) {
  return self->modifySamples(startCol, startRow, *subfieldDesc);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxHeightField_modifySamples_4(physx::PxHeightField* self, int startCol, int startRow, const physx::PxHeightFieldDesc* subfieldDesc, bool shrinkBounds) {
  return self->modifySamples(startCol, startRow, *subfieldDesc, shrinkBounds);
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxHeightField_getNbRows_0(physx::PxHeightField* self) {
  return self->getNbRows();
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxHeightField_getNbColumns_0(physx::PxHeightField* self) {
  return self->getNbColumns();
}

PxHeightFieldFormatEnum EMSCRIPTEN_KEEPALIVE emscripten_bind_PxHeightField_getFormat_0(physx::PxHeightField* self) {
  return self->getFormat();
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxHeightField_getSampleStride_0(physx::PxHeightField* self) {
  return self->getSampleStride();
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxHeightField_getConvexEdgeThreshold_0(physx::PxHeightField* self) {
  return self->getConvexEdgeThreshold();
}

physx::PxHeightFieldFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxHeightField_getFlags_0(physx::PxHeightField* self) {
  static thread_local physx::PxHeightFieldFlags temp;
  return (temp = self->getFlags(), &temp);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxHeightField_getHeight_2(physx::PxHeightField* self, float x, float z) {
  return self->getHeight(x, z);
}

unsigned short EMSCRIPTEN_KEEPALIVE emscripten_bind_PxHeightField_getTriangleMaterialIndex_1(physx::PxHeightField* self, unsigned int triangleIndex) {
  return self->getTriangleMaterialIndex(triangleIndex);
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxHeightField_getTriangleNormal_1(physx::PxHeightField* self, unsigned int triangleIndex) {
  static thread_local physx::PxVec3 temp;
  return (temp = self->getTriangleNormal(triangleIndex), &temp);
}

const physx::PxHeightFieldSample* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxHeightField_getSample_2(physx::PxHeightField* self, unsigned int row, unsigned int column) {
  return &self->getSample(row, column);
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxHeightField_getTimestamp_0(physx::PxHeightField* self) {
  return self->getTimestamp();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxHeightField_release_0(physx::PxHeightField* self) {
  self->release();
}

const char* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxHeightField_getConcreteTypeName_0(physx::PxHeightField* self) {
  return self->getConcreteTypeName();
}

int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxHeightField_getConcreteType_0(physx::PxHeightField* self) {
  return self->getConcreteType();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxHeightField_setBaseFlag_2(physx::PxHeightField* self, PxBaseFlagEnum flag, bool value) {
  self->setBaseFlag(flag, value);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxHeightField_setBaseFlags_1(physx::PxHeightField* self, physx::PxBaseFlags* inFlags) {
  self->setBaseFlags(*inFlags);
}

physx::PxBaseFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxHeightField_getBaseFlags_0(physx::PxHeightField* self) {
  static thread_local physx::PxBaseFlags temp;
  return (temp = self->getBaseFlags(), &temp);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxHeightField_isReleasable_0(physx::PxHeightField* self) {
  return self->isReleasable();
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxHeightField_getReferenceCount_0(physx::PxHeightField* self) {
  return self->getReferenceCount();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxHeightField_acquireReference_0(physx::PxHeightField* self) {
  self->acquireReference();
}

// Interface: PxHeightFieldDesc


physx::PxHeightFieldDesc* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxHeightFieldDesc_PxHeightFieldDesc_0() {
  return new physx::PxHeightFieldDesc();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxHeightFieldDesc_setToDefault_0(physx::PxHeightFieldDesc* self) {
  self->setToDefault();
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxHeightFieldDesc_isValid_0(physx::PxHeightFieldDesc* self) {
  return self->isValid();
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxHeightFieldDesc_get_nbRows_0(physx::PxHeightFieldDesc* self) {
  return self->nbRows;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxHeightFieldDesc_set_nbRows_1(physx::PxHeightFieldDesc* self, unsigned int arg0) {
  self->nbRows = arg0;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxHeightFieldDesc_get_nbColumns_0(physx::PxHeightFieldDesc* self) {
  return self->nbColumns;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxHeightFieldDesc_set_nbColumns_1(physx::PxHeightFieldDesc* self, unsigned int arg0) {
  self->nbColumns = arg0;
}

PxHeightFieldFormatEnum EMSCRIPTEN_KEEPALIVE emscripten_bind_PxHeightFieldDesc_get_format_0(physx::PxHeightFieldDesc* self) {
  return self->format;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxHeightFieldDesc_set_format_1(physx::PxHeightFieldDesc* self, PxHeightFieldFormatEnum arg0) {
  self->format = arg0;
}

physx::PxStridedData* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxHeightFieldDesc_get_samples_0(physx::PxHeightFieldDesc* self) {
  return &self->samples;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxHeightFieldDesc_set_samples_1(physx::PxHeightFieldDesc* self, physx::PxStridedData* arg0) {
  self->samples = *arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxHeightFieldDesc_get_convexEdgeThreshold_0(physx::PxHeightFieldDesc* self) {
  return self->convexEdgeThreshold;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxHeightFieldDesc_set_convexEdgeThreshold_1(physx::PxHeightFieldDesc* self, float arg0) {
  self->convexEdgeThreshold = arg0;
}

physx::PxHeightFieldFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxHeightFieldDesc_get_flags_0(physx::PxHeightFieldDesc* self) {
  return &self->flags;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxHeightFieldDesc_set_flags_1(physx::PxHeightFieldDesc* self, physx::PxHeightFieldFlags* arg0) {
  self->flags = *arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxHeightFieldDesc___destroy___0(physx::PxHeightFieldDesc* self) {
  delete self;
}

// Interface: PxHeightFieldFlags


physx::PxHeightFieldFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxHeightFieldFlags_PxHeightFieldFlags_1(unsigned short flags) {
  return new physx::PxHeightFieldFlags(flags);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxHeightFieldFlags_isSet_1(physx::PxHeightFieldFlags* self, PxHeightFieldFlagEnum flag) {
  return self->isSet(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxHeightFieldFlags_raise_1(physx::PxHeightFieldFlags* self, PxHeightFieldFlagEnum flag) {
  self->raise(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxHeightFieldFlags_clear_1(physx::PxHeightFieldFlags* self, PxHeightFieldFlagEnum flag) {
  self->clear(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxHeightFieldFlags___destroy___0(physx::PxHeightFieldFlags* self) {
  delete self;
}

// Interface: PxHeightFieldGeometry


physx::PxHeightFieldGeometry* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxHeightFieldGeometry_PxHeightFieldGeometry_0() {
  return new physx::PxHeightFieldGeometry();
}

physx::PxHeightFieldGeometry* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxHeightFieldGeometry_PxHeightFieldGeometry_5(physx::PxHeightField* hf, physx::PxMeshGeometryFlags* flags, float heightScale, float rowScale, float columnScale) {
  return new physx::PxHeightFieldGeometry(hf, *flags, heightScale, rowScale, columnScale);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxHeightFieldGeometry_isValid_0(physx::PxHeightFieldGeometry* self) {
  return self->isValid();
}

PxGeometryTypeEnum EMSCRIPTEN_KEEPALIVE emscripten_bind_PxHeightFieldGeometry_getType_0(physx::PxHeightFieldGeometry* self) {
  return self->getType();
}

physx::PxHeightField* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxHeightFieldGeometry_get_heightField_0(physx::PxHeightFieldGeometry* self) {
  return self->heightField;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxHeightFieldGeometry_set_heightField_1(physx::PxHeightFieldGeometry* self, physx::PxHeightField* arg0) {
  self->heightField = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxHeightFieldGeometry_get_heightScale_0(physx::PxHeightFieldGeometry* self) {
  return self->heightScale;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxHeightFieldGeometry_set_heightScale_1(physx::PxHeightFieldGeometry* self, float arg0) {
  self->heightScale = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxHeightFieldGeometry_get_rowScale_0(physx::PxHeightFieldGeometry* self) {
  return self->rowScale;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxHeightFieldGeometry_set_rowScale_1(physx::PxHeightFieldGeometry* self, float arg0) {
  self->rowScale = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxHeightFieldGeometry_get_columnScale_0(physx::PxHeightFieldGeometry* self) {
  return self->columnScale;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxHeightFieldGeometry_set_columnScale_1(physx::PxHeightFieldGeometry* self, float arg0) {
  self->columnScale = arg0;
}

physx::PxMeshGeometryFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxHeightFieldGeometry_get_heightFieldFlags_0(physx::PxHeightFieldGeometry* self) {
  return &self->heightFieldFlags;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxHeightFieldGeometry_set_heightFieldFlags_1(physx::PxHeightFieldGeometry* self, physx::PxMeshGeometryFlags* arg0) {
  self->heightFieldFlags = *arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxHeightFieldGeometry___destroy___0(physx::PxHeightFieldGeometry* self) {
  delete self;
}

// Interface: PxHeightFieldSample


physx::PxHeightFieldSample* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxHeightFieldSample_PxHeightFieldSample_0() {
  return new physx::PxHeightFieldSample();
}

unsigned char EMSCRIPTEN_KEEPALIVE emscripten_bind_PxHeightFieldSample_tessFlag_0(physx::PxHeightFieldSample* self) {
  return self->tessFlag();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxHeightFieldSample_clearTessFlag_0(physx::PxHeightFieldSample* self) {
  self->clearTessFlag();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxHeightFieldSample_setTessFlag_0(physx::PxHeightFieldSample* self) {
  self->setTessFlag();
}

short EMSCRIPTEN_KEEPALIVE emscripten_bind_PxHeightFieldSample_get_height_0(physx::PxHeightFieldSample* self) {
  return self->height;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxHeightFieldSample_set_height_1(physx::PxHeightFieldSample* self, short arg0) {
  self->height = arg0;
}

unsigned char EMSCRIPTEN_KEEPALIVE emscripten_bind_PxHeightFieldSample_get_materialIndex0_0(physx::PxHeightFieldSample* self) {
  return self->materialIndex0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxHeightFieldSample_set_materialIndex0_1(physx::PxHeightFieldSample* self, unsigned char arg0) {
  self->materialIndex0 = arg0;
}

unsigned char EMSCRIPTEN_KEEPALIVE emscripten_bind_PxHeightFieldSample_get_materialIndex1_0(physx::PxHeightFieldSample* self) {
  return self->materialIndex1;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxHeightFieldSample_set_materialIndex1_1(physx::PxHeightFieldSample* self, unsigned char arg0) {
  self->materialIndex1 = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxHeightFieldSample___destroy___0(physx::PxHeightFieldSample* self) {
  delete self;
}

// Interface: PxHitFlags


physx::PxHitFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxHitFlags_PxHitFlags_1(unsigned short flags) {
  return new physx::PxHitFlags(flags);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxHitFlags_isSet_1(physx::PxHitFlags* self, PxHitFlagEnum flag) {
  return self->isSet(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxHitFlags_raise_1(physx::PxHitFlags* self, PxHitFlagEnum flag) {
  self->raise(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxHitFlags_clear_1(physx::PxHitFlags* self, PxHitFlagEnum flag) {
  self->clear(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxHitFlags___destroy___0(physx::PxHitFlags* self) {
  delete self;
}

// Interface: PxHullPolygon


physx::PxHullPolygon* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxHullPolygon_PxHullPolygon_0() {
  return new physx::PxHullPolygon();
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxHullPolygon_get_mPlane_1(physx::PxHullPolygon* self, int arg0) {
  return self->mPlane[arg0];
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxHullPolygon_set_mPlane_2(physx::PxHullPolygon* self, int arg0, float arg1) {
  self->mPlane[arg0] = arg1;
}

short EMSCRIPTEN_KEEPALIVE emscripten_bind_PxHullPolygon_get_mNbVerts_0(physx::PxHullPolygon* self) {
  return self->mNbVerts;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxHullPolygon_set_mNbVerts_1(physx::PxHullPolygon* self, short arg0) {
  self->mNbVerts = arg0;
}

short EMSCRIPTEN_KEEPALIVE emscripten_bind_PxHullPolygon_get_mIndexBase_0(physx::PxHullPolygon* self) {
  return self->mIndexBase;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxHullPolygon_set_mIndexBase_1(physx::PxHullPolygon* self, short arg0) {
  self->mIndexBase = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxHullPolygon___destroy___0(physx::PxHullPolygon* self) {
  delete self;
}

// Interface: PxI32Ptr


void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxI32Ptr___destroy___0(PxI32Ptr* self) {
  delete self;
}

// Interface: PxInsertionCallback


// Interface: PxJointAngularLimitPair


physx::PxJointAngularLimitPair* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointAngularLimitPair_PxJointAngularLimitPair_2(float lowerLimit, float upperLimit) {
  return new physx::PxJointAngularLimitPair(lowerLimit, upperLimit);
}

physx::PxJointAngularLimitPair* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointAngularLimitPair_PxJointAngularLimitPair_3(float lowerLimit, float upperLimit, const physx::PxSpring* spring) {
  return new physx::PxJointAngularLimitPair(lowerLimit, upperLimit, *spring);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointAngularLimitPair_isValid_0(physx::PxJointAngularLimitPair* self) {
  return self->isValid();
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointAngularLimitPair_isSoft_0(physx::PxJointAngularLimitPair* self) {
  return self->isSoft();
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointAngularLimitPair_get_upper_0(physx::PxJointAngularLimitPair* self) {
  return self->upper;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointAngularLimitPair_set_upper_1(physx::PxJointAngularLimitPair* self, float arg0) {
  self->upper = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointAngularLimitPair_get_lower_0(physx::PxJointAngularLimitPair* self) {
  return self->lower;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointAngularLimitPair_set_lower_1(physx::PxJointAngularLimitPair* self, float arg0) {
  self->lower = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointAngularLimitPair_get_restitution_0(physx::PxJointAngularLimitPair* self) {
  return self->restitution;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointAngularLimitPair_set_restitution_1(physx::PxJointAngularLimitPair* self, float arg0) {
  self->restitution = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointAngularLimitPair_get_bounceThreshold_0(physx::PxJointAngularLimitPair* self) {
  return self->bounceThreshold;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointAngularLimitPair_set_bounceThreshold_1(physx::PxJointAngularLimitPair* self, float arg0) {
  self->bounceThreshold = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointAngularLimitPair_get_stiffness_0(physx::PxJointAngularLimitPair* self) {
  return self->stiffness;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointAngularLimitPair_set_stiffness_1(physx::PxJointAngularLimitPair* self, float arg0) {
  self->stiffness = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointAngularLimitPair_get_damping_0(physx::PxJointAngularLimitPair* self) {
  return self->damping;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointAngularLimitPair_set_damping_1(physx::PxJointAngularLimitPair* self, float arg0) {
  self->damping = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointAngularLimitPair___destroy___0(physx::PxJointAngularLimitPair* self) {
  delete self;
}

// Interface: PxJointLimitCone


physx::PxJointLimitCone* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointLimitCone_PxJointLimitCone_2(float yLimitAngle, float zLimitAngle) {
  return new physx::PxJointLimitCone(yLimitAngle, zLimitAngle);
}

physx::PxJointLimitCone* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointLimitCone_PxJointLimitCone_3(float yLimitAngle, float zLimitAngle, const physx::PxSpring* spring) {
  return new physx::PxJointLimitCone(yLimitAngle, zLimitAngle, *spring);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointLimitCone_isValid_0(physx::PxJointLimitCone* self) {
  return self->isValid();
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointLimitCone_isSoft_0(physx::PxJointLimitCone* self) {
  return self->isSoft();
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointLimitCone_get_yAngle_0(physx::PxJointLimitCone* self) {
  return self->yAngle;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointLimitCone_set_yAngle_1(physx::PxJointLimitCone* self, float arg0) {
  self->yAngle = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointLimitCone_get_zAngle_0(physx::PxJointLimitCone* self) {
  return self->zAngle;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointLimitCone_set_zAngle_1(physx::PxJointLimitCone* self, float arg0) {
  self->zAngle = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointLimitCone_get_restitution_0(physx::PxJointLimitCone* self) {
  return self->restitution;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointLimitCone_set_restitution_1(physx::PxJointLimitCone* self, float arg0) {
  self->restitution = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointLimitCone_get_bounceThreshold_0(physx::PxJointLimitCone* self) {
  return self->bounceThreshold;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointLimitCone_set_bounceThreshold_1(physx::PxJointLimitCone* self, float arg0) {
  self->bounceThreshold = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointLimitCone_get_stiffness_0(physx::PxJointLimitCone* self) {
  return self->stiffness;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointLimitCone_set_stiffness_1(physx::PxJointLimitCone* self, float arg0) {
  self->stiffness = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointLimitCone_get_damping_0(physx::PxJointLimitCone* self) {
  return self->damping;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointLimitCone_set_damping_1(physx::PxJointLimitCone* self, float arg0) {
  self->damping = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointLimitCone___destroy___0(physx::PxJointLimitCone* self) {
  delete self;
}

// Interface: PxJointLimitPyramid


physx::PxJointLimitPyramid* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointLimitPyramid_PxJointLimitPyramid_4(float yLimitAngleMin, float yLimitAngleMax, float zLimitAngleMin, float zLimitAngleMax) {
  return new physx::PxJointLimitPyramid(yLimitAngleMin, yLimitAngleMax, zLimitAngleMin, zLimitAngleMax);
}

physx::PxJointLimitPyramid* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointLimitPyramid_PxJointLimitPyramid_5(float yLimitAngleMin, float yLimitAngleMax, float zLimitAngleMin, float zLimitAngleMax, const physx::PxSpring* spring) {
  return new physx::PxJointLimitPyramid(yLimitAngleMin, yLimitAngleMax, zLimitAngleMin, zLimitAngleMax, *spring);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointLimitPyramid_isValid_0(physx::PxJointLimitPyramid* self) {
  return self->isValid();
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointLimitPyramid_isSoft_0(physx::PxJointLimitPyramid* self) {
  return self->isSoft();
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointLimitPyramid_get_yAngleMin_0(physx::PxJointLimitPyramid* self) {
  return self->yAngleMin;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointLimitPyramid_set_yAngleMin_1(physx::PxJointLimitPyramid* self, float arg0) {
  self->yAngleMin = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointLimitPyramid_get_yAngleMax_0(physx::PxJointLimitPyramid* self) {
  return self->yAngleMax;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointLimitPyramid_set_yAngleMax_1(physx::PxJointLimitPyramid* self, float arg0) {
  self->yAngleMax = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointLimitPyramid_get_zAngleMin_0(physx::PxJointLimitPyramid* self) {
  return self->zAngleMin;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointLimitPyramid_set_zAngleMin_1(physx::PxJointLimitPyramid* self, float arg0) {
  self->zAngleMin = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointLimitPyramid_get_zAngleMax_0(physx::PxJointLimitPyramid* self) {
  return self->zAngleMax;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointLimitPyramid_set_zAngleMax_1(physx::PxJointLimitPyramid* self, float arg0) {
  self->zAngleMax = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointLimitPyramid_get_restitution_0(physx::PxJointLimitPyramid* self) {
  return self->restitution;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointLimitPyramid_set_restitution_1(physx::PxJointLimitPyramid* self, float arg0) {
  self->restitution = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointLimitPyramid_get_bounceThreshold_0(physx::PxJointLimitPyramid* self) {
  return self->bounceThreshold;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointLimitPyramid_set_bounceThreshold_1(physx::PxJointLimitPyramid* self, float arg0) {
  self->bounceThreshold = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointLimitPyramid_get_stiffness_0(physx::PxJointLimitPyramid* self) {
  return self->stiffness;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointLimitPyramid_set_stiffness_1(physx::PxJointLimitPyramid* self, float arg0) {
  self->stiffness = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointLimitPyramid_get_damping_0(physx::PxJointLimitPyramid* self) {
  return self->damping;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointLimitPyramid_set_damping_1(physx::PxJointLimitPyramid* self, float arg0) {
  self->damping = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointLimitPyramid___destroy___0(physx::PxJointLimitPyramid* self) {
  delete self;
}

// Interface: PxJointLinearLimit


physx::PxJointLinearLimit* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointLinearLimit_PxJointLinearLimit_2(float extent, const physx::PxSpring* spring) {
  return new physx::PxJointLinearLimit(extent, *spring);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointLinearLimit_isValid_0(physx::PxJointLinearLimit* self) {
  return self->isValid();
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointLinearLimit_isSoft_0(physx::PxJointLinearLimit* self) {
  return self->isSoft();
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointLinearLimit_get_value_0(physx::PxJointLinearLimit* self) {
  return self->value;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointLinearLimit_set_value_1(physx::PxJointLinearLimit* self, float arg0) {
  self->value = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointLinearLimit_get_restitution_0(physx::PxJointLinearLimit* self) {
  return self->restitution;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointLinearLimit_set_restitution_1(physx::PxJointLinearLimit* self, float arg0) {
  self->restitution = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointLinearLimit_get_bounceThreshold_0(physx::PxJointLinearLimit* self) {
  return self->bounceThreshold;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointLinearLimit_set_bounceThreshold_1(physx::PxJointLinearLimit* self, float arg0) {
  self->bounceThreshold = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointLinearLimit_get_stiffness_0(physx::PxJointLinearLimit* self) {
  return self->stiffness;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointLinearLimit_set_stiffness_1(physx::PxJointLinearLimit* self, float arg0) {
  self->stiffness = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointLinearLimit_get_damping_0(physx::PxJointLinearLimit* self) {
  return self->damping;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointLinearLimit_set_damping_1(physx::PxJointLinearLimit* self, float arg0) {
  self->damping = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointLinearLimit___destroy___0(physx::PxJointLinearLimit* self) {
  delete self;
}

// Interface: PxJointLinearLimitPair


physx::PxJointLinearLimitPair* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointLinearLimitPair_PxJointLinearLimitPair_3(float lowerLimit, float upperLimit, const physx::PxSpring* spring) {
  return new physx::PxJointLinearLimitPair(lowerLimit, upperLimit, *spring);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointLinearLimitPair_isValid_0(physx::PxJointLinearLimitPair* self) {
  return self->isValid();
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointLinearLimitPair_isSoft_0(physx::PxJointLinearLimitPair* self) {
  return self->isSoft();
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointLinearLimitPair_get_upper_0(physx::PxJointLinearLimitPair* self) {
  return self->upper;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointLinearLimitPair_set_upper_1(physx::PxJointLinearLimitPair* self, float arg0) {
  self->upper = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointLinearLimitPair_get_lower_0(physx::PxJointLinearLimitPair* self) {
  return self->lower;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointLinearLimitPair_set_lower_1(physx::PxJointLinearLimitPair* self, float arg0) {
  self->lower = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointLinearLimitPair_get_restitution_0(physx::PxJointLinearLimitPair* self) {
  return self->restitution;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointLinearLimitPair_set_restitution_1(physx::PxJointLinearLimitPair* self, float arg0) {
  self->restitution = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointLinearLimitPair_get_bounceThreshold_0(physx::PxJointLinearLimitPair* self) {
  return self->bounceThreshold;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointLinearLimitPair_set_bounceThreshold_1(physx::PxJointLinearLimitPair* self, float arg0) {
  self->bounceThreshold = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointLinearLimitPair_get_stiffness_0(physx::PxJointLinearLimitPair* self) {
  return self->stiffness;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointLinearLimitPair_set_stiffness_1(physx::PxJointLinearLimitPair* self, float arg0) {
  self->stiffness = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointLinearLimitPair_get_damping_0(physx::PxJointLinearLimitPair* self) {
  return self->damping;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointLinearLimitPair_set_damping_1(physx::PxJointLinearLimitPair* self, float arg0) {
  self->damping = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxJointLinearLimitPair___destroy___0(physx::PxJointLinearLimitPair* self) {
  delete self;
}

// Interface: PxMassProperties


physx::PxMassProperties* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMassProperties_PxMassProperties_0() {
  return new physx::PxMassProperties();
}

physx::PxMassProperties* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMassProperties_PxMassProperties_1(const physx::PxGeometry* m) {
  return new physx::PxMassProperties(*m);
}

physx::PxMassProperties* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMassProperties_PxMassProperties_3(float m, const physx::PxMat33* inertiaT, const physx::PxVec3* com) {
  return new physx::PxMassProperties(m, *inertiaT, *com);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMassProperties_translate_1(physx::PxMassProperties* self, const physx::PxVec3* t) {
  self->translate(*t);
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMassProperties_getMassSpaceInertia_2(const physx::PxMat33* inertia, physx::PxQuat* massFrame) {
  static thread_local physx::PxVec3 temp;
  return (temp = physx::PxMassProperties::getMassSpaceInertia(*inertia, *massFrame), &temp);
}

physx::PxMat33* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMassProperties_translateInertia_3(const physx::PxMat33* inertia, float mass, const physx::PxVec3* t) {
  static thread_local physx::PxMat33 temp;
  return (temp = physx::PxMassProperties::translateInertia(*inertia, mass, *t), &temp);
}

physx::PxMat33* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMassProperties_rotateInertia_2(const physx::PxMat33* inertia, const physx::PxQuat* q) {
  static thread_local physx::PxMat33 temp;
  return (temp = physx::PxMassProperties::rotateInertia(*inertia, *q), &temp);
}

physx::PxMat33* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMassProperties_scaleInertia_3(const physx::PxMat33* inertia, const physx::PxQuat* scaleRotation, const physx::PxVec3* scale) {
  static thread_local physx::PxMat33 temp;
  return (temp = physx::PxMassProperties::scaleInertia(*inertia, *scaleRotation, *scale), &temp);
}

physx::PxMassProperties* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMassProperties_sum_3(const physx::PxMassProperties* props, const physx::PxTransform* transforms, unsigned int count) {
  static thread_local physx::PxMassProperties temp;
  return (temp = physx::PxMassProperties::sum(props, transforms, count), &temp);
}

physx::PxMat33* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMassProperties_get_inertiaTensor_0(physx::PxMassProperties* self) {
  return &self->inertiaTensor;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMassProperties_set_inertiaTensor_1(physx::PxMassProperties* self, physx::PxMat33* arg0) {
  self->inertiaTensor = *arg0;
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMassProperties_get_centerOfMass_0(physx::PxMassProperties* self) {
  return &self->centerOfMass;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMassProperties_set_centerOfMass_1(physx::PxMassProperties* self, physx::PxVec3* arg0) {
  self->centerOfMass = *arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMassProperties_get_mass_0(physx::PxMassProperties* self) {
  return self->mass;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMassProperties_set_mass_1(physx::PxMassProperties* self, float arg0) {
  self->mass = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMassProperties___destroy___0(physx::PxMassProperties* self) {
  delete self;
}

// Interface: PxMat33


physx::PxMat33* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMat33_PxMat33_0() {
  return new physx::PxMat33();
}

physx::PxMat33* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMat33_PxMat33_1(PxIDENTITYEnum col0) {
  return new physx::PxMat33(col0);
}

physx::PxMat33* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMat33_PxMat33_3(const physx::PxVec3* col0, const physx::PxVec3* col1, const physx::PxVec3* col2) {
  return new physx::PxMat33(*col0, *col1, *col2);
}

physx::PxMat33* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMat33_getTranspose_0(physx::PxMat33* self) {
  static thread_local physx::PxMat33 temp;
  return (temp = self->getTranspose(), &temp);
}

physx::PxMat33* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMat33_getInverse_0(physx::PxMat33* self) {
  static thread_local physx::PxMat33 temp;
  return (temp = self->getInverse(), &temp);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMat33_getDeterminant_0(physx::PxMat33* self) {
  return self->getDeterminant();
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMat33_transform_1(physx::PxMat33* self, const physx::PxVec3* other) {
  static thread_local physx::PxVec3 temp;
  return (temp = self->transform(*other), &temp);
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMat33_transformTranspose_1(physx::PxMat33* self, const physx::PxVec3* other) {
  static thread_local physx::PxVec3 temp;
  return (temp = self->transformTranspose(*other), &temp);
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMat33_get_column0_0(physx::PxMat33* self) {
  return &self->column0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMat33_set_column0_1(physx::PxMat33* self, physx::PxVec3* arg0) {
  self->column0 = *arg0;
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMat33_get_column1_0(physx::PxMat33* self) {
  return &self->column1;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMat33_set_column1_1(physx::PxMat33* self, physx::PxVec3* arg0) {
  self->column1 = *arg0;
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMat33_get_column2_0(physx::PxMat33* self) {
  return &self->column2;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMat33_set_column2_1(physx::PxMat33* self, physx::PxVec3* arg0) {
  self->column2 = *arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMat33___destroy___0(physx::PxMat33* self) {
  delete self;
}

// Interface: PxMaterial


void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMaterial_setDynamicFriction_1(physx::PxMaterial* self, float coef) {
  self->setDynamicFriction(coef);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMaterial_getDynamicFriction_0(physx::PxMaterial* self) {
  return self->getDynamicFriction();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMaterial_setStaticFriction_1(physx::PxMaterial* self, float coef) {
  self->setStaticFriction(coef);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMaterial_getStaticFriction_0(physx::PxMaterial* self) {
  return self->getStaticFriction();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMaterial_setRestitution_1(physx::PxMaterial* self, float coef) {
  self->setRestitution(coef);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMaterial_getRestitution_0(physx::PxMaterial* self) {
  return self->getRestitution();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMaterial_setFlag_2(physx::PxMaterial* self, PxMaterialFlagEnum flag, bool b) {
  self->setFlag(flag, b);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMaterial_setFlags_1(physx::PxMaterial* self, physx::PxMaterialFlags* flags) {
  self->setFlags(*flags);
}

physx::PxMaterialFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMaterial_getFlags_0(physx::PxMaterial* self) {
  static thread_local physx::PxMaterialFlags temp;
  return (temp = self->getFlags(), &temp);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMaterial_setFrictionCombineMode_1(physx::PxMaterial* self, PxCombineModeEnum combMode) {
  self->setFrictionCombineMode(combMode);
}

PxCombineModeEnum EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMaterial_getFrictionCombineMode_0(physx::PxMaterial* self) {
  return self->getFrictionCombineMode();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMaterial_setRestitutionCombineMode_1(physx::PxMaterial* self, PxCombineModeEnum combMode) {
  self->setRestitutionCombineMode(combMode);
}

PxCombineModeEnum EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMaterial_getRestitutionCombineMode_0(physx::PxMaterial* self) {
  return self->getRestitutionCombineMode();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMaterial_release_0(physx::PxMaterial* self) {
  self->release();
}

const char* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMaterial_getConcreteTypeName_0(physx::PxMaterial* self) {
  return self->getConcreteTypeName();
}

int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMaterial_getConcreteType_0(physx::PxMaterial* self) {
  return self->getConcreteType();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMaterial_setBaseFlag_2(physx::PxMaterial* self, PxBaseFlagEnum flag, bool value) {
  self->setBaseFlag(flag, value);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMaterial_setBaseFlags_1(physx::PxMaterial* self, physx::PxBaseFlags* inFlags) {
  self->setBaseFlags(*inFlags);
}

physx::PxBaseFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMaterial_getBaseFlags_0(physx::PxMaterial* self) {
  static thread_local physx::PxBaseFlags temp;
  return (temp = self->getBaseFlags(), &temp);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMaterial_isReleasable_0(physx::PxMaterial* self) {
  return self->isReleasable();
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMaterial_getReferenceCount_0(physx::PxMaterial* self) {
  return self->getReferenceCount();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMaterial_acquireReference_0(physx::PxMaterial* self) {
  self->acquireReference();
}

void* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMaterial_get_userData_0(physx::PxMaterial* self) {
  return self->userData;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMaterial_set_userData_1(physx::PxMaterial* self, void* arg0) {
  self->userData = arg0;
}

// Interface: PxMaterialConstPtr


void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMaterialConstPtr___destroy___0(PxMaterialConstPtr* self) {
  delete self;
}

// Interface: PxMaterialFlags


physx::PxMaterialFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMaterialFlags_PxMaterialFlags_1(unsigned short flags) {
  return new physx::PxMaterialFlags(flags);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMaterialFlags_isSet_1(physx::PxMaterialFlags* self, PxMaterialFlagEnum flag) {
  return self->isSet(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMaterialFlags_raise_1(physx::PxMaterialFlags* self, PxMaterialFlagEnum flag) {
  self->raise(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMaterialFlags_clear_1(physx::PxMaterialFlags* self, PxMaterialFlagEnum flag) {
  self->clear(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMaterialFlags___destroy___0(physx::PxMaterialFlags* self) {
  delete self;
}

// Interface: PxMaterialPtr


void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMaterialPtr___destroy___0(PxMaterialPtr* self) {
  delete self;
}

// Interface: PxMeshFlags


physx::PxMeshFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMeshFlags_PxMeshFlags_1(unsigned char flags) {
  return new physx::PxMeshFlags(flags);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMeshFlags_isSet_1(physx::PxMeshFlags* self, PxMeshFlagEnum flag) {
  return self->isSet(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMeshFlags_raise_1(physx::PxMeshFlags* self, PxMeshFlagEnum flag) {
  self->raise(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMeshFlags_clear_1(physx::PxMeshFlags* self, PxMeshFlagEnum flag) {
  self->clear(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMeshFlags___destroy___0(physx::PxMeshFlags* self) {
  delete self;
}

// Interface: PxMeshGeometryFlags


physx::PxMeshGeometryFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMeshGeometryFlags_PxMeshGeometryFlags_1(unsigned char flags) {
  return new physx::PxMeshGeometryFlags(flags);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMeshGeometryFlags_isSet_1(physx::PxMeshGeometryFlags* self, PxMeshGeometryFlagEnum flag) {
  return self->isSet(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMeshGeometryFlags_raise_1(physx::PxMeshGeometryFlags* self, PxMeshGeometryFlagEnum flag) {
  self->raise(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMeshGeometryFlags_clear_1(physx::PxMeshGeometryFlags* self, PxMeshGeometryFlagEnum flag) {
  self->clear(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMeshGeometryFlags___destroy___0(physx::PxMeshGeometryFlags* self) {
  delete self;
}

// Interface: PxMeshOverlapUtil


physx::PxMeshOverlapUtil* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMeshOverlapUtil_PxMeshOverlapUtil_0() {
  return new physx::PxMeshOverlapUtil();
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMeshOverlapUtil_findOverlap_4(physx::PxMeshOverlapUtil* self, const physx::PxGeometry* geom, const physx::PxTransform* geomPose, const physx::PxTriangleMeshGeometry* meshGeom, const physx::PxTransform* meshPose) {
  return self->findOverlap(*geom, *geomPose, *meshGeom, *meshPose);
}

PxU32ConstPtr* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMeshOverlapUtil_getResults_0(physx::PxMeshOverlapUtil* self) {
  static thread_local PxU32ConstPtr temp;
  return (temp = self->getResults(), &temp);
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMeshOverlapUtil_getNbResults_0(physx::PxMeshOverlapUtil* self) {
  return self->getNbResults();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMeshOverlapUtil___destroy___0(physx::PxMeshOverlapUtil* self) {
  delete self;
}

// Interface: PxMeshPreprocessingFlags


physx::PxMeshPreprocessingFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMeshPreprocessingFlags_PxMeshPreprocessingFlags_1(unsigned int flags) {
  return new physx::PxMeshPreprocessingFlags(flags);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMeshPreprocessingFlags_isSet_1(physx::PxMeshPreprocessingFlags* self, PxMeshPreprocessingFlagEnum flag) {
  return self->isSet(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMeshPreprocessingFlags_raise_1(physx::PxMeshPreprocessingFlags* self, PxMeshPreprocessingFlagEnum flag) {
  self->raise(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMeshPreprocessingFlags_clear_1(physx::PxMeshPreprocessingFlags* self, PxMeshPreprocessingFlagEnum flag) {
  self->clear(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMeshPreprocessingFlags___destroy___0(physx::PxMeshPreprocessingFlags* self) {
  delete self;
}

// Interface: PxMeshScale


physx::PxMeshScale* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMeshScale_PxMeshScale_0() {
  return new physx::PxMeshScale();
}

physx::PxMeshScale* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMeshScale_PxMeshScale_1(float s) {
  return new physx::PxMeshScale(s);
}

physx::PxMeshScale* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMeshScale_PxMeshScale_2(const physx::PxVec3* s, const physx::PxQuat* r) {
  return new physx::PxMeshScale(*s, *r);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMeshScale___destroy___0(physx::PxMeshScale* self) {
  delete self;
}

// Interface: PxMidphaseDesc


physx::PxMidphaseDesc* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMidphaseDesc_PxMidphaseDesc_0() {
  return new physx::PxMidphaseDesc();
}

PxMeshMidPhaseEnum EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMidphaseDesc_getType_0(physx::PxMidphaseDesc* self) {
  return self->getType();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMidphaseDesc_setToDefault_1(physx::PxMidphaseDesc* self, PxMeshMidPhaseEnum type) {
  self->setToDefault(type);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMidphaseDesc_isValid_0(physx::PxMidphaseDesc* self) {
  return self->isValid();
}

physx::PxBVH33MidphaseDesc* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMidphaseDesc_get_mBVH33Desc_0(physx::PxMidphaseDesc* self) {
  return &self->mBVH33Desc;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMidphaseDesc_set_mBVH33Desc_1(physx::PxMidphaseDesc* self, physx::PxBVH33MidphaseDesc* arg0) {
  self->mBVH33Desc = *arg0;
}

physx::PxBVH34MidphaseDesc* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMidphaseDesc_get_mBVH34Desc_0(physx::PxMidphaseDesc* self) {
  return &self->mBVH34Desc;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMidphaseDesc_set_mBVH34Desc_1(physx::PxMidphaseDesc* self, physx::PxBVH34MidphaseDesc* arg0) {
  self->mBVH34Desc = *arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxMidphaseDesc___destroy___0(physx::PxMidphaseDesc* self) {
  delete self;
}

// Interface: PxObstacleContext


void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxObstacleContext_release_0(physx::PxObstacleContext* self) {
  self->release();
}

physx::PxControllerManager* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxObstacleContext_getControllerManager_0(physx::PxObstacleContext* self) {
  return &self->getControllerManager();
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxObstacleContext_addObstacle_1(physx::PxObstacleContext* self, const physx::PxObstacle* obstacle) {
  return self->addObstacle(*obstacle);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxObstacleContext_removeObstacle_1(physx::PxObstacleContext* self, unsigned int handle) {
  return self->removeObstacle(handle);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxObstacleContext_updateObstacle_2(physx::PxObstacleContext* self, unsigned int handle, const physx::PxObstacle* obstacle) {
  return self->updateObstacle(handle, *obstacle);
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxObstacleContext_getNbObstacles_0(physx::PxObstacleContext* self) {
  return self->getNbObstacles();
}

const physx::PxObstacle* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxObstacleContext_getObstacle_1(physx::PxObstacleContext* self, unsigned int i) {
  return self->getObstacle(i);
}

const physx::PxObstacle* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxObstacleContext_getObstacleByHandle_1(physx::PxObstacleContext* self, unsigned int handle) {
  return self->getObstacleByHandle(handle);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxObstacleContext___destroy___0(physx::PxObstacleContext* self) {
  delete self;
}

// Interface: PxOmniPvd


bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxOmniPvd_startSampling_0(physx::PxOmniPvd* self) {
  return self->startSampling();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxOmniPvd_release_0(physx::PxOmniPvd* self) {
  self->release();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxOmniPvd___destroy___0(physx::PxOmniPvd* self) {
  delete self;
}

// Interface: PxOverlapBuffer10


PxOverlapBuffer10* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxOverlapBuffer10_PxOverlapBuffer10_0() {
  return new PxOverlapBuffer10();
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxOverlapBuffer10_getNbAnyHits_0(PxOverlapBuffer10* self) {
  return self->getNbAnyHits();
}

const physx::PxOverlapHit* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxOverlapBuffer10_getAnyHit_1(PxOverlapBuffer10* self, unsigned int index) {
  return &self->getAnyHit(index);
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxOverlapBuffer10_getNbTouches_0(PxOverlapBuffer10* self) {
  return self->getNbTouches();
}

const physx::PxOverlapHit* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxOverlapBuffer10_getTouches_0(PxOverlapBuffer10* self) {
  return self->getTouches();
}

const physx::PxOverlapHit* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxOverlapBuffer10_getTouch_1(PxOverlapBuffer10* self, unsigned int index) {
  return &self->getTouch(index);
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxOverlapBuffer10_getMaxNbTouches_0(PxOverlapBuffer10* self) {
  return self->getMaxNbTouches();
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxOverlapBuffer10_hasAnyHits_0(PxOverlapBuffer10* self) {
  return self->hasAnyHits();
}

physx::PxOverlapHit* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxOverlapBuffer10_get_block_0(PxOverlapBuffer10* self) {
  return &self->block;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxOverlapBuffer10_set_block_1(PxOverlapBuffer10* self, physx::PxOverlapHit* arg0) {
  self->block = *arg0;
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxOverlapBuffer10_get_hasBlock_0(PxOverlapBuffer10* self) {
  return self->hasBlock;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxOverlapBuffer10_set_hasBlock_1(PxOverlapBuffer10* self, bool arg0) {
  self->hasBlock = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxOverlapBuffer10___destroy___0(PxOverlapBuffer10* self) {
  delete self;
}

// Interface: PxOverlapHit


physx::PxRigidActor* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxOverlapHit_get_actor_0(physx::PxOverlapHit* self) {
  return self->actor;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxOverlapHit_set_actor_1(physx::PxOverlapHit* self, physx::PxRigidActor* arg0) {
  self->actor = arg0;
}

physx::PxShape* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxOverlapHit_get_shape_0(physx::PxOverlapHit* self) {
  return self->shape;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxOverlapHit_set_shape_1(physx::PxOverlapHit* self, physx::PxShape* arg0) {
  self->shape = arg0;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxOverlapHit_get_faceIndex_0(physx::PxOverlapHit* self) {
  return self->faceIndex;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxOverlapHit_set_faceIndex_1(physx::PxOverlapHit* self, unsigned int arg0) {
  self->faceIndex = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxOverlapHit___destroy___0(physx::PxOverlapHit* self) {
  delete self;
}

// Interface: PxOverlapResult


PxOverlapResult* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxOverlapResult_PxOverlapResult_0() {
  return new PxOverlapResult();
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxOverlapResult_getNbAnyHits_0(PxOverlapResult* self) {
  return self->getNbAnyHits();
}

const physx::PxOverlapHit* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxOverlapResult_getAnyHit_1(PxOverlapResult* self, unsigned int index) {
  return &self->getAnyHit(index);
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxOverlapResult_getNbTouches_0(PxOverlapResult* self) {
  return self->getNbTouches();
}

const physx::PxOverlapHit* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxOverlapResult_getTouch_1(PxOverlapResult* self, unsigned int index) {
  return &self->getTouch(index);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxOverlapResult_hasAnyHits_0(PxOverlapResult* self) {
  return self->hasAnyHits();
}

physx::PxOverlapHit* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxOverlapResult_get_block_0(PxOverlapResult* self) {
  return &self->block;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxOverlapResult_set_block_1(PxOverlapResult* self, physx::PxOverlapHit* arg0) {
  self->block = *arg0;
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxOverlapResult_get_hasBlock_0(PxOverlapResult* self) {
  return self->hasBlock;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxOverlapResult_set_hasBlock_1(PxOverlapResult* self, bool arg0) {
  self->hasBlock = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxOverlapResult___destroy___0(PxOverlapResult* self) {
  delete self;
}

// Interface: PxPairFlags


physx::PxPairFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxPairFlags_PxPairFlags_1(unsigned short flags) {
  return new physx::PxPairFlags(flags);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxPairFlags_isSet_1(physx::PxPairFlags* self, PxPairFlagEnum flag) {
  return self->isSet(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxPairFlags_raise_1(physx::PxPairFlags* self, PxPairFlagEnum flag) {
  self->raise(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxPairFlags_clear_1(physx::PxPairFlags* self, PxPairFlagEnum flag) {
  self->clear(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxPairFlags___destroy___0(physx::PxPairFlags* self) {
  delete self;
}

// Interface: PxPhysics


void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxPhysics_release_0(physx::PxPhysics* self) {
  self->release();
}

physx::PxFoundation* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxPhysics_getFoundation_0(physx::PxPhysics* self) {
  return &self->getFoundation();
}

physx::PxAggregate* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxPhysics_createAggregate_3(physx::PxPhysics* self, unsigned int maxActor, unsigned int maxShape, bool enableSelfCollision) {
  return self->createAggregate(maxActor, maxShape, enableSelfCollision);
}

const physx::PxTolerancesScale* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxPhysics_getTolerancesScale_0(physx::PxPhysics* self) {
  return &self->getTolerancesScale();
}

physx::PxScene* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxPhysics_createScene_1(physx::PxPhysics* self, const physx::PxSceneDesc* sceneDesc) {
  return self->createScene(*sceneDesc);
}

physx::PxRigidStatic* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxPhysics_createRigidStatic_1(physx::PxPhysics* self, const physx::PxTransform* pose) {
  return self->createRigidStatic(*pose);
}

physx::PxRigidDynamic* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxPhysics_createRigidDynamic_1(physx::PxPhysics* self, const physx::PxTransform* pose) {
  return self->createRigidDynamic(*pose);
}

physx::PxShape* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxPhysics_createShape_2(physx::PxPhysics* self, const physx::PxGeometry* geometry, const physx::PxMaterial* material) {
  return self->createShape(*geometry, *material);
}

physx::PxShape* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxPhysics_createShape_3(physx::PxPhysics* self, const physx::PxGeometry* geometry, const physx::PxMaterial* material, bool isExclusive) {
  return self->createShape(*geometry, *material, isExclusive);
}

physx::PxShape* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxPhysics_createShape_4(physx::PxPhysics* self, const physx::PxGeometry* geometry, const physx::PxMaterial* material, bool isExclusive, physx::PxShapeFlags* shapeFlags) {
  return self->createShape(*geometry, *material, isExclusive, *shapeFlags);
}

physx::PxTriangleMesh* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxPhysics_createTriangleMesh_1(physx::PxPhysics* self, physx::PxInputData* stream) {
  return self->createTriangleMesh(*stream);
}

physx::PxConvexMesh* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxPhysics_createConvexMesh_1(physx::PxPhysics* self, physx::PxInputData* stream) {
  return self->createConvexMesh(*stream);
}

int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxPhysics_getNbShapes_0(physx::PxPhysics* self) {
  return self->getNbShapes();
}

physx::PxArticulationReducedCoordinate* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxPhysics_createArticulationReducedCoordinate_0(physx::PxPhysics* self) {
  return self->createArticulationReducedCoordinate();
}

physx::PxMaterial* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxPhysics_createMaterial_3(physx::PxPhysics* self, float staticFriction, float dynamicFriction, float restitution) {
  return self->createMaterial(staticFriction, dynamicFriction, restitution);
}

physx::PxInsertionCallback* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxPhysics_getPhysicsInsertionCallback_0(physx::PxPhysics* self) {
  return &self->getPhysicsInsertionCallback();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxPhysics___destroy___0(physx::PxPhysics* self) {
  delete self;
}

// Interface: PxPlane


physx::PxPlane* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxPlane_PxPlane_0() {
  return new physx::PxPlane();
}

physx::PxPlane* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxPlane_PxPlane_2(const physx::PxVec3* nx, float ny) {
  return new physx::PxPlane(*nx, ny);
}

physx::PxPlane* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxPlane_PxPlane_3(const physx::PxVec3* nx, const physx::PxVec3* ny, const physx::PxVec3* nz) {
  return new physx::PxPlane(*nx, *ny, *nz);
}

physx::PxPlane* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxPlane_PxPlane_4(float nx, float ny, float nz, float distance) {
  return new physx::PxPlane(nx, ny, nz, distance);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxPlane_distance_1(physx::PxPlane* self, const physx::PxVec3* p) {
  return self->distance(*p);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxPlane_contains_1(physx::PxPlane* self, const physx::PxVec3* p) {
  return self->contains(*p);
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxPlane_project_1(physx::PxPlane* self, const physx::PxVec3* p) {
  static thread_local physx::PxVec3 temp;
  return (temp = self->project(*p), &temp);
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxPlane_pointInPlane_0(physx::PxPlane* self) {
  static thread_local physx::PxVec3 temp;
  return (temp = self->pointInPlane(), &temp);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxPlane_normalize_0(physx::PxPlane* self) {
  self->normalize();
}

physx::PxPlane* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxPlane_transform_1(physx::PxPlane* self, const physx::PxTransform* pose) {
  static thread_local physx::PxPlane temp;
  return (temp = self->transform(*pose), &temp);
}

physx::PxPlane* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxPlane_inverseTransform_1(physx::PxPlane* self, const physx::PxTransform* pose) {
  static thread_local physx::PxPlane temp;
  return (temp = self->inverseTransform(*pose), &temp);
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxPlane_get_n_0(physx::PxPlane* self) {
  return &self->n;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxPlane_set_n_1(physx::PxPlane* self, physx::PxVec3* arg0) {
  self->n = *arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxPlane_get_d_0(physx::PxPlane* self) {
  return self->d;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxPlane_set_d_1(physx::PxPlane* self, float arg0) {
  self->d = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxPlane___destroy___0(physx::PxPlane* self) {
  delete self;
}

// Interface: PxPlaneGeometry


physx::PxPlaneGeometry* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxPlaneGeometry_PxPlaneGeometry_0() {
  return new physx::PxPlaneGeometry();
}

PxGeometryTypeEnum EMSCRIPTEN_KEEPALIVE emscripten_bind_PxPlaneGeometry_getType_0(physx::PxPlaneGeometry* self) {
  return self->getType();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxPlaneGeometry___destroy___0(physx::PxPlaneGeometry* self) {
  delete self;
}

// Interface: PxPrismaticJoint


float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxPrismaticJoint_getPosition_0(physx::PxPrismaticJoint* self) {
  return self->getPosition();
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxPrismaticJoint_getVelocity_0(physx::PxPrismaticJoint* self) {
  return self->getVelocity();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxPrismaticJoint_setLimit_1(physx::PxPrismaticJoint* self, const physx::PxJointLinearLimitPair* limit) {
  self->setLimit(*limit);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxPrismaticJoint_setPrismaticJointFlags_1(physx::PxPrismaticJoint* self, physx::PxPrismaticJointFlags* flags) {
  self->setPrismaticJointFlags(*flags);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxPrismaticJoint_setPrismaticJointFlag_2(physx::PxPrismaticJoint* self, PxPrismaticJointFlagEnum flag, bool value) {
  self->setPrismaticJointFlag(flag, value);
}

physx::PxPrismaticJointFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxPrismaticJoint_getPrismaticJointFlags_0(physx::PxPrismaticJoint* self) {
  static thread_local physx::PxPrismaticJointFlags temp;
  return (temp = self->getPrismaticJointFlags(), &temp);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxPrismaticJoint_release_0(physx::PxPrismaticJoint* self) {
  self->release();
}

const char* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxPrismaticJoint_getConcreteTypeName_0(physx::PxPrismaticJoint* self) {
  return self->getConcreteTypeName();
}

int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxPrismaticJoint_getConcreteType_0(physx::PxPrismaticJoint* self) {
  return self->getConcreteType();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxPrismaticJoint_setBaseFlag_2(physx::PxPrismaticJoint* self, PxBaseFlagEnum flag, bool value) {
  self->setBaseFlag(flag, value);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxPrismaticJoint_setBaseFlags_1(physx::PxPrismaticJoint* self, physx::PxBaseFlags* inFlags) {
  self->setBaseFlags(*inFlags);
}

physx::PxBaseFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxPrismaticJoint_getBaseFlags_0(physx::PxPrismaticJoint* self) {
  static thread_local physx::PxBaseFlags temp;
  return (temp = self->getBaseFlags(), &temp);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxPrismaticJoint_isReleasable_0(physx::PxPrismaticJoint* self) {
  return self->isReleasable();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxPrismaticJoint_setActors_2(physx::PxPrismaticJoint* self, physx::PxRigidActor* actor0, physx::PxRigidActor* actor1) {
  self->setActors(actor0, actor1);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxPrismaticJoint_setLocalPose_2(physx::PxPrismaticJoint* self, PxJointActorIndexEnum actor, const physx::PxTransform* localPose) {
  self->setLocalPose(actor, *localPose);
}

physx::PxTransform* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxPrismaticJoint_getLocalPose_1(physx::PxPrismaticJoint* self, PxJointActorIndexEnum actor) {
  static thread_local physx::PxTransform temp;
  return (temp = self->getLocalPose(actor), &temp);
}

physx::PxTransform* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxPrismaticJoint_getRelativeTransform_0(physx::PxPrismaticJoint* self) {
  static thread_local physx::PxTransform temp;
  return (temp = self->getRelativeTransform(), &temp);
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxPrismaticJoint_getRelativeLinearVelocity_0(physx::PxPrismaticJoint* self) {
  static thread_local physx::PxVec3 temp;
  return (temp = self->getRelativeLinearVelocity(), &temp);
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxPrismaticJoint_getRelativeAngularVelocity_0(physx::PxPrismaticJoint* self) {
  static thread_local physx::PxVec3 temp;
  return (temp = self->getRelativeAngularVelocity(), &temp);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxPrismaticJoint_setBreakForce_2(physx::PxPrismaticJoint* self, float force, float torque) {
  self->setBreakForce(force, torque);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxPrismaticJoint_setConstraintFlags_1(physx::PxPrismaticJoint* self, physx::PxConstraintFlags* flags) {
  self->setConstraintFlags(*flags);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxPrismaticJoint_setConstraintFlag_2(physx::PxPrismaticJoint* self, PxConstraintFlagEnum flag, bool value) {
  self->setConstraintFlag(flag, value);
}

physx::PxConstraintFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxPrismaticJoint_getConstraintFlags_0(physx::PxPrismaticJoint* self) {
  static thread_local physx::PxConstraintFlags temp;
  return (temp = self->getConstraintFlags(), &temp);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxPrismaticJoint_setInvMassScale0_1(physx::PxPrismaticJoint* self, float invMassScale) {
  self->setInvMassScale0(invMassScale);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxPrismaticJoint_getInvMassScale0_0(physx::PxPrismaticJoint* self) {
  return self->getInvMassScale0();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxPrismaticJoint_setInvMassScale1_1(physx::PxPrismaticJoint* self, float invMassScale) {
  self->setInvMassScale1(invMassScale);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxPrismaticJoint_getInvMassScale1_0(physx::PxPrismaticJoint* self) {
  return self->getInvMassScale1();
}

physx::PxConstraint* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxPrismaticJoint_getConstraint_0(physx::PxPrismaticJoint* self) {
  return self->getConstraint();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxPrismaticJoint_setName_1(physx::PxPrismaticJoint* self, const char* name) {
  self->setName(name);
}

const char* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxPrismaticJoint_getName_0(physx::PxPrismaticJoint* self) {
  return self->getName();
}

physx::PxScene* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxPrismaticJoint_getScene_0(physx::PxPrismaticJoint* self) {
  return self->getScene();
}

void* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxPrismaticJoint_get_userData_0(physx::PxPrismaticJoint* self) {
  return self->userData;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxPrismaticJoint_set_userData_1(physx::PxPrismaticJoint* self, void* arg0) {
  self->userData = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxPrismaticJoint___destroy___0(physx::PxPrismaticJoint* self) {
  delete self;
}

// Interface: PxPrismaticJointFlags


physx::PxPrismaticJointFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxPrismaticJointFlags_PxPrismaticJointFlags_1(unsigned short flags) {
  return new physx::PxPrismaticJointFlags(flags);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxPrismaticJointFlags_isSet_1(physx::PxPrismaticJointFlags* self, PxPrismaticJointFlagEnum flag) {
  return self->isSet(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxPrismaticJointFlags_raise_1(physx::PxPrismaticJointFlags* self, PxPrismaticJointFlagEnum flag) {
  self->raise(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxPrismaticJointFlags_clear_1(physx::PxPrismaticJointFlags* self, PxPrismaticJointFlagEnum flag) {
  self->clear(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxPrismaticJointFlags___destroy___0(physx::PxPrismaticJointFlags* self) {
  delete self;
}

// Interface: PxPvd


bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxPvd_connect_2(physx::PxPvd* self, physx::PxPvdTransport* transport, physx::PxPvdInstrumentationFlags* flags) {
  return self->connect(*transport, *flags);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxPvd_release_0(physx::PxPvd* self) {
  self->release();
}

// Interface: PxPvdInstrumentationFlags


physx::PxPvdInstrumentationFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxPvdInstrumentationFlags_PxPvdInstrumentationFlags_1(unsigned char flags) {
  return new physx::PxPvdInstrumentationFlags(flags);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxPvdInstrumentationFlags_isSet_1(physx::PxPvdInstrumentationFlags* self, PxPvdInstrumentationFlagEnum flag) {
  return self->isSet(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxPvdInstrumentationFlags_raise_1(physx::PxPvdInstrumentationFlags* self, PxPvdInstrumentationFlagEnum flag) {
  self->raise(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxPvdInstrumentationFlags_clear_1(physx::PxPvdInstrumentationFlags* self, PxPvdInstrumentationFlagEnum flag) {
  self->clear(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxPvdInstrumentationFlags___destroy___0(physx::PxPvdInstrumentationFlags* self) {
  delete self;
}

// Interface: PxQuat


physx::PxQuat* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxQuat_PxQuat_0() {
  return new physx::PxQuat();
}

physx::PxQuat* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxQuat_PxQuat_1(PxIDENTITYEnum nx) {
  return new physx::PxQuat(nx);
}

physx::PxQuat* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxQuat_PxQuat_2(float nx, const physx::PxVec3* ny) {
  return new physx::PxQuat(nx, *ny);
}

physx::PxQuat* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxQuat_PxQuat_4(float nx, float ny, float nz, float nw) {
  return new physx::PxQuat(nx, ny, nz, nw);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxQuat_isIdentity_0(physx::PxQuat* self) {
  return self->isIdentity();
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxQuat_isFinite_0(physx::PxQuat* self) {
  return self->isFinite();
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxQuat_isUnit_0(physx::PxQuat* self) {
  return self->isUnit();
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxQuat_isSane_0(physx::PxQuat* self) {
  return self->isSane();
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxQuat_getAngle_0(physx::PxQuat* self) {
  return self->getAngle();
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxQuat_getAngle_1(physx::PxQuat* self, const physx::PxQuat* q) {
  return self->getAngle(*q);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxQuat_magnitudeSquared_0(physx::PxQuat* self) {
  return self->magnitudeSquared();
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxQuat_dot_1(physx::PxQuat* self, const physx::PxQuat* q) {
  return self->dot(*q);
}

physx::PxQuat* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxQuat_getNormalized_0(physx::PxQuat* self) {
  static thread_local physx::PxQuat temp;
  return (temp = self->getNormalized(), &temp);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxQuat_magnitude_0(physx::PxQuat* self) {
  return self->magnitude();
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxQuat_normalize_0(physx::PxQuat* self) {
  return self->normalize();
}

physx::PxQuat* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxQuat_getConjugate_0(physx::PxQuat* self) {
  static thread_local physx::PxQuat temp;
  return (temp = self->getConjugate(), &temp);
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxQuat_getImaginaryPart_0(physx::PxQuat* self) {
  static thread_local physx::PxVec3 temp;
  return (temp = self->getImaginaryPart(), &temp);
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxQuat_getBasisVector0_0(physx::PxQuat* self) {
  static thread_local physx::PxVec3 temp;
  return (temp = self->getBasisVector0(), &temp);
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxQuat_getBasisVector1_0(physx::PxQuat* self) {
  static thread_local physx::PxVec3 temp;
  return (temp = self->getBasisVector1(), &temp);
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxQuat_getBasisVector2_0(physx::PxQuat* self) {
  static thread_local physx::PxVec3 temp;
  return (temp = self->getBasisVector2(), &temp);
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxQuat_rotate_1(physx::PxQuat* self, const physx::PxVec3* v) {
  static thread_local physx::PxVec3 temp;
  return (temp = self->rotate(*v), &temp);
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxQuat_rotateInv_1(physx::PxQuat* self, const physx::PxVec3* v) {
  static thread_local physx::PxVec3 temp;
  return (temp = self->rotateInv(*v), &temp);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxQuat_get_x_0(physx::PxQuat* self) {
  return self->x;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxQuat_set_x_1(physx::PxQuat* self, float arg0) {
  self->x = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxQuat_get_y_0(physx::PxQuat* self) {
  return self->y;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxQuat_set_y_1(physx::PxQuat* self, float arg0) {
  self->y = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxQuat_get_z_0(physx::PxQuat* self) {
  return self->z;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxQuat_set_z_1(physx::PxQuat* self, float arg0) {
  self->z = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxQuat_get_w_0(physx::PxQuat* self) {
  return self->w;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxQuat_set_w_1(physx::PxQuat* self, float arg0) {
  self->w = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxQuat___destroy___0(physx::PxQuat* self) {
  delete self;
}

// Interface: PxQueryFilterCallbackImpl


PxQueryFilterCallbackImpl* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxQueryFilterCallbackImpl_PxQueryFilterCallbackImpl_0() {
  return new PxQueryFilterCallbackImpl();
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxQueryFilterCallbackImpl_simplePreFilter_4(PxQueryFilterCallbackImpl* self, const physx::PxFilterData* filterData, const physx::PxShape* shape, const physx::PxRigidActor* actor, physx::PxHitFlags* queryFlags) {
  return self->simplePreFilter(*filterData, shape, actor, *queryFlags);
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxQueryFilterCallbackImpl_simplePostFilter_4(PxQueryFilterCallbackImpl* self, const physx::PxFilterData* filterData, const physx::PxQueryHit* hit, const physx::PxShape* shape, const physx::PxRigidActor* actor) {
  return self->simplePostFilter(*filterData, *hit, shape, actor);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxQueryFilterCallbackImpl___destroy___0(PxQueryFilterCallbackImpl* self) {
  delete self;
}

// Interface: PxQueryFilterData


physx::PxQueryFilterData* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxQueryFilterData_PxQueryFilterData_0() {
  return new physx::PxQueryFilterData();
}

physx::PxQueryFilterData* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxQueryFilterData_PxQueryFilterData_1(physx::PxQueryFlags* fd) {
  return new physx::PxQueryFilterData(*fd);
}

physx::PxQueryFilterData* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxQueryFilterData_PxQueryFilterData_2(const physx::PxFilterData* fd, physx::PxQueryFlags* f) {
  return new physx::PxQueryFilterData(*fd, *f);
}

physx::PxFilterData* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxQueryFilterData_get_data_0(physx::PxQueryFilterData* self) {
  return &self->data;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxQueryFilterData_set_data_1(physx::PxQueryFilterData* self, physx::PxFilterData* arg0) {
  self->data = *arg0;
}

physx::PxQueryFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxQueryFilterData_get_flags_0(physx::PxQueryFilterData* self) {
  return &self->flags;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxQueryFilterData_set_flags_1(physx::PxQueryFilterData* self, physx::PxQueryFlags* arg0) {
  self->flags = *arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxQueryFilterData___destroy___0(physx::PxQueryFilterData* self) {
  delete self;
}

// Interface: PxQueryFlags


physx::PxQueryFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxQueryFlags_PxQueryFlags_1(unsigned short flags) {
  return new physx::PxQueryFlags(flags);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxQueryFlags_isSet_1(physx::PxQueryFlags* self, PxQueryFlagEnum flag) {
  return self->isSet(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxQueryFlags_raise_1(physx::PxQueryFlags* self, PxQueryFlagEnum flag) {
  self->raise(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxQueryFlags_clear_1(physx::PxQueryFlags* self, PxQueryFlagEnum flag) {
  self->clear(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxQueryFlags___destroy___0(physx::PxQueryFlags* self) {
  delete self;
}

// Interface: PxRackAndPinionJoint


bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRackAndPinionJoint_setJoints_2(physx::PxRackAndPinionJoint* self, const physx::PxBase* hinge, const physx::PxBase* prismatic) {
  return self->setJoints(hinge, prismatic);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRackAndPinionJoint_setRatio_1(physx::PxRackAndPinionJoint* self, float ratio) {
  self->setRatio(ratio);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRackAndPinionJoint_getRatio_0(physx::PxRackAndPinionJoint* self) {
  return self->getRatio();
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRackAndPinionJoint_setData_3(physx::PxRackAndPinionJoint* self, unsigned int nbRackTeeth, unsigned int nbPinionTeeth, float rackLength) {
  return self->setData(nbRackTeeth, nbPinionTeeth, rackLength);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRackAndPinionJoint_release_0(physx::PxRackAndPinionJoint* self) {
  self->release();
}

const char* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRackAndPinionJoint_getConcreteTypeName_0(physx::PxRackAndPinionJoint* self) {
  return self->getConcreteTypeName();
}

int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRackAndPinionJoint_getConcreteType_0(physx::PxRackAndPinionJoint* self) {
  return self->getConcreteType();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRackAndPinionJoint_setBaseFlag_2(physx::PxRackAndPinionJoint* self, PxBaseFlagEnum flag, bool value) {
  self->setBaseFlag(flag, value);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRackAndPinionJoint_setBaseFlags_1(physx::PxRackAndPinionJoint* self, physx::PxBaseFlags* inFlags) {
  self->setBaseFlags(*inFlags);
}

physx::PxBaseFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRackAndPinionJoint_getBaseFlags_0(physx::PxRackAndPinionJoint* self) {
  static thread_local physx::PxBaseFlags temp;
  return (temp = self->getBaseFlags(), &temp);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRackAndPinionJoint_isReleasable_0(physx::PxRackAndPinionJoint* self) {
  return self->isReleasable();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRackAndPinionJoint_setActors_2(physx::PxRackAndPinionJoint* self, physx::PxRigidActor* actor0, physx::PxRigidActor* actor1) {
  self->setActors(actor0, actor1);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRackAndPinionJoint_setLocalPose_2(physx::PxRackAndPinionJoint* self, PxJointActorIndexEnum actor, const physx::PxTransform* localPose) {
  self->setLocalPose(actor, *localPose);
}

physx::PxTransform* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRackAndPinionJoint_getLocalPose_1(physx::PxRackAndPinionJoint* self, PxJointActorIndexEnum actor) {
  static thread_local physx::PxTransform temp;
  return (temp = self->getLocalPose(actor), &temp);
}

physx::PxTransform* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRackAndPinionJoint_getRelativeTransform_0(physx::PxRackAndPinionJoint* self) {
  static thread_local physx::PxTransform temp;
  return (temp = self->getRelativeTransform(), &temp);
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRackAndPinionJoint_getRelativeLinearVelocity_0(physx::PxRackAndPinionJoint* self) {
  static thread_local physx::PxVec3 temp;
  return (temp = self->getRelativeLinearVelocity(), &temp);
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRackAndPinionJoint_getRelativeAngularVelocity_0(physx::PxRackAndPinionJoint* self) {
  static thread_local physx::PxVec3 temp;
  return (temp = self->getRelativeAngularVelocity(), &temp);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRackAndPinionJoint_setBreakForce_2(physx::PxRackAndPinionJoint* self, float force, float torque) {
  self->setBreakForce(force, torque);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRackAndPinionJoint_setConstraintFlags_1(physx::PxRackAndPinionJoint* self, physx::PxConstraintFlags* flags) {
  self->setConstraintFlags(*flags);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRackAndPinionJoint_setConstraintFlag_2(physx::PxRackAndPinionJoint* self, PxConstraintFlagEnum flag, bool value) {
  self->setConstraintFlag(flag, value);
}

physx::PxConstraintFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRackAndPinionJoint_getConstraintFlags_0(physx::PxRackAndPinionJoint* self) {
  static thread_local physx::PxConstraintFlags temp;
  return (temp = self->getConstraintFlags(), &temp);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRackAndPinionJoint_setInvMassScale0_1(physx::PxRackAndPinionJoint* self, float invMassScale) {
  self->setInvMassScale0(invMassScale);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRackAndPinionJoint_getInvMassScale0_0(physx::PxRackAndPinionJoint* self) {
  return self->getInvMassScale0();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRackAndPinionJoint_setInvMassScale1_1(physx::PxRackAndPinionJoint* self, float invMassScale) {
  self->setInvMassScale1(invMassScale);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRackAndPinionJoint_getInvMassScale1_0(physx::PxRackAndPinionJoint* self) {
  return self->getInvMassScale1();
}

physx::PxConstraint* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRackAndPinionJoint_getConstraint_0(physx::PxRackAndPinionJoint* self) {
  return self->getConstraint();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRackAndPinionJoint_setName_1(physx::PxRackAndPinionJoint* self, const char* name) {
  self->setName(name);
}

const char* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRackAndPinionJoint_getName_0(physx::PxRackAndPinionJoint* self) {
  return self->getName();
}

physx::PxScene* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRackAndPinionJoint_getScene_0(physx::PxRackAndPinionJoint* self) {
  return self->getScene();
}

void* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRackAndPinionJoint_get_userData_0(physx::PxRackAndPinionJoint* self) {
  return self->userData;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRackAndPinionJoint_set_userData_1(physx::PxRackAndPinionJoint* self, void* arg0) {
  self->userData = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRackAndPinionJoint___destroy___0(physx::PxRackAndPinionJoint* self) {
  delete self;
}

// Interface: PxRaycastBuffer10


PxRaycastBuffer10* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRaycastBuffer10_PxRaycastBuffer10_0() {
  return new PxRaycastBuffer10();
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRaycastBuffer10_getNbAnyHits_0(PxRaycastBuffer10* self) {
  return self->getNbAnyHits();
}

const physx::PxRaycastHit* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRaycastBuffer10_getAnyHit_1(PxRaycastBuffer10* self, unsigned int index) {
  return &self->getAnyHit(index);
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRaycastBuffer10_getNbTouches_0(PxRaycastBuffer10* self) {
  return self->getNbTouches();
}

const physx::PxRaycastHit* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRaycastBuffer10_getTouches_0(PxRaycastBuffer10* self) {
  return self->getTouches();
}

const physx::PxRaycastHit* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRaycastBuffer10_getTouch_1(PxRaycastBuffer10* self, unsigned int index) {
  return &self->getTouch(index);
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRaycastBuffer10_getMaxNbTouches_0(PxRaycastBuffer10* self) {
  return self->getMaxNbTouches();
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRaycastBuffer10_hasAnyHits_0(PxRaycastBuffer10* self) {
  return self->hasAnyHits();
}

physx::PxRaycastHit* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRaycastBuffer10_get_block_0(PxRaycastBuffer10* self) {
  return &self->block;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRaycastBuffer10_set_block_1(PxRaycastBuffer10* self, physx::PxRaycastHit* arg0) {
  self->block = *arg0;
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRaycastBuffer10_get_hasBlock_0(PxRaycastBuffer10* self) {
  return self->hasBlock;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRaycastBuffer10_set_hasBlock_1(PxRaycastBuffer10* self, bool arg0) {
  self->hasBlock = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRaycastBuffer10___destroy___0(PxRaycastBuffer10* self) {
  delete self;
}

// Interface: PxRaycastHit


physx::PxRaycastHit* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRaycastHit_PxRaycastHit_0() {
  return new physx::PxRaycastHit();
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRaycastHit_hadInitialOverlap_0(physx::PxRaycastHit* self) {
  return self->hadInitialOverlap();
}

physx::PxRigidActor* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRaycastHit_get_actor_0(physx::PxRaycastHit* self) {
  return self->actor;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRaycastHit_set_actor_1(physx::PxRaycastHit* self, physx::PxRigidActor* arg0) {
  self->actor = arg0;
}

physx::PxShape* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRaycastHit_get_shape_0(physx::PxRaycastHit* self) {
  return self->shape;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRaycastHit_set_shape_1(physx::PxRaycastHit* self, physx::PxShape* arg0) {
  self->shape = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRaycastHit_get_u_0(physx::PxRaycastHit* self) {
  return self->u;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRaycastHit_set_u_1(physx::PxRaycastHit* self, float arg0) {
  self->u = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRaycastHit_get_v_0(physx::PxRaycastHit* self) {
  return self->v;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRaycastHit_set_v_1(physx::PxRaycastHit* self, float arg0) {
  self->v = arg0;
}

physx::PxHitFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRaycastHit_get_flags_0(physx::PxRaycastHit* self) {
  return &self->flags;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRaycastHit_set_flags_1(physx::PxRaycastHit* self, physx::PxHitFlags* arg0) {
  self->flags = *arg0;
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRaycastHit_get_position_0(physx::PxRaycastHit* self) {
  return &self->position;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRaycastHit_set_position_1(physx::PxRaycastHit* self, physx::PxVec3* arg0) {
  self->position = *arg0;
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRaycastHit_get_normal_0(physx::PxRaycastHit* self) {
  return &self->normal;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRaycastHit_set_normal_1(physx::PxRaycastHit* self, physx::PxVec3* arg0) {
  self->normal = *arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRaycastHit_get_distance_0(physx::PxRaycastHit* self) {
  return self->distance;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRaycastHit_set_distance_1(physx::PxRaycastHit* self, float arg0) {
  self->distance = arg0;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRaycastHit_get_faceIndex_0(physx::PxRaycastHit* self) {
  return self->faceIndex;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRaycastHit_set_faceIndex_1(physx::PxRaycastHit* self, unsigned int arg0) {
  self->faceIndex = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRaycastHit___destroy___0(physx::PxRaycastHit* self) {
  delete self;
}

// Interface: PxRaycastResult


PxRaycastResult* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRaycastResult_PxRaycastResult_0() {
  return new PxRaycastResult();
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRaycastResult_getNbAnyHits_0(PxRaycastResult* self) {
  return self->getNbAnyHits();
}

const physx::PxRaycastHit* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRaycastResult_getAnyHit_1(PxRaycastResult* self, unsigned int index) {
  return &self->getAnyHit(index);
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRaycastResult_getNbTouches_0(PxRaycastResult* self) {
  return self->getNbTouches();
}

const physx::PxRaycastHit* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRaycastResult_getTouch_1(PxRaycastResult* self, unsigned int index) {
  return &self->getTouch(index);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRaycastResult_hasAnyHits_0(PxRaycastResult* self) {
  return self->hasAnyHits();
}

physx::PxRaycastHit* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRaycastResult_get_block_0(PxRaycastResult* self) {
  return &self->block;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRaycastResult_set_block_1(PxRaycastResult* self, physx::PxRaycastHit* arg0) {
  self->block = *arg0;
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRaycastResult_get_hasBlock_0(PxRaycastResult* self) {
  return self->hasBlock;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRaycastResult_set_hasBlock_1(PxRaycastResult* self, bool arg0) {
  self->hasBlock = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRaycastResult___destroy___0(PxRaycastResult* self) {
  delete self;
}

// Interface: PxRealPtr


void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRealPtr___destroy___0(PxRealPtr* self) {
  delete self;
}

// Interface: PxRenderBuffer


unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRenderBuffer_getNbPoints_0(physx::PxRenderBuffer* self) {
  return self->getNbPoints();
}

const physx::PxDebugPoint* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRenderBuffer_getPoints_0(physx::PxRenderBuffer* self) {
  return self->getPoints();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRenderBuffer_addPoint_1(physx::PxRenderBuffer* self, const physx::PxDebugPoint* point) {
  self->addPoint(*point);
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRenderBuffer_getNbLines_0(physx::PxRenderBuffer* self) {
  return self->getNbLines();
}

const physx::PxDebugLine* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRenderBuffer_getLines_0(physx::PxRenderBuffer* self) {
  return self->getLines();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRenderBuffer_addLine_1(physx::PxRenderBuffer* self, const physx::PxDebugLine* line) {
  self->addLine(*line);
}

physx::PxDebugLine* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRenderBuffer_reserveLines_1(physx::PxRenderBuffer* self, const unsigned int nbLines) {
  return self->reserveLines(nbLines);
}

physx::PxDebugPoint* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRenderBuffer_reservePoints_1(physx::PxRenderBuffer* self, const unsigned int nbLines) {
  return self->reservePoints(nbLines);
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRenderBuffer_getNbTriangles_0(physx::PxRenderBuffer* self) {
  return self->getNbTriangles();
}

const physx::PxDebugTriangle* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRenderBuffer_getTriangles_0(physx::PxRenderBuffer* self) {
  return self->getTriangles();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRenderBuffer_addTriangle_1(physx::PxRenderBuffer* self, const physx::PxDebugTriangle* triangle) {
  self->addTriangle(*triangle);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRenderBuffer_append_1(physx::PxRenderBuffer* self, const physx::PxRenderBuffer* other) {
  self->append(*other);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRenderBuffer_clear_0(physx::PxRenderBuffer* self) {
  self->clear();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRenderBuffer_shift_1(physx::PxRenderBuffer* self, const physx::PxVec3* delta) {
  self->shift(*delta);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRenderBuffer_empty_0(physx::PxRenderBuffer* self) {
  return self->empty();
}

// Interface: PxRevoluteJoint


float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRevoluteJoint_getAngle_0(physx::PxRevoluteJoint* self) {
  return self->getAngle();
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRevoluteJoint_getVelocity_0(physx::PxRevoluteJoint* self) {
  return self->getVelocity();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRevoluteJoint_setLimit_1(physx::PxRevoluteJoint* self, const physx::PxJointAngularLimitPair* limits) {
  self->setLimit(*limits);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRevoluteJoint_setDriveVelocity_1(physx::PxRevoluteJoint* self, float velocity) {
  self->setDriveVelocity(velocity);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRevoluteJoint_setDriveVelocity_2(physx::PxRevoluteJoint* self, float velocity, bool autowake) {
  self->setDriveVelocity(velocity, autowake);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRevoluteJoint_getDriveVelocity_0(physx::PxRevoluteJoint* self) {
  return self->getDriveVelocity();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRevoluteJoint_setDriveForceLimit_1(physx::PxRevoluteJoint* self, float limit) {
  self->setDriveForceLimit(limit);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRevoluteJoint_getDriveForceLimit_0(physx::PxRevoluteJoint* self) {
  return self->getDriveForceLimit();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRevoluteJoint_setDriveGearRatio_1(physx::PxRevoluteJoint* self, float ratio) {
  self->setDriveGearRatio(ratio);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRevoluteJoint_getDriveGearRatio_0(physx::PxRevoluteJoint* self) {
  return self->getDriveGearRatio();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRevoluteJoint_setRevoluteJointFlags_1(physx::PxRevoluteJoint* self, physx::PxRevoluteJointFlags* flags) {
  self->setRevoluteJointFlags(*flags);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRevoluteJoint_setRevoluteJointFlag_2(physx::PxRevoluteJoint* self, PxRevoluteJointFlagEnum flag, bool value) {
  self->setRevoluteJointFlag(flag, value);
}

physx::PxRevoluteJointFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRevoluteJoint_getRevoluteJointFlags_0(physx::PxRevoluteJoint* self) {
  static thread_local physx::PxRevoluteJointFlags temp;
  return (temp = self->getRevoluteJointFlags(), &temp);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRevoluteJoint_release_0(physx::PxRevoluteJoint* self) {
  self->release();
}

const char* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRevoluteJoint_getConcreteTypeName_0(physx::PxRevoluteJoint* self) {
  return self->getConcreteTypeName();
}

int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRevoluteJoint_getConcreteType_0(physx::PxRevoluteJoint* self) {
  return self->getConcreteType();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRevoluteJoint_setBaseFlag_2(physx::PxRevoluteJoint* self, PxBaseFlagEnum flag, bool value) {
  self->setBaseFlag(flag, value);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRevoluteJoint_setBaseFlags_1(physx::PxRevoluteJoint* self, physx::PxBaseFlags* inFlags) {
  self->setBaseFlags(*inFlags);
}

physx::PxBaseFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRevoluteJoint_getBaseFlags_0(physx::PxRevoluteJoint* self) {
  static thread_local physx::PxBaseFlags temp;
  return (temp = self->getBaseFlags(), &temp);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRevoluteJoint_isReleasable_0(physx::PxRevoluteJoint* self) {
  return self->isReleasable();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRevoluteJoint_setActors_2(physx::PxRevoluteJoint* self, physx::PxRigidActor* actor0, physx::PxRigidActor* actor1) {
  self->setActors(actor0, actor1);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRevoluteJoint_setLocalPose_2(physx::PxRevoluteJoint* self, PxJointActorIndexEnum actor, const physx::PxTransform* localPose) {
  self->setLocalPose(actor, *localPose);
}

physx::PxTransform* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRevoluteJoint_getLocalPose_1(physx::PxRevoluteJoint* self, PxJointActorIndexEnum actor) {
  static thread_local physx::PxTransform temp;
  return (temp = self->getLocalPose(actor), &temp);
}

physx::PxTransform* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRevoluteJoint_getRelativeTransform_0(physx::PxRevoluteJoint* self) {
  static thread_local physx::PxTransform temp;
  return (temp = self->getRelativeTransform(), &temp);
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRevoluteJoint_getRelativeLinearVelocity_0(physx::PxRevoluteJoint* self) {
  static thread_local physx::PxVec3 temp;
  return (temp = self->getRelativeLinearVelocity(), &temp);
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRevoluteJoint_getRelativeAngularVelocity_0(physx::PxRevoluteJoint* self) {
  static thread_local physx::PxVec3 temp;
  return (temp = self->getRelativeAngularVelocity(), &temp);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRevoluteJoint_setBreakForce_2(physx::PxRevoluteJoint* self, float force, float torque) {
  self->setBreakForce(force, torque);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRevoluteJoint_setConstraintFlags_1(physx::PxRevoluteJoint* self, physx::PxConstraintFlags* flags) {
  self->setConstraintFlags(*flags);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRevoluteJoint_setConstraintFlag_2(physx::PxRevoluteJoint* self, PxConstraintFlagEnum flag, bool value) {
  self->setConstraintFlag(flag, value);
}

physx::PxConstraintFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRevoluteJoint_getConstraintFlags_0(physx::PxRevoluteJoint* self) {
  static thread_local physx::PxConstraintFlags temp;
  return (temp = self->getConstraintFlags(), &temp);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRevoluteJoint_setInvMassScale0_1(physx::PxRevoluteJoint* self, float invMassScale) {
  self->setInvMassScale0(invMassScale);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRevoluteJoint_getInvMassScale0_0(physx::PxRevoluteJoint* self) {
  return self->getInvMassScale0();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRevoluteJoint_setInvMassScale1_1(physx::PxRevoluteJoint* self, float invMassScale) {
  self->setInvMassScale1(invMassScale);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRevoluteJoint_getInvMassScale1_0(physx::PxRevoluteJoint* self) {
  return self->getInvMassScale1();
}

physx::PxConstraint* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRevoluteJoint_getConstraint_0(physx::PxRevoluteJoint* self) {
  return self->getConstraint();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRevoluteJoint_setName_1(physx::PxRevoluteJoint* self, const char* name) {
  self->setName(name);
}

const char* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRevoluteJoint_getName_0(physx::PxRevoluteJoint* self) {
  return self->getName();
}

physx::PxScene* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRevoluteJoint_getScene_0(physx::PxRevoluteJoint* self) {
  return self->getScene();
}

void* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRevoluteJoint_get_userData_0(physx::PxRevoluteJoint* self) {
  return self->userData;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRevoluteJoint_set_userData_1(physx::PxRevoluteJoint* self, void* arg0) {
  self->userData = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRevoluteJoint___destroy___0(physx::PxRevoluteJoint* self) {
  delete self;
}

// Interface: PxRevoluteJointFlags


physx::PxRevoluteJointFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRevoluteJointFlags_PxRevoluteJointFlags_1(unsigned short flags) {
  return new physx::PxRevoluteJointFlags(flags);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRevoluteJointFlags_isSet_1(physx::PxRevoluteJointFlags* self, PxRevoluteJointFlagEnum flag) {
  return self->isSet(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRevoluteJointFlags_raise_1(physx::PxRevoluteJointFlags* self, PxRevoluteJointFlagEnum flag) {
  self->raise(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRevoluteJointFlags_clear_1(physx::PxRevoluteJointFlags* self, PxRevoluteJointFlagEnum flag) {
  self->clear(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRevoluteJointFlags___destroy___0(physx::PxRevoluteJointFlags* self) {
  delete self;
}

// Interface: PxRigidActorExt


physx::PxShape* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidActorExt_createExclusiveShape_3(physx::PxRigidActor* actor, const physx::PxGeometry* geometry, const physx::PxMaterial* material) {
  return physx::PxRigidActorExt::createExclusiveShape(*actor, *geometry, *material);
}

physx::PxShape* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidActorExt_createExclusiveShape_4(physx::PxRigidActor* actor, const physx::PxGeometry* geometry, const physx::PxMaterial* material, physx::PxShapeFlags* flags) {
  return physx::PxRigidActorExt::createExclusiveShape(*actor, *geometry, *material, *flags);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidActorExt___destroy___0(physx::PxRigidActorExt* self) {
  delete self;
}

// Interface: PxRigidBodyExt


bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBodyExt_updateMassAndInertia_2(physx::PxRigidBody* body, float density) {
  return physx::PxRigidBodyExt::updateMassAndInertia(*body, density);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBodyExt_updateMassAndInertia_3(physx::PxRigidBody* body, float density, physx::PxVec3* massLocalPose) {
  return physx::PxRigidBodyExt::updateMassAndInertia(*body, density, massLocalPose);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBodyExt_updateMassAndInertia_4(physx::PxRigidBody* body, float density, physx::PxVec3* massLocalPose, bool includeNonSimShapes) {
  return physx::PxRigidBodyExt::updateMassAndInertia(*body, density, massLocalPose, includeNonSimShapes);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBodyExt_setMassAndUpdateInertia_2(physx::PxRigidBody* body, float mass) {
  return physx::PxRigidBodyExt::setMassAndUpdateInertia(*body, mass);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBodyExt_setMassAndUpdateInertia_3(physx::PxRigidBody* body, float mass, physx::PxVec3* massLocalPose) {
  return physx::PxRigidBodyExt::setMassAndUpdateInertia(*body, mass, massLocalPose);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBodyExt_setMassAndUpdateInertia_4(physx::PxRigidBody* body, float mass, physx::PxVec3* massLocalPose, bool includeNonSimShapes) {
  return physx::PxRigidBodyExt::setMassAndUpdateInertia(*body, mass, massLocalPose, includeNonSimShapes);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBodyExt_addForceAtPos_3(physx::PxRigidBody* body, const physx::PxVec3* force, const physx::PxVec3* pos) {
  physx::PxRigidBodyExt::addForceAtPos(*body, *force, *pos);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBodyExt_addForceAtPos_4(physx::PxRigidBody* body, const physx::PxVec3* force, const physx::PxVec3* pos, PxForceModeEnum mode) {
  physx::PxRigidBodyExt::addForceAtPos(*body, *force, *pos, mode);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBodyExt_addForceAtPos_5(physx::PxRigidBody* body, const physx::PxVec3* force, const physx::PxVec3* pos, PxForceModeEnum mode, bool wakeup) {
  physx::PxRigidBodyExt::addForceAtPos(*body, *force, *pos, mode, wakeup);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBodyExt_addForceAtLocalPos_3(physx::PxRigidBody* body, const physx::PxVec3* force, const physx::PxVec3* pos) {
  physx::PxRigidBodyExt::addForceAtLocalPos(*body, *force, *pos);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBodyExt_addForceAtLocalPos_4(physx::PxRigidBody* body, const physx::PxVec3* force, const physx::PxVec3* pos, PxForceModeEnum mode) {
  physx::PxRigidBodyExt::addForceAtLocalPos(*body, *force, *pos, mode);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBodyExt_addForceAtLocalPos_5(physx::PxRigidBody* body, const physx::PxVec3* force, const physx::PxVec3* pos, PxForceModeEnum mode, bool wakeup) {
  physx::PxRigidBodyExt::addForceAtLocalPos(*body, *force, *pos, mode, wakeup);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBodyExt_addLocalForceAtPos_3(physx::PxRigidBody* body, const physx::PxVec3* force, const physx::PxVec3* pos) {
  physx::PxRigidBodyExt::addLocalForceAtPos(*body, *force, *pos);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBodyExt_addLocalForceAtPos_4(physx::PxRigidBody* body, const physx::PxVec3* force, const physx::PxVec3* pos, PxForceModeEnum mode) {
  physx::PxRigidBodyExt::addLocalForceAtPos(*body, *force, *pos, mode);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBodyExt_addLocalForceAtPos_5(physx::PxRigidBody* body, const physx::PxVec3* force, const physx::PxVec3* pos, PxForceModeEnum mode, bool wakeup) {
  physx::PxRigidBodyExt::addLocalForceAtPos(*body, *force, *pos, mode, wakeup);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBodyExt_addLocalForceAtLocalPos_3(physx::PxRigidBody* body, const physx::PxVec3* force, const physx::PxVec3* pos) {
  physx::PxRigidBodyExt::addLocalForceAtLocalPos(*body, *force, *pos);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBodyExt_addLocalForceAtLocalPos_4(physx::PxRigidBody* body, const physx::PxVec3* force, const physx::PxVec3* pos, PxForceModeEnum mode) {
  physx::PxRigidBodyExt::addLocalForceAtLocalPos(*body, *force, *pos, mode);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBodyExt_addLocalForceAtLocalPos_5(physx::PxRigidBody* body, const physx::PxVec3* force, const physx::PxVec3* pos, PxForceModeEnum mode, bool wakeup) {
  physx::PxRigidBodyExt::addLocalForceAtLocalPos(*body, *force, *pos, mode, wakeup);
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBodyExt_getVelocityAtPos_2(const physx::PxRigidBody* body, const physx::PxVec3* pos) {
  static thread_local physx::PxVec3 temp;
  return (temp = physx::PxRigidBodyExt::getVelocityAtPos(*body, *pos), &temp);
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBodyExt_getLocalVelocityAtLocalPos_2(const physx::PxRigidBody* body, const physx::PxVec3* pos) {
  static thread_local physx::PxVec3 temp;
  return (temp = physx::PxRigidBodyExt::getLocalVelocityAtLocalPos(*body, *pos), &temp);
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBodyExt_getVelocityAtOffset_2(const physx::PxRigidBody* body, const physx::PxVec3* pos) {
  static thread_local physx::PxVec3 temp;
  return (temp = physx::PxRigidBodyExt::getVelocityAtOffset(*body, *pos), &temp);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBodyExt_computeVelocityDeltaFromImpulse_5(const physx::PxRigidBody* body, const physx::PxVec3* globalPose, const physx::PxVec3* point, physx::PxVec3* impulse, physx::PxVec3* invMassScale) {
  physx::PxRigidBodyExt::computeVelocityDeltaFromImpulse(*body, *globalPose, *point, *impulse, *invMassScale);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBodyExt_computeVelocityDeltaFromImpulse_8(const physx::PxRigidBody* body, const physx::PxTransform* globalPose, const physx::PxVec3* point, const physx::PxVec3* impulse, float invMassScale, float invInertiaScale, physx::PxVec3* deltaLinearVelocity, physx::PxVec3* deltaAngularVelocity) {
  physx::PxRigidBodyExt::computeVelocityDeltaFromImpulse(*body, *globalPose, *point, *impulse, invMassScale, invInertiaScale, *deltaLinearVelocity, *deltaAngularVelocity);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBodyExt_computeLinearAngularImpulse_8(const physx::PxRigidBody* body, const physx::PxTransform* globalPose, const physx::PxVec3* point, const physx::PxVec3* impulse, float invMassScale, float invInertiaScale, physx::PxVec3* linearImpulse, physx::PxVec3* angularImpulse) {
  physx::PxRigidBodyExt::computeLinearAngularImpulse(*body, *globalPose, *point, *impulse, invMassScale, invInertiaScale, *linearImpulse, *angularImpulse);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBodyExt___destroy___0(physx::PxRigidBodyExt* self) {
  delete self;
}

// Interface: PxRigidBodyFlags


physx::PxRigidBodyFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBodyFlags_PxRigidBodyFlags_1(unsigned char flags) {
  return new physx::PxRigidBodyFlags(flags);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBodyFlags_isSet_1(physx::PxRigidBodyFlags* self, PxRigidBodyFlagEnum flag) {
  return self->isSet(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBodyFlags_raise_1(physx::PxRigidBodyFlags* self, PxRigidBodyFlagEnum flag) {
  self->raise(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBodyFlags_clear_1(physx::PxRigidBodyFlags* self, PxRigidBodyFlagEnum flag) {
  self->clear(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidBodyFlags___destroy___0(physx::PxRigidBodyFlags* self) {
  delete self;
}

// Interface: PxRigidDynamic


void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamic_setKinematicTarget_1(physx::PxRigidDynamic* self, const physx::PxTransform* destination) {
  self->setKinematicTarget(*destination);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamic_getKinematicTarget_1(physx::PxRigidDynamic* self, physx::PxTransform* target) {
  return self->getKinematicTarget(*target);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamic_isSleeping_0(physx::PxRigidDynamic* self) {
  return self->isSleeping();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamic_setSleepThreshold_1(physx::PxRigidDynamic* self, float threshold) {
  self->setSleepThreshold(threshold);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamic_getSleepThreshold_0(physx::PxRigidDynamic* self) {
  return self->getSleepThreshold();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamic_setStabilizationThreshold_1(physx::PxRigidDynamic* self, float threshold) {
  self->setStabilizationThreshold(threshold);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamic_getStabilizationThreshold_0(physx::PxRigidDynamic* self) {
  return self->getStabilizationThreshold();
}

physx::PxRigidDynamicLockFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamic_getRigidDynamicLockFlags_0(physx::PxRigidDynamic* self) {
  static thread_local physx::PxRigidDynamicLockFlags temp;
  return (temp = self->getRigidDynamicLockFlags(), &temp);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamic_setRigidDynamicLockFlag_2(physx::PxRigidDynamic* self, PxRigidDynamicLockFlagEnum flag, bool value) {
  self->setRigidDynamicLockFlag(flag, value);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamic_setRigidDynamicLockFlags_1(physx::PxRigidDynamic* self, physx::PxRigidDynamicLockFlags* flags) {
  self->setRigidDynamicLockFlags(*flags);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamic_setLinearVelocity_1(physx::PxRigidDynamic* self, const physx::PxVec3* linVel) {
  self->setLinearVelocity(*linVel);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamic_setLinearVelocity_2(physx::PxRigidDynamic* self, const physx::PxVec3* linVel, bool autowake) {
  self->setLinearVelocity(*linVel, autowake);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamic_setAngularVelocity_1(physx::PxRigidDynamic* self, const physx::PxVec3* angVel) {
  self->setAngularVelocity(*angVel);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamic_setAngularVelocity_2(physx::PxRigidDynamic* self, const physx::PxVec3* angVel, bool autowake) {
  self->setAngularVelocity(*angVel, autowake);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamic_setWakeCounter_1(physx::PxRigidDynamic* self, float wakeCounterValue) {
  self->setWakeCounter(wakeCounterValue);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamic_getWakeCounter_0(physx::PxRigidDynamic* self) {
  return self->getWakeCounter();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamic_wakeUp_0(physx::PxRigidDynamic* self) {
  self->wakeUp();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamic_putToSleep_0(physx::PxRigidDynamic* self) {
  self->putToSleep();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamic_setSolverIterationCounts_1(physx::PxRigidDynamic* self, unsigned int minPositionIters) {
  self->setSolverIterationCounts(minPositionIters);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamic_setSolverIterationCounts_2(physx::PxRigidDynamic* self, unsigned int minPositionIters, unsigned int minVelocityIters) {
  self->setSolverIterationCounts(minPositionIters, minVelocityIters);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamic_getContactReportThreshold_0(physx::PxRigidDynamic* self) {
  return self->getContactReportThreshold();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamic_setContactReportThreshold_1(physx::PxRigidDynamic* self, float threshold) {
  self->setContactReportThreshold(threshold);
}

PxActorTypeEnum EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamic_getType_0(physx::PxRigidDynamic* self) {
  return self->getType();
}

physx::PxScene* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamic_getScene_0(physx::PxRigidDynamic* self) {
  return self->getScene();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamic_setName_1(physx::PxRigidDynamic* self, const char* name) {
  self->setName(name);
}

const char* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamic_getName_0(physx::PxRigidDynamic* self) {
  return self->getName();
}

physx::PxBounds3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamic_getWorldBounds_0(physx::PxRigidDynamic* self) {
  static thread_local physx::PxBounds3 temp;
  return (temp = self->getWorldBounds(), &temp);
}

physx::PxBounds3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamic_getWorldBounds_1(physx::PxRigidDynamic* self, float inflation) {
  static thread_local physx::PxBounds3 temp;
  return (temp = self->getWorldBounds(inflation), &temp);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamic_setActorFlag_2(physx::PxRigidDynamic* self, PxActorFlagEnum flag, bool value) {
  self->setActorFlag(flag, value);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamic_setActorFlags_1(physx::PxRigidDynamic* self, physx::PxActorFlags* flags) {
  self->setActorFlags(*flags);
}

physx::PxActorFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamic_getActorFlags_0(physx::PxRigidDynamic* self) {
  static thread_local physx::PxActorFlags temp;
  return (temp = self->getActorFlags(), &temp);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamic_setDominanceGroup_1(physx::PxRigidDynamic* self, unsigned char dominanceGroup) {
  self->setDominanceGroup(dominanceGroup);
}

unsigned char EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamic_getDominanceGroup_0(physx::PxRigidDynamic* self) {
  return self->getDominanceGroup();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamic_setOwnerClient_1(physx::PxRigidDynamic* self, unsigned char inClient) {
  self->setOwnerClient(inClient);
}

unsigned char EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamic_getOwnerClient_0(physx::PxRigidDynamic* self) {
  return self->getOwnerClient();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamic_release_0(physx::PxRigidDynamic* self) {
  self->release();
}

const char* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamic_getConcreteTypeName_0(physx::PxRigidDynamic* self) {
  return self->getConcreteTypeName();
}

int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamic_getConcreteType_0(physx::PxRigidDynamic* self) {
  return self->getConcreteType();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamic_setBaseFlag_2(physx::PxRigidDynamic* self, PxBaseFlagEnum flag, bool value) {
  self->setBaseFlag(flag, value);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamic_setBaseFlags_1(physx::PxRigidDynamic* self, physx::PxBaseFlags* inFlags) {
  self->setBaseFlags(*inFlags);
}

physx::PxBaseFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamic_getBaseFlags_0(physx::PxRigidDynamic* self) {
  static thread_local physx::PxBaseFlags temp;
  return (temp = self->getBaseFlags(), &temp);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamic_isReleasable_0(physx::PxRigidDynamic* self) {
  return self->isReleasable();
}

physx::PxTransform* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamic_getGlobalPose_0(physx::PxRigidDynamic* self) {
  static thread_local physx::PxTransform temp;
  return (temp = self->getGlobalPose(), &temp);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamic_setGlobalPose_1(physx::PxRigidDynamic* self, const physx::PxTransform* pose) {
  self->setGlobalPose(*pose);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamic_setGlobalPose_2(physx::PxRigidDynamic* self, const physx::PxTransform* pose, bool autowake) {
  self->setGlobalPose(*pose, autowake);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamic_attachShape_1(physx::PxRigidDynamic* self, physx::PxShape* shape) {
  return self->attachShape(*shape);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamic_detachShape_1(physx::PxRigidDynamic* self, physx::PxShape* shape) {
  self->detachShape(*shape);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamic_detachShape_2(physx::PxRigidDynamic* self, physx::PxShape* shape, bool wakeOnLostTouch) {
  self->detachShape(*shape, wakeOnLostTouch);
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamic_getNbShapes_0(physx::PxRigidDynamic* self) {
  return self->getNbShapes();
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamic_getShapes_3(physx::PxRigidDynamic* self, PxShapePtr* userBuffer, unsigned int bufferSize, unsigned int startIndex) {
  return self->getShapes(userBuffer, bufferSize, startIndex);
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamic_getNbConstraints_0(physx::PxRigidDynamic* self) {
  return self->getNbConstraints();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamic_setCMassLocalPose_1(physx::PxRigidDynamic* self, const physx::PxTransform* pose) {
  self->setCMassLocalPose(*pose);
}

physx::PxTransform* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamic_getCMassLocalPose_0(physx::PxRigidDynamic* self) {
  static thread_local physx::PxTransform temp;
  return (temp = self->getCMassLocalPose(), &temp);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamic_setMass_1(physx::PxRigidDynamic* self, float mass) {
  self->setMass(mass);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamic_getMass_0(physx::PxRigidDynamic* self) {
  return self->getMass();
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamic_getInvMass_0(physx::PxRigidDynamic* self) {
  return self->getInvMass();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamic_setMassSpaceInertiaTensor_1(physx::PxRigidDynamic* self, const physx::PxVec3* m) {
  self->setMassSpaceInertiaTensor(*m);
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamic_getMassSpaceInertiaTensor_0(physx::PxRigidDynamic* self) {
  static thread_local physx::PxVec3 temp;
  return (temp = self->getMassSpaceInertiaTensor(), &temp);
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamic_getMassSpaceInvInertiaTensor_0(physx::PxRigidDynamic* self) {
  static thread_local physx::PxVec3 temp;
  return (temp = self->getMassSpaceInvInertiaTensor(), &temp);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamic_setLinearDamping_1(physx::PxRigidDynamic* self, float linDamp) {
  self->setLinearDamping(linDamp);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamic_getLinearDamping_0(physx::PxRigidDynamic* self) {
  return self->getLinearDamping();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamic_setAngularDamping_1(physx::PxRigidDynamic* self, float angDamp) {
  self->setAngularDamping(angDamp);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamic_getAngularDamping_0(physx::PxRigidDynamic* self) {
  return self->getAngularDamping();
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamic_getLinearVelocity_0(physx::PxRigidDynamic* self) {
  static thread_local physx::PxVec3 temp;
  return (temp = self->getLinearVelocity(), &temp);
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamic_getAngularVelocity_0(physx::PxRigidDynamic* self) {
  static thread_local physx::PxVec3 temp;
  return (temp = self->getAngularVelocity(), &temp);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamic_setMaxLinearVelocity_1(physx::PxRigidDynamic* self, float maxLinVel) {
  self->setMaxLinearVelocity(maxLinVel);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamic_getMaxLinearVelocity_0(physx::PxRigidDynamic* self) {
  return self->getMaxLinearVelocity();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamic_setMaxAngularVelocity_1(physx::PxRigidDynamic* self, float maxAngVel) {
  self->setMaxAngularVelocity(maxAngVel);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamic_getMaxAngularVelocity_0(physx::PxRigidDynamic* self) {
  return self->getMaxAngularVelocity();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamic_addForce_1(physx::PxRigidDynamic* self, const physx::PxVec3* force) {
  self->addForce(*force);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamic_addForce_2(physx::PxRigidDynamic* self, const physx::PxVec3* force, PxForceModeEnum mode) {
  self->addForce(*force, mode);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamic_addForce_3(physx::PxRigidDynamic* self, const physx::PxVec3* force, PxForceModeEnum mode, bool autowake) {
  self->addForce(*force, mode, autowake);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamic_addTorque_1(physx::PxRigidDynamic* self, const physx::PxVec3* torque) {
  self->addTorque(*torque);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamic_addTorque_2(physx::PxRigidDynamic* self, const physx::PxVec3* torque, PxForceModeEnum mode) {
  self->addTorque(*torque, mode);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamic_addTorque_3(physx::PxRigidDynamic* self, const physx::PxVec3* torque, PxForceModeEnum mode, bool autowake) {
  self->addTorque(*torque, mode, autowake);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamic_clearForce_1(physx::PxRigidDynamic* self, PxForceModeEnum mode) {
  self->clearForce(mode);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamic_clearTorque_1(physx::PxRigidDynamic* self, PxForceModeEnum mode) {
  self->clearTorque(mode);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamic_setForceAndTorque_2(physx::PxRigidDynamic* self, const physx::PxVec3* force, const physx::PxVec3* torque) {
  self->setForceAndTorque(*force, *torque);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamic_setForceAndTorque_3(physx::PxRigidDynamic* self, const physx::PxVec3* force, const physx::PxVec3* torque, PxForceModeEnum mode) {
  self->setForceAndTorque(*force, *torque, mode);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamic_setRigidBodyFlag_2(physx::PxRigidDynamic* self, PxRigidBodyFlagEnum flag, bool value) {
  self->setRigidBodyFlag(flag, value);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamic_setRigidBodyFlags_1(physx::PxRigidDynamic* self, physx::PxRigidBodyFlags* inFlags) {
  self->setRigidBodyFlags(*inFlags);
}

physx::PxRigidBodyFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamic_getRigidBodyFlags_0(physx::PxRigidDynamic* self) {
  static thread_local physx::PxRigidBodyFlags temp;
  return (temp = self->getRigidBodyFlags(), &temp);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamic_setMinCCDAdvanceCoefficient_1(physx::PxRigidDynamic* self, float advanceCoefficient) {
  self->setMinCCDAdvanceCoefficient(advanceCoefficient);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamic_getMinCCDAdvanceCoefficient_0(physx::PxRigidDynamic* self) {
  return self->getMinCCDAdvanceCoefficient();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamic_setMaxDepenetrationVelocity_1(physx::PxRigidDynamic* self, float biasClamp) {
  self->setMaxDepenetrationVelocity(biasClamp);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamic_getMaxDepenetrationVelocity_0(physx::PxRigidDynamic* self) {
  return self->getMaxDepenetrationVelocity();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamic_setMaxContactImpulse_1(physx::PxRigidDynamic* self, float maxImpulse) {
  self->setMaxContactImpulse(maxImpulse);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamic_getMaxContactImpulse_0(physx::PxRigidDynamic* self) {
  return self->getMaxContactImpulse();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamic_setContactSlopCoefficient_1(physx::PxRigidDynamic* self, float slopCoefficient) {
  self->setContactSlopCoefficient(slopCoefficient);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamic_getContactSlopCoefficient_0(physx::PxRigidDynamic* self) {
  return self->getContactSlopCoefficient();
}

void* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamic_get_userData_0(physx::PxRigidDynamic* self) {
  return self->userData;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamic_set_userData_1(physx::PxRigidDynamic* self, void* arg0) {
  self->userData = arg0;
}

// Interface: PxRigidDynamicLockFlags


physx::PxRigidDynamicLockFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamicLockFlags_PxRigidDynamicLockFlags_1(unsigned char flags) {
  return new physx::PxRigidDynamicLockFlags(flags);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamicLockFlags_isSet_1(physx::PxRigidDynamicLockFlags* self, PxRigidDynamicLockFlagEnum flag) {
  return self->isSet(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamicLockFlags_raise_1(physx::PxRigidDynamicLockFlags* self, PxRigidDynamicLockFlagEnum flag) {
  self->raise(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamicLockFlags_clear_1(physx::PxRigidDynamicLockFlags* self, PxRigidDynamicLockFlagEnum flag) {
  self->clear(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidDynamicLockFlags___destroy___0(physx::PxRigidDynamicLockFlags* self) {
  delete self;
}

// Interface: PxRigidStatic


PxActorTypeEnum EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidStatic_getType_0(physx::PxRigidStatic* self) {
  return self->getType();
}

physx::PxScene* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidStatic_getScene_0(physx::PxRigidStatic* self) {
  return self->getScene();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidStatic_setName_1(physx::PxRigidStatic* self, const char* name) {
  self->setName(name);
}

const char* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidStatic_getName_0(physx::PxRigidStatic* self) {
  return self->getName();
}

physx::PxBounds3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidStatic_getWorldBounds_0(physx::PxRigidStatic* self) {
  static thread_local physx::PxBounds3 temp;
  return (temp = self->getWorldBounds(), &temp);
}

physx::PxBounds3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidStatic_getWorldBounds_1(physx::PxRigidStatic* self, float inflation) {
  static thread_local physx::PxBounds3 temp;
  return (temp = self->getWorldBounds(inflation), &temp);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidStatic_setActorFlag_2(physx::PxRigidStatic* self, PxActorFlagEnum flag, bool value) {
  self->setActorFlag(flag, value);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidStatic_setActorFlags_1(physx::PxRigidStatic* self, physx::PxActorFlags* flags) {
  self->setActorFlags(*flags);
}

physx::PxActorFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidStatic_getActorFlags_0(physx::PxRigidStatic* self) {
  static thread_local physx::PxActorFlags temp;
  return (temp = self->getActorFlags(), &temp);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidStatic_setDominanceGroup_1(physx::PxRigidStatic* self, unsigned char dominanceGroup) {
  self->setDominanceGroup(dominanceGroup);
}

unsigned char EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidStatic_getDominanceGroup_0(physx::PxRigidStatic* self) {
  return self->getDominanceGroup();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidStatic_setOwnerClient_1(physx::PxRigidStatic* self, unsigned char inClient) {
  self->setOwnerClient(inClient);
}

unsigned char EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidStatic_getOwnerClient_0(physx::PxRigidStatic* self) {
  return self->getOwnerClient();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidStatic_release_0(physx::PxRigidStatic* self) {
  self->release();
}

const char* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidStatic_getConcreteTypeName_0(physx::PxRigidStatic* self) {
  return self->getConcreteTypeName();
}

int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidStatic_getConcreteType_0(physx::PxRigidStatic* self) {
  return self->getConcreteType();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidStatic_setBaseFlag_2(physx::PxRigidStatic* self, PxBaseFlagEnum flag, bool value) {
  self->setBaseFlag(flag, value);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidStatic_setBaseFlags_1(physx::PxRigidStatic* self, physx::PxBaseFlags* inFlags) {
  self->setBaseFlags(*inFlags);
}

physx::PxBaseFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidStatic_getBaseFlags_0(physx::PxRigidStatic* self) {
  static thread_local physx::PxBaseFlags temp;
  return (temp = self->getBaseFlags(), &temp);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidStatic_isReleasable_0(physx::PxRigidStatic* self) {
  return self->isReleasable();
}

physx::PxTransform* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidStatic_getGlobalPose_0(physx::PxRigidStatic* self) {
  static thread_local physx::PxTransform temp;
  return (temp = self->getGlobalPose(), &temp);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidStatic_setGlobalPose_1(physx::PxRigidStatic* self, const physx::PxTransform* pose) {
  self->setGlobalPose(*pose);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidStatic_setGlobalPose_2(physx::PxRigidStatic* self, const physx::PxTransform* pose, bool autowake) {
  self->setGlobalPose(*pose, autowake);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidStatic_attachShape_1(physx::PxRigidStatic* self, physx::PxShape* shape) {
  return self->attachShape(*shape);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidStatic_detachShape_1(physx::PxRigidStatic* self, physx::PxShape* shape) {
  self->detachShape(*shape);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidStatic_detachShape_2(physx::PxRigidStatic* self, physx::PxShape* shape, bool wakeOnLostTouch) {
  self->detachShape(*shape, wakeOnLostTouch);
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidStatic_getNbShapes_0(physx::PxRigidStatic* self) {
  return self->getNbShapes();
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidStatic_getShapes_3(physx::PxRigidStatic* self, PxShapePtr* userBuffer, unsigned int bufferSize, unsigned int startIndex) {
  return self->getShapes(userBuffer, bufferSize, startIndex);
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidStatic_getNbConstraints_0(physx::PxRigidStatic* self) {
  return self->getNbConstraints();
}

void* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidStatic_get_userData_0(physx::PxRigidStatic* self) {
  return self->userData;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxRigidStatic_set_userData_1(physx::PxRigidStatic* self, void* arg0) {
  self->userData = arg0;
}

// Interface: PxScene


bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_addActor_1(physx::PxScene* self, physx::PxActor* actor) {
  return self->addActor(*actor);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_addActor_2(physx::PxScene* self, physx::PxActor* actor, const physx::PxBVH* bvh) {
  return self->addActor(*actor, bvh);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_removeActor_1(physx::PxScene* self, physx::PxActor* actor) {
  self->removeActor(*actor);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_removeActor_2(physx::PxScene* self, physx::PxActor* actor, bool wakeOnLostTouch) {
  self->removeActor(*actor, wakeOnLostTouch);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_addAggregate_1(physx::PxScene* self, physx::PxAggregate* aggregate) {
  return self->addAggregate(*aggregate);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_removeAggregate_1(physx::PxScene* self, physx::PxAggregate* aggregate) {
  self->removeAggregate(*aggregate);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_removeAggregate_2(physx::PxScene* self, physx::PxAggregate* aggregate, bool wakeOnLostTouch) {
  self->removeAggregate(*aggregate, wakeOnLostTouch);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_addCollection_1(physx::PxScene* self, const physx::PxCollection* collection) {
  return self->addCollection(*collection);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_getWakeCounterResetValue_0(physx::PxScene* self) {
  return self->getWakeCounterResetValue();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_shiftOrigin_1(physx::PxScene* self, const physx::PxVec3* shift) {
  self->shiftOrigin(*shift);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_addArticulation_1(physx::PxScene* self, physx::PxArticulationReducedCoordinate* articulation) {
  return self->addArticulation(*articulation);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_removeArticulation_1(physx::PxScene* self, physx::PxArticulationReducedCoordinate* articulation) {
  self->removeArticulation(*articulation);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_removeArticulation_2(physx::PxScene* self, physx::PxArticulationReducedCoordinate* articulation, bool wakeOnLostTouch) {
  self->removeArticulation(*articulation, wakeOnLostTouch);
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_getNbActors_1(physx::PxScene* self, physx::PxActorTypeFlags* types) {
  return self->getNbActors(*types);
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_getNbArticulations_0(physx::PxScene* self) {
  return self->getNbArticulations();
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_getNbConstraints_0(physx::PxScene* self) {
  return self->getNbConstraints();
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_getNbAggregates_0(physx::PxScene* self) {
  return self->getNbAggregates();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_setDominanceGroupPair_3(physx::PxScene* self, unsigned char group1, unsigned char group2, const physx::PxDominanceGroupPair* dominance) {
  self->setDominanceGroupPair(group1, group2, *dominance);
}

physx::PxCpuDispatcher* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_getCpuDispatcher_0(physx::PxScene* self) {
  return self->getCpuDispatcher();
}

unsigned char EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_createClient_0(physx::PxScene* self) {
  return self->createClient();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_setSimulationEventCallback_1(physx::PxScene* self, physx::PxSimulationEventCallback* callback) {
  self->setSimulationEventCallback(callback);
}

physx::PxSimulationEventCallback* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_getSimulationEventCallback_0(physx::PxScene* self) {
  return self->getSimulationEventCallback();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_setFilterShaderData_2(physx::PxScene* self, const void* data, unsigned int dataSize) {
  self->setFilterShaderData(data, dataSize);
}

const void* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_getFilterShaderData_0(physx::PxScene* self) {
  return self->getFilterShaderData();
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_getFilterShaderDataSize_0(physx::PxScene* self) {
  return self->getFilterShaderDataSize();
}

physx::PxSimulationFilterShader* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_getFilterShader_0(physx::PxScene* self) {
  static thread_local physx::PxSimulationFilterShader temp;
  return (temp = self->getFilterShader(), &temp);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_resetFiltering_1(physx::PxScene* self, physx::PxActor* actor) {
  return self->resetFiltering(*actor);
}

PxPairFilteringModeEnum EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_getKinematicKinematicFilteringMode_0(physx::PxScene* self) {
  return self->getKinematicKinematicFilteringMode();
}

PxPairFilteringModeEnum EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_getStaticKinematicFilteringMode_0(physx::PxScene* self) {
  return self->getStaticKinematicFilteringMode();
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_simulate_1(physx::PxScene* self, float elapsedTime) {
  return self->simulate(elapsedTime);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_simulate_2(physx::PxScene* self, float elapsedTime, physx::PxBaseTask* completionTask) {
  return self->simulate(elapsedTime, completionTask);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_simulate_3(physx::PxScene* self, float elapsedTime, physx::PxBaseTask* completionTask, void* scratchMemBlock) {
  return self->simulate(elapsedTime, completionTask, scratchMemBlock);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_simulate_4(physx::PxScene* self, float elapsedTime, physx::PxBaseTask* completionTask, void* scratchMemBlock, unsigned int scratchMemBlockSize) {
  return self->simulate(elapsedTime, completionTask, scratchMemBlock, scratchMemBlockSize);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_simulate_5(physx::PxScene* self, float elapsedTime, physx::PxBaseTask* completionTask, void* scratchMemBlock, unsigned int scratchMemBlockSize, bool controlSimulation) {
  return self->simulate(elapsedTime, completionTask, scratchMemBlock, scratchMemBlockSize, controlSimulation);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_advance_0(physx::PxScene* self) {
  return self->advance();
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_advance_1(physx::PxScene* self, physx::PxBaseTask* completionTask) {
  return self->advance(completionTask);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_collide_1(physx::PxScene* self, float elapsedTime) {
  return self->collide(elapsedTime);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_collide_2(physx::PxScene* self, float elapsedTime, physx::PxBaseTask* completionTask) {
  return self->collide(elapsedTime, completionTask);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_collide_3(physx::PxScene* self, float elapsedTime, physx::PxBaseTask* completionTask, void* scratchMemBlock) {
  return self->collide(elapsedTime, completionTask, scratchMemBlock);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_collide_4(physx::PxScene* self, float elapsedTime, physx::PxBaseTask* completionTask, void* scratchMemBlock, unsigned int scratchMemBlockSize) {
  return self->collide(elapsedTime, completionTask, scratchMemBlock, scratchMemBlockSize);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_collide_5(physx::PxScene* self, float elapsedTime, physx::PxBaseTask* completionTask, void* scratchMemBlock, unsigned int scratchMemBlockSize, bool controlSimulation) {
  return self->collide(elapsedTime, completionTask, scratchMemBlock, scratchMemBlockSize, controlSimulation);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_checkResults_0(physx::PxScene* self) {
  return self->checkResults();
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_checkResults_1(physx::PxScene* self, bool block) {
  return self->checkResults(block);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_fetchCollision_0(physx::PxScene* self) {
  return self->fetchCollision();
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_fetchCollision_1(physx::PxScene* self, bool block) {
  return self->fetchCollision(block);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_fetchResults_0(physx::PxScene* self) {
  return self->fetchResults();
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_fetchResults_1(physx::PxScene* self, bool block) {
  return self->fetchResults(block);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_processCallbacks_1(physx::PxScene* self, physx::PxBaseTask* continuation) {
  self->processCallbacks(continuation);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_fetchResultsParticleSystem_0(physx::PxScene* self) {
  self->fetchResultsParticleSystem();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_flushSimulation_0(physx::PxScene* self) {
  self->flushSimulation();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_flushSimulation_1(physx::PxScene* self, bool sendPendingReports) {
  self->flushSimulation(sendPendingReports);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_setGravity_1(physx::PxScene* self, const physx::PxVec3* vec) {
  self->setGravity(*vec);
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_getGravity_0(physx::PxScene* self) {
  static thread_local physx::PxVec3 temp;
  return (temp = self->getGravity(), &temp);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_setBounceThresholdVelocity_1(physx::PxScene* self, float t) {
  self->setBounceThresholdVelocity(t);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_getBounceThresholdVelocity_0(physx::PxScene* self) {
  return self->getBounceThresholdVelocity();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_setCCDMaxPasses_1(physx::PxScene* self, unsigned int ccdMaxPasses) {
  self->setCCDMaxPasses(ccdMaxPasses);
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_getCCDMaxPasses_0(physx::PxScene* self) {
  return self->getCCDMaxPasses();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_setCCDMaxSeparation_1(physx::PxScene* self, float t) {
  self->setCCDMaxSeparation(t);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_getCCDMaxSeparation_0(physx::PxScene* self) {
  return self->getCCDMaxSeparation();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_setCCDThreshold_1(physx::PxScene* self, float t) {
  self->setCCDThreshold(t);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_getCCDThreshold_0(physx::PxScene* self) {
  return self->getCCDThreshold();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_setMaxBiasCoefficient_1(physx::PxScene* self, float t) {
  self->setMaxBiasCoefficient(t);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_getMaxBiasCoefficient_0(physx::PxScene* self) {
  return self->getMaxBiasCoefficient();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_setFrictionOffsetThreshold_1(physx::PxScene* self, float t) {
  self->setFrictionOffsetThreshold(t);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_getFrictionOffsetThreshold_0(physx::PxScene* self) {
  return self->getFrictionOffsetThreshold();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_setFrictionCorrelationDistance_1(physx::PxScene* self, float t) {
  self->setFrictionCorrelationDistance(t);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_getFrictionCorrelationDistance_0(physx::PxScene* self) {
  return self->getFrictionCorrelationDistance();
}

PxFrictionTypeEnum EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_getFrictionType_0(physx::PxScene* self) {
  return self->getFrictionType();
}

PxSolverTypeEnum EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_getSolverType_0(physx::PxScene* self) {
  return self->getSolverType();
}

const physx::PxRenderBuffer* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_getRenderBuffer_0(physx::PxScene* self) {
  return &self->getRenderBuffer();
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_setVisualizationParameter_2(physx::PxScene* self, PxVisualizationParameterEnum param, float value) {
  return self->setVisualizationParameter(param, value);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_getVisualizationParameter_1(physx::PxScene* self, PxVisualizationParameterEnum paramEnum) {
  return self->getVisualizationParameter(paramEnum);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_setVisualizationCullingBox_1(physx::PxScene* self, const physx::PxBounds3* box) {
  self->setVisualizationCullingBox(*box);
}

physx::PxBounds3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_getVisualizationCullingBox_0(physx::PxScene* self) {
  static thread_local physx::PxBounds3 temp;
  return (temp = self->getVisualizationCullingBox(), &temp);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_getSimulationStatistics_1(physx::PxScene* self, physx::PxSimulationStatistics* stats) {
  self->getSimulationStatistics(*stats);
}

PxBroadPhaseTypeEnum EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_getBroadPhaseType_0(physx::PxScene* self) {
  return self->getBroadPhaseType();
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_getBroadPhaseCaps_1(physx::PxScene* self, physx::PxBroadPhaseCaps* caps) {
  return self->getBroadPhaseCaps(*caps);
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_getNbBroadPhaseRegions_0(physx::PxScene* self) {
  return self->getNbBroadPhaseRegions();
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_getBroadPhaseRegions_2(physx::PxScene* self, physx::PxBroadPhaseRegionInfo* userBuffer, unsigned int bufferSize) {
  return self->getBroadPhaseRegions(userBuffer, bufferSize);
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_getBroadPhaseRegions_3(physx::PxScene* self, physx::PxBroadPhaseRegionInfo* userBuffer, unsigned int bufferSize, unsigned int startIndex) {
  return self->getBroadPhaseRegions(userBuffer, bufferSize, startIndex);
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_addBroadPhaseRegion_1(physx::PxScene* self, const physx::PxBroadPhaseRegion* region) {
  return self->addBroadPhaseRegion(*region);
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_addBroadPhaseRegion_2(physx::PxScene* self, const physx::PxBroadPhaseRegion* region, bool populateRegion) {
  return self->addBroadPhaseRegion(*region, populateRegion);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_removeBroadPhaseRegion_1(physx::PxScene* self, unsigned int handle) {
  return self->removeBroadPhaseRegion(handle);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_lockRead_0(physx::PxScene* self) {
  self->lockRead();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_lockRead_1(physx::PxScene* self, const char* file) {
  self->lockRead(file);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_lockRead_2(physx::PxScene* self, const char* file, unsigned int line) {
  self->lockRead(file, line);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_unlockRead_0(physx::PxScene* self) {
  self->unlockRead();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_lockWrite_0(physx::PxScene* self) {
  self->lockWrite();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_lockWrite_1(physx::PxScene* self, const char* file) {
  self->lockWrite(file);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_lockWrite_2(physx::PxScene* self, const char* file, unsigned int line) {
  self->lockWrite(file, line);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_unlockWrite_0(physx::PxScene* self) {
  self->unlockWrite();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_setNbContactDataBlocks_1(physx::PxScene* self, unsigned int numBlocks) {
  self->setNbContactDataBlocks(numBlocks);
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_getNbContactDataBlocksUsed_0(physx::PxScene* self) {
  return self->getNbContactDataBlocksUsed();
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_getMaxNbContactDataBlocksUsed_0(physx::PxScene* self) {
  return self->getMaxNbContactDataBlocksUsed();
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_getContactReportStreamBufferSize_0(physx::PxScene* self) {
  return self->getContactReportStreamBufferSize();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_setSolverBatchSize_1(physx::PxScene* self, unsigned int solverBatchSize) {
  self->setSolverBatchSize(solverBatchSize);
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_getSolverBatchSize_0(physx::PxScene* self) {
  return self->getSolverBatchSize();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_setSolverArticulationBatchSize_1(physx::PxScene* self, unsigned int solverBatchSize) {
  self->setSolverArticulationBatchSize(solverBatchSize);
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_getSolverArticulationBatchSize_0(physx::PxScene* self) {
  return self->getSolverArticulationBatchSize();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_release_0(physx::PxScene* self) {
  self->release();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_setFlag_2(physx::PxScene* self, PxSceneFlagEnum flag, bool value) {
  self->setFlag(flag, value);
}

physx::PxSceneFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_getFlags_0(physx::PxScene* self) {
  static thread_local physx::PxSceneFlags temp;
  return (temp = self->getFlags(), &temp);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_setLimits_1(physx::PxScene* self, const physx::PxSceneLimits* limits) {
  self->setLimits(*limits);
}

physx::PxSceneLimits* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_getLimits_0(physx::PxScene* self) {
  static thread_local physx::PxSceneLimits temp;
  return (temp = self->getLimits(), &temp);
}

physx::PxPhysics* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_getPhysics_0(physx::PxScene* self) {
  return &self->getPhysics();
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_getTimestamp_0(physx::PxScene* self) {
  return self->getTimestamp();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_setDynamicTreeRebuildRateHint_1(physx::PxScene* self, unsigned int dynamicTreeRebuildRateHint) {
  self->setDynamicTreeRebuildRateHint(dynamicTreeRebuildRateHint);
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_getDynamicTreeRebuildRateHint_0(physx::PxScene* self) {
  return self->getDynamicTreeRebuildRateHint();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_forceRebuildDynamicTree_1(physx::PxScene* self, unsigned int prunerIndex) {
  self->forceRebuildDynamicTree(prunerIndex);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_setUpdateMode_1(physx::PxScene* self, PxSceneQueryUpdateModeEnum updateMode) {
  self->setUpdateMode(updateMode);
}

PxSceneQueryUpdateModeEnum EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_getUpdateMode_0(physx::PxScene* self) {
  return self->getUpdateMode();
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_getStaticTimestamp_0(physx::PxScene* self) {
  return self->getStaticTimestamp();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_flushUpdates_0(physx::PxScene* self) {
  self->flushUpdates();
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_raycast_4(physx::PxScene* self, const physx::PxVec3* origin, const physx::PxVec3* unitDir, float distance, physx::PxRaycastCallback* hitCall) {
  return self->raycast(*origin, *unitDir, distance, *hitCall);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_raycast_5(physx::PxScene* self, const physx::PxVec3* origin, const physx::PxVec3* unitDir, float distance, physx::PxRaycastCallback* hitCall, physx::PxHitFlags* hitFlags) {
  return self->raycast(*origin, *unitDir, distance, *hitCall, *hitFlags);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_raycast_6(physx::PxScene* self, const physx::PxVec3* origin, const physx::PxVec3* unitDir, float distance, physx::PxRaycastCallback* hitCall, physx::PxHitFlags* hitFlags, const physx::PxQueryFilterData* filterData) {
  return self->raycast(*origin, *unitDir, distance, *hitCall, *hitFlags, *filterData);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_sweep_5(physx::PxScene* self, const physx::PxGeometry* geometry, const physx::PxTransform* pose, const physx::PxVec3* unitDir, float distance, physx::PxSweepCallback* hitCall) {
  return self->sweep(*geometry, *pose, *unitDir, distance, *hitCall);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_sweep_6(physx::PxScene* self, const physx::PxGeometry* geometry, const physx::PxTransform* pose, const physx::PxVec3* unitDir, float distance, physx::PxSweepCallback* hitCall, physx::PxHitFlags* hitFlags) {
  return self->sweep(*geometry, *pose, *unitDir, distance, *hitCall, *hitFlags);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_sweep_7(physx::PxScene* self, const physx::PxGeometry* geometry, const physx::PxTransform* pose, const physx::PxVec3* unitDir, float distance, physx::PxSweepCallback* hitCall, physx::PxHitFlags* hitFlags, const physx::PxQueryFilterData* filterData) {
  return self->sweep(*geometry, *pose, *unitDir, distance, *hitCall, *hitFlags, *filterData);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_overlap_3(physx::PxScene* self, const physx::PxGeometry* geometry, const physx::PxTransform* pose, physx::PxOverlapCallback* hitCall) {
  return self->overlap(*geometry, *pose, *hitCall);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_overlap_4(physx::PxScene* self, const physx::PxGeometry* geometry, const physx::PxTransform* pose, physx::PxOverlapCallback* hitCall, const physx::PxQueryFilterData* filterData) {
  return self->overlap(*geometry, *pose, *hitCall, *filterData);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_setSceneQueryUpdateMode_1(physx::PxScene* self, PxSceneQueryUpdateModeEnum updateMode) {
  self->setSceneQueryUpdateMode(updateMode);
}

PxSceneQueryUpdateModeEnum EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_getSceneQueryUpdateMode_0(physx::PxScene* self) {
  return self->getSceneQueryUpdateMode();
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_getSceneQueryStaticTimestamp_0(physx::PxScene* self) {
  return self->getSceneQueryStaticTimestamp();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_flushQueryUpdates_0(physx::PxScene* self) {
  self->flushQueryUpdates();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_forceDynamicTreeRebuild_2(physx::PxScene* self, bool rebuildStaticStructure, bool rebuildDynamicStructure) {
  self->forceDynamicTreeRebuild(rebuildStaticStructure, rebuildDynamicStructure);
}

PxPruningStructureTypeEnum EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_getStaticStructure_0(physx::PxScene* self) {
  return self->getStaticStructure();
}

PxPruningStructureTypeEnum EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_getDynamicStructure_0(physx::PxScene* self) {
  return self->getDynamicStructure();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_sceneQueriesUpdate_0(physx::PxScene* self) {
  self->sceneQueriesUpdate();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_sceneQueriesUpdate_1(physx::PxScene* self, physx::PxBaseTask* completionTask) {
  self->sceneQueriesUpdate(completionTask);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_sceneQueriesUpdate_2(physx::PxScene* self, physx::PxBaseTask* completionTask, bool controlSimulation) {
  self->sceneQueriesUpdate(completionTask, controlSimulation);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_checkQueries_0(physx::PxScene* self) {
  return self->checkQueries();
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_checkQueries_1(physx::PxScene* self, bool block) {
  return self->checkQueries(block);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_fetchQueries_0(physx::PxScene* self) {
  return self->fetchQueries();
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_fetchQueries_1(physx::PxScene* self, bool block) {
  return self->fetchQueries(block);
}

void* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_get_userData_0(physx::PxScene* self) {
  return self->userData;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxScene_set_userData_1(physx::PxScene* self, void* arg0) {
  self->userData = arg0;
}

// Interface: PxSceneDesc


physx::PxSceneDesc* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneDesc_PxSceneDesc_1(const physx::PxTolerancesScale* scale) {
  return new physx::PxSceneDesc(*scale);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneDesc_setToDefault_1(physx::PxSceneDesc* self, const physx::PxTolerancesScale* scale) {
  self->setToDefault(*scale);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneDesc_isValid_0(physx::PxSceneDesc* self) {
  return self->isValid();
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneDesc_get_gravity_0(physx::PxSceneDesc* self) {
  return &self->gravity;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneDesc_set_gravity_1(physx::PxSceneDesc* self, physx::PxVec3* arg0) {
  self->gravity = *arg0;
}

physx::PxSimulationEventCallback* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneDesc_get_simulationEventCallback_0(physx::PxSceneDesc* self) {
  return self->simulationEventCallback;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneDesc_set_simulationEventCallback_1(physx::PxSceneDesc* self, physx::PxSimulationEventCallback* arg0) {
  self->simulationEventCallback = arg0;
}

const void* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneDesc_get_filterShaderData_0(physx::PxSceneDesc* self) {
  return self->filterShaderData;
}

const void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneDesc_set_filterShaderData_1(physx::PxSceneDesc* self, void* arg0) {
  self->filterShaderData = arg0;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneDesc_get_filterShaderDataSize_0(physx::PxSceneDesc* self) {
  return self->filterShaderDataSize;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneDesc_set_filterShaderDataSize_1(physx::PxSceneDesc* self, unsigned int arg0) {
  self->filterShaderDataSize = arg0;
}

physx::PxSimulationFilterShader* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneDesc_get_filterShader_0(physx::PxSceneDesc* self) {
  return &self->filterShader;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneDesc_set_filterShader_1(physx::PxSceneDesc* self, physx::PxSimulationFilterShader* arg0) {
  self->filterShader = *arg0;
}

PxPairFilteringModeEnum EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneDesc_get_kineKineFilteringMode_0(physx::PxSceneDesc* self) {
  return self->kineKineFilteringMode;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneDesc_set_kineKineFilteringMode_1(physx::PxSceneDesc* self, PxPairFilteringModeEnum arg0) {
  self->kineKineFilteringMode = arg0;
}

PxPairFilteringModeEnum EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneDesc_get_staticKineFilteringMode_0(physx::PxSceneDesc* self) {
  return self->staticKineFilteringMode;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneDesc_set_staticKineFilteringMode_1(physx::PxSceneDesc* self, PxPairFilteringModeEnum arg0) {
  self->staticKineFilteringMode = arg0;
}

PxBroadPhaseTypeEnum EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneDesc_get_broadPhaseType_0(physx::PxSceneDesc* self) {
  return self->broadPhaseType;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneDesc_set_broadPhaseType_1(physx::PxSceneDesc* self, PxBroadPhaseTypeEnum arg0) {
  self->broadPhaseType = arg0;
}

physx::PxSceneLimits* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneDesc_get_limits_0(physx::PxSceneDesc* self) {
  return &self->limits;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneDesc_set_limits_1(physx::PxSceneDesc* self, physx::PxSceneLimits* arg0) {
  self->limits = *arg0;
}

PxFrictionTypeEnum EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneDesc_get_frictionType_0(physx::PxSceneDesc* self) {
  return self->frictionType;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneDesc_set_frictionType_1(physx::PxSceneDesc* self, PxFrictionTypeEnum arg0) {
  self->frictionType = arg0;
}

PxSolverTypeEnum EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneDesc_get_solverType_0(physx::PxSceneDesc* self) {
  return self->solverType;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneDesc_set_solverType_1(physx::PxSceneDesc* self, PxSolverTypeEnum arg0) {
  self->solverType = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneDesc_get_bounceThresholdVelocity_0(physx::PxSceneDesc* self) {
  return self->bounceThresholdVelocity;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneDesc_set_bounceThresholdVelocity_1(physx::PxSceneDesc* self, float arg0) {
  self->bounceThresholdVelocity = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneDesc_get_frictionOffsetThreshold_0(physx::PxSceneDesc* self) {
  return self->frictionOffsetThreshold;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneDesc_set_frictionOffsetThreshold_1(physx::PxSceneDesc* self, float arg0) {
  self->frictionOffsetThreshold = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneDesc_get_frictionCorrelationDistance_0(physx::PxSceneDesc* self) {
  return self->frictionCorrelationDistance;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneDesc_set_frictionCorrelationDistance_1(physx::PxSceneDesc* self, float arg0) {
  self->frictionCorrelationDistance = arg0;
}

physx::PxSceneFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneDesc_get_flags_0(physx::PxSceneDesc* self) {
  return &self->flags;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneDesc_set_flags_1(physx::PxSceneDesc* self, physx::PxSceneFlags* arg0) {
  self->flags = *arg0;
}

physx::PxCpuDispatcher* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneDesc_get_cpuDispatcher_0(physx::PxSceneDesc* self) {
  return self->cpuDispatcher;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneDesc_set_cpuDispatcher_1(physx::PxSceneDesc* self, physx::PxCpuDispatcher* arg0) {
  self->cpuDispatcher = arg0;
}

void* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneDesc_get_userData_0(physx::PxSceneDesc* self) {
  return self->userData;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneDesc_set_userData_1(physx::PxSceneDesc* self, void* arg0) {
  self->userData = arg0;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneDesc_get_solverBatchSize_0(physx::PxSceneDesc* self) {
  return self->solverBatchSize;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneDesc_set_solverBatchSize_1(physx::PxSceneDesc* self, unsigned int arg0) {
  self->solverBatchSize = arg0;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneDesc_get_solverArticulationBatchSize_0(physx::PxSceneDesc* self) {
  return self->solverArticulationBatchSize;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneDesc_set_solverArticulationBatchSize_1(physx::PxSceneDesc* self, unsigned int arg0) {
  self->solverArticulationBatchSize = arg0;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneDesc_get_nbContactDataBlocks_0(physx::PxSceneDesc* self) {
  return self->nbContactDataBlocks;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneDesc_set_nbContactDataBlocks_1(physx::PxSceneDesc* self, unsigned int arg0) {
  self->nbContactDataBlocks = arg0;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneDesc_get_maxNbContactDataBlocks_0(physx::PxSceneDesc* self) {
  return self->maxNbContactDataBlocks;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneDesc_set_maxNbContactDataBlocks_1(physx::PxSceneDesc* self, unsigned int arg0) {
  self->maxNbContactDataBlocks = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneDesc_get_maxBiasCoefficient_0(physx::PxSceneDesc* self) {
  return self->maxBiasCoefficient;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneDesc_set_maxBiasCoefficient_1(physx::PxSceneDesc* self, float arg0) {
  self->maxBiasCoefficient = arg0;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneDesc_get_contactReportStreamBufferSize_0(physx::PxSceneDesc* self) {
  return self->contactReportStreamBufferSize;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneDesc_set_contactReportStreamBufferSize_1(physx::PxSceneDesc* self, unsigned int arg0) {
  self->contactReportStreamBufferSize = arg0;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneDesc_get_ccdMaxPasses_0(physx::PxSceneDesc* self) {
  return self->ccdMaxPasses;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneDesc_set_ccdMaxPasses_1(physx::PxSceneDesc* self, unsigned int arg0) {
  self->ccdMaxPasses = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneDesc_get_ccdThreshold_0(physx::PxSceneDesc* self) {
  return self->ccdThreshold;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneDesc_set_ccdThreshold_1(physx::PxSceneDesc* self, float arg0) {
  self->ccdThreshold = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneDesc_get_ccdMaxSeparation_0(physx::PxSceneDesc* self) {
  return self->ccdMaxSeparation;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneDesc_set_ccdMaxSeparation_1(physx::PxSceneDesc* self, float arg0) {
  self->ccdMaxSeparation = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneDesc_get_wakeCounterResetValue_0(physx::PxSceneDesc* self) {
  return self->wakeCounterResetValue;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneDesc_set_wakeCounterResetValue_1(physx::PxSceneDesc* self, float arg0) {
  self->wakeCounterResetValue = arg0;
}

physx::PxBounds3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneDesc_get_sanityBounds_0(physx::PxSceneDesc* self) {
  return &self->sanityBounds;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneDesc_set_sanityBounds_1(physx::PxSceneDesc* self, physx::PxBounds3* arg0) {
  self->sanityBounds = *arg0;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneDesc_get_gpuMaxNumPartitions_0(physx::PxSceneDesc* self) {
  return self->gpuMaxNumPartitions;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneDesc_set_gpuMaxNumPartitions_1(physx::PxSceneDesc* self, unsigned int arg0) {
  self->gpuMaxNumPartitions = arg0;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneDesc_get_gpuMaxNumStaticPartitions_0(physx::PxSceneDesc* self) {
  return self->gpuMaxNumStaticPartitions;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneDesc_set_gpuMaxNumStaticPartitions_1(physx::PxSceneDesc* self, unsigned int arg0) {
  self->gpuMaxNumStaticPartitions = arg0;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneDesc_get_gpuComputeVersion_0(physx::PxSceneDesc* self) {
  return self->gpuComputeVersion;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneDesc_set_gpuComputeVersion_1(physx::PxSceneDesc* self, unsigned int arg0) {
  self->gpuComputeVersion = arg0;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneDesc_get_contactPairSlabSize_0(physx::PxSceneDesc* self) {
  return self->contactPairSlabSize;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneDesc_set_contactPairSlabSize_1(physx::PxSceneDesc* self, unsigned int arg0) {
  self->contactPairSlabSize = arg0;
}

PxPruningStructureTypeEnum EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneDesc_get_staticStructure_0(physx::PxSceneDesc* self) {
  return self->staticStructure;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneDesc_set_staticStructure_1(physx::PxSceneDesc* self, PxPruningStructureTypeEnum arg0) {
  self->staticStructure = arg0;
}

PxPruningStructureTypeEnum EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneDesc_get_dynamicStructure_0(physx::PxSceneDesc* self) {
  return self->dynamicStructure;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneDesc_set_dynamicStructure_1(physx::PxSceneDesc* self, PxPruningStructureTypeEnum arg0) {
  self->dynamicStructure = arg0;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneDesc_get_dynamicTreeRebuildRateHint_0(physx::PxSceneDesc* self) {
  return self->dynamicTreeRebuildRateHint;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneDesc_set_dynamicTreeRebuildRateHint_1(physx::PxSceneDesc* self, unsigned int arg0) {
  self->dynamicTreeRebuildRateHint = arg0;
}

PxDynamicTreeSecondaryPrunerEnum EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneDesc_get_dynamicTreeSecondaryPruner_0(physx::PxSceneDesc* self) {
  return self->dynamicTreeSecondaryPruner;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneDesc_set_dynamicTreeSecondaryPruner_1(physx::PxSceneDesc* self, PxDynamicTreeSecondaryPrunerEnum arg0) {
  self->dynamicTreeSecondaryPruner = arg0;
}

PxBVHBuildStrategyEnum EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneDesc_get_staticBVHBuildStrategy_0(physx::PxSceneDesc* self) {
  return self->staticBVHBuildStrategy;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneDesc_set_staticBVHBuildStrategy_1(physx::PxSceneDesc* self, PxBVHBuildStrategyEnum arg0) {
  self->staticBVHBuildStrategy = arg0;
}

PxBVHBuildStrategyEnum EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneDesc_get_dynamicBVHBuildStrategy_0(physx::PxSceneDesc* self) {
  return self->dynamicBVHBuildStrategy;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneDesc_set_dynamicBVHBuildStrategy_1(physx::PxSceneDesc* self, PxBVHBuildStrategyEnum arg0) {
  self->dynamicBVHBuildStrategy = arg0;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneDesc_get_staticNbObjectsPerNode_0(physx::PxSceneDesc* self) {
  return self->staticNbObjectsPerNode;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneDesc_set_staticNbObjectsPerNode_1(physx::PxSceneDesc* self, unsigned int arg0) {
  self->staticNbObjectsPerNode = arg0;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneDesc_get_dynamicNbObjectsPerNode_0(physx::PxSceneDesc* self) {
  return self->dynamicNbObjectsPerNode;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneDesc_set_dynamicNbObjectsPerNode_1(physx::PxSceneDesc* self, unsigned int arg0) {
  self->dynamicNbObjectsPerNode = arg0;
}

PxSceneQueryUpdateModeEnum EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneDesc_get_sceneQueryUpdateMode_0(physx::PxSceneDesc* self) {
  return self->sceneQueryUpdateMode;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneDesc_set_sceneQueryUpdateMode_1(physx::PxSceneDesc* self, PxSceneQueryUpdateModeEnum arg0) {
  self->sceneQueryUpdateMode = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneDesc___destroy___0(physx::PxSceneDesc* self) {
  delete self;
}

// Interface: PxSceneFlags


physx::PxSceneFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneFlags_PxSceneFlags_1(unsigned int flags) {
  return new physx::PxSceneFlags(flags);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneFlags_isSet_1(physx::PxSceneFlags* self, PxSceneFlagEnum flag) {
  return self->isSet(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneFlags_raise_1(physx::PxSceneFlags* self, PxSceneFlagEnum flag) {
  self->raise(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneFlags_clear_1(physx::PxSceneFlags* self, PxSceneFlagEnum flag) {
  self->clear(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneFlags___destroy___0(physx::PxSceneFlags* self) {
  delete self;
}

// Interface: PxSceneLimits


physx::PxSceneLimits* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneLimits_PxSceneLimits_0() {
  return new physx::PxSceneLimits();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneLimits_setToDefault_0(physx::PxSceneLimits* self) {
  self->setToDefault();
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneLimits_isValid_0(physx::PxSceneLimits* self) {
  return self->isValid();
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneLimits_get_maxNbActors_0(physx::PxSceneLimits* self) {
  return self->maxNbActors;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneLimits_set_maxNbActors_1(physx::PxSceneLimits* self, unsigned int arg0) {
  self->maxNbActors = arg0;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneLimits_get_maxNbBodies_0(physx::PxSceneLimits* self) {
  return self->maxNbBodies;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneLimits_set_maxNbBodies_1(physx::PxSceneLimits* self, unsigned int arg0) {
  self->maxNbBodies = arg0;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneLimits_get_maxNbStaticShapes_0(physx::PxSceneLimits* self) {
  return self->maxNbStaticShapes;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneLimits_set_maxNbStaticShapes_1(physx::PxSceneLimits* self, unsigned int arg0) {
  self->maxNbStaticShapes = arg0;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneLimits_get_maxNbDynamicShapes_0(physx::PxSceneLimits* self) {
  return self->maxNbDynamicShapes;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneLimits_set_maxNbDynamicShapes_1(physx::PxSceneLimits* self, unsigned int arg0) {
  self->maxNbDynamicShapes = arg0;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneLimits_get_maxNbAggregates_0(physx::PxSceneLimits* self) {
  return self->maxNbAggregates;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneLimits_set_maxNbAggregates_1(physx::PxSceneLimits* self, unsigned int arg0) {
  self->maxNbAggregates = arg0;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneLimits_get_maxNbConstraints_0(physx::PxSceneLimits* self) {
  return self->maxNbConstraints;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneLimits_set_maxNbConstraints_1(physx::PxSceneLimits* self, unsigned int arg0) {
  self->maxNbConstraints = arg0;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneLimits_get_maxNbRegions_0(physx::PxSceneLimits* self) {
  return self->maxNbRegions;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneLimits_set_maxNbRegions_1(physx::PxSceneLimits* self, unsigned int arg0) {
  self->maxNbRegions = arg0;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneLimits_get_maxNbBroadPhaseOverlaps_0(physx::PxSceneLimits* self) {
  return self->maxNbBroadPhaseOverlaps;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneLimits_set_maxNbBroadPhaseOverlaps_1(physx::PxSceneLimits* self, unsigned int arg0) {
  self->maxNbBroadPhaseOverlaps = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSceneLimits___destroy___0(physx::PxSceneLimits* self) {
  delete self;
}

// Interface: PxSerialization


bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSerialization_isSerializable_2(physx::PxCollection* collection, physx::PxSerializationRegistry* sr) {
  return physx::PxSerialization::isSerializable(*collection, *sr);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSerialization_isSerializable_3(physx::PxCollection* collection, physx::PxSerializationRegistry* sr, const physx::PxCollection* externalReferences) {
  return physx::PxSerialization::isSerializable(*collection, *sr, externalReferences);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSerialization_complete_2(physx::PxCollection* collection, physx::PxSerializationRegistry* sr) {
  physx::PxSerialization::complete(*collection, *sr);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSerialization_complete_3(physx::PxCollection* collection, physx::PxSerializationRegistry* sr, const physx::PxCollection* exceptFor) {
  physx::PxSerialization::complete(*collection, *sr, exceptFor);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSerialization_complete_4(physx::PxCollection* collection, physx::PxSerializationRegistry* sr, const physx::PxCollection* exceptFor, bool followJoints) {
  physx::PxSerialization::complete(*collection, *sr, exceptFor, followJoints);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSerialization_createSerialObjectIds_2(physx::PxCollection* collection, unsigned long long base) {
  physx::PxSerialization::createSerialObjectIds(*collection, base);
}

physx::PxCollection* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSerialization_createCollectionFromXml_3(physx::PxInputData* inputData, const physx::PxCookingParams* params, physx::PxSerializationRegistry* sr) {
  return physx::PxSerialization::createCollectionFromXml(*inputData, *params, *sr);
}

physx::PxCollection* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSerialization_createCollectionFromXml_4(physx::PxInputData* inputData, const physx::PxCookingParams* params, physx::PxSerializationRegistry* sr, const physx::PxCollection* externalRefs) {
  return physx::PxSerialization::createCollectionFromXml(*inputData, *params, *sr, externalRefs);
}

physx::PxCollection* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSerialization_createCollectionFromBinary_2(void* memBlock, physx::PxSerializationRegistry* sr) {
  return physx::PxSerialization::createCollectionFromBinary(memBlock, *sr);
}

physx::PxCollection* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSerialization_createCollectionFromBinary_3(void* memBlock, physx::PxSerializationRegistry* sr, const physx::PxCollection* externalRefs) {
  return physx::PxSerialization::createCollectionFromBinary(memBlock, *sr, externalRefs);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSerialization_serializeCollectionToXml_3(physx::PxOutputStream* outputStream, physx::PxCollection* collection, physx::PxSerializationRegistry* sr) {
  return physx::PxSerialization::serializeCollectionToXml(*outputStream, *collection, *sr);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSerialization_serializeCollectionToXml_4(physx::PxOutputStream* outputStream, physx::PxCollection* collection, physx::PxSerializationRegistry* sr, const physx::PxCookingParams* params) {
  return physx::PxSerialization::serializeCollectionToXml(*outputStream, *collection, *sr, params);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSerialization_serializeCollectionToXml_5(physx::PxOutputStream* outputStream, physx::PxCollection* collection, physx::PxSerializationRegistry* sr, const physx::PxCookingParams* params, const physx::PxCollection* externalRefs) {
  return physx::PxSerialization::serializeCollectionToXml(*outputStream, *collection, *sr, params, externalRefs);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSerialization_serializeCollectionToBinary_3(physx::PxOutputStream* outputStream, physx::PxCollection* collection, physx::PxSerializationRegistry* sr) {
  return physx::PxSerialization::serializeCollectionToBinary(*outputStream, *collection, *sr);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSerialization_serializeCollectionToBinary_4(physx::PxOutputStream* outputStream, physx::PxCollection* collection, physx::PxSerializationRegistry* sr, const physx::PxCollection* externalRefs) {
  return physx::PxSerialization::serializeCollectionToBinary(*outputStream, *collection, *sr, externalRefs);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSerialization_serializeCollectionToBinary_5(physx::PxOutputStream* outputStream, physx::PxCollection* collection, physx::PxSerializationRegistry* sr, const physx::PxCollection* externalRefs, bool exportNames) {
  return physx::PxSerialization::serializeCollectionToBinary(*outputStream, *collection, *sr, externalRefs, exportNames);
}

physx::PxSerializationRegistry* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSerialization_createSerializationRegistry_1(physx::PxPhysics* physics) {
  return physx::PxSerialization::createSerializationRegistry(*physics);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSerialization___destroy___0(physx::PxSerialization* self) {
  delete self;
}

// Interface: PxSerializationRegistry


void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSerializationRegistry_release_0(physx::PxSerializationRegistry* self) {
  self->release();
}

// Interface: PxShape


void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxShape_setGeometry_1(physx::PxShape* self, const physx::PxGeometry* geometry) {
  self->setGeometry(*geometry);
}

const physx::PxGeometry* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxShape_getGeometry_0(physx::PxShape* self) {
  return &self->getGeometry();
}

physx::PxRigidActor* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxShape_getActor_0(physx::PxShape* self) {
  return self->getActor();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxShape_setMaterials_2(physx::PxShape* self, PxMaterialPtr* materials, unsigned short materialCount) {
  self->setMaterials(materials, materialCount);
}

unsigned short EMSCRIPTEN_KEEPALIVE emscripten_bind_PxShape_getNbMaterials_0(physx::PxShape* self) {
  return self->getNbMaterials();
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxShape_getMaterials_3(physx::PxShape* self, PxMaterialPtr* userBuffer, unsigned int bufferSize, unsigned int startIndex) {
  return self->getMaterials(userBuffer, bufferSize, startIndex);
}

physx::PxBaseMaterial* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxShape_getMaterialFromInternalFaceIndex_1(physx::PxShape* self, unsigned int faceIndex) {
  return self->getMaterialFromInternalFaceIndex(faceIndex);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxShape_setContactOffset_1(physx::PxShape* self, float contactOffset) {
  self->setContactOffset(contactOffset);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxShape_getContactOffset_0(physx::PxShape* self) {
  return self->getContactOffset();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxShape_setRestOffset_1(physx::PxShape* self, float restOffset) {
  self->setRestOffset(restOffset);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxShape_getRestOffset_0(physx::PxShape* self) {
  return self->getRestOffset();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxShape_setTorsionalPatchRadius_1(physx::PxShape* self, float radius) {
  self->setTorsionalPatchRadius(radius);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxShape_getTorsionalPatchRadius_0(physx::PxShape* self) {
  return self->getTorsionalPatchRadius();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxShape_setMinTorsionalPatchRadius_1(physx::PxShape* self, float radius) {
  self->setMinTorsionalPatchRadius(radius);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxShape_getMinTorsionalPatchRadius_0(physx::PxShape* self) {
  return self->getMinTorsionalPatchRadius();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxShape_setFlag_2(physx::PxShape* self, PxShapeFlagEnum flag, bool value) {
  self->setFlag(flag, value);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxShape_setFlags_1(physx::PxShape* self, physx::PxShapeFlags* inFlags) {
  self->setFlags(*inFlags);
}

physx::PxShapeFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxShape_getFlags_0(physx::PxShape* self) {
  static thread_local physx::PxShapeFlags temp;
  return (temp = self->getFlags(), &temp);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxShape_isExclusive_0(physx::PxShape* self) {
  return self->isExclusive();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxShape_setName_1(physx::PxShape* self, const char* name) {
  self->setName(name);
}

const char* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxShape_getName_0(physx::PxShape* self) {
  return self->getName();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxShape_setLocalPose_1(physx::PxShape* self, const physx::PxTransform* pose) {
  self->setLocalPose(*pose);
}

physx::PxTransform* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxShape_getLocalPose_0(physx::PxShape* self) {
  static thread_local physx::PxTransform temp;
  return (temp = self->getLocalPose(), &temp);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxShape_setSimulationFilterData_1(physx::PxShape* self, const physx::PxFilterData* data) {
  self->setSimulationFilterData(*data);
}

physx::PxFilterData* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxShape_getSimulationFilterData_0(physx::PxShape* self) {
  static thread_local physx::PxFilterData temp;
  return (temp = self->getSimulationFilterData(), &temp);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxShape_setQueryFilterData_1(physx::PxShape* self, const physx::PxFilterData* data) {
  self->setQueryFilterData(*data);
}

physx::PxFilterData* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxShape_getQueryFilterData_0(physx::PxShape* self) {
  static thread_local physx::PxFilterData temp;
  return (temp = self->getQueryFilterData(), &temp);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxShape_release_0(physx::PxShape* self) {
  self->release();
}

const char* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxShape_getConcreteTypeName_0(physx::PxShape* self) {
  return self->getConcreteTypeName();
}

int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxShape_getConcreteType_0(physx::PxShape* self) {
  return self->getConcreteType();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxShape_setBaseFlag_2(physx::PxShape* self, PxBaseFlagEnum flag, bool value) {
  self->setBaseFlag(flag, value);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxShape_setBaseFlags_1(physx::PxShape* self, physx::PxBaseFlags* inFlags) {
  self->setBaseFlags(*inFlags);
}

physx::PxBaseFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxShape_getBaseFlags_0(physx::PxShape* self) {
  static thread_local physx::PxBaseFlags temp;
  return (temp = self->getBaseFlags(), &temp);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxShape_isReleasable_0(physx::PxShape* self) {
  return self->isReleasable();
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxShape_getReferenceCount_0(physx::PxShape* self) {
  return self->getReferenceCount();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxShape_acquireReference_0(physx::PxShape* self) {
  self->acquireReference();
}

void* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxShape_get_userData_0(physx::PxShape* self) {
  return self->userData;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxShape_set_userData_1(physx::PxShape* self, void* arg0) {
  self->userData = arg0;
}

// Interface: PxShapeExt


physx::PxTransform* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxShapeExt_getGlobalPose_2(const physx::PxShape* shape, const physx::PxRigidActor* actor) {
  static thread_local physx::PxTransform temp;
  return (temp = physx::PxShapeExt::getGlobalPose(*shape, *actor), &temp);
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxShapeExt_raycast_8(const physx::PxShape* shape, const physx::PxRigidActor* actor, const physx::PxVec3* rayOrigin, const physx::PxVec3* rayDir, float maxDist, physx::PxHitFlags* hitFlags, unsigned int maxHits, physx::PxRaycastHit* rayHits) {
  return physx::PxShapeExt::raycast(*shape, *actor, *rayOrigin, *rayDir, maxDist, *hitFlags, maxHits, rayHits);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxShapeExt_overlap_4(const physx::PxShape* shape, const physx::PxRigidActor* actor, const physx::PxGeometry* otherGeom, const physx::PxTransform* otherGeomPose) {
  return physx::PxShapeExt::overlap(*shape, *actor, *otherGeom, *otherGeomPose);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxShapeExt_sweep_8(const physx::PxShape* shape, const physx::PxRigidActor* actor, const physx::PxVec3* unitDir, float distance, const physx::PxGeometry* otherGeom, const physx::PxTransform* otherGeomPose, physx::PxSweepHit* sweepHit, physx::PxHitFlags* hitFlags) {
  return physx::PxShapeExt::sweep(*shape, *actor, *unitDir, distance, *otherGeom, *otherGeomPose, *sweepHit, *hitFlags);
}

physx::PxBounds3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxShapeExt_getWorldBounds_2(const physx::PxShape* shape, const physx::PxRigidActor* actor) {
  static thread_local physx::PxBounds3 temp;
  return (temp = physx::PxShapeExt::getWorldBounds(*shape, *actor), &temp);
}

physx::PxBounds3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxShapeExt_getWorldBounds_3(const physx::PxShape* shape, const physx::PxRigidActor* actor, float inflation) {
  static thread_local physx::PxBounds3 temp;
  return (temp = physx::PxShapeExt::getWorldBounds(*shape, *actor, inflation), &temp);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxShapeExt___destroy___0(physx::PxShapeExt* self) {
  delete self;
}

// Interface: PxShapeFlags


physx::PxShapeFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxShapeFlags_PxShapeFlags_1(unsigned char flags) {
  return new physx::PxShapeFlags(flags);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxShapeFlags_isSet_1(physx::PxShapeFlags* self, PxShapeFlagEnum flag) {
  return self->isSet(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxShapeFlags_raise_1(physx::PxShapeFlags* self, PxShapeFlagEnum flag) {
  self->raise(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxShapeFlags_clear_1(physx::PxShapeFlags* self, PxShapeFlagEnum flag) {
  self->clear(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxShapeFlags___destroy___0(physx::PxShapeFlags* self) {
  delete self;
}

// Interface: PxShapePtr


void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxShapePtr___destroy___0(PxShapePtr* self) {
  delete self;
}

// Interface: PxSimulationEventCallbackImpl


PxSimulationEventCallbackImpl* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSimulationEventCallbackImpl_PxSimulationEventCallbackImpl_0() {
  return new PxSimulationEventCallbackImpl();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSimulationEventCallbackImpl_onConstraintBreak_2(PxSimulationEventCallbackImpl* self, physx::PxConstraintInfo* constraints, unsigned int count) {
  self->onConstraintBreak(constraints, count);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSimulationEventCallbackImpl_onWake_2(PxSimulationEventCallbackImpl* self, PxActorPtr* actors, unsigned int count) {
  self->onWake(actors, count);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSimulationEventCallbackImpl_onSleep_2(PxSimulationEventCallbackImpl* self, PxActorPtr* actors, unsigned int count) {
  self->onSleep(actors, count);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSimulationEventCallbackImpl_onContact_3(PxSimulationEventCallbackImpl* self, const physx::PxContactPairHeader* pairHeader, const physx::PxContactPair* pairs, unsigned int nbPairs) {
  self->onContact(*pairHeader, pairs, nbPairs);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSimulationEventCallbackImpl_onTrigger_2(PxSimulationEventCallbackImpl* self, physx::PxTriggerPair* pairs, unsigned int count) {
  self->onTrigger(pairs, count);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSimulationEventCallbackImpl___destroy___0(PxSimulationEventCallbackImpl* self) {
  delete self;
}

// Interface: PxSimulationStatistics


unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSimulationStatistics_get_nbActiveConstraints_0(physx::PxSimulationStatistics* self) {
  return self->nbActiveConstraints;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSimulationStatistics_set_nbActiveConstraints_1(physx::PxSimulationStatistics* self, unsigned int arg0) {
  self->nbActiveConstraints = arg0;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSimulationStatistics_get_nbActiveDynamicBodies_0(physx::PxSimulationStatistics* self) {
  return self->nbActiveDynamicBodies;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSimulationStatistics_set_nbActiveDynamicBodies_1(physx::PxSimulationStatistics* self, unsigned int arg0) {
  self->nbActiveDynamicBodies = arg0;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSimulationStatistics_get_nbActiveKinematicBodies_0(physx::PxSimulationStatistics* self) {
  return self->nbActiveKinematicBodies;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSimulationStatistics_set_nbActiveKinematicBodies_1(physx::PxSimulationStatistics* self, unsigned int arg0) {
  self->nbActiveKinematicBodies = arg0;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSimulationStatistics_get_nbStaticBodies_0(physx::PxSimulationStatistics* self) {
  return self->nbStaticBodies;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSimulationStatistics_set_nbStaticBodies_1(physx::PxSimulationStatistics* self, unsigned int arg0) {
  self->nbStaticBodies = arg0;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSimulationStatistics_get_nbDynamicBodies_0(physx::PxSimulationStatistics* self) {
  return self->nbDynamicBodies;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSimulationStatistics_set_nbDynamicBodies_1(physx::PxSimulationStatistics* self, unsigned int arg0) {
  self->nbDynamicBodies = arg0;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSimulationStatistics_get_nbKinematicBodies_0(physx::PxSimulationStatistics* self) {
  return self->nbKinematicBodies;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSimulationStatistics_set_nbKinematicBodies_1(physx::PxSimulationStatistics* self, unsigned int arg0) {
  self->nbKinematicBodies = arg0;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSimulationStatistics_get_nbShapes_1(physx::PxSimulationStatistics* self, int arg0) {
  return self->nbShapes[arg0];
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSimulationStatistics_set_nbShapes_2(physx::PxSimulationStatistics* self, int arg0, unsigned int arg1) {
  self->nbShapes[arg0] = arg1;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSimulationStatistics_get_nbAggregates_0(physx::PxSimulationStatistics* self) {
  return self->nbAggregates;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSimulationStatistics_set_nbAggregates_1(physx::PxSimulationStatistics* self, unsigned int arg0) {
  self->nbAggregates = arg0;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSimulationStatistics_get_nbArticulations_0(physx::PxSimulationStatistics* self) {
  return self->nbArticulations;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSimulationStatistics_set_nbArticulations_1(physx::PxSimulationStatistics* self, unsigned int arg0) {
  self->nbArticulations = arg0;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSimulationStatistics_get_nbAxisSolverConstraints_0(physx::PxSimulationStatistics* self) {
  return self->nbAxisSolverConstraints;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSimulationStatistics_set_nbAxisSolverConstraints_1(physx::PxSimulationStatistics* self, unsigned int arg0) {
  self->nbAxisSolverConstraints = arg0;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSimulationStatistics_get_compressedContactSize_0(physx::PxSimulationStatistics* self) {
  return self->compressedContactSize;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSimulationStatistics_set_compressedContactSize_1(physx::PxSimulationStatistics* self, unsigned int arg0) {
  self->compressedContactSize = arg0;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSimulationStatistics_get_requiredContactConstraintMemory_0(physx::PxSimulationStatistics* self) {
  return self->requiredContactConstraintMemory;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSimulationStatistics_set_requiredContactConstraintMemory_1(physx::PxSimulationStatistics* self, unsigned int arg0) {
  self->requiredContactConstraintMemory = arg0;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSimulationStatistics_get_peakConstraintMemory_0(physx::PxSimulationStatistics* self) {
  return self->peakConstraintMemory;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSimulationStatistics_set_peakConstraintMemory_1(physx::PxSimulationStatistics* self, unsigned int arg0) {
  self->peakConstraintMemory = arg0;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSimulationStatistics_get_nbDiscreteContactPairsTotal_0(physx::PxSimulationStatistics* self) {
  return self->nbDiscreteContactPairsTotal;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSimulationStatistics_set_nbDiscreteContactPairsTotal_1(physx::PxSimulationStatistics* self, unsigned int arg0) {
  self->nbDiscreteContactPairsTotal = arg0;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSimulationStatistics_get_nbDiscreteContactPairsWithCacheHits_0(physx::PxSimulationStatistics* self) {
  return self->nbDiscreteContactPairsWithCacheHits;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSimulationStatistics_set_nbDiscreteContactPairsWithCacheHits_1(physx::PxSimulationStatistics* self, unsigned int arg0) {
  self->nbDiscreteContactPairsWithCacheHits = arg0;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSimulationStatistics_get_nbDiscreteContactPairsWithContacts_0(physx::PxSimulationStatistics* self) {
  return self->nbDiscreteContactPairsWithContacts;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSimulationStatistics_set_nbDiscreteContactPairsWithContacts_1(physx::PxSimulationStatistics* self, unsigned int arg0) {
  self->nbDiscreteContactPairsWithContacts = arg0;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSimulationStatistics_get_nbNewPairs_0(physx::PxSimulationStatistics* self) {
  return self->nbNewPairs;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSimulationStatistics_set_nbNewPairs_1(physx::PxSimulationStatistics* self, unsigned int arg0) {
  self->nbNewPairs = arg0;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSimulationStatistics_get_nbLostPairs_0(physx::PxSimulationStatistics* self) {
  return self->nbLostPairs;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSimulationStatistics_set_nbLostPairs_1(physx::PxSimulationStatistics* self, unsigned int arg0) {
  self->nbLostPairs = arg0;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSimulationStatistics_get_nbNewTouches_0(physx::PxSimulationStatistics* self) {
  return self->nbNewTouches;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSimulationStatistics_set_nbNewTouches_1(physx::PxSimulationStatistics* self, unsigned int arg0) {
  self->nbNewTouches = arg0;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSimulationStatistics_get_nbLostTouches_0(physx::PxSimulationStatistics* self) {
  return self->nbLostTouches;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSimulationStatistics_set_nbLostTouches_1(physx::PxSimulationStatistics* self, unsigned int arg0) {
  self->nbLostTouches = arg0;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSimulationStatistics_get_nbPartitions_0(physx::PxSimulationStatistics* self) {
  return self->nbPartitions;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSimulationStatistics_set_nbPartitions_1(physx::PxSimulationStatistics* self, unsigned int arg0) {
  self->nbPartitions = arg0;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSimulationStatistics_get_nbBroadPhaseAdds_0(physx::PxSimulationStatistics* self) {
  return self->nbBroadPhaseAdds;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSimulationStatistics_set_nbBroadPhaseAdds_1(physx::PxSimulationStatistics* self, unsigned int arg0) {
  self->nbBroadPhaseAdds = arg0;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSimulationStatistics_get_nbBroadPhaseRemoves_0(physx::PxSimulationStatistics* self) {
  return self->nbBroadPhaseRemoves;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSimulationStatistics_set_nbBroadPhaseRemoves_1(physx::PxSimulationStatistics* self, unsigned int arg0) {
  self->nbBroadPhaseRemoves = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSimulationStatistics___destroy___0(physx::PxSimulationStatistics* self) {
  delete self;
}

// Interface: PxSpatialForce


physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSpatialForce_get_force_0(physx::PxSpatialForce* self) {
  return &self->force;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSpatialForce_set_force_1(physx::PxSpatialForce* self, physx::PxVec3* arg0) {
  self->force = *arg0;
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSpatialForce_get_torque_0(physx::PxSpatialForce* self) {
  return &self->torque;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSpatialForce_set_torque_1(physx::PxSpatialForce* self, physx::PxVec3* arg0) {
  self->torque = *arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSpatialForce___destroy___0(physx::PxSpatialForce* self) {
  delete self;
}

// Interface: PxSpatialVelocity


physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSpatialVelocity_get_linear_0(physx::PxSpatialVelocity* self) {
  return &self->linear;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSpatialVelocity_set_linear_1(physx::PxSpatialVelocity* self, physx::PxVec3* arg0) {
  self->linear = *arg0;
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSpatialVelocity_get_angular_0(physx::PxSpatialVelocity* self) {
  return &self->angular;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSpatialVelocity_set_angular_1(physx::PxSpatialVelocity* self, physx::PxVec3* arg0) {
  self->angular = *arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSpatialVelocity___destroy___0(physx::PxSpatialVelocity* self) {
  delete self;
}

// Interface: PxSphereGeometry


physx::PxSphereGeometry* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSphereGeometry_PxSphereGeometry_1(float ir) {
  return new physx::PxSphereGeometry(ir);
}

PxGeometryTypeEnum EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSphereGeometry_getType_0(physx::PxSphereGeometry* self) {
  return self->getType();
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSphereGeometry_get_radius_0(physx::PxSphereGeometry* self) {
  return self->radius;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSphereGeometry_set_radius_1(physx::PxSphereGeometry* self, float arg0) {
  self->radius = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSphereGeometry___destroy___0(physx::PxSphereGeometry* self) {
  delete self;
}

// Interface: PxSphericalJoint


void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSphericalJoint_setLimitCone_1(physx::PxSphericalJoint* self, const physx::PxJointLimitCone* limitCone) {
  self->setLimitCone(*limitCone);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSphericalJoint_getSwingYAngle_0(physx::PxSphericalJoint* self) {
  return self->getSwingYAngle();
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSphericalJoint_getSwingZAngle_0(physx::PxSphericalJoint* self) {
  return self->getSwingZAngle();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSphericalJoint_setSphericalJointFlags_1(physx::PxSphericalJoint* self, physx::PxSphericalJointFlags* flags) {
  self->setSphericalJointFlags(*flags);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSphericalJoint_setSphericalJointFlag_2(physx::PxSphericalJoint* self, PxSphericalJointFlagEnum flag, bool value) {
  self->setSphericalJointFlag(flag, value);
}

physx::PxSphericalJointFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSphericalJoint_getSphericalJointFlags_0(physx::PxSphericalJoint* self) {
  static thread_local physx::PxSphericalJointFlags temp;
  return (temp = self->getSphericalJointFlags(), &temp);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSphericalJoint_release_0(physx::PxSphericalJoint* self) {
  self->release();
}

const char* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSphericalJoint_getConcreteTypeName_0(physx::PxSphericalJoint* self) {
  return self->getConcreteTypeName();
}

int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSphericalJoint_getConcreteType_0(physx::PxSphericalJoint* self) {
  return self->getConcreteType();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSphericalJoint_setBaseFlag_2(physx::PxSphericalJoint* self, PxBaseFlagEnum flag, bool value) {
  self->setBaseFlag(flag, value);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSphericalJoint_setBaseFlags_1(physx::PxSphericalJoint* self, physx::PxBaseFlags* inFlags) {
  self->setBaseFlags(*inFlags);
}

physx::PxBaseFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSphericalJoint_getBaseFlags_0(physx::PxSphericalJoint* self) {
  static thread_local physx::PxBaseFlags temp;
  return (temp = self->getBaseFlags(), &temp);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSphericalJoint_isReleasable_0(physx::PxSphericalJoint* self) {
  return self->isReleasable();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSphericalJoint_setActors_2(physx::PxSphericalJoint* self, physx::PxRigidActor* actor0, physx::PxRigidActor* actor1) {
  self->setActors(actor0, actor1);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSphericalJoint_setLocalPose_2(physx::PxSphericalJoint* self, PxJointActorIndexEnum actor, const physx::PxTransform* localPose) {
  self->setLocalPose(actor, *localPose);
}

physx::PxTransform* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSphericalJoint_getLocalPose_1(physx::PxSphericalJoint* self, PxJointActorIndexEnum actor) {
  static thread_local physx::PxTransform temp;
  return (temp = self->getLocalPose(actor), &temp);
}

physx::PxTransform* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSphericalJoint_getRelativeTransform_0(physx::PxSphericalJoint* self) {
  static thread_local physx::PxTransform temp;
  return (temp = self->getRelativeTransform(), &temp);
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSphericalJoint_getRelativeLinearVelocity_0(physx::PxSphericalJoint* self) {
  static thread_local physx::PxVec3 temp;
  return (temp = self->getRelativeLinearVelocity(), &temp);
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSphericalJoint_getRelativeAngularVelocity_0(physx::PxSphericalJoint* self) {
  static thread_local physx::PxVec3 temp;
  return (temp = self->getRelativeAngularVelocity(), &temp);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSphericalJoint_setBreakForce_2(physx::PxSphericalJoint* self, float force, float torque) {
  self->setBreakForce(force, torque);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSphericalJoint_setConstraintFlags_1(physx::PxSphericalJoint* self, physx::PxConstraintFlags* flags) {
  self->setConstraintFlags(*flags);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSphericalJoint_setConstraintFlag_2(physx::PxSphericalJoint* self, PxConstraintFlagEnum flag, bool value) {
  self->setConstraintFlag(flag, value);
}

physx::PxConstraintFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSphericalJoint_getConstraintFlags_0(physx::PxSphericalJoint* self) {
  static thread_local physx::PxConstraintFlags temp;
  return (temp = self->getConstraintFlags(), &temp);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSphericalJoint_setInvMassScale0_1(physx::PxSphericalJoint* self, float invMassScale) {
  self->setInvMassScale0(invMassScale);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSphericalJoint_getInvMassScale0_0(physx::PxSphericalJoint* self) {
  return self->getInvMassScale0();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSphericalJoint_setInvMassScale1_1(physx::PxSphericalJoint* self, float invMassScale) {
  self->setInvMassScale1(invMassScale);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSphericalJoint_getInvMassScale1_0(physx::PxSphericalJoint* self) {
  return self->getInvMassScale1();
}

physx::PxConstraint* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSphericalJoint_getConstraint_0(physx::PxSphericalJoint* self) {
  return self->getConstraint();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSphericalJoint_setName_1(physx::PxSphericalJoint* self, const char* name) {
  self->setName(name);
}

const char* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSphericalJoint_getName_0(physx::PxSphericalJoint* self) {
  return self->getName();
}

physx::PxScene* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSphericalJoint_getScene_0(physx::PxSphericalJoint* self) {
  return self->getScene();
}

void* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSphericalJoint_get_userData_0(physx::PxSphericalJoint* self) {
  return self->userData;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSphericalJoint_set_userData_1(physx::PxSphericalJoint* self, void* arg0) {
  self->userData = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSphericalJoint___destroy___0(physx::PxSphericalJoint* self) {
  delete self;
}

// Interface: PxSphericalJointFlags


physx::PxSphericalJointFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSphericalJointFlags_PxSphericalJointFlags_1(unsigned short flags) {
  return new physx::PxSphericalJointFlags(flags);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSphericalJointFlags_isSet_1(physx::PxSphericalJointFlags* self, PxSphericalJointFlagEnum flag) {
  return self->isSet(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSphericalJointFlags_raise_1(physx::PxSphericalJointFlags* self, PxSphericalJointFlagEnum flag) {
  self->raise(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSphericalJointFlags_clear_1(physx::PxSphericalJointFlags* self, PxSphericalJointFlagEnum flag) {
  self->clear(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSphericalJointFlags___destroy___0(physx::PxSphericalJointFlags* self) {
  delete self;
}

// Interface: PxSweepBuffer10


PxSweepBuffer10* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSweepBuffer10_PxSweepBuffer10_0() {
  return new PxSweepBuffer10();
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSweepBuffer10_getNbAnyHits_0(PxSweepBuffer10* self) {
  return self->getNbAnyHits();
}

const physx::PxSweepHit* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSweepBuffer10_getAnyHit_1(PxSweepBuffer10* self, unsigned int index) {
  return &self->getAnyHit(index);
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSweepBuffer10_getNbTouches_0(PxSweepBuffer10* self) {
  return self->getNbTouches();
}

const physx::PxSweepHit* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSweepBuffer10_getTouches_0(PxSweepBuffer10* self) {
  return self->getTouches();
}

const physx::PxSweepHit* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSweepBuffer10_getTouch_1(PxSweepBuffer10* self, unsigned int index) {
  return &self->getTouch(index);
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSweepBuffer10_getMaxNbTouches_0(PxSweepBuffer10* self) {
  return self->getMaxNbTouches();
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSweepBuffer10_hasAnyHits_0(PxSweepBuffer10* self) {
  return self->hasAnyHits();
}

physx::PxSweepHit* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSweepBuffer10_get_block_0(PxSweepBuffer10* self) {
  return &self->block;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSweepBuffer10_set_block_1(PxSweepBuffer10* self, physx::PxSweepHit* arg0) {
  self->block = *arg0;
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSweepBuffer10_get_hasBlock_0(PxSweepBuffer10* self) {
  return self->hasBlock;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSweepBuffer10_set_hasBlock_1(PxSweepBuffer10* self, bool arg0) {
  self->hasBlock = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSweepBuffer10___destroy___0(PxSweepBuffer10* self) {
  delete self;
}

// Interface: PxSweepHit


physx::PxSweepHit* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSweepHit_PxSweepHit_0() {
  return new physx::PxSweepHit();
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSweepHit_hadInitialOverlap_0(physx::PxSweepHit* self) {
  return self->hadInitialOverlap();
}

physx::PxRigidActor* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSweepHit_get_actor_0(physx::PxSweepHit* self) {
  return self->actor;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSweepHit_set_actor_1(physx::PxSweepHit* self, physx::PxRigidActor* arg0) {
  self->actor = arg0;
}

physx::PxShape* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSweepHit_get_shape_0(physx::PxSweepHit* self) {
  return self->shape;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSweepHit_set_shape_1(physx::PxSweepHit* self, physx::PxShape* arg0) {
  self->shape = arg0;
}

physx::PxHitFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSweepHit_get_flags_0(physx::PxSweepHit* self) {
  return &self->flags;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSweepHit_set_flags_1(physx::PxSweepHit* self, physx::PxHitFlags* arg0) {
  self->flags = *arg0;
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSweepHit_get_position_0(physx::PxSweepHit* self) {
  return &self->position;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSweepHit_set_position_1(physx::PxSweepHit* self, physx::PxVec3* arg0) {
  self->position = *arg0;
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSweepHit_get_normal_0(physx::PxSweepHit* self) {
  return &self->normal;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSweepHit_set_normal_1(physx::PxSweepHit* self, physx::PxVec3* arg0) {
  self->normal = *arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSweepHit_get_distance_0(physx::PxSweepHit* self) {
  return self->distance;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSweepHit_set_distance_1(physx::PxSweepHit* self, float arg0) {
  self->distance = arg0;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSweepHit_get_faceIndex_0(physx::PxSweepHit* self) {
  return self->faceIndex;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSweepHit_set_faceIndex_1(physx::PxSweepHit* self, unsigned int arg0) {
  self->faceIndex = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSweepHit___destroy___0(physx::PxSweepHit* self) {
  delete self;
}

// Interface: PxSweepResult


PxSweepResult* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSweepResult_PxSweepResult_0() {
  return new PxSweepResult();
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSweepResult_getNbAnyHits_0(PxSweepResult* self) {
  return self->getNbAnyHits();
}

const physx::PxSweepHit* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSweepResult_getAnyHit_1(PxSweepResult* self, unsigned int index) {
  return &self->getAnyHit(index);
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSweepResult_getNbTouches_0(PxSweepResult* self) {
  return self->getNbTouches();
}

const physx::PxSweepHit* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSweepResult_getTouch_1(PxSweepResult* self, unsigned int index) {
  return &self->getTouch(index);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSweepResult_hasAnyHits_0(PxSweepResult* self) {
  return self->hasAnyHits();
}

physx::PxSweepHit* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSweepResult_get_block_0(PxSweepResult* self) {
  return &self->block;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSweepResult_set_block_1(PxSweepResult* self, physx::PxSweepHit* arg0) {
  self->block = *arg0;
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSweepResult_get_hasBlock_0(PxSweepResult* self) {
  return self->hasBlock;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSweepResult_set_hasBlock_1(PxSweepResult* self, bool arg0) {
  self->hasBlock = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxSweepResult___destroy___0(PxSweepResult* self) {
  delete self;
}

// Interface: PxTetMaker


bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTetMaker_createConformingTetrahedronMesh_5(const physx::PxSimpleTriangleMesh* triangleMesh, PxArray_PxVec3* outVertices, PxArray_PxU32* outTetIndices, bool validate, float volumeThreshold) {
  return physx::PxTetMaker::createConformingTetrahedronMesh(*triangleMesh, *outVertices, *outTetIndices, validate, volumeThreshold);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTetMaker_createVoxelTetrahedronMesh_4(const physx::PxTetrahedronMeshDesc* tetMesh, unsigned int numVoxelsAlongLongestBoundingBoxAxis, PxArray_PxVec3* outVertices, PxArray_PxU32* outTetIndices) {
  return physx::PxTetMaker::createVoxelTetrahedronMesh(*tetMesh, numVoxelsAlongLongestBoundingBoxAxis, *outVertices, *outTetIndices);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTetMaker_createVoxelTetrahedronMeshFromEdgeLength_4(const physx::PxTetrahedronMeshDesc* tetMesh, float voxelEdgeLength, PxArray_PxVec3* outVertices, PxArray_PxU32* outTetIndices) {
  return physx::PxTetMaker::createVoxelTetrahedronMeshFromEdgeLength(*tetMesh, voxelEdgeLength, *outVertices, *outTetIndices);
}

physx::PxTriangleMeshAnalysisResults* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTetMaker_validateTriangleMesh_3(const physx::PxSimpleTriangleMesh* triangleMesh, float minVolumeThreshold, float minTriangleAngleRadians) {
  static thread_local physx::PxTriangleMeshAnalysisResults temp;
  return (temp = physx::PxTetMaker::validateTriangleMesh(*triangleMesh, minVolumeThreshold, minTriangleAngleRadians), &temp);
}

physx::PxTetrahedronMeshAnalysisResults* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTetMaker_validateTetrahedronMesh_3(const physx::PxBoundedData* points, const physx::PxBoundedData* tetrahedra, float minTetVolumeThreshold) {
  static thread_local physx::PxTetrahedronMeshAnalysisResults temp;
  return (temp = physx::PxTetMaker::validateTetrahedronMesh(*points, *tetrahedra, minTetVolumeThreshold), &temp);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTetMaker_simplifyTriangleMesh_6(const PxArray_PxVec3* inputVertices, const PxArray_PxU32* inputIndices, int targetTriangleCount, float maximalEdgeLength, PxArray_PxVec3* outputVertices, PxArray_PxU32* outputIndices) {
  physx::PxTetMaker::simplifyTriangleMesh(*inputVertices, *inputIndices, targetTriangleCount, maximalEdgeLength, *outputVertices, *outputIndices);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTetMaker_simplifyTriangleMesh_7(const PxArray_PxVec3* inputVertices, const PxArray_PxU32* inputIndices, int targetTriangleCount, float maximalEdgeLength, PxArray_PxVec3* outputVertices, PxArray_PxU32* outputIndices, PxArray_PxU32* vertexMap) {
  physx::PxTetMaker::simplifyTriangleMesh(*inputVertices, *inputIndices, targetTriangleCount, maximalEdgeLength, *outputVertices, *outputIndices, vertexMap);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTetMaker_simplifyTriangleMesh_8(const PxArray_PxVec3* inputVertices, const PxArray_PxU32* inputIndices, int targetTriangleCount, float maximalEdgeLength, PxArray_PxVec3* outputVertices, PxArray_PxU32* outputIndices, PxArray_PxU32* vertexMap, float edgeLengthCostWeight) {
  physx::PxTetMaker::simplifyTriangleMesh(*inputVertices, *inputIndices, targetTriangleCount, maximalEdgeLength, *outputVertices, *outputIndices, vertexMap, edgeLengthCostWeight);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTetMaker_simplifyTriangleMesh_9(const PxArray_PxVec3* inputVertices, const PxArray_PxU32* inputIndices, int targetTriangleCount, float maximalEdgeLength, PxArray_PxVec3* outputVertices, PxArray_PxU32* outputIndices, PxArray_PxU32* vertexMap, float edgeLengthCostWeight, float flatnessDetectionThreshold) {
  physx::PxTetMaker::simplifyTriangleMesh(*inputVertices, *inputIndices, targetTriangleCount, maximalEdgeLength, *outputVertices, *outputIndices, vertexMap, edgeLengthCostWeight, flatnessDetectionThreshold);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTetMaker_simplifyTriangleMesh_10(const PxArray_PxVec3* inputVertices, const PxArray_PxU32* inputIndices, int targetTriangleCount, float maximalEdgeLength, PxArray_PxVec3* outputVertices, PxArray_PxU32* outputIndices, PxArray_PxU32* vertexMap, float edgeLengthCostWeight, float flatnessDetectionThreshold, bool projectSimplifiedPointsOnInputMeshSurface) {
  physx::PxTetMaker::simplifyTriangleMesh(*inputVertices, *inputIndices, targetTriangleCount, maximalEdgeLength, *outputVertices, *outputIndices, vertexMap, edgeLengthCostWeight, flatnessDetectionThreshold, projectSimplifiedPointsOnInputMeshSurface);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTetMaker_simplifyTriangleMesh_11(const PxArray_PxVec3* inputVertices, const PxArray_PxU32* inputIndices, int targetTriangleCount, float maximalEdgeLength, PxArray_PxVec3* outputVertices, PxArray_PxU32* outputIndices, PxArray_PxU32* vertexMap, float edgeLengthCostWeight, float flatnessDetectionThreshold, bool projectSimplifiedPointsOnInputMeshSurface, PxArray_PxU32* outputVertexToInputTriangle) {
  physx::PxTetMaker::simplifyTriangleMesh(*inputVertices, *inputIndices, targetTriangleCount, maximalEdgeLength, *outputVertices, *outputIndices, vertexMap, edgeLengthCostWeight, flatnessDetectionThreshold, projectSimplifiedPointsOnInputMeshSurface, outputVertexToInputTriangle);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTetMaker_simplifyTriangleMesh_12(const PxArray_PxVec3* inputVertices, const PxArray_PxU32* inputIndices, int targetTriangleCount, float maximalEdgeLength, PxArray_PxVec3* outputVertices, PxArray_PxU32* outputIndices, PxArray_PxU32* vertexMap, float edgeLengthCostWeight, float flatnessDetectionThreshold, bool projectSimplifiedPointsOnInputMeshSurface, PxArray_PxU32* outputVertexToInputTriangle, bool removeDisconnectedPatches) {
  physx::PxTetMaker::simplifyTriangleMesh(*inputVertices, *inputIndices, targetTriangleCount, maximalEdgeLength, *outputVertices, *outputIndices, vertexMap, edgeLengthCostWeight, flatnessDetectionThreshold, projectSimplifiedPointsOnInputMeshSurface, outputVertexToInputTriangle, removeDisconnectedPatches);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTetMaker_remeshTriangleMesh_5(const PxArray_PxVec3* inputVertices, const PxArray_PxU32* inputIndices, unsigned int gridResolution, PxArray_PxVec3* outputVertices, PxArray_PxU32* outputIndices) {
  physx::PxTetMaker::remeshTriangleMesh(*inputVertices, *inputIndices, gridResolution, *outputVertices, *outputIndices);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTetMaker_remeshTriangleMesh_6(const PxArray_PxVec3* inputVertices, const PxArray_PxU32* inputIndices, unsigned int gridResolution, PxArray_PxVec3* outputVertices, PxArray_PxU32* outputIndices, PxArray_PxU32* vertexMap) {
  physx::PxTetMaker::remeshTriangleMesh(*inputVertices, *inputIndices, gridResolution, *outputVertices, *outputIndices, vertexMap);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTetMaker_createTreeBasedTetrahedralMesh_6(const PxArray_PxVec3* inputVertices, const PxArray_PxU32* inputIndices, bool useTreeNodes, PxArray_PxVec3* outputVertices, PxArray_PxU32* outputIndices, float volumeThreshold) {
  physx::PxTetMaker::createTreeBasedTetrahedralMesh(*inputVertices, *inputIndices, useTreeNodes, *outputVertices, *outputIndices, volumeThreshold);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTetMaker_createRelaxedVoxelTetrahedralMesh_5(const PxArray_PxVec3* inputVertices, const PxArray_PxU32* inputIndices, PxArray_PxVec3* outputVertices, PxArray_PxU32* outputIndices, int resolution) {
  physx::PxTetMaker::createRelaxedVoxelTetrahedralMesh(*inputVertices, *inputIndices, *outputVertices, *outputIndices, resolution);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTetMaker_createRelaxedVoxelTetrahedralMesh_6(const PxArray_PxVec3* inputVertices, const PxArray_PxU32* inputIndices, PxArray_PxVec3* outputVertices, PxArray_PxU32* outputIndices, int resolution, int numRelaxationIterations) {
  physx::PxTetMaker::createRelaxedVoxelTetrahedralMesh(*inputVertices, *inputIndices, *outputVertices, *outputIndices, resolution, numRelaxationIterations);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTetMaker_createRelaxedVoxelTetrahedralMesh_7(const PxArray_PxVec3* inputVertices, const PxArray_PxU32* inputIndices, PxArray_PxVec3* outputVertices, PxArray_PxU32* outputIndices, int resolution, int numRelaxationIterations, float relMinTetVolume) {
  physx::PxTetMaker::createRelaxedVoxelTetrahedralMesh(*inputVertices, *inputIndices, *outputVertices, *outputIndices, resolution, numRelaxationIterations, relMinTetVolume);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTetMaker_detectTriangleIslands_3(PxI32ConstPtr* triangles, unsigned int numTriangles, PxArray_PxU32* islandIndexPerTriangle) {
  physx::PxTetMaker::detectTriangleIslands(*triangles, numTriangles, *islandIndexPerTriangle);
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTetMaker_findLargestIslandId_2(PxU32ConstPtr* islandIndexPerTriangle, unsigned int numTriangles) {
  return physx::PxTetMaker::findLargestIslandId(*islandIndexPerTriangle, numTriangles);
}

// Interface: PxTetrahedronMesh


unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTetrahedronMesh_getNbVertices_0(physx::PxTetrahedronMesh* self) {
  return self->getNbVertices();
}

const physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTetrahedronMesh_getVertices_0(physx::PxTetrahedronMesh* self) {
  return self->getVertices();
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTetrahedronMesh_getNbTetrahedrons_0(physx::PxTetrahedronMesh* self) {
  return self->getNbTetrahedrons();
}

const void* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTetrahedronMesh_getTetrahedrons_0(physx::PxTetrahedronMesh* self) {
  return self->getTetrahedrons();
}

physx::PxTetrahedronMeshFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTetrahedronMesh_getTetrahedronMeshFlags_0(physx::PxTetrahedronMesh* self) {
  static thread_local physx::PxTetrahedronMeshFlags temp;
  return (temp = self->getTetrahedronMeshFlags(), &temp);
}

PxU32ConstPtr* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTetrahedronMesh_getTetrahedraRemap_0(physx::PxTetrahedronMesh* self) {
  static thread_local PxU32ConstPtr temp;
  return (temp = self->getTetrahedraRemap(), &temp);
}

physx::PxBounds3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTetrahedronMesh_getLocalBounds_0(physx::PxTetrahedronMesh* self) {
  static thread_local physx::PxBounds3 temp;
  return (temp = self->getLocalBounds(), &temp);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTetrahedronMesh_release_0(physx::PxTetrahedronMesh* self) {
  self->release();
}

const char* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTetrahedronMesh_getConcreteTypeName_0(physx::PxTetrahedronMesh* self) {
  return self->getConcreteTypeName();
}

int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTetrahedronMesh_getConcreteType_0(physx::PxTetrahedronMesh* self) {
  return self->getConcreteType();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTetrahedronMesh_setBaseFlag_2(physx::PxTetrahedronMesh* self, PxBaseFlagEnum flag, bool value) {
  self->setBaseFlag(flag, value);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTetrahedronMesh_setBaseFlags_1(physx::PxTetrahedronMesh* self, physx::PxBaseFlags* inFlags) {
  self->setBaseFlags(*inFlags);
}

physx::PxBaseFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTetrahedronMesh_getBaseFlags_0(physx::PxTetrahedronMesh* self) {
  static thread_local physx::PxBaseFlags temp;
  return (temp = self->getBaseFlags(), &temp);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTetrahedronMesh_isReleasable_0(physx::PxTetrahedronMesh* self) {
  return self->isReleasable();
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTetrahedronMesh_getReferenceCount_0(physx::PxTetrahedronMesh* self) {
  return self->getReferenceCount();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTetrahedronMesh_acquireReference_0(physx::PxTetrahedronMesh* self) {
  self->acquireReference();
}

// Interface: PxTetrahedronMeshAnalysisResults


physx::PxTetrahedronMeshAnalysisResults* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTetrahedronMeshAnalysisResults_PxTetrahedronMeshAnalysisResults_1(unsigned int flags) {
  return new physx::PxTetrahedronMeshAnalysisResults(flags);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTetrahedronMeshAnalysisResults_isSet_1(physx::PxTetrahedronMeshAnalysisResults* self, PxTetrahedronMeshAnalysisResultEnum flag) {
  return self->isSet(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTetrahedronMeshAnalysisResults_raise_1(physx::PxTetrahedronMeshAnalysisResults* self, PxTetrahedronMeshAnalysisResultEnum flag) {
  self->raise(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTetrahedronMeshAnalysisResults_clear_1(physx::PxTetrahedronMeshAnalysisResults* self, PxTetrahedronMeshAnalysisResultEnum flag) {
  self->clear(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTetrahedronMeshAnalysisResults___destroy___0(physx::PxTetrahedronMeshAnalysisResults* self) {
  delete self;
}

// Interface: PxTetrahedronMeshDesc


physx::PxTetrahedronMeshDesc* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTetrahedronMeshDesc_PxTetrahedronMeshDesc_0() {
  return new physx::PxTetrahedronMeshDesc();
}

physx::PxTetrahedronMeshDesc* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTetrahedronMeshDesc_PxTetrahedronMeshDesc_2(PxArray_PxVec3* meshVertices, PxArray_PxU32* meshTetIndices) {
  return new physx::PxTetrahedronMeshDesc(*meshVertices, *meshTetIndices);
}

physx::PxTetrahedronMeshDesc* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTetrahedronMeshDesc_PxTetrahedronMeshDesc_3(PxArray_PxVec3* meshVertices, PxArray_PxU32* meshTetIndices, PxTetrahedronMeshFormatEnum meshFormat) {
  return new physx::PxTetrahedronMeshDesc(*meshVertices, *meshTetIndices, meshFormat);
}

physx::PxTetrahedronMeshDesc* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTetrahedronMeshDesc_PxTetrahedronMeshDesc_4(PxArray_PxVec3* meshVertices, PxArray_PxU32* meshTetIndices, PxTetrahedronMeshFormatEnum meshFormat, unsigned short numberOfTetsPerHexElement) {
  return new physx::PxTetrahedronMeshDesc(*meshVertices, *meshTetIndices, meshFormat, numberOfTetsPerHexElement);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTetrahedronMeshDesc_isValid_0(physx::PxTetrahedronMeshDesc* self) {
  return self->isValid();
}

PxTypedBoundedData_PxU16* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTetrahedronMeshDesc_get_materialIndices_0(physx::PxTetrahedronMeshDesc* self) {
  return &self->materialIndices;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTetrahedronMeshDesc_set_materialIndices_1(physx::PxTetrahedronMeshDesc* self, PxTypedBoundedData_PxU16* arg0) {
  self->materialIndices = *arg0;
}

physx::PxBoundedData* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTetrahedronMeshDesc_get_points_0(physx::PxTetrahedronMeshDesc* self) {
  return &self->points;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTetrahedronMeshDesc_set_points_1(physx::PxTetrahedronMeshDesc* self, physx::PxBoundedData* arg0) {
  self->points = *arg0;
}

physx::PxBoundedData* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTetrahedronMeshDesc_get_tetrahedrons_0(physx::PxTetrahedronMeshDesc* self) {
  return &self->tetrahedrons;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTetrahedronMeshDesc_set_tetrahedrons_1(physx::PxTetrahedronMeshDesc* self, physx::PxBoundedData* arg0) {
  self->tetrahedrons = *arg0;
}

physx::PxMeshFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTetrahedronMeshDesc_get_flags_0(physx::PxTetrahedronMeshDesc* self) {
  return &self->flags;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTetrahedronMeshDesc_set_flags_1(physx::PxTetrahedronMeshDesc* self, physx::PxMeshFlags* arg0) {
  self->flags = *arg0;
}

short EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTetrahedronMeshDesc_get_tetsPerElement_0(physx::PxTetrahedronMeshDesc* self) {
  return self->tetsPerElement;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTetrahedronMeshDesc_set_tetsPerElement_1(physx::PxTetrahedronMeshDesc* self, short arg0) {
  self->tetsPerElement = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTetrahedronMeshDesc___destroy___0(physx::PxTetrahedronMeshDesc* self) {
  delete self;
}

// Interface: PxTetrahedronMeshExt


int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTetrahedronMeshExt_findTetrahedronContainingPoint_4(const physx::PxTetrahedronMesh* mesh, const physx::PxVec3* point, physx::PxVec4* bary, float tolerance) {
  return physx::PxTetrahedronMeshExt::findTetrahedronContainingPoint(mesh, *point, *bary, tolerance);
}

int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTetrahedronMeshExt_findTetrahedronClosestToPoint_3(const physx::PxTetrahedronMesh* mesh, const physx::PxVec3* point, physx::PxVec4* bary) {
  return physx::PxTetrahedronMeshExt::findTetrahedronClosestToPoint(mesh, *point, *bary);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTetrahedronMeshExt_createPointsToTetrahedronMap_5(const PxArray_PxVec3* tetMeshVertices, const PxArray_PxU32* tetMeshIndices, const PxArray_PxVec3* pointsToEmbed, PxArray_PxVec4* barycentricCoordinates, PxArray_PxU32* tetLinks) {
  physx::PxTetrahedronMeshExt::createPointsToTetrahedronMap(*tetMeshVertices, *tetMeshIndices, *pointsToEmbed, *barycentricCoordinates, *tetLinks);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTetrahedronMeshExt_extractTetMeshSurface_2(const physx::PxTetrahedronMesh* mesh, PxArray_PxU32* surfaceTriangles) {
  physx::PxTetrahedronMeshExt::extractTetMeshSurface(mesh, *surfaceTriangles);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTetrahedronMeshExt_extractTetMeshSurface_3(const physx::PxTetrahedronMesh* mesh, PxArray_PxU32* surfaceTriangles, PxArray_PxU32* surfaceTriangleToTet) {
  physx::PxTetrahedronMeshExt::extractTetMeshSurface(mesh, *surfaceTriangles, surfaceTriangleToTet);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTetrahedronMeshExt_extractTetMeshSurface_4(const physx::PxTetrahedronMesh* mesh, PxArray_PxU32* surfaceTriangles, PxArray_PxU32* surfaceTriangleToTet, bool flipTriangleOrientation) {
  physx::PxTetrahedronMeshExt::extractTetMeshSurface(mesh, *surfaceTriangles, surfaceTriangleToTet, flipTriangleOrientation);
}

// Interface: PxTetrahedronMeshFlags


physx::PxTetrahedronMeshFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTetrahedronMeshFlags_PxTetrahedronMeshFlags_1(unsigned char flags) {
  return new physx::PxTetrahedronMeshFlags(flags);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTetrahedronMeshFlags_isSet_1(physx::PxTetrahedronMeshFlags* self, PxTetrahedronMeshFlagEnum flag) {
  return self->isSet(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTetrahedronMeshFlags_raise_1(physx::PxTetrahedronMeshFlags* self, PxTetrahedronMeshFlagEnum flag) {
  self->raise(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTetrahedronMeshFlags_clear_1(physx::PxTetrahedronMeshFlags* self, PxTetrahedronMeshFlagEnum flag) {
  self->clear(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTetrahedronMeshFlags___destroy___0(physx::PxTetrahedronMeshFlags* self) {
  delete self;
}

// Interface: PxTetrahedronMeshGeometry


physx::PxTetrahedronMeshGeometry* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTetrahedronMeshGeometry_PxTetrahedronMeshGeometry_1(physx::PxTetrahedronMesh* mesh) {
  return new physx::PxTetrahedronMeshGeometry(mesh);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTetrahedronMeshGeometry_isValid_0(physx::PxTetrahedronMeshGeometry* self) {
  return self->isValid();
}

PxGeometryTypeEnum EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTetrahedronMeshGeometry_getType_0(physx::PxTetrahedronMeshGeometry* self) {
  return self->getType();
}

physx::PxTetrahedronMesh* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTetrahedronMeshGeometry_get_tetrahedronMesh_0(physx::PxTetrahedronMeshGeometry* self) {
  return self->tetrahedronMesh;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTetrahedronMeshGeometry_set_tetrahedronMesh_1(physx::PxTetrahedronMeshGeometry* self, physx::PxTetrahedronMesh* arg0) {
  self->tetrahedronMesh = arg0;
}

// Interface: PxTolerancesScale


physx::PxTolerancesScale* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTolerancesScale_PxTolerancesScale_0() {
  return new physx::PxTolerancesScale();
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTolerancesScale_isValid_0(physx::PxTolerancesScale* self) {
  return self->isValid();
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTolerancesScale_get_length_0(physx::PxTolerancesScale* self) {
  return self->length;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTolerancesScale_set_length_1(physx::PxTolerancesScale* self, float arg0) {
  self->length = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTolerancesScale_get_speed_0(physx::PxTolerancesScale* self) {
  return self->speed;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTolerancesScale_set_speed_1(physx::PxTolerancesScale* self, float arg0) {
  self->speed = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTolerancesScale___destroy___0(physx::PxTolerancesScale* self) {
  delete self;
}

// Interface: PxTopLevelFunctions


physx::PxSimulationFilterShader* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTopLevelFunctions_DefaultFilterShader_0() {
  static thread_local physx::PxSimulationFilterShader temp;
  return (temp = PxTopLevelFunctions::DefaultFilterShader(), &temp);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTopLevelFunctions_setupPassThroughFilterShader_2(physx::PxSceneDesc* sceneDesc, PassThroughFilterShader* filterShader) {
  PxTopLevelFunctions::setupPassThroughFilterShader(sceneDesc, filterShader);
}

physx::PxControllerManager* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTopLevelFunctions_CreateControllerManager_1(physx::PxScene* scene) {
  return PxTopLevelFunctions::CreateControllerManager(*scene);
}

physx::PxControllerManager* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTopLevelFunctions_CreateControllerManager_2(physx::PxScene* scene, bool lockingEnabled) {
  return PxTopLevelFunctions::CreateControllerManager(*scene, lockingEnabled);
}

physx::PxFoundation* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTopLevelFunctions_CreateFoundation_3(unsigned int version, physx::PxDefaultAllocator* allocator, physx::PxErrorCallback* errorCallback) {
  return PxTopLevelFunctions::CreateFoundation(version, *allocator, *errorCallback);
}

physx::PxPhysics* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTopLevelFunctions_CreatePhysics_3(unsigned int version, physx::PxFoundation* foundation, const physx::PxTolerancesScale* params) {
  return PxTopLevelFunctions::CreatePhysics(version, *foundation, *params);
}

physx::PxPhysics* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTopLevelFunctions_CreatePhysics_4(unsigned int version, physx::PxFoundation* foundation, const physx::PxTolerancesScale* params, physx::PxPvd* pvd) {
  return PxTopLevelFunctions::CreatePhysics(version, *foundation, *params, pvd);
}

physx::PxPhysics* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTopLevelFunctions_CreatePhysics_5(unsigned int version, physx::PxFoundation* foundation, const physx::PxTolerancesScale* params, physx::PxPvd* pvd, physx::PxOmniPvd* omniPvd) {
  return PxTopLevelFunctions::CreatePhysics(version, *foundation, *params, pvd, omniPvd);
}

physx::PxDefaultCpuDispatcher* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTopLevelFunctions_DefaultCpuDispatcherCreate_1(unsigned int numThreads) {
  return PxTopLevelFunctions::DefaultCpuDispatcherCreate(numThreads);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTopLevelFunctions_InitExtensions_1(physx::PxPhysics* physics) {
  return PxTopLevelFunctions::InitExtensions(*physics);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTopLevelFunctions_CloseExtensions_0() {
  PxTopLevelFunctions::CloseExtensions();
}

physx::PxPvd* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTopLevelFunctions_CreatePvd_1(physx::PxFoundation* foundation) {
  return PxTopLevelFunctions::CreatePvd(*foundation);
}

physx::PxD6Joint* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTopLevelFunctions_D6JointCreate_5(physx::PxPhysics* physics, physx::PxRigidActor* actor0, physx::PxTransform* localFrame0, physx::PxRigidActor* actor1, physx::PxTransform* localFrame1) {
  return PxTopLevelFunctions::D6JointCreate(*physics, actor0, *localFrame0, actor1, *localFrame1);
}

physx::PxDistanceJoint* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTopLevelFunctions_DistanceJointCreate_5(physx::PxPhysics* physics, physx::PxRigidActor* actor0, physx::PxTransform* localFrame0, physx::PxRigidActor* actor1, physx::PxTransform* localFrame1) {
  return PxTopLevelFunctions::DistanceJointCreate(*physics, actor0, *localFrame0, actor1, *localFrame1);
}

physx::PxFixedJoint* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTopLevelFunctions_FixedJointCreate_5(physx::PxPhysics* physics, physx::PxRigidActor* actor0, physx::PxTransform* localFrame0, physx::PxRigidActor* actor1, physx::PxTransform* localFrame1) {
  return PxTopLevelFunctions::FixedJointCreate(*physics, actor0, *localFrame0, actor1, *localFrame1);
}

physx::PxGearJoint* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTopLevelFunctions_GearJointCreate_5(physx::PxPhysics* physics, physx::PxRigidActor* actor0, physx::PxTransform* localFrame0, physx::PxRigidActor* actor1, physx::PxTransform* localFrame1) {
  return PxTopLevelFunctions::GearJointCreate(*physics, actor0, *localFrame0, actor1, *localFrame1);
}

physx::PxPrismaticJoint* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTopLevelFunctions_PrismaticJointCreate_5(physx::PxPhysics* physics, physx::PxRigidActor* actor0, physx::PxTransform* localFrame0, physx::PxRigidActor* actor1, physx::PxTransform* localFrame1) {
  return PxTopLevelFunctions::PrismaticJointCreate(*physics, actor0, *localFrame0, actor1, *localFrame1);
}

physx::PxRackAndPinionJoint* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTopLevelFunctions_RackAndPinionJointCreate_5(physx::PxPhysics* physics, physx::PxRigidActor* actor0, physx::PxTransform* localFrame0, physx::PxRigidActor* actor1, physx::PxTransform* localFrame1) {
  return PxTopLevelFunctions::RackAndPinionJointCreate(*physics, actor0, *localFrame0, actor1, *localFrame1);
}

physx::PxRevoluteJoint* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTopLevelFunctions_RevoluteJointCreate_5(physx::PxPhysics* physics, physx::PxRigidActor* actor0, physx::PxTransform* localFrame0, physx::PxRigidActor* actor1, physx::PxTransform* localFrame1) {
  return PxTopLevelFunctions::RevoluteJointCreate(*physics, actor0, *localFrame0, actor1, *localFrame1);
}

physx::PxSphericalJoint* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTopLevelFunctions_SphericalJointCreate_5(physx::PxPhysics* physics, physx::PxRigidActor* actor0, physx::PxTransform* localFrame0, physx::PxRigidActor* actor1, physx::PxTransform* localFrame1) {
  return PxTopLevelFunctions::SphericalJointCreate(*physics, actor0, *localFrame0, actor1, *localFrame1);
}

physx::PxConvexMesh* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTopLevelFunctions_CreateConvexMesh_2(const physx::PxCookingParams* params, const physx::PxConvexMeshDesc* desc) {
  return PxTopLevelFunctions::CreateConvexMesh(*params, *desc);
}

physx::PxTriangleMesh* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTopLevelFunctions_CreateTriangleMesh_2(const physx::PxCookingParams* params, const physx::PxTriangleMeshDesc* desc) {
  return PxTopLevelFunctions::CreateTriangleMesh(*params, *desc);
}

physx::PxHeightField* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTopLevelFunctions_CreateHeightField_1(const physx::PxHeightFieldDesc* desc) {
  return PxTopLevelFunctions::CreateHeightField(*desc);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTopLevelFunctions_CookTriangleMesh_3(const physx::PxCookingParams* params, const physx::PxTriangleMeshDesc* desc, physx::PxOutputStream* stream) {
  return PxTopLevelFunctions::CookTriangleMesh(*params, *desc, *stream);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTopLevelFunctions_CookConvexMesh_3(const physx::PxCookingParams* params, const physx::PxConvexMeshDesc* desc, physx::PxOutputStream* stream) {
  return PxTopLevelFunctions::CookConvexMesh(*params, *desc, *stream);
}

physx::PxRigidDynamic* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTopLevelFunctions_CreateDynamicFromShape_4(physx::PxPhysics* sdk, const physx::PxTransform* transform, physx::PxShape* shape, float density) {
  return PxTopLevelFunctions::CreateDynamicFromShape(*sdk, *transform, *shape, density);
}

physx::PxRigidDynamic* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTopLevelFunctions_CreateDynamic_5(physx::PxPhysics* sdk, const physx::PxTransform* transform, const physx::PxGeometry* geometry, physx::PxMaterial* material, float density) {
  return PxTopLevelFunctions::CreateDynamic(*sdk, *transform, *geometry, *material, density);
}

physx::PxRigidDynamic* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTopLevelFunctions_CreateDynamic_6(physx::PxPhysics* sdk, const physx::PxTransform* transform, const physx::PxGeometry* geometry, physx::PxMaterial* material, float density, const physx::PxTransform* shapeOffset) {
  return PxTopLevelFunctions::CreateDynamic(*sdk, *transform, *geometry, *material, density, *shapeOffset);
}

physx::PxRigidDynamic* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTopLevelFunctions_CreateKinematicFromShape_4(physx::PxPhysics* sdk, const physx::PxTransform* transform, physx::PxShape* shape, float density) {
  return PxTopLevelFunctions::CreateKinematicFromShape(*sdk, *transform, *shape, density);
}

physx::PxRigidDynamic* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTopLevelFunctions_CreateKinematic_5(physx::PxPhysics* sdk, const physx::PxTransform* transform, const physx::PxGeometry* geometry, physx::PxMaterial* material, float density) {
  return PxTopLevelFunctions::CreateKinematic(*sdk, *transform, *geometry, *material, density);
}

physx::PxRigidDynamic* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTopLevelFunctions_CreateKinematic_6(physx::PxPhysics* sdk, const physx::PxTransform* transform, const physx::PxGeometry* geometry, physx::PxMaterial* material, float density, const physx::PxTransform* shapeOffset) {
  return PxTopLevelFunctions::CreateKinematic(*sdk, *transform, *geometry, *material, density, *shapeOffset);
}

physx::PxRigidStatic* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTopLevelFunctions_CreateStaticFromShape_3(physx::PxPhysics* sdk, const physx::PxTransform* transform, physx::PxShape* shape) {
  return PxTopLevelFunctions::CreateStaticFromShape(*sdk, *transform, *shape);
}

physx::PxRigidStatic* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTopLevelFunctions_CreateStatic_5(physx::PxPhysics* sdk, const physx::PxTransform* transform, const physx::PxGeometry* geometry, physx::PxMaterial* material, const physx::PxTransform* shapeOffset) {
  return PxTopLevelFunctions::CreateStatic(*sdk, *transform, *geometry, *material, *shapeOffset);
}

physx::PxRigidStatic* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTopLevelFunctions_CreatePlane_3(physx::PxPhysics* sdk, const physx::PxPlane* plane, physx::PxMaterial* material) {
  return PxTopLevelFunctions::CreatePlane(*sdk, *plane, *material);
}

physx::PxShape* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTopLevelFunctions_CloneShape_3(physx::PxPhysics* physics, const physx::PxShape* from, bool isExclusive) {
  return PxTopLevelFunctions::CloneShape(*physics, *from, isExclusive);
}

physx::PxRigidStatic* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTopLevelFunctions_CloneStatic_3(physx::PxPhysics* physicsSDK, const physx::PxTransform* transform, const physx::PxRigidActor* from) {
  return PxTopLevelFunctions::CloneStatic(*physicsSDK, *transform, *from);
}

physx::PxRigidDynamic* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTopLevelFunctions_CloneDynamic_3(physx::PxPhysics* physicsSDK, const physx::PxTransform* transform, const physx::PxRigidDynamic* from) {
  return PxTopLevelFunctions::CloneDynamic(*physicsSDK, *transform, *from);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTopLevelFunctions_ScaleRigidActor_3(physx::PxRigidActor* actor, float scale, bool scaleMassProps) {
  PxTopLevelFunctions::ScaleRigidActor(*actor, scale, scaleMassProps);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTopLevelFunctions_IntegrateTransform_5(const physx::PxTransform* curTrans, const physx::PxVec3* linvel, const physx::PxVec3* angvel, float timeStep, physx::PxTransform* result) {
  PxTopLevelFunctions::IntegrateTransform(*curTrans, *linvel, *angvel, timeStep, *result);
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTopLevelFunctions_get_PHYSICS_VERSION_0(PxTopLevelFunctions* self) {
  return self->PHYSICS_VERSION;
}

// Interface: PxTransform


physx::PxTransform* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTransform_PxTransform_0() {
  return new physx::PxTransform();
}

physx::PxTransform* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTransform_PxTransform_1(PxIDENTITYEnum p0) {
  return new physx::PxTransform(p0);
}

physx::PxTransform* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTransform_PxTransform_2(const physx::PxVec3* p0, const physx::PxQuat* q0) {
  return new physx::PxTransform(*p0, *q0);
}

physx::PxTransform* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTransform_getInverse_0(physx::PxTransform* self) {
  static thread_local physx::PxTransform temp;
  return (temp = self->getInverse(), &temp);
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTransform_transform_1(physx::PxTransform* self, const physx::PxVec3* input) {
  static thread_local physx::PxVec3 temp;
  return (temp = self->transform(*input), &temp);
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTransform_transformInv_1(physx::PxTransform* self, const physx::PxVec3* input) {
  static thread_local physx::PxVec3 temp;
  return (temp = self->transformInv(*input), &temp);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTransform_isValid_0(physx::PxTransform* self) {
  return self->isValid();
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTransform_isSane_0(physx::PxTransform* self) {
  return self->isSane();
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTransform_isFinite_0(physx::PxTransform* self) {
  return self->isFinite();
}

physx::PxTransform* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTransform_getNormalized_0(physx::PxTransform* self) {
  static thread_local physx::PxTransform temp;
  return (temp = self->getNormalized(), &temp);
}

physx::PxQuat* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTransform_get_q_0(physx::PxTransform* self) {
  return &self->q;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTransform_set_q_1(physx::PxTransform* self, physx::PxQuat* arg0) {
  self->q = *arg0;
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTransform_get_p_0(physx::PxTransform* self) {
  return &self->p;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTransform_set_p_1(physx::PxTransform* self, physx::PxVec3* arg0) {
  self->p = *arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTransform___destroy___0(physx::PxTransform* self) {
  delete self;
}

// Interface: PxTriangle


physx::PxTriangle* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTriangle_PxTriangle_0() {
  return new physx::PxTriangle();
}

physx::PxTriangle* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTriangle_PxTriangle_3(const physx::PxVec3* p0, const physx::PxVec3* p1, const physx::PxVec3* p2) {
  return new physx::PxTriangle(*p0, *p1, *p2);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTriangle_normal_1(physx::PxTriangle* self, physx::PxVec3* normal) {
  self->normal(*normal);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTriangle_denormalizedNormal_1(physx::PxTriangle* self, physx::PxVec3* normal) {
  self->denormalizedNormal(*normal);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTriangle_area_0(physx::PxTriangle* self) {
  return self->area();
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTriangle_pointFromUV_2(physx::PxTriangle* self, float u, float v) {
  static thread_local physx::PxVec3 temp;
  return (temp = self->pointFromUV(u, v), &temp);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTriangle___destroy___0(physx::PxTriangle* self) {
  delete self;
}

// Interface: PxTriangleMesh


unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTriangleMesh_getNbVertices_0(physx::PxTriangleMesh* self) {
  return self->getNbVertices();
}

const physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTriangleMesh_getVertices_0(physx::PxTriangleMesh* self) {
  return self->getVertices();
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTriangleMesh_getVerticesForModification_0(physx::PxTriangleMesh* self) {
  return self->getVerticesForModification();
}

physx::PxBounds3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTriangleMesh_refitBVH_0(physx::PxTriangleMesh* self) {
  static thread_local physx::PxBounds3 temp;
  return (temp = self->refitBVH(), &temp);
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTriangleMesh_getNbTriangles_0(physx::PxTriangleMesh* self) {
  return self->getNbTriangles();
}

const void* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTriangleMesh_getTriangles_0(physx::PxTriangleMesh* self) {
  return self->getTriangles();
}

physx::PxTriangleMeshFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTriangleMesh_getTriangleMeshFlags_0(physx::PxTriangleMesh* self) {
  static thread_local physx::PxTriangleMeshFlags temp;
  return (temp = self->getTriangleMeshFlags(), &temp);
}

const PxU32ConstPtr* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTriangleMesh_getTrianglesRemap_0(physx::PxTriangleMesh* self) {
  static thread_local PxU32ConstPtr temp;
  return (temp = self->getTrianglesRemap(), &temp);
}

unsigned short EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTriangleMesh_getTriangleMaterialIndex_1(physx::PxTriangleMesh* self, unsigned int triangleIndex) {
  return self->getTriangleMaterialIndex(triangleIndex);
}

physx::PxBounds3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTriangleMesh_getLocalBounds_0(physx::PxTriangleMesh* self) {
  static thread_local physx::PxBounds3 temp;
  return (temp = self->getLocalBounds(), &temp);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTriangleMesh_release_0(physx::PxTriangleMesh* self) {
  self->release();
}

const char* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTriangleMesh_getConcreteTypeName_0(physx::PxTriangleMesh* self) {
  return self->getConcreteTypeName();
}

int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTriangleMesh_getConcreteType_0(physx::PxTriangleMesh* self) {
  return self->getConcreteType();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTriangleMesh_setBaseFlag_2(physx::PxTriangleMesh* self, PxBaseFlagEnum flag, bool value) {
  self->setBaseFlag(flag, value);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTriangleMesh_setBaseFlags_1(physx::PxTriangleMesh* self, physx::PxBaseFlags* inFlags) {
  self->setBaseFlags(*inFlags);
}

physx::PxBaseFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTriangleMesh_getBaseFlags_0(physx::PxTriangleMesh* self) {
  static thread_local physx::PxBaseFlags temp;
  return (temp = self->getBaseFlags(), &temp);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTriangleMesh_isReleasable_0(physx::PxTriangleMesh* self) {
  return self->isReleasable();
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTriangleMesh_getReferenceCount_0(physx::PxTriangleMesh* self) {
  return self->getReferenceCount();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTriangleMesh_acquireReference_0(physx::PxTriangleMesh* self) {
  self->acquireReference();
}

// Interface: PxTriangleMeshAnalysisResults


physx::PxTriangleMeshAnalysisResults* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTriangleMeshAnalysisResults_PxTriangleMeshAnalysisResults_1(unsigned int flags) {
  return new physx::PxTriangleMeshAnalysisResults(flags);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTriangleMeshAnalysisResults_isSet_1(physx::PxTriangleMeshAnalysisResults* self, PxTriangleMeshAnalysisResultEnum flag) {
  return self->isSet(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTriangleMeshAnalysisResults_raise_1(physx::PxTriangleMeshAnalysisResults* self, PxTriangleMeshAnalysisResultEnum flag) {
  self->raise(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTriangleMeshAnalysisResults_clear_1(physx::PxTriangleMeshAnalysisResults* self, PxTriangleMeshAnalysisResultEnum flag) {
  self->clear(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTriangleMeshAnalysisResults___destroy___0(physx::PxTriangleMeshAnalysisResults* self) {
  delete self;
}

// Interface: PxTriangleMeshDesc


physx::PxTriangleMeshDesc* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTriangleMeshDesc_PxTriangleMeshDesc_0() {
  return new physx::PxTriangleMeshDesc();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTriangleMeshDesc_setToDefault_0(physx::PxTriangleMeshDesc* self) {
  self->setToDefault();
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTriangleMeshDesc_isValid_0(physx::PxTriangleMeshDesc* self) {
  return self->isValid();
}

const PxTypedBoundedData_PxU16Const* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTriangleMeshDesc_get_materialIndices_0(physx::PxTriangleMeshDesc* self) {
  return &self->materialIndices;
}

const void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTriangleMeshDesc_set_materialIndices_1(physx::PxTriangleMeshDesc* self, PxTypedBoundedData_PxU16Const* arg0) {
  self->materialIndices = *arg0;
}

physx::PxBoundedData* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTriangleMeshDesc_get_points_0(physx::PxTriangleMeshDesc* self) {
  return &self->points;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTriangleMeshDesc_set_points_1(physx::PxTriangleMeshDesc* self, physx::PxBoundedData* arg0) {
  self->points = *arg0;
}

physx::PxBoundedData* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTriangleMeshDesc_get_triangles_0(physx::PxTriangleMeshDesc* self) {
  return &self->triangles;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTriangleMeshDesc_set_triangles_1(physx::PxTriangleMeshDesc* self, physx::PxBoundedData* arg0) {
  self->triangles = *arg0;
}

physx::PxMeshFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTriangleMeshDesc_get_flags_0(physx::PxTriangleMeshDesc* self) {
  return &self->flags;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTriangleMeshDesc_set_flags_1(physx::PxTriangleMeshDesc* self, physx::PxMeshFlags* arg0) {
  self->flags = *arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTriangleMeshDesc___destroy___0(physx::PxTriangleMeshDesc* self) {
  delete self;
}

// Interface: PxTriangleMeshFlags


physx::PxTriangleMeshFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTriangleMeshFlags_PxTriangleMeshFlags_1(unsigned char flags) {
  return new physx::PxTriangleMeshFlags(flags);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTriangleMeshFlags_isSet_1(physx::PxTriangleMeshFlags* self, PxTriangleMeshFlagEnum flag) {
  return self->isSet(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTriangleMeshFlags_raise_1(physx::PxTriangleMeshFlags* self, PxTriangleMeshFlagEnum flag) {
  self->raise(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTriangleMeshFlags_clear_1(physx::PxTriangleMeshFlags* self, PxTriangleMeshFlagEnum flag) {
  self->clear(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTriangleMeshFlags___destroy___0(physx::PxTriangleMeshFlags* self) {
  delete self;
}

// Interface: PxTriangleMeshGeometry


physx::PxTriangleMeshGeometry* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTriangleMeshGeometry_PxTriangleMeshGeometry_1(physx::PxTriangleMesh* mesh) {
  return new physx::PxTriangleMeshGeometry(mesh);
}

physx::PxTriangleMeshGeometry* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTriangleMeshGeometry_PxTriangleMeshGeometry_2(physx::PxTriangleMesh* mesh, const physx::PxMeshScale* scaling) {
  return new physx::PxTriangleMeshGeometry(mesh, *scaling);
}

physx::PxTriangleMeshGeometry* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTriangleMeshGeometry_PxTriangleMeshGeometry_3(physx::PxTriangleMesh* mesh, const physx::PxMeshScale* scaling, physx::PxMeshGeometryFlags* flags) {
  return new physx::PxTriangleMeshGeometry(mesh, *scaling, *flags);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTriangleMeshGeometry_isValid_0(physx::PxTriangleMeshGeometry* self) {
  return self->isValid();
}

PxGeometryTypeEnum EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTriangleMeshGeometry_getType_0(physx::PxTriangleMeshGeometry* self) {
  return self->getType();
}

physx::PxMeshScale* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTriangleMeshGeometry_get_scale_0(physx::PxTriangleMeshGeometry* self) {
  return &self->scale;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTriangleMeshGeometry_set_scale_1(physx::PxTriangleMeshGeometry* self, physx::PxMeshScale* arg0) {
  self->scale = *arg0;
}

physx::PxMeshGeometryFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTriangleMeshGeometry_get_meshFlags_0(physx::PxTriangleMeshGeometry* self) {
  return &self->meshFlags;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTriangleMeshGeometry_set_meshFlags_1(physx::PxTriangleMeshGeometry* self, physx::PxMeshGeometryFlags* arg0) {
  self->meshFlags = *arg0;
}

physx::PxTriangleMesh* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTriangleMeshGeometry_get_triangleMesh_0(physx::PxTriangleMeshGeometry* self) {
  return self->triangleMesh;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTriangleMeshGeometry_set_triangleMesh_1(physx::PxTriangleMeshGeometry* self, physx::PxTriangleMesh* arg0) {
  self->triangleMesh = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTriangleMeshGeometry___destroy___0(physx::PxTriangleMeshGeometry* self) {
  delete self;
}

// Interface: PxTriggerPair


physx::PxShape* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTriggerPair_get_triggerShape_0(physx::PxTriggerPair* self) {
  return self->triggerShape;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTriggerPair_set_triggerShape_1(physx::PxTriggerPair* self, physx::PxShape* arg0) {
  self->triggerShape = arg0;
}

physx::PxActor* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTriggerPair_get_triggerActor_0(physx::PxTriggerPair* self) {
  return self->triggerActor;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTriggerPair_set_triggerActor_1(physx::PxTriggerPair* self, physx::PxActor* arg0) {
  self->triggerActor = arg0;
}

physx::PxShape* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTriggerPair_get_otherShape_0(physx::PxTriggerPair* self) {
  return self->otherShape;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTriggerPair_set_otherShape_1(physx::PxTriggerPair* self, physx::PxShape* arg0) {
  self->otherShape = arg0;
}

physx::PxActor* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTriggerPair_get_otherActor_0(physx::PxTriggerPair* self) {
  return self->otherActor;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTriggerPair_set_otherActor_1(physx::PxTriggerPair* self, physx::PxActor* arg0) {
  self->otherActor = arg0;
}

PxPairFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTriggerPair_get_status_0(physx::PxTriggerPair* self) {
  return self->status;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTriggerPair_set_status_1(physx::PxTriggerPair* self, PxPairFlagEnum arg0) {
  self->status = arg0;
}

physx::PxTriggerPairFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTriggerPair_get_flags_0(physx::PxTriggerPair* self) {
  return &self->flags;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTriggerPair_set_flags_1(physx::PxTriggerPair* self, physx::PxTriggerPairFlags* arg0) {
  self->flags = *arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTriggerPair___destroy___0(physx::PxTriggerPair* self) {
  delete self;
}

// Interface: PxTriggerPairFlags


physx::PxTriggerPairFlags* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTriggerPairFlags_PxTriggerPairFlags_1(unsigned char flags) {
  return new physx::PxTriggerPairFlags(flags);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTriggerPairFlags_isSet_1(physx::PxTriggerPairFlags* self, PxTriggerPairFlagEnum flag) {
  return self->isSet(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTriggerPairFlags_raise_1(physx::PxTriggerPairFlags* self, PxTriggerPairFlagEnum flag) {
  self->raise(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTriggerPairFlags_clear_1(physx::PxTriggerPairFlags* self, PxTriggerPairFlagEnum flag) {
  self->clear(flag);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTriggerPairFlags___destroy___0(physx::PxTriggerPairFlags* self) {
  delete self;
}

// Interface: PxTypedBoundedData_PxU16


unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTypedBoundedData_PxU16_get_stride_0(PxTypedBoundedData_PxU16* self) {
  return self->stride;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTypedBoundedData_PxU16_set_stride_1(PxTypedBoundedData_PxU16* self, unsigned int arg0) {
  self->stride = arg0;
}

PxU16Ptr* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTypedBoundedData_PxU16_get_data_0(PxTypedBoundedData_PxU16* self) {
  return &self->data;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTypedBoundedData_PxU16_set_data_1(PxTypedBoundedData_PxU16* self, PxU16Ptr* arg0) {
  self->data = *arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTypedBoundedData_PxU16___destroy___0(PxTypedBoundedData_PxU16* self) {
  delete self;
}

// Interface: PxTypedBoundedData_PxU16Const


unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTypedBoundedData_PxU16Const_get_stride_0(PxTypedBoundedData_PxU16Const* self) {
  return self->stride;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTypedBoundedData_PxU16Const_set_stride_1(PxTypedBoundedData_PxU16Const* self, unsigned int arg0) {
  self->stride = arg0;
}

const PxU16ConstPtr* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTypedBoundedData_PxU16Const_get_data_0(PxTypedBoundedData_PxU16Const* self) {
  return &self->data;
}

const void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTypedBoundedData_PxU16Const_set_data_1(PxTypedBoundedData_PxU16Const* self, PxU16ConstPtr* arg0) {
  self->data = *arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxTypedBoundedData_PxU16Const___destroy___0(PxTypedBoundedData_PxU16Const* self) {
  delete self;
}

// Interface: PxU16Ptr


void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxU16Ptr___destroy___0(PxU16Ptr* self) {
  delete self;
}

// Interface: PxU32Ptr


void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxU32Ptr___destroy___0(PxU32Ptr* self) {
  delete self;
}

// Interface: PxU8Ptr


void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxU8Ptr___destroy___0(PxU8Ptr* self) {
  delete self;
}

// Interface: PxUserControllerHitReportImpl


PxUserControllerHitReportImpl* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxUserControllerHitReportImpl_PxUserControllerHitReportImpl_0() {
  return new PxUserControllerHitReportImpl();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxUserControllerHitReportImpl_onShapeHit_1(PxUserControllerHitReportImpl* self, const physx::PxControllerShapeHit* hit) {
  self->onShapeHit(*hit);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxUserControllerHitReportImpl_onControllerHit_1(PxUserControllerHitReportImpl* self, const physx::PxControllersHit* hit) {
  self->onControllerHit(*hit);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxUserControllerHitReportImpl_onObstacleHit_1(PxUserControllerHitReportImpl* self, const physx::PxControllerObstacleHit* hit) {
  self->onObstacleHit(*hit);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxUserControllerHitReportImpl___destroy___0(PxUserControllerHitReportImpl* self) {
  delete self;
}

// Interface: PxVec3


physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVec3_PxVec3_0() {
  return new physx::PxVec3();
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVec3_PxVec3_3(float x, float y, float z) {
  return new physx::PxVec3(x, y, z);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVec3_isZero_0(physx::PxVec3* self) {
  return self->isZero();
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVec3_isFinite_0(physx::PxVec3* self) {
  return self->isFinite();
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVec3_isNormalized_0(physx::PxVec3* self) {
  return self->isNormalized();
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVec3_magnitudeSquared_0(physx::PxVec3* self) {
  return self->magnitudeSquared();
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVec3_magnitude_0(physx::PxVec3* self) {
  return self->magnitude();
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVec3_dot_1(physx::PxVec3* self, const physx::PxVec3* v) {
  return self->dot(*v);
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVec3_cross_1(physx::PxVec3* self, const physx::PxVec3* v) {
  static thread_local physx::PxVec3 temp;
  return (temp = self->cross(*v), &temp);
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVec3_getNormalized_0(physx::PxVec3* self) {
  static thread_local physx::PxVec3 temp;
  return (temp = self->getNormalized(), &temp);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVec3_normalize_0(physx::PxVec3* self) {
  return self->normalize();
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVec3_normalizeSafe_0(physx::PxVec3* self) {
  return self->normalizeSafe();
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVec3_normalizeFast_0(physx::PxVec3* self) {
  return self->normalizeFast();
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVec3_multiply_1(physx::PxVec3* self, const physx::PxVec3* a) {
  static thread_local physx::PxVec3 temp;
  return (temp = self->multiply(*a), &temp);
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVec3_minimum_1(physx::PxVec3* self, const physx::PxVec3* v) {
  static thread_local physx::PxVec3 temp;
  return (temp = self->minimum(*v), &temp);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVec3_minElement_0(physx::PxVec3* self) {
  return self->minElement();
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVec3_maximum_1(physx::PxVec3* self, const physx::PxVec3* v) {
  static thread_local physx::PxVec3 temp;
  return (temp = self->maximum(*v), &temp);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVec3_maxElement_0(physx::PxVec3* self) {
  return self->maxElement();
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVec3_abs_0(physx::PxVec3* self) {
  static thread_local physx::PxVec3 temp;
  return (temp = self->abs(), &temp);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVec3_get_x_0(physx::PxVec3* self) {
  return self->x;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVec3_set_x_1(physx::PxVec3* self, float arg0) {
  self->x = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVec3_get_y_0(physx::PxVec3* self) {
  return self->y;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVec3_set_y_1(physx::PxVec3* self, float arg0) {
  self->y = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVec3_get_z_0(physx::PxVec3* self) {
  return self->z;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVec3_set_z_1(physx::PxVec3* self, float arg0) {
  self->z = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVec3___destroy___0(physx::PxVec3* self) {
  delete self;
}

// Interface: PxVec4


physx::PxVec4* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVec4_PxVec4_0() {
  return new physx::PxVec4();
}

physx::PxVec4* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVec4_PxVec4_4(float x, float y, float z, float w) {
  return new physx::PxVec4(x, y, z, w);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVec4_isZero_0(physx::PxVec4* self) {
  return self->isZero();
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVec4_isFinite_0(physx::PxVec4* self) {
  return self->isFinite();
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVec4_isNormalized_0(physx::PxVec4* self) {
  return self->isNormalized();
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVec4_magnitudeSquared_0(physx::PxVec4* self) {
  return self->magnitudeSquared();
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVec4_magnitude_0(physx::PxVec4* self) {
  return self->magnitude();
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVec4_dot_1(physx::PxVec4* self, const physx::PxVec4* v) {
  return self->dot(*v);
}

physx::PxVec4* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVec4_getNormalized_0(physx::PxVec4* self) {
  static thread_local physx::PxVec4 temp;
  return (temp = self->getNormalized(), &temp);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVec4_normalize_0(physx::PxVec4* self) {
  return self->normalize();
}

physx::PxVec4* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVec4_multiply_1(physx::PxVec4* self, const physx::PxVec4* a) {
  static thread_local physx::PxVec4 temp;
  return (temp = self->multiply(*a), &temp);
}

physx::PxVec4* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVec4_minimum_1(physx::PxVec4* self, const physx::PxVec4* v) {
  static thread_local physx::PxVec4 temp;
  return (temp = self->minimum(*v), &temp);
}

physx::PxVec4* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVec4_maximum_1(physx::PxVec4* self, const physx::PxVec4* v) {
  static thread_local physx::PxVec4 temp;
  return (temp = self->maximum(*v), &temp);
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVec4_getXYZ_0(physx::PxVec4* self) {
  static thread_local physx::PxVec3 temp;
  return (temp = self->getXYZ(), &temp);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVec4_get_x_0(physx::PxVec4* self) {
  return self->x;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVec4_set_x_1(physx::PxVec4* self, float arg0) {
  self->x = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVec4_get_y_0(physx::PxVec4* self) {
  return self->y;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVec4_set_y_1(physx::PxVec4* self, float arg0) {
  self->y = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVec4_get_z_0(physx::PxVec4* self) {
  return self->z;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVec4_set_z_1(physx::PxVec4* self, float arg0) {
  self->z = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVec4_get_w_0(physx::PxVec4* self) {
  return self->w;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVec4_set_w_1(physx::PxVec4* self, float arg0) {
  self->w = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVec4___destroy___0(physx::PxVec4* self) {
  delete self;
}

// Interface: PxVehicleAckermannParams


physx::vehicle2::PxVehicleAckermannParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleAckermannParams_PxVehicleAckermannParams_0() {
  return new physx::vehicle2::PxVehicleAckermannParams();
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleAckermannParams_isValid_1(physx::vehicle2::PxVehicleAckermannParams* self, const physx::vehicle2::PxVehicleAxleDescription* axleDesc) {
  return self->isValid(*axleDesc);
}

physx::vehicle2::PxVehicleAckermannParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleAckermannParams_transformAndScale_4(physx::vehicle2::PxVehicleAckermannParams* self, const physx::vehicle2::PxVehicleFrame* srcFrame, const physx::vehicle2::PxVehicleFrame* trgFrame, const physx::vehicle2::PxVehicleScale* srcScale, const physx::vehicle2::PxVehicleScale* trgScale) {
  static thread_local physx::vehicle2::PxVehicleAckermannParams temp;
  return (temp = self->transformAndScale(*srcFrame, *trgFrame, *srcScale, *trgScale), &temp);
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleAckermannParams_get_wheelIds_1(physx::vehicle2::PxVehicleAckermannParams* self, int arg0) {
  return self->wheelIds[arg0];
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleAckermannParams_set_wheelIds_2(physx::vehicle2::PxVehicleAckermannParams* self, int arg0, unsigned int arg1) {
  self->wheelIds[arg0] = arg1;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleAckermannParams_get_wheelBase_0(physx::vehicle2::PxVehicleAckermannParams* self) {
  return self->wheelBase;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleAckermannParams_set_wheelBase_1(physx::vehicle2::PxVehicleAckermannParams* self, float arg0) {
  self->wheelBase = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleAckermannParams_get_trackWidth_0(physx::vehicle2::PxVehicleAckermannParams* self) {
  return self->trackWidth;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleAckermannParams_set_trackWidth_1(physx::vehicle2::PxVehicleAckermannParams* self, float arg0) {
  self->trackWidth = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleAckermannParams_get_strength_0(physx::vehicle2::PxVehicleAckermannParams* self) {
  return self->strength;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleAckermannParams_set_strength_1(physx::vehicle2::PxVehicleAckermannParams* self, float arg0) {
  self->strength = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleAckermannParams___destroy___0(physx::vehicle2::PxVehicleAckermannParams* self) {
  delete self;
}

// Interface: PxVehicleAntiRollForceParams


physx::vehicle2::PxVehicleAntiRollForceParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleAntiRollForceParams_PxVehicleAntiRollForceParams_0() {
  return new physx::vehicle2::PxVehicleAntiRollForceParams();
}

physx::vehicle2::PxVehicleAntiRollForceParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleAntiRollForceParams_transformAndScale_4(physx::vehicle2::PxVehicleAntiRollForceParams* self, const physx::vehicle2::PxVehicleFrame* srcFrame, const physx::vehicle2::PxVehicleFrame* trgFrame, const physx::vehicle2::PxVehicleScale* srcScale, const physx::vehicle2::PxVehicleScale* trgScale) {
  static thread_local physx::vehicle2::PxVehicleAntiRollForceParams temp;
  return (temp = self->transformAndScale(*srcFrame, *trgFrame, *srcScale, *trgScale), &temp);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleAntiRollForceParams_isValid_1(physx::vehicle2::PxVehicleAntiRollForceParams* self, const physx::vehicle2::PxVehicleAxleDescription* axleDesc) {
  return self->isValid(*axleDesc);
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleAntiRollForceParams_get_wheel0_0(physx::vehicle2::PxVehicleAntiRollForceParams* self) {
  return self->wheel0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleAntiRollForceParams_set_wheel0_1(physx::vehicle2::PxVehicleAntiRollForceParams* self, unsigned int arg0) {
  self->wheel0 = arg0;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleAntiRollForceParams_get_wheel1_0(physx::vehicle2::PxVehicleAntiRollForceParams* self) {
  return self->wheel1;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleAntiRollForceParams_set_wheel1_1(physx::vehicle2::PxVehicleAntiRollForceParams* self, unsigned int arg0) {
  self->wheel1 = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleAntiRollForceParams_get_stiffness_0(physx::vehicle2::PxVehicleAntiRollForceParams* self) {
  return self->stiffness;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleAntiRollForceParams_set_stiffness_1(physx::vehicle2::PxVehicleAntiRollForceParams* self, float arg0) {
  self->stiffness = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleAntiRollForceParams___destroy___0(physx::vehicle2::PxVehicleAntiRollForceParams* self) {
  delete self;
}

// Interface: PxVehicleAntiRollTorque


physx::vehicle2::PxVehicleAntiRollTorque* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleAntiRollTorque_PxVehicleAntiRollTorque_0() {
  return new physx::vehicle2::PxVehicleAntiRollTorque();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleAntiRollTorque_setToDefault_0(physx::vehicle2::PxVehicleAntiRollTorque* self) {
  self->setToDefault();
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleAntiRollTorque_get_antiRollTorque_0(physx::vehicle2::PxVehicleAntiRollTorque* self) {
  return &self->antiRollTorque;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleAntiRollTorque_set_antiRollTorque_1(physx::vehicle2::PxVehicleAntiRollTorque* self, physx::PxVec3* arg0) {
  self->antiRollTorque = *arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleAntiRollTorque___destroy___0(physx::vehicle2::PxVehicleAntiRollTorque* self) {
  delete self;
}

// Interface: PxVehicleAutoboxParams


physx::vehicle2::PxVehicleAutoboxParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleAutoboxParams_PxVehicleAutoboxParams_0() {
  return new physx::vehicle2::PxVehicleAutoboxParams();
}

physx::vehicle2::PxVehicleAutoboxParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleAutoboxParams_transformAndScale_4(physx::vehicle2::PxVehicleAutoboxParams* self, const physx::vehicle2::PxVehicleFrame* srcFrame, const physx::vehicle2::PxVehicleFrame* trgFrame, const physx::vehicle2::PxVehicleScale* srcScale, const physx::vehicle2::PxVehicleScale* trgScale) {
  static thread_local physx::vehicle2::PxVehicleAutoboxParams temp;
  return (temp = self->transformAndScale(*srcFrame, *trgFrame, *srcScale, *trgScale), &temp);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleAutoboxParams_isValid_1(physx::vehicle2::PxVehicleAutoboxParams* self, const physx::vehicle2::PxVehicleGearboxParams* gearboxParams) {
  return self->isValid(*gearboxParams);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleAutoboxParams_get_upRatios_1(physx::vehicle2::PxVehicleAutoboxParams* self, int arg0) {
  return self->upRatios[arg0];
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleAutoboxParams_set_upRatios_2(physx::vehicle2::PxVehicleAutoboxParams* self, int arg0, float arg1) {
  self->upRatios[arg0] = arg1;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleAutoboxParams_get_downRatios_1(physx::vehicle2::PxVehicleAutoboxParams* self, int arg0) {
  return self->downRatios[arg0];
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleAutoboxParams_set_downRatios_2(physx::vehicle2::PxVehicleAutoboxParams* self, int arg0, float arg1) {
  self->downRatios[arg0] = arg1;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleAutoboxParams_get_latency_0(physx::vehicle2::PxVehicleAutoboxParams* self) {
  return self->latency;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleAutoboxParams_set_latency_1(physx::vehicle2::PxVehicleAutoboxParams* self, float arg0) {
  self->latency = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleAutoboxParams___destroy___0(physx::vehicle2::PxVehicleAutoboxParams* self) {
  delete self;
}

// Interface: PxVehicleAutoboxState


physx::vehicle2::PxVehicleAutoboxState* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleAutoboxState_PxVehicleAutoboxState_0() {
  return new physx::vehicle2::PxVehicleAutoboxState();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleAutoboxState_setToDefault_0(physx::vehicle2::PxVehicleAutoboxState* self) {
  self->setToDefault();
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleAutoboxState_get_timeSinceLastShift_0(physx::vehicle2::PxVehicleAutoboxState* self) {
  return self->timeSinceLastShift;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleAutoboxState_set_timeSinceLastShift_1(physx::vehicle2::PxVehicleAutoboxState* self, float arg0) {
  self->timeSinceLastShift = arg0;
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleAutoboxState_get_activeAutoboxGearShift_0(physx::vehicle2::PxVehicleAutoboxState* self) {
  return self->activeAutoboxGearShift;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleAutoboxState_set_activeAutoboxGearShift_1(physx::vehicle2::PxVehicleAutoboxState* self, bool arg0) {
  self->activeAutoboxGearShift = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleAutoboxState___destroy___0(physx::vehicle2::PxVehicleAutoboxState* self) {
  delete self;
}

// Interface: PxVehicleAxleDescription


physx::vehicle2::PxVehicleAxleDescription* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleAxleDescription_PxVehicleAxleDescription_0() {
  return new physx::vehicle2::PxVehicleAxleDescription();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleAxleDescription_setToDefault_0(physx::vehicle2::PxVehicleAxleDescription* self) {
  self->setToDefault();
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleAxleDescription_getNbWheelsOnAxle_1(physx::vehicle2::PxVehicleAxleDescription* self, unsigned int i) {
  return self->getNbWheelsOnAxle(i);
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleAxleDescription_getWheelOnAxle_2(physx::vehicle2::PxVehicleAxleDescription* self, unsigned int j, unsigned int i) {
  return self->getWheelOnAxle(j, i);
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleAxleDescription_getAxle_1(physx::vehicle2::PxVehicleAxleDescription* self, unsigned int wheelId) {
  return self->getAxle(wheelId);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleAxleDescription_isValid_0(physx::vehicle2::PxVehicleAxleDescription* self) {
  return self->isValid();
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleAxleDescription_get_nbAxles_0(physx::vehicle2::PxVehicleAxleDescription* self) {
  return self->nbAxles;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleAxleDescription_set_nbAxles_1(physx::vehicle2::PxVehicleAxleDescription* self, unsigned int arg0) {
  self->nbAxles = arg0;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleAxleDescription_get_nbWheelsPerAxle_1(physx::vehicle2::PxVehicleAxleDescription* self, int arg0) {
  return self->nbWheelsPerAxle[arg0];
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleAxleDescription_set_nbWheelsPerAxle_2(physx::vehicle2::PxVehicleAxleDescription* self, int arg0, unsigned int arg1) {
  self->nbWheelsPerAxle[arg0] = arg1;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleAxleDescription_get_axleToWheelIds_1(physx::vehicle2::PxVehicleAxleDescription* self, int arg0) {
  return self->axleToWheelIds[arg0];
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleAxleDescription_set_axleToWheelIds_2(physx::vehicle2::PxVehicleAxleDescription* self, int arg0, unsigned int arg1) {
  self->axleToWheelIds[arg0] = arg1;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleAxleDescription_get_wheelIdsInAxleOrder_1(physx::vehicle2::PxVehicleAxleDescription* self, int arg0) {
  return self->wheelIdsInAxleOrder[arg0];
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleAxleDescription_set_wheelIdsInAxleOrder_2(physx::vehicle2::PxVehicleAxleDescription* self, int arg0, unsigned int arg1) {
  self->wheelIdsInAxleOrder[arg0] = arg1;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleAxleDescription_get_nbWheels_0(physx::vehicle2::PxVehicleAxleDescription* self) {
  return self->nbWheels;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleAxleDescription_set_nbWheels_1(physx::vehicle2::PxVehicleAxleDescription* self, unsigned int arg0) {
  self->nbWheels = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleAxleDescription___destroy___0(physx::vehicle2::PxVehicleAxleDescription* self) {
  delete self;
}

// Interface: PxVehicleBrakeCommandResponseParams


physx::vehicle2::PxVehicleBrakeCommandResponseParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleBrakeCommandResponseParams_PxVehicleBrakeCommandResponseParams_0() {
  return new physx::vehicle2::PxVehicleBrakeCommandResponseParams();
}

physx::vehicle2::PxVehicleBrakeCommandResponseParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleBrakeCommandResponseParams_transformAndScale_4(physx::vehicle2::PxVehicleBrakeCommandResponseParams* self, const physx::vehicle2::PxVehicleFrame* srcFrame, const physx::vehicle2::PxVehicleFrame* trgFrame, const physx::vehicle2::PxVehicleScale* srcScale, const physx::vehicle2::PxVehicleScale* trgScale) {
  static thread_local physx::vehicle2::PxVehicleBrakeCommandResponseParams temp;
  return (temp = self->transformAndScale(*srcFrame, *trgFrame, *srcScale, *trgScale), &temp);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleBrakeCommandResponseParams_isValid_1(physx::vehicle2::PxVehicleBrakeCommandResponseParams* self, const physx::vehicle2::PxVehicleAxleDescription* axleDesc) {
  return self->isValid(*axleDesc);
}

physx::vehicle2::PxVehicleCommandNonLinearResponseParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleBrakeCommandResponseParams_get_nonlinearResponse_0(physx::vehicle2::PxVehicleBrakeCommandResponseParams* self) {
  return &self->nonlinearResponse;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleBrakeCommandResponseParams_set_nonlinearResponse_1(physx::vehicle2::PxVehicleBrakeCommandResponseParams* self, physx::vehicle2::PxVehicleCommandNonLinearResponseParams* arg0) {
  self->nonlinearResponse = *arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleBrakeCommandResponseParams_get_wheelResponseMultipliers_1(physx::vehicle2::PxVehicleBrakeCommandResponseParams* self, int arg0) {
  return self->wheelResponseMultipliers[arg0];
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleBrakeCommandResponseParams_set_wheelResponseMultipliers_2(physx::vehicle2::PxVehicleBrakeCommandResponseParams* self, int arg0, float arg1) {
  self->wheelResponseMultipliers[arg0] = arg1;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleBrakeCommandResponseParams_get_maxResponse_0(physx::vehicle2::PxVehicleBrakeCommandResponseParams* self) {
  return self->maxResponse;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleBrakeCommandResponseParams_set_maxResponse_1(physx::vehicle2::PxVehicleBrakeCommandResponseParams* self, float arg0) {
  self->maxResponse = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleBrakeCommandResponseParams___destroy___0(physx::vehicle2::PxVehicleBrakeCommandResponseParams* self) {
  delete self;
}

// Interface: PxVehicleClutchCommandResponseParams


physx::vehicle2::PxVehicleClutchCommandResponseParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleClutchCommandResponseParams_PxVehicleClutchCommandResponseParams_0() {
  return new physx::vehicle2::PxVehicleClutchCommandResponseParams();
}

physx::vehicle2::PxVehicleClutchCommandResponseParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleClutchCommandResponseParams_transformAndScale_4(physx::vehicle2::PxVehicleClutchCommandResponseParams* self, const physx::vehicle2::PxVehicleFrame* srcFrame, const physx::vehicle2::PxVehicleFrame* trgFrame, const physx::vehicle2::PxVehicleScale* srcScale, const physx::vehicle2::PxVehicleScale* trgScale) {
  static thread_local physx::vehicle2::PxVehicleClutchCommandResponseParams temp;
  return (temp = self->transformAndScale(*srcFrame, *trgFrame, *srcScale, *trgScale), &temp);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleClutchCommandResponseParams_isValid_0(physx::vehicle2::PxVehicleClutchCommandResponseParams* self) {
  return self->isValid();
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleClutchCommandResponseParams_get_maxResponse_0(physx::vehicle2::PxVehicleClutchCommandResponseParams* self) {
  return self->maxResponse;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleClutchCommandResponseParams_set_maxResponse_1(physx::vehicle2::PxVehicleClutchCommandResponseParams* self, float arg0) {
  self->maxResponse = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleClutchCommandResponseParams___destroy___0(physx::vehicle2::PxVehicleClutchCommandResponseParams* self) {
  delete self;
}

// Interface: PxVehicleClutchCommandResponseState


physx::vehicle2::PxVehicleClutchCommandResponseState* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleClutchCommandResponseState_PxVehicleClutchCommandResponseState_0() {
  return new physx::vehicle2::PxVehicleClutchCommandResponseState();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleClutchCommandResponseState_setToDefault_0(physx::vehicle2::PxVehicleClutchCommandResponseState* self) {
  self->setToDefault();
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleClutchCommandResponseState_get_normalisedCommandResponse_0(physx::vehicle2::PxVehicleClutchCommandResponseState* self) {
  return self->normalisedCommandResponse;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleClutchCommandResponseState_set_normalisedCommandResponse_1(physx::vehicle2::PxVehicleClutchCommandResponseState* self, float arg0) {
  self->normalisedCommandResponse = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleClutchCommandResponseState_get_commandResponse_0(physx::vehicle2::PxVehicleClutchCommandResponseState* self) {
  return self->commandResponse;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleClutchCommandResponseState_set_commandResponse_1(physx::vehicle2::PxVehicleClutchCommandResponseState* self, float arg0) {
  self->commandResponse = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleClutchCommandResponseState___destroy___0(physx::vehicle2::PxVehicleClutchCommandResponseState* self) {
  delete self;
}

// Interface: PxVehicleClutchParams


physx::vehicle2::PxVehicleClutchParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleClutchParams_PxVehicleClutchParams_0() {
  return new physx::vehicle2::PxVehicleClutchParams();
}

physx::vehicle2::PxVehicleClutchParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleClutchParams_transformAndScale_4(physx::vehicle2::PxVehicleClutchParams* self, const physx::vehicle2::PxVehicleFrame* srcFrame, const physx::vehicle2::PxVehicleFrame* trgFrame, const physx::vehicle2::PxVehicleScale* srcScale, const physx::vehicle2::PxVehicleScale* trgScale) {
  static thread_local physx::vehicle2::PxVehicleClutchParams temp;
  return (temp = self->transformAndScale(*srcFrame, *trgFrame, *srcScale, *trgScale), &temp);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleClutchParams_isValid_0(physx::vehicle2::PxVehicleClutchParams* self) {
  return self->isValid();
}

PxVehicleClutchAccuracyModeEnum EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleClutchParams_get_accuracyMode_0(physx::vehicle2::PxVehicleClutchParams* self) {
  return self->accuracyMode;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleClutchParams_set_accuracyMode_1(physx::vehicle2::PxVehicleClutchParams* self, PxVehicleClutchAccuracyModeEnum arg0) {
  self->accuracyMode = arg0;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleClutchParams_get_estimateIterations_0(physx::vehicle2::PxVehicleClutchParams* self) {
  return self->estimateIterations;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleClutchParams_set_estimateIterations_1(physx::vehicle2::PxVehicleClutchParams* self, unsigned int arg0) {
  self->estimateIterations = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleClutchParams___destroy___0(physx::vehicle2::PxVehicleClutchParams* self) {
  delete self;
}

// Interface: PxVehicleClutchSlipState


physx::vehicle2::PxVehicleClutchSlipState* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleClutchSlipState_PxVehicleClutchSlipState_0() {
  return new physx::vehicle2::PxVehicleClutchSlipState();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleClutchSlipState_setToDefault_0(physx::vehicle2::PxVehicleClutchSlipState* self) {
  self->setToDefault();
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleClutchSlipState_get_clutchSlip_0(physx::vehicle2::PxVehicleClutchSlipState* self) {
  return self->clutchSlip;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleClutchSlipState_set_clutchSlip_1(physx::vehicle2::PxVehicleClutchSlipState* self, float arg0) {
  self->clutchSlip = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleClutchSlipState___destroy___0(physx::vehicle2::PxVehicleClutchSlipState* self) {
  delete self;
}

// Interface: PxVehicleCommandNonLinearResponseParams


physx::vehicle2::PxVehicleCommandNonLinearResponseParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleCommandNonLinearResponseParams_PxVehicleCommandNonLinearResponseParams_0() {
  return new physx::vehicle2::PxVehicleCommandNonLinearResponseParams();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleCommandNonLinearResponseParams_clear_0(physx::vehicle2::PxVehicleCommandNonLinearResponseParams* self) {
  self->clear();
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleCommandNonLinearResponseParams_addResponse_1(physx::vehicle2::PxVehicleCommandNonLinearResponseParams* self, const physx::vehicle2::PxVehicleCommandValueResponseTable* commandValueSpeedResponses) {
  return self->addResponse(*commandValueSpeedResponses);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleCommandNonLinearResponseParams_get_speedResponses_1(physx::vehicle2::PxVehicleCommandNonLinearResponseParams* self, int arg0) {
  return self->speedResponses[arg0];
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleCommandNonLinearResponseParams_set_speedResponses_2(physx::vehicle2::PxVehicleCommandNonLinearResponseParams* self, int arg0, float arg1) {
  self->speedResponses[arg0] = arg1;
}

short EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleCommandNonLinearResponseParams_get_nbSpeedResponses_0(physx::vehicle2::PxVehicleCommandNonLinearResponseParams* self) {
  return self->nbSpeedResponses;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleCommandNonLinearResponseParams_set_nbSpeedResponses_1(physx::vehicle2::PxVehicleCommandNonLinearResponseParams* self, short arg0) {
  self->nbSpeedResponses = arg0;
}

short EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleCommandNonLinearResponseParams_get_speedResponsesPerCommandValue_1(physx::vehicle2::PxVehicleCommandNonLinearResponseParams* self, int arg0) {
  return self->speedResponsesPerCommandValue[arg0];
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleCommandNonLinearResponseParams_set_speedResponsesPerCommandValue_2(physx::vehicle2::PxVehicleCommandNonLinearResponseParams* self, int arg0, short arg1) {
  self->speedResponsesPerCommandValue[arg0] = arg1;
}

short EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleCommandNonLinearResponseParams_get_nbSpeedResponsesPerCommandValue_1(physx::vehicle2::PxVehicleCommandNonLinearResponseParams* self, int arg0) {
  return self->nbSpeedResponsesPerCommandValue[arg0];
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleCommandNonLinearResponseParams_set_nbSpeedResponsesPerCommandValue_2(physx::vehicle2::PxVehicleCommandNonLinearResponseParams* self, int arg0, short arg1) {
  self->nbSpeedResponsesPerCommandValue[arg0] = arg1;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleCommandNonLinearResponseParams_get_commandValues_1(physx::vehicle2::PxVehicleCommandNonLinearResponseParams* self, int arg0) {
  return self->commandValues[arg0];
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleCommandNonLinearResponseParams_set_commandValues_2(physx::vehicle2::PxVehicleCommandNonLinearResponseParams* self, int arg0, float arg1) {
  self->commandValues[arg0] = arg1;
}

short EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleCommandNonLinearResponseParams_get_nbCommandValues_0(physx::vehicle2::PxVehicleCommandNonLinearResponseParams* self) {
  return self->nbCommandValues;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleCommandNonLinearResponseParams_set_nbCommandValues_1(physx::vehicle2::PxVehicleCommandNonLinearResponseParams* self, short arg0) {
  self->nbCommandValues = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleCommandNonLinearResponseParams___destroy___0(physx::vehicle2::PxVehicleCommandNonLinearResponseParams* self) {
  delete self;
}

// Interface: PxVehicleCommandState


physx::vehicle2::PxVehicleCommandState* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleCommandState_PxVehicleCommandState_0() {
  return new physx::vehicle2::PxVehicleCommandState();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleCommandState_setToDefault_0(physx::vehicle2::PxVehicleCommandState* self) {
  self->setToDefault();
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleCommandState_get_brakes_1(physx::vehicle2::PxVehicleCommandState* self, int arg0) {
  return self->brakes[arg0];
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleCommandState_set_brakes_2(physx::vehicle2::PxVehicleCommandState* self, int arg0, float arg1) {
  self->brakes[arg0] = arg1;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleCommandState_get_nbBrakes_0(physx::vehicle2::PxVehicleCommandState* self) {
  return self->nbBrakes;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleCommandState_set_nbBrakes_1(physx::vehicle2::PxVehicleCommandState* self, unsigned int arg0) {
  self->nbBrakes = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleCommandState_get_throttle_0(physx::vehicle2::PxVehicleCommandState* self) {
  return self->throttle;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleCommandState_set_throttle_1(physx::vehicle2::PxVehicleCommandState* self, float arg0) {
  self->throttle = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleCommandState_get_steer_0(physx::vehicle2::PxVehicleCommandState* self) {
  return self->steer;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleCommandState_set_steer_1(physx::vehicle2::PxVehicleCommandState* self, float arg0) {
  self->steer = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleCommandState___destroy___0(physx::vehicle2::PxVehicleCommandState* self) {
  delete self;
}

// Interface: PxVehicleCommandValueResponseTable


physx::vehicle2::PxVehicleCommandValueResponseTable* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleCommandValueResponseTable_PxVehicleCommandValueResponseTable_0() {
  return new physx::vehicle2::PxVehicleCommandValueResponseTable();
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleCommandValueResponseTable_get_commandValue_0(physx::vehicle2::PxVehicleCommandValueResponseTable* self) {
  return self->commandValue;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleCommandValueResponseTable_set_commandValue_1(physx::vehicle2::PxVehicleCommandValueResponseTable* self, float arg0) {
  self->commandValue = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleCommandValueResponseTable___destroy___0(physx::vehicle2::PxVehicleCommandValueResponseTable* self) {
  delete self;
}

// Interface: PxVehicleComponent


void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleComponent___destroy___0(physx::vehicle2::PxVehicleComponent* self) {
  delete self;
}

// Interface: PxVehicleComponentSequence


physx::vehicle2::PxVehicleComponentSequence* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleComponentSequence_PxVehicleComponentSequence_0() {
  return new physx::vehicle2::PxVehicleComponentSequence();
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleComponentSequence_add_1(physx::vehicle2::PxVehicleComponentSequence* self, physx::vehicle2::PxVehicleComponent* component) {
  return self->add(component);
}

unsigned char EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleComponentSequence_beginSubstepGroup_0(physx::vehicle2::PxVehicleComponentSequence* self) {
  return self->beginSubstepGroup();
}

unsigned char EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleComponentSequence_beginSubstepGroup_1(physx::vehicle2::PxVehicleComponentSequence* self, unsigned char nbSubSteps) {
  return self->beginSubstepGroup(nbSubSteps);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleComponentSequence_endSubstepGroup_0(physx::vehicle2::PxVehicleComponentSequence* self) {
  self->endSubstepGroup();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleComponentSequence_setSubsteps_2(physx::vehicle2::PxVehicleComponentSequence* self, unsigned char subGroupHandle, unsigned char nbSteps) {
  self->setSubsteps(subGroupHandle, nbSteps);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleComponentSequence_update_2(physx::vehicle2::PxVehicleComponentSequence* self, float dt, const physx::vehicle2::PxVehicleSimulationContext* context) {
  self->update(dt, *context);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleComponentSequence___destroy___0(physx::vehicle2::PxVehicleComponentSequence* self) {
  delete self;
}

// Interface: PxVehicleConstraintConnector


physx::vehicle2::PxVehicleConstraintConnector* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleConstraintConnector_PxVehicleConstraintConnector_0() {
  return new physx::vehicle2::PxVehicleConstraintConnector();
}

physx::vehicle2::PxVehicleConstraintConnector* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleConstraintConnector_PxVehicleConstraintConnector_1(physx::vehicle2::PxVehiclePhysXConstraintState* vehicleConstraintState) {
  return new physx::vehicle2::PxVehicleConstraintConnector(vehicleConstraintState);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleConstraintConnector_setConstraintState_1(physx::vehicle2::PxVehicleConstraintConnector* self, physx::vehicle2::PxVehiclePhysXConstraintState* constraintState) {
  self->setConstraintState(constraintState);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleConstraintConnector_getConstantBlock_0(physx::vehicle2::PxVehicleConstraintConnector* self) {
  self->getConstantBlock();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleConstraintConnector_prepareData_0(physx::vehicle2::PxVehicleConstraintConnector* self) {
  self->prepareData();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleConstraintConnector_updateOmniPvdProperties_0(physx::vehicle2::PxVehicleConstraintConnector* self) {
  self->updateOmniPvdProperties();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleConstraintConnector_onConstraintRelease_0(physx::vehicle2::PxVehicleConstraintConnector* self) {
  self->onConstraintRelease();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleConstraintConnector_onComShift_1(physx::vehicle2::PxVehicleConstraintConnector* self, unsigned int actor) {
  self->onComShift(actor);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleConstraintConnector_onOriginShift_1(physx::vehicle2::PxVehicleConstraintConnector* self, const physx::PxVec3* shift) {
  self->onOriginShift(*shift);
}

physx::PxBase* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleConstraintConnector_getSerializable_0(physx::vehicle2::PxVehicleConstraintConnector* self) {
  return self->getSerializable();
}

physx::PxConstraintSolverPrep* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleConstraintConnector_getPrep_0(physx::vehicle2::PxVehicleConstraintConnector* self) {
  static thread_local physx::PxConstraintSolverPrep temp;
  return (temp = self->getPrep(), &temp);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleConstraintConnector_connectToConstraint_1(physx::vehicle2::PxVehicleConstraintConnector* self, physx::PxConstraint* constraint) {
  self->connectToConstraint(constraint);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleConstraintConnector___destroy___0(physx::vehicle2::PxVehicleConstraintConnector* self) {
  delete self;
}

// Interface: PxVehicleDifferentialState


physx::vehicle2::PxVehicleDifferentialState* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleDifferentialState_PxVehicleDifferentialState_0() {
  return new physx::vehicle2::PxVehicleDifferentialState();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleDifferentialState_setToDefault_0(physx::vehicle2::PxVehicleDifferentialState* self) {
  self->setToDefault();
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleDifferentialState_get_connectedWheels_1(physx::vehicle2::PxVehicleDifferentialState* self, int arg0) {
  return self->connectedWheels[arg0];
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleDifferentialState_set_connectedWheels_2(physx::vehicle2::PxVehicleDifferentialState* self, int arg0, unsigned int arg1) {
  self->connectedWheels[arg0] = arg1;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleDifferentialState_get_nbConnectedWheels_0(physx::vehicle2::PxVehicleDifferentialState* self) {
  return self->nbConnectedWheels;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleDifferentialState_set_nbConnectedWheels_1(physx::vehicle2::PxVehicleDifferentialState* self, unsigned int arg0) {
  self->nbConnectedWheels = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleDifferentialState_get_torqueRatiosAllWheels_1(physx::vehicle2::PxVehicleDifferentialState* self, int arg0) {
  return self->torqueRatiosAllWheels[arg0];
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleDifferentialState_set_torqueRatiosAllWheels_2(physx::vehicle2::PxVehicleDifferentialState* self, int arg0, float arg1) {
  self->torqueRatiosAllWheels[arg0] = arg1;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleDifferentialState_get_aveWheelSpeedContributionAllWheels_1(physx::vehicle2::PxVehicleDifferentialState* self, int arg0) {
  return self->aveWheelSpeedContributionAllWheels[arg0];
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleDifferentialState_set_aveWheelSpeedContributionAllWheels_2(physx::vehicle2::PxVehicleDifferentialState* self, int arg0, float arg1) {
  self->aveWheelSpeedContributionAllWheels[arg0] = arg1;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleDifferentialState___destroy___0(physx::vehicle2::PxVehicleDifferentialState* self) {
  delete self;
}

// Interface: PxVehicleDirectDriveThrottleCommandResponseParams


physx::vehicle2::PxVehicleDirectDriveThrottleCommandResponseParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleDirectDriveThrottleCommandResponseParams_PxVehicleDirectDriveThrottleCommandResponseParams_0() {
  return new physx::vehicle2::PxVehicleDirectDriveThrottleCommandResponseParams();
}

physx::vehicle2::PxVehicleDirectDriveThrottleCommandResponseParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleDirectDriveThrottleCommandResponseParams_transformAndScale_4(physx::vehicle2::PxVehicleDirectDriveThrottleCommandResponseParams* self, const physx::vehicle2::PxVehicleFrame* srcFrame, const physx::vehicle2::PxVehicleFrame* trgFrame, const physx::vehicle2::PxVehicleScale* srcScale, const physx::vehicle2::PxVehicleScale* trgScale) {
  static thread_local physx::vehicle2::PxVehicleDirectDriveThrottleCommandResponseParams temp;
  return (temp = self->transformAndScale(*srcFrame, *trgFrame, *srcScale, *trgScale), &temp);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleDirectDriveThrottleCommandResponseParams_isValid_1(physx::vehicle2::PxVehicleDirectDriveThrottleCommandResponseParams* self, const physx::vehicle2::PxVehicleAxleDescription* axleDesc) {
  return self->isValid(*axleDesc);
}

physx::vehicle2::PxVehicleCommandNonLinearResponseParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleDirectDriveThrottleCommandResponseParams_get_nonlinearResponse_0(physx::vehicle2::PxVehicleDirectDriveThrottleCommandResponseParams* self) {
  return &self->nonlinearResponse;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleDirectDriveThrottleCommandResponseParams_set_nonlinearResponse_1(physx::vehicle2::PxVehicleDirectDriveThrottleCommandResponseParams* self, physx::vehicle2::PxVehicleCommandNonLinearResponseParams* arg0) {
  self->nonlinearResponse = *arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleDirectDriveThrottleCommandResponseParams_get_wheelResponseMultipliers_1(physx::vehicle2::PxVehicleDirectDriveThrottleCommandResponseParams* self, int arg0) {
  return self->wheelResponseMultipliers[arg0];
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleDirectDriveThrottleCommandResponseParams_set_wheelResponseMultipliers_2(physx::vehicle2::PxVehicleDirectDriveThrottleCommandResponseParams* self, int arg0, float arg1) {
  self->wheelResponseMultipliers[arg0] = arg1;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleDirectDriveThrottleCommandResponseParams_get_maxResponse_0(physx::vehicle2::PxVehicleDirectDriveThrottleCommandResponseParams* self) {
  return self->maxResponse;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleDirectDriveThrottleCommandResponseParams_set_maxResponse_1(physx::vehicle2::PxVehicleDirectDriveThrottleCommandResponseParams* self, float arg0) {
  self->maxResponse = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleDirectDriveThrottleCommandResponseParams___destroy___0(physx::vehicle2::PxVehicleDirectDriveThrottleCommandResponseParams* self) {
  delete self;
}

// Interface: PxVehicleDirectDriveTransmissionCommandState


physx::vehicle2::PxVehicleDirectDriveTransmissionCommandState* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleDirectDriveTransmissionCommandState_PxVehicleDirectDriveTransmissionCommandState_0() {
  return new physx::vehicle2::PxVehicleDirectDriveTransmissionCommandState();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleDirectDriveTransmissionCommandState_setToDefault_0(physx::vehicle2::PxVehicleDirectDriveTransmissionCommandState* self) {
  self->setToDefault();
}

PxVehicleDirectDriveTransmissionCommandStateEnum EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleDirectDriveTransmissionCommandState_get_gear_0(physx::vehicle2::PxVehicleDirectDriveTransmissionCommandState* self) {
  return self->gear;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleDirectDriveTransmissionCommandState_set_gear_1(physx::vehicle2::PxVehicleDirectDriveTransmissionCommandState* self, PxVehicleDirectDriveTransmissionCommandStateEnum arg0) {
  self->gear = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleDirectDriveTransmissionCommandState___destroy___0(physx::vehicle2::PxVehicleDirectDriveTransmissionCommandState* self) {
  delete self;
}

// Interface: PxVehicleEngineDriveThrottleCommandResponseState


physx::vehicle2::PxVehicleEngineDriveThrottleCommandResponseState* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleEngineDriveThrottleCommandResponseState_PxVehicleEngineDriveThrottleCommandResponseState_0() {
  return new physx::vehicle2::PxVehicleEngineDriveThrottleCommandResponseState();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleEngineDriveThrottleCommandResponseState_setToDefault_0(physx::vehicle2::PxVehicleEngineDriveThrottleCommandResponseState* self) {
  self->setToDefault();
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleEngineDriveThrottleCommandResponseState_get_commandResponse_0(physx::vehicle2::PxVehicleEngineDriveThrottleCommandResponseState* self) {
  return self->commandResponse;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleEngineDriveThrottleCommandResponseState_set_commandResponse_1(physx::vehicle2::PxVehicleEngineDriveThrottleCommandResponseState* self, float arg0) {
  self->commandResponse = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleEngineDriveThrottleCommandResponseState___destroy___0(physx::vehicle2::PxVehicleEngineDriveThrottleCommandResponseState* self) {
  delete self;
}

// Interface: PxVehicleEngineParams


physx::vehicle2::PxVehicleEngineParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleEngineParams_PxVehicleEngineParams_0() {
  return new physx::vehicle2::PxVehicleEngineParams();
}

physx::vehicle2::PxVehicleEngineParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleEngineParams_transformAndScale_4(physx::vehicle2::PxVehicleEngineParams* self, const physx::vehicle2::PxVehicleFrame* srcFrame, const physx::vehicle2::PxVehicleFrame* trgFrame, const physx::vehicle2::PxVehicleScale* srcScale, const physx::vehicle2::PxVehicleScale* trgScale) {
  static thread_local physx::vehicle2::PxVehicleEngineParams temp;
  return (temp = self->transformAndScale(*srcFrame, *trgFrame, *srcScale, *trgScale), &temp);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleEngineParams_isValid_0(physx::vehicle2::PxVehicleEngineParams* self) {
  return self->isValid();
}

PxVehicleTorqueCurveLookupTable* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleEngineParams_get_torqueCurve_0(physx::vehicle2::PxVehicleEngineParams* self) {
  return &self->torqueCurve;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleEngineParams_set_torqueCurve_1(physx::vehicle2::PxVehicleEngineParams* self, PxVehicleTorqueCurveLookupTable* arg0) {
  self->torqueCurve = *arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleEngineParams_get_moi_0(physx::vehicle2::PxVehicleEngineParams* self) {
  return self->moi;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleEngineParams_set_moi_1(physx::vehicle2::PxVehicleEngineParams* self, float arg0) {
  self->moi = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleEngineParams_get_peakTorque_0(physx::vehicle2::PxVehicleEngineParams* self) {
  return self->peakTorque;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleEngineParams_set_peakTorque_1(physx::vehicle2::PxVehicleEngineParams* self, float arg0) {
  self->peakTorque = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleEngineParams_get_idleOmega_0(physx::vehicle2::PxVehicleEngineParams* self) {
  return self->idleOmega;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleEngineParams_set_idleOmega_1(physx::vehicle2::PxVehicleEngineParams* self, float arg0) {
  self->idleOmega = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleEngineParams_get_maxOmega_0(physx::vehicle2::PxVehicleEngineParams* self) {
  return self->maxOmega;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleEngineParams_set_maxOmega_1(physx::vehicle2::PxVehicleEngineParams* self, float arg0) {
  self->maxOmega = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleEngineParams_get_dampingRateFullThrottle_0(physx::vehicle2::PxVehicleEngineParams* self) {
  return self->dampingRateFullThrottle;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleEngineParams_set_dampingRateFullThrottle_1(physx::vehicle2::PxVehicleEngineParams* self, float arg0) {
  self->dampingRateFullThrottle = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleEngineParams_get_dampingRateZeroThrottleClutchEngaged_0(physx::vehicle2::PxVehicleEngineParams* self) {
  return self->dampingRateZeroThrottleClutchEngaged;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleEngineParams_set_dampingRateZeroThrottleClutchEngaged_1(physx::vehicle2::PxVehicleEngineParams* self, float arg0) {
  self->dampingRateZeroThrottleClutchEngaged = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleEngineParams_get_dampingRateZeroThrottleClutchDisengaged_0(physx::vehicle2::PxVehicleEngineParams* self) {
  return self->dampingRateZeroThrottleClutchDisengaged;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleEngineParams_set_dampingRateZeroThrottleClutchDisengaged_1(physx::vehicle2::PxVehicleEngineParams* self, float arg0) {
  self->dampingRateZeroThrottleClutchDisengaged = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleEngineParams___destroy___0(physx::vehicle2::PxVehicleEngineParams* self) {
  delete self;
}

// Interface: PxVehicleEngineState


physx::vehicle2::PxVehicleEngineState* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleEngineState_PxVehicleEngineState_0() {
  return new physx::vehicle2::PxVehicleEngineState();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleEngineState_setToDefault_0(physx::vehicle2::PxVehicleEngineState* self) {
  self->setToDefault();
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleEngineState_get_rotationSpeed_0(physx::vehicle2::PxVehicleEngineState* self) {
  return self->rotationSpeed;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleEngineState_set_rotationSpeed_1(physx::vehicle2::PxVehicleEngineState* self, float arg0) {
  self->rotationSpeed = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleEngineState___destroy___0(physx::vehicle2::PxVehicleEngineState* self) {
  delete self;
}

// Interface: PxVehicleFixedSizeLookupTableFloat_3


PxVehicleFixedSizeLookupTableFloat_3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleFixedSizeLookupTableFloat_3_PxVehicleFixedSizeLookupTableFloat_3_0() {
  return new PxVehicleFixedSizeLookupTableFloat_3();
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleFixedSizeLookupTableFloat_3_addPair_2(PxVehicleFixedSizeLookupTableFloat_3* self, float x, float y) {
  return self->addPair(x, y);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleFixedSizeLookupTableFloat_3_interpolate_1(PxVehicleFixedSizeLookupTableFloat_3* self, float x) {
  return self->interpolate(x);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleFixedSizeLookupTableFloat_3_clear_0(PxVehicleFixedSizeLookupTableFloat_3* self) {
  self->clear();
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleFixedSizeLookupTableFloat_3_isValid_0(PxVehicleFixedSizeLookupTableFloat_3* self) {
  return self->isValid();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleFixedSizeLookupTableFloat_3___destroy___0(PxVehicleFixedSizeLookupTableFloat_3* self) {
  delete self;
}

// Interface: PxVehicleFixedSizeLookupTableVec3_3


PxVehicleFixedSizeLookupTableVec3_3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleFixedSizeLookupTableVec3_3_PxVehicleFixedSizeLookupTableVec3_3_0() {
  return new PxVehicleFixedSizeLookupTableVec3_3();
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleFixedSizeLookupTableVec3_3_addPair_2(PxVehicleFixedSizeLookupTableVec3_3* self, float x, const physx::PxVec3* y) {
  return self->addPair(x, *y);
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleFixedSizeLookupTableVec3_3_interpolate_1(PxVehicleFixedSizeLookupTableVec3_3* self, float x) {
  static thread_local physx::PxVec3 temp;
  return (temp = self->interpolate(x), &temp);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleFixedSizeLookupTableVec3_3_clear_0(PxVehicleFixedSizeLookupTableVec3_3* self) {
  self->clear();
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleFixedSizeLookupTableVec3_3_isValid_0(PxVehicleFixedSizeLookupTableVec3_3* self) {
  return self->isValid();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleFixedSizeLookupTableVec3_3___destroy___0(PxVehicleFixedSizeLookupTableVec3_3* self) {
  delete self;
}

// Interface: PxVehicleFourWheelDriveDifferentialParams


physx::vehicle2::PxVehicleFourWheelDriveDifferentialParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleFourWheelDriveDifferentialParams_PxVehicleFourWheelDriveDifferentialParams_0() {
  return new physx::vehicle2::PxVehicleFourWheelDriveDifferentialParams();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleFourWheelDriveDifferentialParams_setToDefault_0(physx::vehicle2::PxVehicleFourWheelDriveDifferentialParams* self) {
  self->setToDefault();
}

physx::vehicle2::PxVehicleFourWheelDriveDifferentialParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleFourWheelDriveDifferentialParams_transformAndScale_4(physx::vehicle2::PxVehicleFourWheelDriveDifferentialParams* self, const physx::vehicle2::PxVehicleFrame* srcFrame, const physx::vehicle2::PxVehicleFrame* trgFrame, const physx::vehicle2::PxVehicleScale* srcScale, const physx::vehicle2::PxVehicleScale* trgScale) {
  static thread_local physx::vehicle2::PxVehicleFourWheelDriveDifferentialParams temp;
  return (temp = self->transformAndScale(*srcFrame, *trgFrame, *srcScale, *trgScale), &temp);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleFourWheelDriveDifferentialParams_isValid_1(physx::vehicle2::PxVehicleFourWheelDriveDifferentialParams* self, const physx::vehicle2::PxVehicleAxleDescription* axleDesc) {
  return self->isValid(*axleDesc);
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleFourWheelDriveDifferentialParams_get_frontWheelIds_1(physx::vehicle2::PxVehicleFourWheelDriveDifferentialParams* self, int arg0) {
  return self->frontWheelIds[arg0];
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleFourWheelDriveDifferentialParams_set_frontWheelIds_2(physx::vehicle2::PxVehicleFourWheelDriveDifferentialParams* self, int arg0, unsigned int arg1) {
  self->frontWheelIds[arg0] = arg1;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleFourWheelDriveDifferentialParams_get_rearWheelIds_1(physx::vehicle2::PxVehicleFourWheelDriveDifferentialParams* self, int arg0) {
  return self->rearWheelIds[arg0];
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleFourWheelDriveDifferentialParams_set_rearWheelIds_2(physx::vehicle2::PxVehicleFourWheelDriveDifferentialParams* self, int arg0, unsigned int arg1) {
  self->rearWheelIds[arg0] = arg1;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleFourWheelDriveDifferentialParams_get_frontBias_0(physx::vehicle2::PxVehicleFourWheelDriveDifferentialParams* self) {
  return self->frontBias;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleFourWheelDriveDifferentialParams_set_frontBias_1(physx::vehicle2::PxVehicleFourWheelDriveDifferentialParams* self, float arg0) {
  self->frontBias = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleFourWheelDriveDifferentialParams_get_frontTarget_0(physx::vehicle2::PxVehicleFourWheelDriveDifferentialParams* self) {
  return self->frontTarget;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleFourWheelDriveDifferentialParams_set_frontTarget_1(physx::vehicle2::PxVehicleFourWheelDriveDifferentialParams* self, float arg0) {
  self->frontTarget = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleFourWheelDriveDifferentialParams_get_rearBias_0(physx::vehicle2::PxVehicleFourWheelDriveDifferentialParams* self) {
  return self->rearBias;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleFourWheelDriveDifferentialParams_set_rearBias_1(physx::vehicle2::PxVehicleFourWheelDriveDifferentialParams* self, float arg0) {
  self->rearBias = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleFourWheelDriveDifferentialParams_get_rearTarget_0(physx::vehicle2::PxVehicleFourWheelDriveDifferentialParams* self) {
  return self->rearTarget;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleFourWheelDriveDifferentialParams_set_rearTarget_1(physx::vehicle2::PxVehicleFourWheelDriveDifferentialParams* self, float arg0) {
  self->rearTarget = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleFourWheelDriveDifferentialParams_get_centerBias_0(physx::vehicle2::PxVehicleFourWheelDriveDifferentialParams* self) {
  return self->centerBias;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleFourWheelDriveDifferentialParams_set_centerBias_1(physx::vehicle2::PxVehicleFourWheelDriveDifferentialParams* self, float arg0) {
  self->centerBias = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleFourWheelDriveDifferentialParams_get_centerTarget_0(physx::vehicle2::PxVehicleFourWheelDriveDifferentialParams* self) {
  return self->centerTarget;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleFourWheelDriveDifferentialParams_set_centerTarget_1(physx::vehicle2::PxVehicleFourWheelDriveDifferentialParams* self, float arg0) {
  self->centerTarget = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleFourWheelDriveDifferentialParams_get_rate_0(physx::vehicle2::PxVehicleFourWheelDriveDifferentialParams* self) {
  return self->rate;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleFourWheelDriveDifferentialParams_set_rate_1(physx::vehicle2::PxVehicleFourWheelDriveDifferentialParams* self, float arg0) {
  self->rate = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleFourWheelDriveDifferentialParams_get_torqueRatios_1(physx::vehicle2::PxVehicleFourWheelDriveDifferentialParams* self, int arg0) {
  return self->torqueRatios[arg0];
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleFourWheelDriveDifferentialParams_set_torqueRatios_2(physx::vehicle2::PxVehicleFourWheelDriveDifferentialParams* self, int arg0, float arg1) {
  self->torqueRatios[arg0] = arg1;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleFourWheelDriveDifferentialParams_get_aveWheelSpeedRatios_1(physx::vehicle2::PxVehicleFourWheelDriveDifferentialParams* self, int arg0) {
  return self->aveWheelSpeedRatios[arg0];
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleFourWheelDriveDifferentialParams_set_aveWheelSpeedRatios_2(physx::vehicle2::PxVehicleFourWheelDriveDifferentialParams* self, int arg0, float arg1) {
  self->aveWheelSpeedRatios[arg0] = arg1;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleFourWheelDriveDifferentialParams___destroy___0(physx::vehicle2::PxVehicleFourWheelDriveDifferentialParams* self) {
  delete self;
}

// Interface: PxVehicleFrame


physx::vehicle2::PxVehicleFrame* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleFrame_PxVehicleFrame_0() {
  return new physx::vehicle2::PxVehicleFrame();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleFrame_setToDefault_0(physx::vehicle2::PxVehicleFrame* self) {
  self->setToDefault();
}

physx::PxMat33* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleFrame_getFrame_0(physx::vehicle2::PxVehicleFrame* self) {
  static thread_local physx::PxMat33 temp;
  return (temp = self->getFrame(), &temp);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleFrame_isValid_0(physx::vehicle2::PxVehicleFrame* self) {
  return self->isValid();
}

PxVehicleAxesEnum EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleFrame_get_lngAxis_0(physx::vehicle2::PxVehicleFrame* self) {
  return self->lngAxis;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleFrame_set_lngAxis_1(physx::vehicle2::PxVehicleFrame* self, PxVehicleAxesEnum arg0) {
  self->lngAxis = arg0;
}

PxVehicleAxesEnum EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleFrame_get_latAxis_0(physx::vehicle2::PxVehicleFrame* self) {
  return self->latAxis;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleFrame_set_latAxis_1(physx::vehicle2::PxVehicleFrame* self, PxVehicleAxesEnum arg0) {
  self->latAxis = arg0;
}

PxVehicleAxesEnum EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleFrame_get_vrtAxis_0(physx::vehicle2::PxVehicleFrame* self) {
  return self->vrtAxis;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleFrame_set_vrtAxis_1(physx::vehicle2::PxVehicleFrame* self, PxVehicleAxesEnum arg0) {
  self->vrtAxis = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleFrame___destroy___0(physx::vehicle2::PxVehicleFrame* self) {
  delete self;
}

// Interface: PxVehicleGearboxParams


physx::vehicle2::PxVehicleGearboxParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleGearboxParams_PxVehicleGearboxParams_0() {
  return new physx::vehicle2::PxVehicleGearboxParams();
}

physx::vehicle2::PxVehicleGearboxParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleGearboxParams_transformAndScale_4(physx::vehicle2::PxVehicleGearboxParams* self, const physx::vehicle2::PxVehicleFrame* srcFrame, const physx::vehicle2::PxVehicleFrame* trgFrame, const physx::vehicle2::PxVehicleScale* srcScale, const physx::vehicle2::PxVehicleScale* trgScale) {
  static thread_local physx::vehicle2::PxVehicleGearboxParams temp;
  return (temp = self->transformAndScale(*srcFrame, *trgFrame, *srcScale, *trgScale), &temp);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleGearboxParams_isValid_0(physx::vehicle2::PxVehicleGearboxParams* self) {
  return self->isValid();
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleGearboxParams_get_neutralGear_0(physx::vehicle2::PxVehicleGearboxParams* self) {
  return self->neutralGear;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleGearboxParams_set_neutralGear_1(physx::vehicle2::PxVehicleGearboxParams* self, unsigned int arg0) {
  self->neutralGear = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleGearboxParams_get_ratios_1(physx::vehicle2::PxVehicleGearboxParams* self, int arg0) {
  return self->ratios[arg0];
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleGearboxParams_set_ratios_2(physx::vehicle2::PxVehicleGearboxParams* self, int arg0, float arg1) {
  self->ratios[arg0] = arg1;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleGearboxParams_get_finalRatio_0(physx::vehicle2::PxVehicleGearboxParams* self) {
  return self->finalRatio;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleGearboxParams_set_finalRatio_1(physx::vehicle2::PxVehicleGearboxParams* self, float arg0) {
  self->finalRatio = arg0;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleGearboxParams_get_nbRatios_0(physx::vehicle2::PxVehicleGearboxParams* self) {
  return self->nbRatios;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleGearboxParams_set_nbRatios_1(physx::vehicle2::PxVehicleGearboxParams* self, unsigned int arg0) {
  self->nbRatios = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleGearboxParams_get_switchTime_0(physx::vehicle2::PxVehicleGearboxParams* self) {
  return self->switchTime;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleGearboxParams_set_switchTime_1(physx::vehicle2::PxVehicleGearboxParams* self, float arg0) {
  self->switchTime = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleGearboxParams___destroy___0(physx::vehicle2::PxVehicleGearboxParams* self) {
  delete self;
}

// Interface: PxVehicleGearboxState


physx::vehicle2::PxVehicleGearboxState* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleGearboxState_PxVehicleGearboxState_0() {
  return new physx::vehicle2::PxVehicleGearboxState();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleGearboxState_setToDefault_0(physx::vehicle2::PxVehicleGearboxState* self) {
  self->setToDefault();
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleGearboxState_get_currentGear_0(physx::vehicle2::PxVehicleGearboxState* self) {
  return self->currentGear;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleGearboxState_set_currentGear_1(physx::vehicle2::PxVehicleGearboxState* self, unsigned int arg0) {
  self->currentGear = arg0;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleGearboxState_get_targetGear_0(physx::vehicle2::PxVehicleGearboxState* self) {
  return self->targetGear;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleGearboxState_set_targetGear_1(physx::vehicle2::PxVehicleGearboxState* self, unsigned int arg0) {
  self->targetGear = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleGearboxState_get_gearSwitchTime_0(physx::vehicle2::PxVehicleGearboxState* self) {
  return self->gearSwitchTime;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleGearboxState_set_gearSwitchTime_1(physx::vehicle2::PxVehicleGearboxState* self, float arg0) {
  self->gearSwitchTime = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleGearboxState___destroy___0(physx::vehicle2::PxVehicleGearboxState* self) {
  delete self;
}

// Interface: PxVehiclePhysXActor


void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXActor_setToDefault_0(physx::vehicle2::PxVehiclePhysXActor* self) {
  self->setToDefault();
}

physx::PxRigidBody* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXActor_get_rigidBody_0(physx::vehicle2::PxVehiclePhysXActor* self) {
  return self->rigidBody;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXActor_set_rigidBody_1(physx::vehicle2::PxVehiclePhysXActor* self, physx::PxRigidBody* arg0) {
  self->rigidBody = arg0;
}

physx::PxShape* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXActor_get_wheelShapes_1(physx::vehicle2::PxVehiclePhysXActor* self, int arg0) {
  return self->wheelShapes[arg0];
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXActor_set_wheelShapes_2(physx::vehicle2::PxVehiclePhysXActor* self, int arg0, physx::PxShape* arg1) {
  self->wheelShapes[arg0] = arg1;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXActor___destroy___0(physx::vehicle2::PxVehiclePhysXActor* self) {
  delete self;
}

// Interface: PxVehiclePhysXConstraintState


physx::vehicle2::PxVehiclePhysXConstraintState* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXConstraintState_PxVehiclePhysXConstraintState_0() {
  return new physx::vehicle2::PxVehiclePhysXConstraintState();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXConstraintState_setToDefault_0(physx::vehicle2::PxVehiclePhysXConstraintState* self) {
  self->setToDefault();
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXConstraintState_get_tireActiveStatus_1(physx::vehicle2::PxVehiclePhysXConstraintState* self, int arg0) {
  return self->tireActiveStatus[arg0];
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXConstraintState_set_tireActiveStatus_2(physx::vehicle2::PxVehiclePhysXConstraintState* self, int arg0, bool arg1) {
  self->tireActiveStatus[arg0] = arg1;
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXConstraintState_get_tireLinears_1(physx::vehicle2::PxVehiclePhysXConstraintState* self, int arg0) {
  return &self->tireLinears[arg0];
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXConstraintState_set_tireLinears_2(physx::vehicle2::PxVehiclePhysXConstraintState* self, int arg0, physx::PxVec3* arg1) {
  self->tireLinears[arg0] = *arg1;
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXConstraintState_get_tireAngulars_1(physx::vehicle2::PxVehiclePhysXConstraintState* self, int arg0) {
  return &self->tireAngulars[arg0];
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXConstraintState_set_tireAngulars_2(physx::vehicle2::PxVehiclePhysXConstraintState* self, int arg0, physx::PxVec3* arg1) {
  self->tireAngulars[arg0] = *arg1;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXConstraintState_get_tireDamping_1(physx::vehicle2::PxVehiclePhysXConstraintState* self, int arg0) {
  return self->tireDamping[arg0];
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXConstraintState_set_tireDamping_2(physx::vehicle2::PxVehiclePhysXConstraintState* self, int arg0, float arg1) {
  self->tireDamping[arg0] = arg1;
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXConstraintState_get_suspActiveStatus_0(physx::vehicle2::PxVehiclePhysXConstraintState* self) {
  return self->suspActiveStatus;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXConstraintState_set_suspActiveStatus_1(physx::vehicle2::PxVehiclePhysXConstraintState* self, bool arg0) {
  self->suspActiveStatus = arg0;
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXConstraintState_get_suspLinear_0(physx::vehicle2::PxVehiclePhysXConstraintState* self) {
  return &self->suspLinear;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXConstraintState_set_suspLinear_1(physx::vehicle2::PxVehiclePhysXConstraintState* self, physx::PxVec3* arg0) {
  self->suspLinear = *arg0;
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXConstraintState_get_suspAngular_0(physx::vehicle2::PxVehiclePhysXConstraintState* self) {
  return &self->suspAngular;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXConstraintState_set_suspAngular_1(physx::vehicle2::PxVehiclePhysXConstraintState* self, physx::PxVec3* arg0) {
  self->suspAngular = *arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXConstraintState_get_suspGeometricError_0(physx::vehicle2::PxVehiclePhysXConstraintState* self) {
  return self->suspGeometricError;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXConstraintState_set_suspGeometricError_1(physx::vehicle2::PxVehiclePhysXConstraintState* self, float arg0) {
  self->suspGeometricError = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXConstraintState_get_restitution_0(physx::vehicle2::PxVehiclePhysXConstraintState* self) {
  return self->restitution;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXConstraintState_set_restitution_1(physx::vehicle2::PxVehiclePhysXConstraintState* self, float arg0) {
  self->restitution = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXConstraintState___destroy___0(physx::vehicle2::PxVehiclePhysXConstraintState* self) {
  delete self;
}

// Interface: PxVehiclePhysXConstraints


void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXConstraints_setToDefault_0(physx::vehicle2::PxVehiclePhysXConstraints* self) {
  self->setToDefault();
}

physx::vehicle2::PxVehiclePhysXConstraintState* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXConstraints_get_constraintStates_1(physx::vehicle2::PxVehiclePhysXConstraints* self, int arg0) {
  return &self->constraintStates[arg0];
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXConstraints_set_constraintStates_2(physx::vehicle2::PxVehiclePhysXConstraints* self, int arg0, physx::vehicle2::PxVehiclePhysXConstraintState* arg1) {
  self->constraintStates[arg0] = *arg1;
}

physx::PxConstraint* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXConstraints_get_constraints_1(physx::vehicle2::PxVehiclePhysXConstraints* self, int arg0) {
  return self->constraints[arg0];
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXConstraints_set_constraints_2(physx::vehicle2::PxVehiclePhysXConstraints* self, int arg0, physx::PxConstraint* arg1) {
  self->constraints[arg0] = arg1;
}

physx::vehicle2::PxVehicleConstraintConnector* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXConstraints_get_constraintConnectors_1(physx::vehicle2::PxVehiclePhysXConstraints* self, int arg0) {
  return self->constraintConnectors[arg0];
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXConstraints_set_constraintConnectors_2(physx::vehicle2::PxVehiclePhysXConstraints* self, int arg0, physx::vehicle2::PxVehicleConstraintConnector* arg1) {
  self->constraintConnectors[arg0] = arg1;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXConstraints___destroy___0(physx::vehicle2::PxVehiclePhysXConstraints* self) {
  delete self;
}

// Interface: PxVehiclePhysXMaterialFriction


physx::vehicle2::PxVehiclePhysXMaterialFriction* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXMaterialFriction_PxVehiclePhysXMaterialFriction_0() {
  return new physx::vehicle2::PxVehiclePhysXMaterialFriction();
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXMaterialFriction_isValid_0(physx::vehicle2::PxVehiclePhysXMaterialFriction* self) {
  return self->isValid();
}

const physx::PxMaterial* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXMaterialFriction_get_material_0(physx::vehicle2::PxVehiclePhysXMaterialFriction* self) {
  return self->material;
}

const void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXMaterialFriction_set_material_1(physx::vehicle2::PxVehiclePhysXMaterialFriction* self, physx::PxMaterial* arg0) {
  self->material = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXMaterialFriction_get_friction_0(physx::vehicle2::PxVehiclePhysXMaterialFriction* self) {
  return self->friction;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXMaterialFriction_set_friction_1(physx::vehicle2::PxVehiclePhysXMaterialFriction* self, float arg0) {
  self->friction = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXMaterialFriction___destroy___0(physx::vehicle2::PxVehiclePhysXMaterialFriction* self) {
  delete self;
}

// Interface: PxVehiclePhysXMaterialFrictionParams


bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXMaterialFrictionParams_isValid_0(physx::vehicle2::PxVehiclePhysXMaterialFrictionParams* self) {
  return self->isValid();
}

physx::vehicle2::PxVehiclePhysXMaterialFriction* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXMaterialFrictionParams_get_materialFrictions_0(physx::vehicle2::PxVehiclePhysXMaterialFrictionParams* self) {
  return self->materialFrictions;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXMaterialFrictionParams_set_materialFrictions_1(physx::vehicle2::PxVehiclePhysXMaterialFrictionParams* self, physx::vehicle2::PxVehiclePhysXMaterialFriction* arg0) {
  self->materialFrictions = arg0;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXMaterialFrictionParams_get_nbMaterialFrictions_0(physx::vehicle2::PxVehiclePhysXMaterialFrictionParams* self) {
  return self->nbMaterialFrictions;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXMaterialFrictionParams_set_nbMaterialFrictions_1(physx::vehicle2::PxVehiclePhysXMaterialFrictionParams* self, unsigned int arg0) {
  self->nbMaterialFrictions = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXMaterialFrictionParams_get_defaultFriction_0(physx::vehicle2::PxVehiclePhysXMaterialFrictionParams* self) {
  return self->defaultFriction;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXMaterialFrictionParams_set_defaultFriction_1(physx::vehicle2::PxVehiclePhysXMaterialFrictionParams* self, float arg0) {
  self->defaultFriction = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXMaterialFrictionParams___destroy___0(physx::vehicle2::PxVehiclePhysXMaterialFrictionParams* self) {
  delete self;
}

// Interface: PxVehiclePhysXRoadGeometryQueryParams


physx::vehicle2::PxVehiclePhysXRoadGeometryQueryParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXRoadGeometryQueryParams_transformAndScale_4(physx::vehicle2::PxVehiclePhysXRoadGeometryQueryParams* self, const physx::vehicle2::PxVehicleFrame* srcFrame, const physx::vehicle2::PxVehicleFrame* trgFrame, const physx::vehicle2::PxVehicleScale* srcScale, const physx::vehicle2::PxVehicleScale* trgScale) {
  static thread_local physx::vehicle2::PxVehiclePhysXRoadGeometryQueryParams temp;
  return (temp = self->transformAndScale(*srcFrame, *trgFrame, *srcScale, *trgScale), &temp);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXRoadGeometryQueryParams_isValid_0(physx::vehicle2::PxVehiclePhysXRoadGeometryQueryParams* self) {
  return self->isValid();
}

PxVehiclePhysXRoadGeometryQueryTypeEnum EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXRoadGeometryQueryParams_get_roadGeometryQueryType_0(physx::vehicle2::PxVehiclePhysXRoadGeometryQueryParams* self) {
  return self->roadGeometryQueryType;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXRoadGeometryQueryParams_set_roadGeometryQueryType_1(physx::vehicle2::PxVehiclePhysXRoadGeometryQueryParams* self, PxVehiclePhysXRoadGeometryQueryTypeEnum arg0) {
  self->roadGeometryQueryType = arg0;
}

physx::PxQueryFilterData* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXRoadGeometryQueryParams_get_defaultFilterData_0(physx::vehicle2::PxVehiclePhysXRoadGeometryQueryParams* self) {
  return &self->defaultFilterData;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXRoadGeometryQueryParams_set_defaultFilterData_1(physx::vehicle2::PxVehiclePhysXRoadGeometryQueryParams* self, physx::PxQueryFilterData* arg0) {
  self->defaultFilterData = *arg0;
}

physx::PxQueryFilterData* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXRoadGeometryQueryParams_get_filterDataEntries_0(physx::vehicle2::PxVehiclePhysXRoadGeometryQueryParams* self) {
  return self->filterDataEntries;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXRoadGeometryQueryParams_set_filterDataEntries_1(physx::vehicle2::PxVehiclePhysXRoadGeometryQueryParams* self, physx::PxQueryFilterData* arg0) {
  self->filterDataEntries = arg0;
}

physx::PxQueryFilterCallback* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXRoadGeometryQueryParams_get_filterCallback_0(physx::vehicle2::PxVehiclePhysXRoadGeometryQueryParams* self) {
  return self->filterCallback;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXRoadGeometryQueryParams_set_filterCallback_1(physx::vehicle2::PxVehiclePhysXRoadGeometryQueryParams* self, physx::PxQueryFilterCallback* arg0) {
  self->filterCallback = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXRoadGeometryQueryParams___destroy___0(physx::vehicle2::PxVehiclePhysXRoadGeometryQueryParams* self) {
  delete self;
}

// Interface: PxVehiclePhysXSimulationContext


physx::vehicle2::PxVehiclePhysXSimulationContext* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXSimulationContext_PxVehiclePhysXSimulationContext_0() {
  return new physx::vehicle2::PxVehiclePhysXSimulationContext();
}

physx::vehicle2::PxVehiclePhysXSimulationContext* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXSimulationContext_transformAndScale_4(physx::vehicle2::PxVehiclePhysXSimulationContext* self, const physx::vehicle2::PxVehicleFrame* srcFrame, const physx::vehicle2::PxVehicleFrame* trgFrame, const physx::vehicle2::PxVehicleScale* srcScale, const physx::vehicle2::PxVehicleScale* trgScale) {
  static thread_local physx::vehicle2::PxVehiclePhysXSimulationContext temp;
  return (temp = self->transformAndScale(*srcFrame, *trgFrame, *srcScale, *trgScale), &temp);
}

PxVehicleSimulationContextTypeEnum EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXSimulationContext_getType_0(physx::vehicle2::PxVehiclePhysXSimulationContext* self) {
  return self->getType();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXSimulationContext_setToDefault_0(physx::vehicle2::PxVehiclePhysXSimulationContext* self) {
  self->setToDefault();
}

const physx::PxConvexMesh* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXSimulationContext_get_physxUnitCylinderSweepMesh_0(physx::vehicle2::PxVehiclePhysXSimulationContext* self) {
  return self->physxUnitCylinderSweepMesh;
}

const void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXSimulationContext_set_physxUnitCylinderSweepMesh_1(physx::vehicle2::PxVehiclePhysXSimulationContext* self, physx::PxConvexMesh* arg0) {
  self->physxUnitCylinderSweepMesh = arg0;
}

const physx::PxScene* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXSimulationContext_get_physxScene_0(physx::vehicle2::PxVehiclePhysXSimulationContext* self) {
  return self->physxScene;
}

const void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXSimulationContext_set_physxScene_1(physx::vehicle2::PxVehiclePhysXSimulationContext* self, physx::PxScene* arg0) {
  self->physxScene = arg0;
}

PxVehiclePhysXActorUpdateModeEnum EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXSimulationContext_get_physxActorUpdateMode_0(physx::vehicle2::PxVehiclePhysXSimulationContext* self) {
  return self->physxActorUpdateMode;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXSimulationContext_set_physxActorUpdateMode_1(physx::vehicle2::PxVehiclePhysXSimulationContext* self, PxVehiclePhysXActorUpdateModeEnum arg0) {
  self->physxActorUpdateMode = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXSimulationContext_get_physxActorWakeCounterResetValue_0(physx::vehicle2::PxVehiclePhysXSimulationContext* self) {
  return self->physxActorWakeCounterResetValue;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXSimulationContext_set_physxActorWakeCounterResetValue_1(physx::vehicle2::PxVehiclePhysXSimulationContext* self, float arg0) {
  self->physxActorWakeCounterResetValue = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXSimulationContext_get_physxActorWakeCounterThreshold_0(physx::vehicle2::PxVehiclePhysXSimulationContext* self) {
  return self->physxActorWakeCounterThreshold;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXSimulationContext_set_physxActorWakeCounterThreshold_1(physx::vehicle2::PxVehiclePhysXSimulationContext* self, float arg0) {
  self->physxActorWakeCounterThreshold = arg0;
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXSimulationContext_get_gravity_0(physx::vehicle2::PxVehiclePhysXSimulationContext* self) {
  return &self->gravity;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXSimulationContext_set_gravity_1(physx::vehicle2::PxVehiclePhysXSimulationContext* self, physx::PxVec3* arg0) {
  self->gravity = *arg0;
}

physx::vehicle2::PxVehicleFrame* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXSimulationContext_get_frame_0(physx::vehicle2::PxVehiclePhysXSimulationContext* self) {
  return &self->frame;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXSimulationContext_set_frame_1(physx::vehicle2::PxVehiclePhysXSimulationContext* self, physx::vehicle2::PxVehicleFrame* arg0) {
  self->frame = *arg0;
}

physx::vehicle2::PxVehicleScale* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXSimulationContext_get_scale_0(physx::vehicle2::PxVehiclePhysXSimulationContext* self) {
  return &self->scale;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXSimulationContext_set_scale_1(physx::vehicle2::PxVehiclePhysXSimulationContext* self, physx::vehicle2::PxVehicleScale* arg0) {
  self->scale = *arg0;
}

physx::vehicle2::PxVehicleTireSlipParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXSimulationContext_get_tireSlipParams_0(physx::vehicle2::PxVehiclePhysXSimulationContext* self) {
  return &self->tireSlipParams;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXSimulationContext_set_tireSlipParams_1(physx::vehicle2::PxVehiclePhysXSimulationContext* self, physx::vehicle2::PxVehicleTireSlipParams* arg0) {
  self->tireSlipParams = *arg0;
}

physx::vehicle2::PxVehicleTireStickyParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXSimulationContext_get_tireStickyParams_0(physx::vehicle2::PxVehiclePhysXSimulationContext* self) {
  return &self->tireStickyParams;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXSimulationContext_set_tireStickyParams_1(physx::vehicle2::PxVehiclePhysXSimulationContext* self, physx::vehicle2::PxVehicleTireStickyParams* arg0) {
  self->tireStickyParams = *arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXSimulationContext_get_thresholdForwardSpeedForWheelAngleIntegration_0(physx::vehicle2::PxVehiclePhysXSimulationContext* self) {
  return self->thresholdForwardSpeedForWheelAngleIntegration;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXSimulationContext_set_thresholdForwardSpeedForWheelAngleIntegration_1(physx::vehicle2::PxVehiclePhysXSimulationContext* self, float arg0) {
  self->thresholdForwardSpeedForWheelAngleIntegration = arg0;
}

physx::vehicle2::PxVehiclePvdContext* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXSimulationContext_get_pvdContext_0(physx::vehicle2::PxVehiclePhysXSimulationContext* self) {
  return &self->pvdContext;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXSimulationContext_set_pvdContext_1(physx::vehicle2::PxVehiclePhysXSimulationContext* self, physx::vehicle2::PxVehiclePvdContext* arg0) {
  self->pvdContext = *arg0;
}

// Interface: PxVehiclePhysXSteerState


void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXSteerState_setToDefault_0(physx::vehicle2::PxVehiclePhysXSteerState* self) {
  self->setToDefault();
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXSteerState_get_previousSteerCommand_0(physx::vehicle2::PxVehiclePhysXSteerState* self) {
  return self->previousSteerCommand;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXSteerState_set_previousSteerCommand_1(physx::vehicle2::PxVehiclePhysXSteerState* self, float arg0) {
  self->previousSteerCommand = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXSteerState___destroy___0(physx::vehicle2::PxVehiclePhysXSteerState* self) {
  delete self;
}

// Interface: PxVehiclePhysXSuspensionLimitConstraintParams


physx::vehicle2::PxVehiclePhysXSuspensionLimitConstraintParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXSuspensionLimitConstraintParams_transformAndScale_4(physx::vehicle2::PxVehiclePhysXSuspensionLimitConstraintParams* self, const physx::vehicle2::PxVehicleFrame* srcFrame, const physx::vehicle2::PxVehicleFrame* trgFrame, const physx::vehicle2::PxVehicleScale* srcScale, const physx::vehicle2::PxVehicleScale* trgScale) {
  static thread_local physx::vehicle2::PxVehiclePhysXSuspensionLimitConstraintParams temp;
  return (temp = self->transformAndScale(*srcFrame, *trgFrame, *srcScale, *trgScale), &temp);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXSuspensionLimitConstraintParams_isValid_0(physx::vehicle2::PxVehiclePhysXSuspensionLimitConstraintParams* self) {
  return self->isValid();
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXSuspensionLimitConstraintParams_get_restitution_0(physx::vehicle2::PxVehiclePhysXSuspensionLimitConstraintParams* self) {
  return self->restitution;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXSuspensionLimitConstraintParams_set_restitution_1(physx::vehicle2::PxVehiclePhysXSuspensionLimitConstraintParams* self, float arg0) {
  self->restitution = arg0;
}

PxVehiclePhysXSuspensionLimitConstraintParamsDirectionSpecifierEnum EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXSuspensionLimitConstraintParams_get_directionForSuspensionLimitConstraint_0(physx::vehicle2::PxVehiclePhysXSuspensionLimitConstraintParams* self) {
  return self->directionForSuspensionLimitConstraint;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXSuspensionLimitConstraintParams_set_directionForSuspensionLimitConstraint_1(physx::vehicle2::PxVehiclePhysXSuspensionLimitConstraintParams* self, PxVehiclePhysXSuspensionLimitConstraintParamsDirectionSpecifierEnum arg0) {
  self->directionForSuspensionLimitConstraint = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehiclePhysXSuspensionLimitConstraintParams___destroy___0(physx::vehicle2::PxVehiclePhysXSuspensionLimitConstraintParams* self) {
  delete self;
}

// Interface: PxVehiclePvdContext


// Interface: PxVehicleRigidBodyParams


physx::vehicle2::PxVehicleRigidBodyParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleRigidBodyParams_PxVehicleRigidBodyParams_0() {
  return new physx::vehicle2::PxVehicleRigidBodyParams();
}

physx::vehicle2::PxVehicleRigidBodyParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleRigidBodyParams_transformAndScale_4(physx::vehicle2::PxVehicleRigidBodyParams* self, const physx::vehicle2::PxVehicleFrame* srcFrame, const physx::vehicle2::PxVehicleFrame* trgFrame, const physx::vehicle2::PxVehicleScale* srcScale, const physx::vehicle2::PxVehicleScale* trgScale) {
  static thread_local physx::vehicle2::PxVehicleRigidBodyParams temp;
  return (temp = self->transformAndScale(*srcFrame, *trgFrame, *srcScale, *trgScale), &temp);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleRigidBodyParams_isValid_0(physx::vehicle2::PxVehicleRigidBodyParams* self) {
  return self->isValid();
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleRigidBodyParams_get_mass_0(physx::vehicle2::PxVehicleRigidBodyParams* self) {
  return self->mass;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleRigidBodyParams_set_mass_1(physx::vehicle2::PxVehicleRigidBodyParams* self, float arg0) {
  self->mass = arg0;
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleRigidBodyParams_get_moi_0(physx::vehicle2::PxVehicleRigidBodyParams* self) {
  return &self->moi;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleRigidBodyParams_set_moi_1(physx::vehicle2::PxVehicleRigidBodyParams* self, physx::PxVec3* arg0) {
  self->moi = *arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleRigidBodyParams___destroy___0(physx::vehicle2::PxVehicleRigidBodyParams* self) {
  delete self;
}

// Interface: PxVehicleRigidBodyState


physx::vehicle2::PxVehicleRigidBodyState* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleRigidBodyState_PxVehicleRigidBodyState_0() {
  return new physx::vehicle2::PxVehicleRigidBodyState();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleRigidBodyState_setToDefault_0(physx::vehicle2::PxVehicleRigidBodyState* self) {
  self->setToDefault();
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleRigidBodyState_getVerticalSpeed_1(physx::vehicle2::PxVehicleRigidBodyState* self, const physx::vehicle2::PxVehicleFrame* frame) {
  return self->getVerticalSpeed(*frame);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleRigidBodyState_getLateralSpeed_1(physx::vehicle2::PxVehicleRigidBodyState* self, const physx::vehicle2::PxVehicleFrame* frame) {
  return self->getLateralSpeed(*frame);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleRigidBodyState_getLongitudinalSpeed_1(physx::vehicle2::PxVehicleRigidBodyState* self, const physx::vehicle2::PxVehicleFrame* frame) {
  return self->getLongitudinalSpeed(*frame);
}

physx::PxTransform* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleRigidBodyState_get_pose_0(physx::vehicle2::PxVehicleRigidBodyState* self) {
  return &self->pose;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleRigidBodyState_set_pose_1(physx::vehicle2::PxVehicleRigidBodyState* self, physx::PxTransform* arg0) {
  self->pose = *arg0;
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleRigidBodyState_get_linearVelocity_0(physx::vehicle2::PxVehicleRigidBodyState* self) {
  return &self->linearVelocity;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleRigidBodyState_set_linearVelocity_1(physx::vehicle2::PxVehicleRigidBodyState* self, physx::PxVec3* arg0) {
  self->linearVelocity = *arg0;
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleRigidBodyState_get_angularVelocity_0(physx::vehicle2::PxVehicleRigidBodyState* self) {
  return &self->angularVelocity;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleRigidBodyState_set_angularVelocity_1(physx::vehicle2::PxVehicleRigidBodyState* self, physx::PxVec3* arg0) {
  self->angularVelocity = *arg0;
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleRigidBodyState_get_previousLinearVelocity_0(physx::vehicle2::PxVehicleRigidBodyState* self) {
  return &self->previousLinearVelocity;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleRigidBodyState_set_previousLinearVelocity_1(physx::vehicle2::PxVehicleRigidBodyState* self, physx::PxVec3* arg0) {
  self->previousLinearVelocity = *arg0;
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleRigidBodyState_get_previousAngularVelocity_0(physx::vehicle2::PxVehicleRigidBodyState* self) {
  return &self->previousAngularVelocity;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleRigidBodyState_set_previousAngularVelocity_1(physx::vehicle2::PxVehicleRigidBodyState* self, physx::PxVec3* arg0) {
  self->previousAngularVelocity = *arg0;
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleRigidBodyState_get_externalForce_0(physx::vehicle2::PxVehicleRigidBodyState* self) {
  return &self->externalForce;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleRigidBodyState_set_externalForce_1(physx::vehicle2::PxVehicleRigidBodyState* self, physx::PxVec3* arg0) {
  self->externalForce = *arg0;
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleRigidBodyState_get_externalTorque_0(physx::vehicle2::PxVehicleRigidBodyState* self) {
  return &self->externalTorque;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleRigidBodyState_set_externalTorque_1(physx::vehicle2::PxVehicleRigidBodyState* self, physx::PxVec3* arg0) {
  self->externalTorque = *arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleRigidBodyState___destroy___0(physx::vehicle2::PxVehicleRigidBodyState* self) {
  delete self;
}

// Interface: PxVehicleRoadGeometryState


physx::vehicle2::PxVehicleRoadGeometryState* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleRoadGeometryState_PxVehicleRoadGeometryState_0() {
  return new physx::vehicle2::PxVehicleRoadGeometryState();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleRoadGeometryState_setToDefault_0(physx::vehicle2::PxVehicleRoadGeometryState* self) {
  self->setToDefault();
}

physx::PxPlane* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleRoadGeometryState_get_plane_0(physx::vehicle2::PxVehicleRoadGeometryState* self) {
  return &self->plane;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleRoadGeometryState_set_plane_1(physx::vehicle2::PxVehicleRoadGeometryState* self, physx::PxPlane* arg0) {
  self->plane = *arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleRoadGeometryState_get_friction_0(physx::vehicle2::PxVehicleRoadGeometryState* self) {
  return self->friction;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleRoadGeometryState_set_friction_1(physx::vehicle2::PxVehicleRoadGeometryState* self, float arg0) {
  self->friction = arg0;
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleRoadGeometryState_get_velocity_0(physx::vehicle2::PxVehicleRoadGeometryState* self) {
  return &self->velocity;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleRoadGeometryState_set_velocity_1(physx::vehicle2::PxVehicleRoadGeometryState* self, physx::PxVec3* arg0) {
  self->velocity = *arg0;
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleRoadGeometryState_get_hitState_0(physx::vehicle2::PxVehicleRoadGeometryState* self) {
  return self->hitState;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleRoadGeometryState_set_hitState_1(physx::vehicle2::PxVehicleRoadGeometryState* self, bool arg0) {
  self->hitState = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleRoadGeometryState___destroy___0(physx::vehicle2::PxVehicleRoadGeometryState* self) {
  delete self;
}

// Interface: PxVehicleScale


physx::vehicle2::PxVehicleScale* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleScale_PxVehicleScale_0() {
  return new physx::vehicle2::PxVehicleScale();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleScale_setToDefault_0(physx::vehicle2::PxVehicleScale* self) {
  self->setToDefault();
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleScale_isValid_0(physx::vehicle2::PxVehicleScale* self) {
  return self->isValid();
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleScale_get_scale_0(physx::vehicle2::PxVehicleScale* self) {
  return self->scale;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleScale_set_scale_1(physx::vehicle2::PxVehicleScale* self, float arg0) {
  self->scale = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleScale___destroy___0(physx::vehicle2::PxVehicleScale* self) {
  delete self;
}

// Interface: PxVehicleSteerCommandResponseParams


physx::vehicle2::PxVehicleSteerCommandResponseParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSteerCommandResponseParams_PxVehicleSteerCommandResponseParams_0() {
  return new physx::vehicle2::PxVehicleSteerCommandResponseParams();
}

physx::vehicle2::PxVehicleSteerCommandResponseParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSteerCommandResponseParams_transformAndScale_4(physx::vehicle2::PxVehicleSteerCommandResponseParams* self, const physx::vehicle2::PxVehicleFrame* srcFrame, const physx::vehicle2::PxVehicleFrame* trgFrame, const physx::vehicle2::PxVehicleScale* srcScale, const physx::vehicle2::PxVehicleScale* trgScale) {
  static thread_local physx::vehicle2::PxVehicleSteerCommandResponseParams temp;
  return (temp = self->transformAndScale(*srcFrame, *trgFrame, *srcScale, *trgScale), &temp);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSteerCommandResponseParams_isValid_1(physx::vehicle2::PxVehicleSteerCommandResponseParams* self, const physx::vehicle2::PxVehicleAxleDescription* axleDesc) {
  return self->isValid(*axleDesc);
}

physx::vehicle2::PxVehicleCommandNonLinearResponseParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSteerCommandResponseParams_get_nonlinearResponse_0(physx::vehicle2::PxVehicleSteerCommandResponseParams* self) {
  return &self->nonlinearResponse;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSteerCommandResponseParams_set_nonlinearResponse_1(physx::vehicle2::PxVehicleSteerCommandResponseParams* self, physx::vehicle2::PxVehicleCommandNonLinearResponseParams* arg0) {
  self->nonlinearResponse = *arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSteerCommandResponseParams_get_wheelResponseMultipliers_1(physx::vehicle2::PxVehicleSteerCommandResponseParams* self, int arg0) {
  return self->wheelResponseMultipliers[arg0];
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSteerCommandResponseParams_set_wheelResponseMultipliers_2(physx::vehicle2::PxVehicleSteerCommandResponseParams* self, int arg0, float arg1) {
  self->wheelResponseMultipliers[arg0] = arg1;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSteerCommandResponseParams_get_maxResponse_0(physx::vehicle2::PxVehicleSteerCommandResponseParams* self) {
  return self->maxResponse;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSteerCommandResponseParams_set_maxResponse_1(physx::vehicle2::PxVehicleSteerCommandResponseParams* self, float arg0) {
  self->maxResponse = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSteerCommandResponseParams___destroy___0(physx::vehicle2::PxVehicleSteerCommandResponseParams* self) {
  delete self;
}

// Interface: PxVehicleSuspensionComplianceParams


physx::vehicle2::PxVehicleSuspensionComplianceParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSuspensionComplianceParams_PxVehicleSuspensionComplianceParams_0() {
  return new physx::vehicle2::PxVehicleSuspensionComplianceParams();
}

physx::vehicle2::PxVehicleSuspensionComplianceParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSuspensionComplianceParams_transformAndScale_4(physx::vehicle2::PxVehicleSuspensionComplianceParams* self, const physx::vehicle2::PxVehicleFrame* srcFrame, const physx::vehicle2::PxVehicleFrame* trgFrame, const physx::vehicle2::PxVehicleScale* srcScale, const physx::vehicle2::PxVehicleScale* trgScale) {
  static thread_local physx::vehicle2::PxVehicleSuspensionComplianceParams temp;
  return (temp = self->transformAndScale(*srcFrame, *trgFrame, *srcScale, *trgScale), &temp);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSuspensionComplianceParams_isValid_0(physx::vehicle2::PxVehicleSuspensionComplianceParams* self) {
  return self->isValid();
}

PxVehicleFixedSizeLookupTableFloat_3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSuspensionComplianceParams_get_wheelToeAngle_0(physx::vehicle2::PxVehicleSuspensionComplianceParams* self) {
  return &self->wheelToeAngle;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSuspensionComplianceParams_set_wheelToeAngle_1(physx::vehicle2::PxVehicleSuspensionComplianceParams* self, PxVehicleFixedSizeLookupTableFloat_3* arg0) {
  self->wheelToeAngle = *arg0;
}

PxVehicleFixedSizeLookupTableFloat_3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSuspensionComplianceParams_get_wheelCamberAngle_0(physx::vehicle2::PxVehicleSuspensionComplianceParams* self) {
  return &self->wheelCamberAngle;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSuspensionComplianceParams_set_wheelCamberAngle_1(physx::vehicle2::PxVehicleSuspensionComplianceParams* self, PxVehicleFixedSizeLookupTableFloat_3* arg0) {
  self->wheelCamberAngle = *arg0;
}

PxVehicleFixedSizeLookupTableVec3_3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSuspensionComplianceParams_get_suspForceAppPoint_0(physx::vehicle2::PxVehicleSuspensionComplianceParams* self) {
  return &self->suspForceAppPoint;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSuspensionComplianceParams_set_suspForceAppPoint_1(physx::vehicle2::PxVehicleSuspensionComplianceParams* self, PxVehicleFixedSizeLookupTableVec3_3* arg0) {
  self->suspForceAppPoint = *arg0;
}

PxVehicleFixedSizeLookupTableVec3_3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSuspensionComplianceParams_get_tireForceAppPoint_0(physx::vehicle2::PxVehicleSuspensionComplianceParams* self) {
  return &self->tireForceAppPoint;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSuspensionComplianceParams_set_tireForceAppPoint_1(physx::vehicle2::PxVehicleSuspensionComplianceParams* self, PxVehicleFixedSizeLookupTableVec3_3* arg0) {
  self->tireForceAppPoint = *arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSuspensionComplianceParams___destroy___0(physx::vehicle2::PxVehicleSuspensionComplianceParams* self) {
  delete self;
}

// Interface: PxVehicleSuspensionComplianceState


physx::vehicle2::PxVehicleSuspensionComplianceState* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSuspensionComplianceState_PxVehicleSuspensionComplianceState_0() {
  return new physx::vehicle2::PxVehicleSuspensionComplianceState();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSuspensionComplianceState_setToDefault_0(physx::vehicle2::PxVehicleSuspensionComplianceState* self) {
  self->setToDefault();
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSuspensionComplianceState_get_toe_0(physx::vehicle2::PxVehicleSuspensionComplianceState* self) {
  return self->toe;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSuspensionComplianceState_set_toe_1(physx::vehicle2::PxVehicleSuspensionComplianceState* self, float arg0) {
  self->toe = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSuspensionComplianceState_get_camber_0(physx::vehicle2::PxVehicleSuspensionComplianceState* self) {
  return self->camber;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSuspensionComplianceState_set_camber_1(physx::vehicle2::PxVehicleSuspensionComplianceState* self, float arg0) {
  self->camber = arg0;
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSuspensionComplianceState_get_tireForceAppPoint_0(physx::vehicle2::PxVehicleSuspensionComplianceState* self) {
  return &self->tireForceAppPoint;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSuspensionComplianceState_set_tireForceAppPoint_1(physx::vehicle2::PxVehicleSuspensionComplianceState* self, physx::PxVec3* arg0) {
  self->tireForceAppPoint = *arg0;
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSuspensionComplianceState_get_suspForceAppPoint_0(physx::vehicle2::PxVehicleSuspensionComplianceState* self) {
  return &self->suspForceAppPoint;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSuspensionComplianceState_set_suspForceAppPoint_1(physx::vehicle2::PxVehicleSuspensionComplianceState* self, physx::PxVec3* arg0) {
  self->suspForceAppPoint = *arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSuspensionComplianceState___destroy___0(physx::vehicle2::PxVehicleSuspensionComplianceState* self) {
  delete self;
}

// Interface: PxVehicleSuspensionForce


physx::vehicle2::PxVehicleSuspensionForce* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSuspensionForce_PxVehicleSuspensionForce_0() {
  return new physx::vehicle2::PxVehicleSuspensionForce();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSuspensionForce_setToDefault_0(physx::vehicle2::PxVehicleSuspensionForce* self) {
  self->setToDefault();
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSuspensionForce_get_force_0(physx::vehicle2::PxVehicleSuspensionForce* self) {
  return &self->force;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSuspensionForce_set_force_1(physx::vehicle2::PxVehicleSuspensionForce* self, physx::PxVec3* arg0) {
  self->force = *arg0;
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSuspensionForce_get_torque_0(physx::vehicle2::PxVehicleSuspensionForce* self) {
  return &self->torque;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSuspensionForce_set_torque_1(physx::vehicle2::PxVehicleSuspensionForce* self, physx::PxVec3* arg0) {
  self->torque = *arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSuspensionForce_get_normalForce_0(physx::vehicle2::PxVehicleSuspensionForce* self) {
  return self->normalForce;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSuspensionForce_set_normalForce_1(physx::vehicle2::PxVehicleSuspensionForce* self, float arg0) {
  self->normalForce = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSuspensionForce___destroy___0(physx::vehicle2::PxVehicleSuspensionForce* self) {
  delete self;
}

// Interface: PxVehicleSuspensionForceParams


physx::vehicle2::PxVehicleSuspensionForceParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSuspensionForceParams_PxVehicleSuspensionForceParams_0() {
  return new physx::vehicle2::PxVehicleSuspensionForceParams();
}

physx::vehicle2::PxVehicleSuspensionForceParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSuspensionForceParams_transformAndScale_4(physx::vehicle2::PxVehicleSuspensionForceParams* self, const physx::vehicle2::PxVehicleFrame* srcFrame, const physx::vehicle2::PxVehicleFrame* trgFrame, const physx::vehicle2::PxVehicleScale* srcScale, const physx::vehicle2::PxVehicleScale* trgScale) {
  static thread_local physx::vehicle2::PxVehicleSuspensionForceParams temp;
  return (temp = self->transformAndScale(*srcFrame, *trgFrame, *srcScale, *trgScale), &temp);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSuspensionForceParams_isValid_0(physx::vehicle2::PxVehicleSuspensionForceParams* self) {
  return self->isValid();
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSuspensionForceParams_get_stiffness_0(physx::vehicle2::PxVehicleSuspensionForceParams* self) {
  return self->stiffness;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSuspensionForceParams_set_stiffness_1(physx::vehicle2::PxVehicleSuspensionForceParams* self, float arg0) {
  self->stiffness = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSuspensionForceParams_get_damping_0(physx::vehicle2::PxVehicleSuspensionForceParams* self) {
  return self->damping;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSuspensionForceParams_set_damping_1(physx::vehicle2::PxVehicleSuspensionForceParams* self, float arg0) {
  self->damping = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSuspensionForceParams_get_sprungMass_0(physx::vehicle2::PxVehicleSuspensionForceParams* self) {
  return self->sprungMass;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSuspensionForceParams_set_sprungMass_1(physx::vehicle2::PxVehicleSuspensionForceParams* self, float arg0) {
  self->sprungMass = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSuspensionForceParams___destroy___0(physx::vehicle2::PxVehicleSuspensionForceParams* self) {
  delete self;
}

// Interface: PxVehicleSuspensionParams


physx::vehicle2::PxVehicleSuspensionParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSuspensionParams_PxVehicleSuspensionParams_0() {
  return new physx::vehicle2::PxVehicleSuspensionParams();
}

physx::vehicle2::PxVehicleSuspensionParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSuspensionParams_transformAndScale_4(physx::vehicle2::PxVehicleSuspensionParams* self, const physx::vehicle2::PxVehicleFrame* srcFrame, const physx::vehicle2::PxVehicleFrame* trgFrame, const physx::vehicle2::PxVehicleScale* srcScale, const physx::vehicle2::PxVehicleScale* trgScale) {
  static thread_local physx::vehicle2::PxVehicleSuspensionParams temp;
  return (temp = self->transformAndScale(*srcFrame, *trgFrame, *srcScale, *trgScale), &temp);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSuspensionParams_isValid_0(physx::vehicle2::PxVehicleSuspensionParams* self) {
  return self->isValid();
}

physx::PxTransform* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSuspensionParams_get_suspensionAttachment_0(physx::vehicle2::PxVehicleSuspensionParams* self) {
  return &self->suspensionAttachment;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSuspensionParams_set_suspensionAttachment_1(physx::vehicle2::PxVehicleSuspensionParams* self, physx::PxTransform* arg0) {
  self->suspensionAttachment = *arg0;
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSuspensionParams_get_suspensionTravelDir_0(physx::vehicle2::PxVehicleSuspensionParams* self) {
  return &self->suspensionTravelDir;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSuspensionParams_set_suspensionTravelDir_1(physx::vehicle2::PxVehicleSuspensionParams* self, physx::PxVec3* arg0) {
  self->suspensionTravelDir = *arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSuspensionParams_get_suspensionTravelDist_0(physx::vehicle2::PxVehicleSuspensionParams* self) {
  return self->suspensionTravelDist;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSuspensionParams_set_suspensionTravelDist_1(physx::vehicle2::PxVehicleSuspensionParams* self, float arg0) {
  self->suspensionTravelDist = arg0;
}

physx::PxTransform* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSuspensionParams_get_wheelAttachment_0(physx::vehicle2::PxVehicleSuspensionParams* self) {
  return &self->wheelAttachment;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSuspensionParams_set_wheelAttachment_1(physx::vehicle2::PxVehicleSuspensionParams* self, physx::PxTransform* arg0) {
  self->wheelAttachment = *arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSuspensionParams___destroy___0(physx::vehicle2::PxVehicleSuspensionParams* self) {
  delete self;
}

// Interface: PxVehicleSuspensionState


physx::vehicle2::PxVehicleSuspensionState* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSuspensionState_PxVehicleSuspensionState_0() {
  return new physx::vehicle2::PxVehicleSuspensionState();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSuspensionState_setToDefault_2(physx::vehicle2::PxVehicleSuspensionState* self, float jounce, float separation) {
  self->setToDefault(jounce, separation);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSuspensionState_get_jounce_0(physx::vehicle2::PxVehicleSuspensionState* self) {
  return self->jounce;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSuspensionState_set_jounce_1(physx::vehicle2::PxVehicleSuspensionState* self, float arg0) {
  self->jounce = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSuspensionState_get_jounceSpeed_0(physx::vehicle2::PxVehicleSuspensionState* self) {
  return self->jounceSpeed;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSuspensionState_set_jounceSpeed_1(physx::vehicle2::PxVehicleSuspensionState* self, float arg0) {
  self->jounceSpeed = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSuspensionState_get_separation_0(physx::vehicle2::PxVehicleSuspensionState* self) {
  return self->separation;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSuspensionState_set_separation_1(physx::vehicle2::PxVehicleSuspensionState* self, float arg0) {
  self->separation = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSuspensionState___destroy___0(physx::vehicle2::PxVehicleSuspensionState* self) {
  delete self;
}

// Interface: PxVehicleSuspensionStateCalculationParams


physx::vehicle2::PxVehicleSuspensionStateCalculationParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSuspensionStateCalculationParams_PxVehicleSuspensionStateCalculationParams_0() {
  return new physx::vehicle2::PxVehicleSuspensionStateCalculationParams();
}

physx::vehicle2::PxVehicleSuspensionStateCalculationParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSuspensionStateCalculationParams_transformAndScale_4(physx::vehicle2::PxVehicleSuspensionStateCalculationParams* self, const physx::vehicle2::PxVehicleFrame* srcFrame, const physx::vehicle2::PxVehicleFrame* trgFrame, const physx::vehicle2::PxVehicleScale* srcScale, const physx::vehicle2::PxVehicleScale* trgScale) {
  static thread_local physx::vehicle2::PxVehicleSuspensionStateCalculationParams temp;
  return (temp = self->transformAndScale(*srcFrame, *trgFrame, *srcScale, *trgScale), &temp);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSuspensionStateCalculationParams_isValid_0(physx::vehicle2::PxVehicleSuspensionStateCalculationParams* self) {
  return self->isValid();
}

PxVehicleSuspensionJounceCalculationTypeEnum EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSuspensionStateCalculationParams_get_suspensionJounceCalculationType_0(physx::vehicle2::PxVehicleSuspensionStateCalculationParams* self) {
  return self->suspensionJounceCalculationType;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSuspensionStateCalculationParams_set_suspensionJounceCalculationType_1(physx::vehicle2::PxVehicleSuspensionStateCalculationParams* self, PxVehicleSuspensionJounceCalculationTypeEnum arg0) {
  self->suspensionJounceCalculationType = arg0;
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSuspensionStateCalculationParams_get_limitSuspensionExpansionVelocity_0(physx::vehicle2::PxVehicleSuspensionStateCalculationParams* self) {
  return self->limitSuspensionExpansionVelocity;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSuspensionStateCalculationParams_set_limitSuspensionExpansionVelocity_1(physx::vehicle2::PxVehicleSuspensionStateCalculationParams* self, bool arg0) {
  self->limitSuspensionExpansionVelocity = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleSuspensionStateCalculationParams___destroy___0(physx::vehicle2::PxVehicleSuspensionStateCalculationParams* self) {
  delete self;
}

// Interface: PxVehicleTankDriveDifferentialParams


physx::vehicle2::PxVehicleTankDriveDifferentialParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTankDriveDifferentialParams_PxVehicleTankDriveDifferentialParams_0() {
  return new physx::vehicle2::PxVehicleTankDriveDifferentialParams();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTankDriveDifferentialParams_setToDefault_0(physx::vehicle2::PxVehicleTankDriveDifferentialParams* self) {
  self->setToDefault();
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTankDriveDifferentialParams_getNbWheelsInTrack_1(physx::vehicle2::PxVehicleTankDriveDifferentialParams* self, unsigned int i) {
  return self->getNbWheelsInTrack(i);
}

PxU32ConstPtr* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTankDriveDifferentialParams_getWheelsInTrack_1(physx::vehicle2::PxVehicleTankDriveDifferentialParams* self, unsigned int i) {
  static thread_local PxU32ConstPtr temp;
  return (temp = self->getWheelsInTrack(i), &temp);
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTankDriveDifferentialParams_getWheelInTrack_2(physx::vehicle2::PxVehicleTankDriveDifferentialParams* self, unsigned int j, unsigned int i) {
  return self->getWheelInTrack(j, i);
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTankDriveDifferentialParams_getThrustControllerIndex_1(physx::vehicle2::PxVehicleTankDriveDifferentialParams* self, unsigned int i) {
  return self->getThrustControllerIndex(i);
}

physx::vehicle2::PxVehicleTankDriveDifferentialParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTankDriveDifferentialParams_transformAndScale_4(physx::vehicle2::PxVehicleTankDriveDifferentialParams* self, const physx::vehicle2::PxVehicleFrame* srcFrame, const physx::vehicle2::PxVehicleFrame* trgFrame, const physx::vehicle2::PxVehicleScale* srcScale, const physx::vehicle2::PxVehicleScale* trgScale) {
  static thread_local physx::vehicle2::PxVehicleTankDriveDifferentialParams temp;
  return (temp = self->transformAndScale(*srcFrame, *trgFrame, *srcScale, *trgScale), &temp);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTankDriveDifferentialParams_isValid_1(physx::vehicle2::PxVehicleTankDriveDifferentialParams* self, const physx::vehicle2::PxVehicleAxleDescription* axleDesc) {
  return self->isValid(*axleDesc);
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTankDriveDifferentialParams_get_nbTracks_0(physx::vehicle2::PxVehicleTankDriveDifferentialParams* self) {
  return self->nbTracks;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTankDriveDifferentialParams_set_nbTracks_1(physx::vehicle2::PxVehicleTankDriveDifferentialParams* self, unsigned int arg0) {
  self->nbTracks = arg0;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTankDriveDifferentialParams_get_thrustIdPerTrack_1(physx::vehicle2::PxVehicleTankDriveDifferentialParams* self, int arg0) {
  return self->thrustIdPerTrack[arg0];
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTankDriveDifferentialParams_set_thrustIdPerTrack_2(physx::vehicle2::PxVehicleTankDriveDifferentialParams* self, int arg0, unsigned int arg1) {
  self->thrustIdPerTrack[arg0] = arg1;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTankDriveDifferentialParams_get_nbWheelsPerTrack_1(physx::vehicle2::PxVehicleTankDriveDifferentialParams* self, int arg0) {
  return self->nbWheelsPerTrack[arg0];
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTankDriveDifferentialParams_set_nbWheelsPerTrack_2(physx::vehicle2::PxVehicleTankDriveDifferentialParams* self, int arg0, unsigned int arg1) {
  self->nbWheelsPerTrack[arg0] = arg1;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTankDriveDifferentialParams_get_trackToWheelIds_1(physx::vehicle2::PxVehicleTankDriveDifferentialParams* self, int arg0) {
  return self->trackToWheelIds[arg0];
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTankDriveDifferentialParams_set_trackToWheelIds_2(physx::vehicle2::PxVehicleTankDriveDifferentialParams* self, int arg0, unsigned int arg1) {
  self->trackToWheelIds[arg0] = arg1;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTankDriveDifferentialParams_get_wheelIdsInTrackOrder_1(physx::vehicle2::PxVehicleTankDriveDifferentialParams* self, int arg0) {
  return self->wheelIdsInTrackOrder[arg0];
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTankDriveDifferentialParams_set_wheelIdsInTrackOrder_2(physx::vehicle2::PxVehicleTankDriveDifferentialParams* self, int arg0, unsigned int arg1) {
  self->wheelIdsInTrackOrder[arg0] = arg1;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTankDriveDifferentialParams_get_torqueRatios_1(physx::vehicle2::PxVehicleTankDriveDifferentialParams* self, int arg0) {
  return self->torqueRatios[arg0];
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTankDriveDifferentialParams_set_torqueRatios_2(physx::vehicle2::PxVehicleTankDriveDifferentialParams* self, int arg0, float arg1) {
  self->torqueRatios[arg0] = arg1;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTankDriveDifferentialParams_get_aveWheelSpeedRatios_1(physx::vehicle2::PxVehicleTankDriveDifferentialParams* self, int arg0) {
  return self->aveWheelSpeedRatios[arg0];
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTankDriveDifferentialParams_set_aveWheelSpeedRatios_2(physx::vehicle2::PxVehicleTankDriveDifferentialParams* self, int arg0, float arg1) {
  self->aveWheelSpeedRatios[arg0] = arg1;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTankDriveDifferentialParams___destroy___0(physx::vehicle2::PxVehicleTankDriveDifferentialParams* self) {
  delete self;
}

// Interface: PxVehicleTankDriveTransmissionCommandState


physx::vehicle2::PxVehicleTankDriveTransmissionCommandState* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTankDriveTransmissionCommandState_PxVehicleTankDriveTransmissionCommandState_0() {
  return new physx::vehicle2::PxVehicleTankDriveTransmissionCommandState();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTankDriveTransmissionCommandState_setToDefault_0(physx::vehicle2::PxVehicleTankDriveTransmissionCommandState* self) {
  self->setToDefault();
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTankDriveTransmissionCommandState_get_thrusts_1(physx::vehicle2::PxVehicleTankDriveTransmissionCommandState* self, int arg0) {
  return self->thrusts[arg0];
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTankDriveTransmissionCommandState_set_thrusts_2(physx::vehicle2::PxVehicleTankDriveTransmissionCommandState* self, int arg0, float arg1) {
  self->thrusts[arg0] = arg1;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTankDriveTransmissionCommandState_get_clutch_0(physx::vehicle2::PxVehicleTankDriveTransmissionCommandState* self) {
  return self->clutch;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTankDriveTransmissionCommandState_set_clutch_1(physx::vehicle2::PxVehicleTankDriveTransmissionCommandState* self, float arg0) {
  self->clutch = arg0;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTankDriveTransmissionCommandState_get_targetGear_0(physx::vehicle2::PxVehicleTankDriveTransmissionCommandState* self) {
  return self->targetGear;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTankDriveTransmissionCommandState_set_targetGear_1(physx::vehicle2::PxVehicleTankDriveTransmissionCommandState* self, unsigned int arg0) {
  self->targetGear = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTankDriveTransmissionCommandState___destroy___0(physx::vehicle2::PxVehicleTankDriveTransmissionCommandState* self) {
  delete self;
}

// Interface: PxVehicleTireAxisStickyParams


physx::vehicle2::PxVehicleTireAxisStickyParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTireAxisStickyParams_PxVehicleTireAxisStickyParams_0() {
  return new physx::vehicle2::PxVehicleTireAxisStickyParams();
}

physx::vehicle2::PxVehicleTireAxisStickyParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTireAxisStickyParams_transformAndScale_4(physx::vehicle2::PxVehicleTireAxisStickyParams* self, const physx::vehicle2::PxVehicleFrame* srcFrame, const physx::vehicle2::PxVehicleFrame* trgFrame, const physx::vehicle2::PxVehicleScale* srcScale, const physx::vehicle2::PxVehicleScale* trgScale) {
  static thread_local physx::vehicle2::PxVehicleTireAxisStickyParams temp;
  return (temp = self->transformAndScale(*srcFrame, *trgFrame, *srcScale, *trgScale), &temp);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTireAxisStickyParams_isValid_0(physx::vehicle2::PxVehicleTireAxisStickyParams* self) {
  return self->isValid();
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTireAxisStickyParams_get_thresholdSpeed_0(physx::vehicle2::PxVehicleTireAxisStickyParams* self) {
  return self->thresholdSpeed;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTireAxisStickyParams_set_thresholdSpeed_1(physx::vehicle2::PxVehicleTireAxisStickyParams* self, float arg0) {
  self->thresholdSpeed = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTireAxisStickyParams_get_thresholdTime_0(physx::vehicle2::PxVehicleTireAxisStickyParams* self) {
  return self->thresholdTime;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTireAxisStickyParams_set_thresholdTime_1(physx::vehicle2::PxVehicleTireAxisStickyParams* self, float arg0) {
  self->thresholdTime = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTireAxisStickyParams_get_damping_0(physx::vehicle2::PxVehicleTireAxisStickyParams* self) {
  return self->damping;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTireAxisStickyParams_set_damping_1(physx::vehicle2::PxVehicleTireAxisStickyParams* self, float arg0) {
  self->damping = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTireAxisStickyParams___destroy___0(physx::vehicle2::PxVehicleTireAxisStickyParams* self) {
  delete self;
}

// Interface: PxVehicleTireCamberAngleState


physx::vehicle2::PxVehicleTireCamberAngleState* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTireCamberAngleState_PxVehicleTireCamberAngleState_0() {
  return new physx::vehicle2::PxVehicleTireCamberAngleState();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTireCamberAngleState_setToDefault_0(physx::vehicle2::PxVehicleTireCamberAngleState* self) {
  self->setToDefault();
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTireCamberAngleState_get_camberAngle_0(physx::vehicle2::PxVehicleTireCamberAngleState* self) {
  return self->camberAngle;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTireCamberAngleState_set_camberAngle_1(physx::vehicle2::PxVehicleTireCamberAngleState* self, float arg0) {
  self->camberAngle = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTireCamberAngleState___destroy___0(physx::vehicle2::PxVehicleTireCamberAngleState* self) {
  delete self;
}

// Interface: PxVehicleTireDirectionState


physx::vehicle2::PxVehicleTireDirectionState* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTireDirectionState_PxVehicleTireDirectionState_0() {
  return new physx::vehicle2::PxVehicleTireDirectionState();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTireDirectionState_setToDefault_0(physx::vehicle2::PxVehicleTireDirectionState* self) {
  self->setToDefault();
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTireDirectionState_get_directions_1(physx::vehicle2::PxVehicleTireDirectionState* self, int arg0) {
  return &self->directions[arg0];
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTireDirectionState_set_directions_2(physx::vehicle2::PxVehicleTireDirectionState* self, int arg0, physx::PxVec3* arg1) {
  self->directions[arg0] = *arg1;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTireDirectionState___destroy___0(physx::vehicle2::PxVehicleTireDirectionState* self) {
  delete self;
}

// Interface: PxVehicleTireForce


physx::vehicle2::PxVehicleTireForce* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTireForce_PxVehicleTireForce_0() {
  return new physx::vehicle2::PxVehicleTireForce();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTireForce_setToDefault_0(physx::vehicle2::PxVehicleTireForce* self) {
  self->setToDefault();
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTireForce_get_forces_1(physx::vehicle2::PxVehicleTireForce* self, int arg0) {
  return &self->forces[arg0];
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTireForce_set_forces_2(physx::vehicle2::PxVehicleTireForce* self, int arg0, physx::PxVec3* arg1) {
  self->forces[arg0] = *arg1;
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTireForce_get_torques_1(physx::vehicle2::PxVehicleTireForce* self, int arg0) {
  return &self->torques[arg0];
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTireForce_set_torques_2(physx::vehicle2::PxVehicleTireForce* self, int arg0, physx::PxVec3* arg1) {
  self->torques[arg0] = *arg1;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTireForce_get_aligningMoment_0(physx::vehicle2::PxVehicleTireForce* self) {
  return self->aligningMoment;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTireForce_set_aligningMoment_1(physx::vehicle2::PxVehicleTireForce* self, float arg0) {
  self->aligningMoment = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTireForce_get_wheelTorque_0(physx::vehicle2::PxVehicleTireForce* self) {
  return self->wheelTorque;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTireForce_set_wheelTorque_1(physx::vehicle2::PxVehicleTireForce* self, float arg0) {
  self->wheelTorque = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTireForce___destroy___0(physx::vehicle2::PxVehicleTireForce* self) {
  delete self;
}

// Interface: PxVehicleTireForceParams


physx::vehicle2::PxVehicleTireForceParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTireForceParams_PxVehicleTireForceParams_0() {
  return new physx::vehicle2::PxVehicleTireForceParams();
}

physx::vehicle2::PxVehicleTireForceParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTireForceParams_transformAndScale_4(physx::vehicle2::PxVehicleTireForceParams* self, const physx::vehicle2::PxVehicleFrame* srcFrame, const physx::vehicle2::PxVehicleFrame* trgFrame, const physx::vehicle2::PxVehicleScale* srcScale, const physx::vehicle2::PxVehicleScale* trgScale) {
  static thread_local physx::vehicle2::PxVehicleTireForceParams temp;
  return (temp = self->transformAndScale(*srcFrame, *trgFrame, *srcScale, *trgScale), &temp);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTireForceParams_isValid_0(physx::vehicle2::PxVehicleTireForceParams* self) {
  return self->isValid();
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTireForceParams_get_latStiffX_0(physx::vehicle2::PxVehicleTireForceParams* self) {
  return self->latStiffX;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTireForceParams_set_latStiffX_1(physx::vehicle2::PxVehicleTireForceParams* self, float arg0) {
  self->latStiffX = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTireForceParams_get_latStiffY_0(physx::vehicle2::PxVehicleTireForceParams* self) {
  return self->latStiffY;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTireForceParams_set_latStiffY_1(physx::vehicle2::PxVehicleTireForceParams* self, float arg0) {
  self->latStiffY = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTireForceParams_get_longStiff_0(physx::vehicle2::PxVehicleTireForceParams* self) {
  return self->longStiff;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTireForceParams_set_longStiff_1(physx::vehicle2::PxVehicleTireForceParams* self, float arg0) {
  self->longStiff = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTireForceParams_get_camberStiff_0(physx::vehicle2::PxVehicleTireForceParams* self) {
  return self->camberStiff;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTireForceParams_set_camberStiff_1(physx::vehicle2::PxVehicleTireForceParams* self, float arg0) {
  self->camberStiff = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTireForceParams_get_restLoad_0(physx::vehicle2::PxVehicleTireForceParams* self) {
  return self->restLoad;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTireForceParams_set_restLoad_1(physx::vehicle2::PxVehicleTireForceParams* self, float arg0) {
  self->restLoad = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTireForceParams___destroy___0(physx::vehicle2::PxVehicleTireForceParams* self) {
  delete self;
}

// Interface: PxVehicleTireForceParamsExt


void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTireForceParamsExt_setFrictionVsSlip_4(physx::vehicle2::PxVehicleTireForceParams* tireForceParams, unsigned int i, unsigned int j, float value) {
  PxVehicleTireForceParamsExt::setFrictionVsSlip(tireForceParams, i, j, value);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTireForceParamsExt_setLoadFilter_4(physx::vehicle2::PxVehicleTireForceParams* tireForceParams, unsigned int i, unsigned int j, float value) {
  PxVehicleTireForceParamsExt::setLoadFilter(tireForceParams, i, j, value);
}

// Interface: PxVehicleTireGripState


void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTireGripState_setToDefault_0(physx::vehicle2::PxVehicleTireGripState* self) {
  self->setToDefault();
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTireGripState_get_load_0(physx::vehicle2::PxVehicleTireGripState* self) {
  return self->load;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTireGripState_set_load_1(physx::vehicle2::PxVehicleTireGripState* self, float arg0) {
  self->load = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTireGripState_get_friction_0(physx::vehicle2::PxVehicleTireGripState* self) {
  return self->friction;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTireGripState_set_friction_1(physx::vehicle2::PxVehicleTireGripState* self, float arg0) {
  self->friction = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTireGripState___destroy___0(physx::vehicle2::PxVehicleTireGripState* self) {
  delete self;
}

// Interface: PxVehicleTireSlipParams


physx::vehicle2::PxVehicleTireSlipParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTireSlipParams_PxVehicleTireSlipParams_0() {
  return new physx::vehicle2::PxVehicleTireSlipParams();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTireSlipParams_setToDefault_0(physx::vehicle2::PxVehicleTireSlipParams* self) {
  self->setToDefault();
}

physx::vehicle2::PxVehicleTireSlipParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTireSlipParams_transformAndScale_4(physx::vehicle2::PxVehicleTireSlipParams* self, const physx::vehicle2::PxVehicleFrame* srcFrame, const physx::vehicle2::PxVehicleFrame* trgFrame, const physx::vehicle2::PxVehicleScale* srcScale, const physx::vehicle2::PxVehicleScale* trgScale) {
  static thread_local physx::vehicle2::PxVehicleTireSlipParams temp;
  return (temp = self->transformAndScale(*srcFrame, *trgFrame, *srcScale, *trgScale), &temp);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTireSlipParams_isValid_0(physx::vehicle2::PxVehicleTireSlipParams* self) {
  return self->isValid();
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTireSlipParams_get_minLatSlipDenominator_0(physx::vehicle2::PxVehicleTireSlipParams* self) {
  return self->minLatSlipDenominator;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTireSlipParams_set_minLatSlipDenominator_1(physx::vehicle2::PxVehicleTireSlipParams* self, float arg0) {
  self->minLatSlipDenominator = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTireSlipParams_get_minPassiveLongSlipDenominator_0(physx::vehicle2::PxVehicleTireSlipParams* self) {
  return self->minPassiveLongSlipDenominator;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTireSlipParams_set_minPassiveLongSlipDenominator_1(physx::vehicle2::PxVehicleTireSlipParams* self, float arg0) {
  self->minPassiveLongSlipDenominator = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTireSlipParams_get_minActiveLongSlipDenominator_0(physx::vehicle2::PxVehicleTireSlipParams* self) {
  return self->minActiveLongSlipDenominator;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTireSlipParams_set_minActiveLongSlipDenominator_1(physx::vehicle2::PxVehicleTireSlipParams* self, float arg0) {
  self->minActiveLongSlipDenominator = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTireSlipParams___destroy___0(physx::vehicle2::PxVehicleTireSlipParams* self) {
  delete self;
}

// Interface: PxVehicleTireSlipState


physx::vehicle2::PxVehicleTireSlipState* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTireSlipState_PxVehicleTireSlipState_0() {
  return new physx::vehicle2::PxVehicleTireSlipState();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTireSlipState_setToDefault_0(physx::vehicle2::PxVehicleTireSlipState* self) {
  self->setToDefault();
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTireSlipState_get_slips_1(physx::vehicle2::PxVehicleTireSlipState* self, int arg0) {
  return self->slips[arg0];
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTireSlipState_set_slips_2(physx::vehicle2::PxVehicleTireSlipState* self, int arg0, float arg1) {
  self->slips[arg0] = arg1;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTireSlipState___destroy___0(physx::vehicle2::PxVehicleTireSlipState* self) {
  delete self;
}

// Interface: PxVehicleTireSpeedState


physx::vehicle2::PxVehicleTireSpeedState* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTireSpeedState_PxVehicleTireSpeedState_0() {
  return new physx::vehicle2::PxVehicleTireSpeedState();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTireSpeedState_setToDefault_0(physx::vehicle2::PxVehicleTireSpeedState* self) {
  self->setToDefault();
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTireSpeedState_get_speedStates_1(physx::vehicle2::PxVehicleTireSpeedState* self, int arg0) {
  return self->speedStates[arg0];
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTireSpeedState_set_speedStates_2(physx::vehicle2::PxVehicleTireSpeedState* self, int arg0, float arg1) {
  self->speedStates[arg0] = arg1;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTireSpeedState___destroy___0(physx::vehicle2::PxVehicleTireSpeedState* self) {
  delete self;
}

// Interface: PxVehicleTireStickyParams


physx::vehicle2::PxVehicleTireStickyParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTireStickyParams_PxVehicleTireStickyParams_0() {
  return new physx::vehicle2::PxVehicleTireStickyParams();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTireStickyParams_setToDefault_0(physx::vehicle2::PxVehicleTireStickyParams* self) {
  self->setToDefault();
}

physx::vehicle2::PxVehicleTireStickyParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTireStickyParams_transformAndScale_4(physx::vehicle2::PxVehicleTireStickyParams* self, const physx::vehicle2::PxVehicleFrame* srcFrame, const physx::vehicle2::PxVehicleFrame* trgFrame, const physx::vehicle2::PxVehicleScale* srcScale, const physx::vehicle2::PxVehicleScale* trgScale) {
  static thread_local physx::vehicle2::PxVehicleTireStickyParams temp;
  return (temp = self->transformAndScale(*srcFrame, *trgFrame, *srcScale, *trgScale), &temp);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTireStickyParams_isValid_0(physx::vehicle2::PxVehicleTireStickyParams* self) {
  return self->isValid();
}

physx::vehicle2::PxVehicleTireAxisStickyParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTireStickyParams_get_stickyParams_1(physx::vehicle2::PxVehicleTireStickyParams* self, int arg0) {
  return &self->stickyParams[arg0];
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTireStickyParams_set_stickyParams_2(physx::vehicle2::PxVehicleTireStickyParams* self, int arg0, physx::vehicle2::PxVehicleTireAxisStickyParams* arg1) {
  self->stickyParams[arg0] = *arg1;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTireStickyParams___destroy___0(physx::vehicle2::PxVehicleTireStickyParams* self) {
  delete self;
}

// Interface: PxVehicleTireStickyState


physx::vehicle2::PxVehicleTireStickyState* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTireStickyState_PxVehicleTireStickyState_0() {
  return new physx::vehicle2::PxVehicleTireStickyState();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTireStickyState_setToDefault_0(physx::vehicle2::PxVehicleTireStickyState* self) {
  self->setToDefault();
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTireStickyState_get_lowSpeedTime_1(physx::vehicle2::PxVehicleTireStickyState* self, int arg0) {
  return self->lowSpeedTime[arg0];
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTireStickyState_set_lowSpeedTime_2(physx::vehicle2::PxVehicleTireStickyState* self, int arg0, float arg1) {
  self->lowSpeedTime[arg0] = arg1;
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTireStickyState_get_activeStatus_1(physx::vehicle2::PxVehicleTireStickyState* self, int arg0) {
  return self->activeStatus[arg0];
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTireStickyState_set_activeStatus_2(physx::vehicle2::PxVehicleTireStickyState* self, int arg0, bool arg1) {
  self->activeStatus[arg0] = arg1;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTireStickyState___destroy___0(physx::vehicle2::PxVehicleTireStickyState* self) {
  delete self;
}

// Interface: PxVehicleTopLevelFunctions


bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTopLevelFunctions_InitVehicleExtension_1(physx::PxFoundation* foundation) {
  return PxVehicleTopLevelFunctions::InitVehicleExtension(*foundation);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTopLevelFunctions_CloseVehicleExtension_0() {
  PxVehicleTopLevelFunctions::CloseVehicleExtension();
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTopLevelFunctions_VehicleComputeSprungMasses_5(unsigned int nbSprungMasses, PxArray_PxVec3* sprungMassCoordinates, float totalMass, PxVehicleAxesEnum gravityDirection, PxArray_PxReal* sprungMasses) {
  return PxVehicleTopLevelFunctions::VehicleComputeSprungMasses(nbSprungMasses, *sprungMassCoordinates, totalMass, gravityDirection, *sprungMasses);
}

physx::PxConvexMesh* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTopLevelFunctions_VehicleUnitCylinderSweepMeshCreate_3(const physx::vehicle2::PxVehicleFrame* vehicleFrame, physx::PxPhysics* physics, const physx::PxCookingParams* params) {
  return PxVehicleTopLevelFunctions::VehicleUnitCylinderSweepMeshCreate(*vehicleFrame, *physics, *params);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTopLevelFunctions_VehicleUnitCylinderSweepMeshDestroy_1(physx::PxConvexMesh* mesh) {
  PxVehicleTopLevelFunctions::VehicleUnitCylinderSweepMeshDestroy(mesh);
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTopLevelFunctions_get_MAX_NB_ENGINE_TORQUE_CURVE_ENTRIES_0(PxVehicleTopLevelFunctions* self) {
  return self->MAX_NB_ENGINE_TORQUE_CURVE_ENTRIES;
}

// Interface: PxVehicleTorqueCurveLookupTable


PxVehicleTorqueCurveLookupTable* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTorqueCurveLookupTable_PxVehicleTorqueCurveLookupTable_0() {
  return new PxVehicleTorqueCurveLookupTable();
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTorqueCurveLookupTable_addPair_2(PxVehicleTorqueCurveLookupTable* self, float x, float y) {
  return self->addPair(x, y);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTorqueCurveLookupTable_interpolate_1(PxVehicleTorqueCurveLookupTable* self, float x) {
  return self->interpolate(x);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTorqueCurveLookupTable_clear_0(PxVehicleTorqueCurveLookupTable* self) {
  self->clear();
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTorqueCurveLookupTable_isValid_0(PxVehicleTorqueCurveLookupTable* self) {
  return self->isValid();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleTorqueCurveLookupTable___destroy___0(PxVehicleTorqueCurveLookupTable* self) {
  delete self;
}

// Interface: PxVehicleWheelActuationState


physx::vehicle2::PxVehicleWheelActuationState* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleWheelActuationState_PxVehicleWheelActuationState_0() {
  return new physx::vehicle2::PxVehicleWheelActuationState();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleWheelActuationState_setToDefault_0(physx::vehicle2::PxVehicleWheelActuationState* self) {
  self->setToDefault();
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleWheelActuationState_get_isBrakeApplied_0(physx::vehicle2::PxVehicleWheelActuationState* self) {
  return self->isBrakeApplied;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleWheelActuationState_set_isBrakeApplied_1(physx::vehicle2::PxVehicleWheelActuationState* self, bool arg0) {
  self->isBrakeApplied = arg0;
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleWheelActuationState_get_isDriveApplied_0(physx::vehicle2::PxVehicleWheelActuationState* self) {
  return self->isDriveApplied;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleWheelActuationState_set_isDriveApplied_1(physx::vehicle2::PxVehicleWheelActuationState* self, bool arg0) {
  self->isDriveApplied = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleWheelActuationState___destroy___0(physx::vehicle2::PxVehicleWheelActuationState* self) {
  delete self;
}

// Interface: PxVehicleWheelConstraintGroupState


physx::vehicle2::PxVehicleWheelConstraintGroupState* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleWheelConstraintGroupState_PxVehicleWheelConstraintGroupState_0() {
  return new physx::vehicle2::PxVehicleWheelConstraintGroupState();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleWheelConstraintGroupState_setToDefault_0(physx::vehicle2::PxVehicleWheelConstraintGroupState* self) {
  self->setToDefault();
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleWheelConstraintGroupState_getNbConstraintGroups_0(physx::vehicle2::PxVehicleWheelConstraintGroupState* self) {
  return self->getNbConstraintGroups();
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleWheelConstraintGroupState_getNbWheelsInConstraintGroup_1(physx::vehicle2::PxVehicleWheelConstraintGroupState* self, unsigned int i) {
  return self->getNbWheelsInConstraintGroup(i);
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleWheelConstraintGroupState_getWheelInConstraintGroup_2(physx::vehicle2::PxVehicleWheelConstraintGroupState* self, unsigned int j, unsigned int i) {
  return self->getWheelInConstraintGroup(j, i);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleWheelConstraintGroupState_getMultiplierInConstraintGroup_2(physx::vehicle2::PxVehicleWheelConstraintGroupState* self, unsigned int j, unsigned int i) {
  return self->getMultiplierInConstraintGroup(j, i);
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleWheelConstraintGroupState_get_nbGroups_0(physx::vehicle2::PxVehicleWheelConstraintGroupState* self) {
  return self->nbGroups;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleWheelConstraintGroupState_set_nbGroups_1(physx::vehicle2::PxVehicleWheelConstraintGroupState* self, unsigned int arg0) {
  self->nbGroups = arg0;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleWheelConstraintGroupState_get_nbWheelsPerGroup_1(physx::vehicle2::PxVehicleWheelConstraintGroupState* self, int arg0) {
  return self->nbWheelsPerGroup[arg0];
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleWheelConstraintGroupState_set_nbWheelsPerGroup_2(physx::vehicle2::PxVehicleWheelConstraintGroupState* self, int arg0, unsigned int arg1) {
  self->nbWheelsPerGroup[arg0] = arg1;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleWheelConstraintGroupState_get_groupToWheelIds_1(physx::vehicle2::PxVehicleWheelConstraintGroupState* self, int arg0) {
  return self->groupToWheelIds[arg0];
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleWheelConstraintGroupState_set_groupToWheelIds_2(physx::vehicle2::PxVehicleWheelConstraintGroupState* self, int arg0, unsigned int arg1) {
  self->groupToWheelIds[arg0] = arg1;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleWheelConstraintGroupState_get_wheelIdsInGroupOrder_1(physx::vehicle2::PxVehicleWheelConstraintGroupState* self, int arg0) {
  return self->wheelIdsInGroupOrder[arg0];
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleWheelConstraintGroupState_set_wheelIdsInGroupOrder_2(physx::vehicle2::PxVehicleWheelConstraintGroupState* self, int arg0, unsigned int arg1) {
  self->wheelIdsInGroupOrder[arg0] = arg1;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleWheelConstraintGroupState_get_wheelMultipliersInGroupOrder_1(physx::vehicle2::PxVehicleWheelConstraintGroupState* self, int arg0) {
  return self->wheelMultipliersInGroupOrder[arg0];
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleWheelConstraintGroupState_set_wheelMultipliersInGroupOrder_2(physx::vehicle2::PxVehicleWheelConstraintGroupState* self, int arg0, float arg1) {
  self->wheelMultipliersInGroupOrder[arg0] = arg1;
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleWheelConstraintGroupState_get_nbWheelsInGroups_0(physx::vehicle2::PxVehicleWheelConstraintGroupState* self) {
  return self->nbWheelsInGroups;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleWheelConstraintGroupState_set_nbWheelsInGroups_1(physx::vehicle2::PxVehicleWheelConstraintGroupState* self, unsigned int arg0) {
  self->nbWheelsInGroups = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleWheelConstraintGroupState___destroy___0(physx::vehicle2::PxVehicleWheelConstraintGroupState* self) {
  delete self;
}

// Interface: PxVehicleWheelLocalPose


physx::vehicle2::PxVehicleWheelLocalPose* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleWheelLocalPose_PxVehicleWheelLocalPose_0() {
  return new physx::vehicle2::PxVehicleWheelLocalPose();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleWheelLocalPose_setToDefault_0(physx::vehicle2::PxVehicleWheelLocalPose* self) {
  self->setToDefault();
}

physx::PxTransform* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleWheelLocalPose_get_localPose_0(physx::vehicle2::PxVehicleWheelLocalPose* self) {
  return &self->localPose;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleWheelLocalPose_set_localPose_1(physx::vehicle2::PxVehicleWheelLocalPose* self, physx::PxTransform* arg0) {
  self->localPose = *arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleWheelLocalPose___destroy___0(physx::vehicle2::PxVehicleWheelLocalPose* self) {
  delete self;
}

// Interface: PxVehicleWheelParams


physx::vehicle2::PxVehicleWheelParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleWheelParams_PxVehicleWheelParams_0() {
  return new physx::vehicle2::PxVehicleWheelParams();
}

physx::vehicle2::PxVehicleWheelParams* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleWheelParams_transformAndScale_4(physx::vehicle2::PxVehicleWheelParams* self, const physx::vehicle2::PxVehicleFrame* srcFrame, const physx::vehicle2::PxVehicleFrame* trgFrame, const physx::vehicle2::PxVehicleScale* srcScale, const physx::vehicle2::PxVehicleScale* trgScale) {
  static thread_local physx::vehicle2::PxVehicleWheelParams temp;
  return (temp = self->transformAndScale(*srcFrame, *trgFrame, *srcScale, *trgScale), &temp);
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleWheelParams_isValid_0(physx::vehicle2::PxVehicleWheelParams* self) {
  return self->isValid();
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleWheelParams_get_radius_0(physx::vehicle2::PxVehicleWheelParams* self) {
  return self->radius;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleWheelParams_set_radius_1(physx::vehicle2::PxVehicleWheelParams* self, float arg0) {
  self->radius = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleWheelParams_get_halfWidth_0(physx::vehicle2::PxVehicleWheelParams* self) {
  return self->halfWidth;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleWheelParams_set_halfWidth_1(physx::vehicle2::PxVehicleWheelParams* self, float arg0) {
  self->halfWidth = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleWheelParams_get_mass_0(physx::vehicle2::PxVehicleWheelParams* self) {
  return self->mass;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleWheelParams_set_mass_1(physx::vehicle2::PxVehicleWheelParams* self, float arg0) {
  self->mass = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleWheelParams_get_moi_0(physx::vehicle2::PxVehicleWheelParams* self) {
  return self->moi;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleWheelParams_set_moi_1(physx::vehicle2::PxVehicleWheelParams* self, float arg0) {
  self->moi = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleWheelParams_get_dampingRate_0(physx::vehicle2::PxVehicleWheelParams* self) {
  return self->dampingRate;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleWheelParams_set_dampingRate_1(physx::vehicle2::PxVehicleWheelParams* self, float arg0) {
  self->dampingRate = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleWheelParams___destroy___0(physx::vehicle2::PxVehicleWheelParams* self) {
  delete self;
}

// Interface: PxVehicleWheelRigidBody1dState


physx::vehicle2::PxVehicleWheelRigidBody1dState* EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleWheelRigidBody1dState_PxVehicleWheelRigidBody1dState_0() {
  return new physx::vehicle2::PxVehicleWheelRigidBody1dState();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleWheelRigidBody1dState_setToDefault_0(physx::vehicle2::PxVehicleWheelRigidBody1dState* self) {
  self->setToDefault();
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleWheelRigidBody1dState_get_rotationSpeed_0(physx::vehicle2::PxVehicleWheelRigidBody1dState* self) {
  return self->rotationSpeed;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleWheelRigidBody1dState_set_rotationSpeed_1(physx::vehicle2::PxVehicleWheelRigidBody1dState* self, float arg0) {
  self->rotationSpeed = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleWheelRigidBody1dState_get_correctedRotationSpeed_0(physx::vehicle2::PxVehicleWheelRigidBody1dState* self) {
  return self->correctedRotationSpeed;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleWheelRigidBody1dState_set_correctedRotationSpeed_1(physx::vehicle2::PxVehicleWheelRigidBody1dState* self, float arg0) {
  self->correctedRotationSpeed = arg0;
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleWheelRigidBody1dState_get_rotationAngle_0(physx::vehicle2::PxVehicleWheelRigidBody1dState* self) {
  return self->rotationAngle;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleWheelRigidBody1dState_set_rotationAngle_1(physx::vehicle2::PxVehicleWheelRigidBody1dState* self, float arg0) {
  self->rotationAngle = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_PxVehicleWheelRigidBody1dState___destroy___0(physx::vehicle2::PxVehicleWheelRigidBody1dState* self) {
  delete self;
}

// Interface: SimplPvdTransportImpl


SimplPvdTransportImpl* EMSCRIPTEN_KEEPALIVE emscripten_bind_SimplPvdTransportImpl_SimplPvdTransportImpl_0() {
  return new SimplPvdTransportImpl();
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_SimplPvdTransportImpl_connect_0(SimplPvdTransportImpl* self) {
  return self->connect();
}

bool EMSCRIPTEN_KEEPALIVE emscripten_bind_SimplPvdTransportImpl_isConnected_0(SimplPvdTransportImpl* self) {
  return self->isConnected();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_SimplPvdTransportImpl_disconnect_0(SimplPvdTransportImpl* self) {
  self->disconnect();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_SimplPvdTransportImpl_send_2(SimplPvdTransportImpl* self, void* inBytes, unsigned int inLength) {
  self->send(inBytes, inLength);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_SimplPvdTransportImpl_flush_0(SimplPvdTransportImpl* self) {
  self->flush();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_SimplPvdTransportImpl___destroy___0(SimplPvdTransportImpl* self) {
  delete self;
}

// Interface: SphereSupport


physx::PxGjkQueryExt::SphereSupport* EMSCRIPTEN_KEEPALIVE emscripten_bind_SphereSupport_SphereSupport_1(float radius) {
  return new physx::PxGjkQueryExt::SphereSupport(radius);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_SphereSupport_getMargin_0(physx::PxGjkQueryExt::SphereSupport* self) {
  return self->getMargin();
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_SphereSupport_supportLocal_1(physx::PxGjkQueryExt::SphereSupport* self, const physx::PxVec3* dir) {
  static thread_local physx::PxVec3 temp;
  return (temp = self->supportLocal(*dir), &temp);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_SphereSupport_get_radius_0(physx::PxGjkQueryExt::SphereSupport* self) {
  return self->radius;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_SphereSupport_set_radius_1(physx::PxGjkQueryExt::SphereSupport* self, float arg0) {
  self->radius = arg0;
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_SphereSupport___destroy___0(physx::PxGjkQueryExt::SphereSupport* self) {
  delete self;
}

// Interface: SupportFunctions


physx::PxShape* EMSCRIPTEN_KEEPALIVE emscripten_bind_SupportFunctions_PxActor_getShape_2(physx::PxRigidActor* actor, int index) {
  return SupportFunctions::PxActor_getShape(*actor, index);
}

PxArray_PxActorPtr* EMSCRIPTEN_KEEPALIVE emscripten_bind_SupportFunctions_PxScene_getActiveActors_1(physx::PxScene* scene) {
  return &SupportFunctions::PxScene_getActiveActors(scene);
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_SupportFunctions_PxArticulationReducedCoordinate_getMinSolverPositionIterations_1(physx::PxArticulationReducedCoordinate* articulation) {
  return SupportFunctions::PxArticulationReducedCoordinate_getMinSolverPositionIterations(articulation);
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_SupportFunctions_PxArticulationReducedCoordinate_getMinSolverVelocityIterations_1(physx::PxArticulationReducedCoordinate* articulation) {
  return SupportFunctions::PxArticulationReducedCoordinate_getMinSolverVelocityIterations(articulation);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_SupportFunctions___destroy___0(SupportFunctions* self) {
  delete self;
}

// Interface: Vector_PxActorPtr


Vector_PxActorPtr* EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxActorPtr_Vector_PxActorPtr_0() {
  return new Vector_PxActorPtr();
}

Vector_PxActorPtr* EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxActorPtr_Vector_PxActorPtr_1(unsigned int size) {
  return new Vector_PxActorPtr(size);
}

physx::PxActor* EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxActorPtr_at_1(Vector_PxActorPtr* self, unsigned int index) {
  return self->at(index);
}

PxActorPtr* EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxActorPtr_data_0(Vector_PxActorPtr* self) {
  return self->data();
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxActorPtr_size_0(Vector_PxActorPtr* self) {
  return self->size();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxActorPtr_push_back_1(Vector_PxActorPtr* self, physx::PxActor* value) {
  self->push_back(value);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxActorPtr_clear_0(Vector_PxActorPtr* self) {
  self->clear();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxActorPtr___destroy___0(Vector_PxActorPtr* self) {
  delete self;
}

// Interface: Vector_PxContactPairPoint


Vector_PxContactPairPoint* EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxContactPairPoint_Vector_PxContactPairPoint_0() {
  return new Vector_PxContactPairPoint();
}

Vector_PxContactPairPoint* EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxContactPairPoint_Vector_PxContactPairPoint_1(unsigned int size) {
  return new Vector_PxContactPairPoint(size);
}

physx::PxContactPairPoint* EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxContactPairPoint_at_1(Vector_PxContactPairPoint* self, unsigned int index) {
  return &self->at(index);
}

physx::PxContactPairPoint* EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxContactPairPoint_data_0(Vector_PxContactPairPoint* self) {
  return self->data();
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxContactPairPoint_size_0(Vector_PxContactPairPoint* self) {
  return self->size();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxContactPairPoint_push_back_1(Vector_PxContactPairPoint* self, physx::PxContactPairPoint* value) {
  self->push_back(*value);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxContactPairPoint_clear_0(Vector_PxContactPairPoint* self) {
  self->clear();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxContactPairPoint___destroy___0(Vector_PxContactPairPoint* self) {
  delete self;
}

// Interface: Vector_PxHeightFieldSample


Vector_PxHeightFieldSample* EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxHeightFieldSample_Vector_PxHeightFieldSample_0() {
  return new Vector_PxHeightFieldSample();
}

Vector_PxHeightFieldSample* EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxHeightFieldSample_Vector_PxHeightFieldSample_1(unsigned int size) {
  return new Vector_PxHeightFieldSample(size);
}

physx::PxHeightFieldSample* EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxHeightFieldSample_at_1(Vector_PxHeightFieldSample* self, unsigned int index) {
  return &self->at(index);
}

physx::PxHeightFieldSample* EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxHeightFieldSample_data_0(Vector_PxHeightFieldSample* self) {
  return self->data();
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxHeightFieldSample_size_0(Vector_PxHeightFieldSample* self) {
  return self->size();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxHeightFieldSample_push_back_1(Vector_PxHeightFieldSample* self, physx::PxHeightFieldSample* value) {
  self->push_back(*value);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxHeightFieldSample_clear_0(Vector_PxHeightFieldSample* self) {
  self->clear();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxHeightFieldSample___destroy___0(Vector_PxHeightFieldSample* self) {
  delete self;
}

// Interface: Vector_PxMaterialConst


Vector_PxMaterialConst* EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxMaterialConst_Vector_PxMaterialConst_0() {
  return new Vector_PxMaterialConst();
}

Vector_PxMaterialConst* EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxMaterialConst_Vector_PxMaterialConst_1(unsigned int size) {
  return new Vector_PxMaterialConst(size);
}

const physx::PxMaterial* EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxMaterialConst_at_1(Vector_PxMaterialConst* self, unsigned int index) {
  return self->at(index);
}

PxMaterialConstPtr* EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxMaterialConst_data_0(Vector_PxMaterialConst* self) {
  return self->data();
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxMaterialConst_size_0(Vector_PxMaterialConst* self) {
  return self->size();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxMaterialConst_push_back_1(Vector_PxMaterialConst* self, const physx::PxMaterial* value) {
  self->push_back(value);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxMaterialConst_clear_0(Vector_PxMaterialConst* self) {
  self->clear();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxMaterialConst___destroy___0(Vector_PxMaterialConst* self) {
  delete self;
}

// Interface: Vector_PxRaycastHit


Vector_PxRaycastHit* EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxRaycastHit_Vector_PxRaycastHit_0() {
  return new Vector_PxRaycastHit();
}

Vector_PxRaycastHit* EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxRaycastHit_Vector_PxRaycastHit_1(unsigned int size) {
  return new Vector_PxRaycastHit(size);
}

physx::PxRaycastHit* EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxRaycastHit_at_1(Vector_PxRaycastHit* self, unsigned int index) {
  return &self->at(index);
}

physx::PxRaycastHit* EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxRaycastHit_data_0(Vector_PxRaycastHit* self) {
  return self->data();
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxRaycastHit_size_0(Vector_PxRaycastHit* self) {
  return self->size();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxRaycastHit_push_back_1(Vector_PxRaycastHit* self, physx::PxRaycastHit* value) {
  self->push_back(*value);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxRaycastHit_clear_0(Vector_PxRaycastHit* self) {
  self->clear();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxRaycastHit___destroy___0(Vector_PxRaycastHit* self) {
  delete self;
}

// Interface: Vector_PxReal


Vector_PxReal* EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxReal_Vector_PxReal_0() {
  return new Vector_PxReal();
}

Vector_PxReal* EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxReal_Vector_PxReal_1(unsigned int size) {
  return new Vector_PxReal(size);
}

float EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxReal_at_1(Vector_PxReal* self, unsigned int index) {
  return self->at(index);
}

void* EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxReal_data_0(Vector_PxReal* self) {
  return self->data();
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxReal_size_0(Vector_PxReal* self) {
  return self->size();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxReal_push_back_1(Vector_PxReal* self, float value) {
  self->push_back(value);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxReal_clear_0(Vector_PxReal* self) {
  self->clear();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxReal___destroy___0(Vector_PxReal* self) {
  delete self;
}

// Interface: Vector_PxSweepHit


Vector_PxSweepHit* EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxSweepHit_Vector_PxSweepHit_0() {
  return new Vector_PxSweepHit();
}

Vector_PxSweepHit* EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxSweepHit_Vector_PxSweepHit_1(unsigned int size) {
  return new Vector_PxSweepHit(size);
}

physx::PxSweepHit* EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxSweepHit_at_1(Vector_PxSweepHit* self, unsigned int index) {
  return &self->at(index);
}

physx::PxSweepHit* EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxSweepHit_data_0(Vector_PxSweepHit* self) {
  return self->data();
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxSweepHit_size_0(Vector_PxSweepHit* self) {
  return self->size();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxSweepHit_push_back_1(Vector_PxSweepHit* self, physx::PxSweepHit* value) {
  self->push_back(*value);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxSweepHit_clear_0(Vector_PxSweepHit* self) {
  self->clear();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxSweepHit___destroy___0(Vector_PxSweepHit* self) {
  delete self;
}

// Interface: Vector_PxU16


Vector_PxU16* EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxU16_Vector_PxU16_0() {
  return new Vector_PxU16();
}

Vector_PxU16* EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxU16_Vector_PxU16_1(unsigned int size) {
  return new Vector_PxU16(size);
}

unsigned short EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxU16_at_1(Vector_PxU16* self, unsigned int index) {
  return self->at(index);
}

void* EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxU16_data_0(Vector_PxU16* self) {
  return self->data();
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxU16_size_0(Vector_PxU16* self) {
  return self->size();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxU16_push_back_1(Vector_PxU16* self, unsigned short value) {
  self->push_back(value);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxU16_clear_0(Vector_PxU16* self) {
  self->clear();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxU16___destroy___0(Vector_PxU16* self) {
  delete self;
}

// Interface: Vector_PxU32


Vector_PxU32* EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxU32_Vector_PxU32_0() {
  return new Vector_PxU32();
}

Vector_PxU32* EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxU32_Vector_PxU32_1(unsigned int size) {
  return new Vector_PxU32(size);
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxU32_at_1(Vector_PxU32* self, unsigned int index) {
  return self->at(index);
}

void* EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxU32_data_0(Vector_PxU32* self) {
  return self->data();
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxU32_size_0(Vector_PxU32* self) {
  return self->size();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxU32_push_back_1(Vector_PxU32* self, unsigned int value) {
  self->push_back(value);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxU32_clear_0(Vector_PxU32* self) {
  self->clear();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxU32___destroy___0(Vector_PxU32* self) {
  delete self;
}

// Interface: Vector_PxU8


Vector_PxU8* EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxU8_Vector_PxU8_0() {
  return new Vector_PxU8();
}

Vector_PxU8* EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxU8_Vector_PxU8_1(unsigned int size) {
  return new Vector_PxU8(size);
}

unsigned char EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxU8_at_1(Vector_PxU8* self, unsigned int index) {
  return self->at(index);
}

void* EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxU8_data_0(Vector_PxU8* self) {
  return self->data();
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxU8_size_0(Vector_PxU8* self) {
  return self->size();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxU8_push_back_1(Vector_PxU8* self, unsigned char value) {
  self->push_back(value);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxU8_clear_0(Vector_PxU8* self) {
  self->clear();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxU8___destroy___0(Vector_PxU8* self) {
  delete self;
}

// Interface: Vector_PxVec3


Vector_PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxVec3_Vector_PxVec3_0() {
  return new Vector_PxVec3();
}

Vector_PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxVec3_Vector_PxVec3_1(unsigned int size) {
  return new Vector_PxVec3(size);
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxVec3_at_1(Vector_PxVec3* self, unsigned int index) {
  return &self->at(index);
}

physx::PxVec3* EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxVec3_data_0(Vector_PxVec3* self) {
  return self->data();
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxVec3_size_0(Vector_PxVec3* self) {
  return self->size();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxVec3_push_back_1(Vector_PxVec3* self, physx::PxVec3* value) {
  self->push_back(*value);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxVec3_clear_0(Vector_PxVec3* self) {
  self->clear();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxVec3___destroy___0(Vector_PxVec3* self) {
  delete self;
}

// Interface: Vector_PxVec4


Vector_PxVec4* EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxVec4_Vector_PxVec4_0() {
  return new Vector_PxVec4();
}

Vector_PxVec4* EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxVec4_Vector_PxVec4_1(unsigned int size) {
  return new Vector_PxVec4(size);
}

physx::PxVec4* EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxVec4_at_1(Vector_PxVec4* self, unsigned int index) {
  return &self->at(index);
}

physx::PxVec4* EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxVec4_data_0(Vector_PxVec4* self) {
  return self->data();
}

unsigned int EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxVec4_size_0(Vector_PxVec4* self) {
  return self->size();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxVec4_push_back_1(Vector_PxVec4* self, physx::PxVec4* value) {
  self->push_back(*value);
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxVec4_clear_0(Vector_PxVec4* self) {
  self->clear();
}

void EMSCRIPTEN_KEEPALIVE emscripten_bind_Vector_PxVec4___destroy___0(Vector_PxVec4* self) {
  delete self;
}

// $EngineDriveVehicleEnum
EngineDriveVehicleEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_EngineDriveVehicleEnum_eDIFFTYPE_FOURWHEELDRIVE() {
  return EngineDriveVehicleEnum::eDIFFTYPE_FOURWHEELDRIVE;
}
EngineDriveVehicleEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_EngineDriveVehicleEnum_eDIFFTYPE_MULTIWHEELDRIVE() {
  return EngineDriveVehicleEnum::eDIFFTYPE_MULTIWHEELDRIVE;
}
EngineDriveVehicleEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_EngineDriveVehicleEnum_eDIFFTYPE_TANKDRIVE() {
  return EngineDriveVehicleEnum::eDIFFTYPE_TANKDRIVE;
}

// $PxActorFlagEnum
PxActorFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxActorFlagEnum_eVISUALIZATION() {
  return PxActorFlagEnum::eVISUALIZATION;
}
PxActorFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxActorFlagEnum_eDISABLE_GRAVITY() {
  return PxActorFlagEnum::eDISABLE_GRAVITY;
}
PxActorFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxActorFlagEnum_eSEND_SLEEP_NOTIFIES() {
  return PxActorFlagEnum::eSEND_SLEEP_NOTIFIES;
}
PxActorFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxActorFlagEnum_eDISABLE_SIMULATION() {
  return PxActorFlagEnum::eDISABLE_SIMULATION;
}

// $PxActorTypeEnum
PxActorTypeEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxActorTypeEnum_eRIGID_STATIC() {
  return PxActorTypeEnum::eRIGID_STATIC;
}
PxActorTypeEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxActorTypeEnum_eRIGID_DYNAMIC() {
  return PxActorTypeEnum::eRIGID_DYNAMIC;
}
PxActorTypeEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxActorTypeEnum_eARTICULATION_LINK() {
  return PxActorTypeEnum::eARTICULATION_LINK;
}
PxActorTypeEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxActorTypeEnum_eDEFORMABLE_SURFACE() {
  return PxActorTypeEnum::eDEFORMABLE_SURFACE;
}
PxActorTypeEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxActorTypeEnum_eDEFORMABLE_VOLUME() {
  return PxActorTypeEnum::eDEFORMABLE_VOLUME;
}
PxActorTypeEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxActorTypeEnum_eSOFTBODY() {
  return PxActorTypeEnum::eSOFTBODY;
}
PxActorTypeEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxActorTypeEnum_ePBD_PARTICLESYSTEM() {
  return PxActorTypeEnum::ePBD_PARTICLESYSTEM;
}

// $PxActorTypeFlagEnum
PxActorTypeFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxActorTypeFlagEnum_eRIGID_STATIC() {
  return PxActorTypeFlagEnum::eRIGID_STATIC;
}
PxActorTypeFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxActorTypeFlagEnum_eRIGID_DYNAMIC() {
  return PxActorTypeFlagEnum::eRIGID_DYNAMIC;
}

// $PxArticulationAxisEnum
PxArticulationAxisEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxArticulationAxisEnum_eTWIST() {
  return PxArticulationAxisEnum::eTWIST;
}
PxArticulationAxisEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxArticulationAxisEnum_eSWING1() {
  return PxArticulationAxisEnum::eSWING1;
}
PxArticulationAxisEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxArticulationAxisEnum_eSWING2() {
  return PxArticulationAxisEnum::eSWING2;
}
PxArticulationAxisEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxArticulationAxisEnum_eX() {
  return PxArticulationAxisEnum::eX;
}
PxArticulationAxisEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxArticulationAxisEnum_eY() {
  return PxArticulationAxisEnum::eY;
}
PxArticulationAxisEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxArticulationAxisEnum_eZ() {
  return PxArticulationAxisEnum::eZ;
}

// $PxArticulationCacheFlagEnum
PxArticulationCacheFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxArticulationCacheFlagEnum_eVELOCITY() {
  return PxArticulationCacheFlagEnum::eVELOCITY;
}
PxArticulationCacheFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxArticulationCacheFlagEnum_eACCELERATION() {
  return PxArticulationCacheFlagEnum::eACCELERATION;
}
PxArticulationCacheFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxArticulationCacheFlagEnum_ePOSITION() {
  return PxArticulationCacheFlagEnum::ePOSITION;
}
PxArticulationCacheFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxArticulationCacheFlagEnum_eFORCE() {
  return PxArticulationCacheFlagEnum::eFORCE;
}
PxArticulationCacheFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxArticulationCacheFlagEnum_eLINK_VELOCITY() {
  return PxArticulationCacheFlagEnum::eLINK_VELOCITY;
}
PxArticulationCacheFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxArticulationCacheFlagEnum_eLINK_ACCELERATION() {
  return PxArticulationCacheFlagEnum::eLINK_ACCELERATION;
}
PxArticulationCacheFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxArticulationCacheFlagEnum_eROOT_TRANSFORM() {
  return PxArticulationCacheFlagEnum::eROOT_TRANSFORM;
}
PxArticulationCacheFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxArticulationCacheFlagEnum_eROOT_VELOCITIES() {
  return PxArticulationCacheFlagEnum::eROOT_VELOCITIES;
}
PxArticulationCacheFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxArticulationCacheFlagEnum_eLINK_INCOMING_JOINT_FORCE() {
  return PxArticulationCacheFlagEnum::eLINK_INCOMING_JOINT_FORCE;
}
PxArticulationCacheFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxArticulationCacheFlagEnum_eJOINT_TARGET_POSITIONS() {
  return PxArticulationCacheFlagEnum::eJOINT_TARGET_POSITIONS;
}
PxArticulationCacheFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxArticulationCacheFlagEnum_eJOINT_TARGET_VELOCITIES() {
  return PxArticulationCacheFlagEnum::eJOINT_TARGET_VELOCITIES;
}
PxArticulationCacheFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxArticulationCacheFlagEnum_eALL() {
  return PxArticulationCacheFlagEnum::eALL;
}

// $PxArticulationDriveTypeEnum
PxArticulationDriveTypeEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxArticulationDriveTypeEnum_eFORCE() {
  return PxArticulationDriveTypeEnum::eFORCE;
}
PxArticulationDriveTypeEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxArticulationDriveTypeEnum_eACCELERATION() {
  return PxArticulationDriveTypeEnum::eACCELERATION;
}
PxArticulationDriveTypeEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxArticulationDriveTypeEnum_eNONE() {
  return PxArticulationDriveTypeEnum::eNONE;
}

// $PxArticulationFlagEnum
PxArticulationFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxArticulationFlagEnum_eFIX_BASE() {
  return PxArticulationFlagEnum::eFIX_BASE;
}
PxArticulationFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxArticulationFlagEnum_eDRIVE_LIMITS_ARE_FORCES() {
  return PxArticulationFlagEnum::eDRIVE_LIMITS_ARE_FORCES;
}
PxArticulationFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxArticulationFlagEnum_eDISABLE_SELF_COLLISION() {
  return PxArticulationFlagEnum::eDISABLE_SELF_COLLISION;
}

// $PxArticulationJointTypeEnum
PxArticulationJointTypeEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxArticulationJointTypeEnum_eFIX() {
  return PxArticulationJointTypeEnum::eFIX;
}
PxArticulationJointTypeEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxArticulationJointTypeEnum_ePRISMATIC() {
  return PxArticulationJointTypeEnum::ePRISMATIC;
}
PxArticulationJointTypeEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxArticulationJointTypeEnum_eREVOLUTE() {
  return PxArticulationJointTypeEnum::eREVOLUTE;
}
PxArticulationJointTypeEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxArticulationJointTypeEnum_eSPHERICAL() {
  return PxArticulationJointTypeEnum::eSPHERICAL;
}
PxArticulationJointTypeEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxArticulationJointTypeEnum_eUNDEFINED() {
  return PxArticulationJointTypeEnum::eUNDEFINED;
}

// $PxArticulationKinematicFlagEnum
PxArticulationKinematicFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxArticulationKinematicFlagEnum_ePOSITION() {
  return PxArticulationKinematicFlagEnum::ePOSITION;
}
PxArticulationKinematicFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxArticulationKinematicFlagEnum_eVELOCITY() {
  return PxArticulationKinematicFlagEnum::eVELOCITY;
}

// $PxArticulationMotionEnum
PxArticulationMotionEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxArticulationMotionEnum_eLOCKED() {
  return PxArticulationMotionEnum::eLOCKED;
}
PxArticulationMotionEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxArticulationMotionEnum_eLIMITED() {
  return PxArticulationMotionEnum::eLIMITED;
}
PxArticulationMotionEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxArticulationMotionEnum_eFREE() {
  return PxArticulationMotionEnum::eFREE;
}

// $PxBVHBuildStrategyEnum
PxBVHBuildStrategyEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxBVHBuildStrategyEnum_eFAST() {
  return PxBVHBuildStrategyEnum::eFAST;
}
PxBVHBuildStrategyEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxBVHBuildStrategyEnum_eDEFAULT() {
  return PxBVHBuildStrategyEnum::eDEFAULT;
}
PxBVHBuildStrategyEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxBVHBuildStrategyEnum_eSAH() {
  return PxBVHBuildStrategyEnum::eSAH;
}

// $PxBaseFlagEnum
PxBaseFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxBaseFlagEnum_eOWNS_MEMORY() {
  return PxBaseFlagEnum::eOWNS_MEMORY;
}
PxBaseFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxBaseFlagEnum_eIS_RELEASABLE() {
  return PxBaseFlagEnum::eIS_RELEASABLE;
}

// $PxBroadPhaseTypeEnum
PxBroadPhaseTypeEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxBroadPhaseTypeEnum_eSAP() {
  return PxBroadPhaseTypeEnum::eSAP;
}
PxBroadPhaseTypeEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxBroadPhaseTypeEnum_eMBP() {
  return PxBroadPhaseTypeEnum::eMBP;
}
PxBroadPhaseTypeEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxBroadPhaseTypeEnum_eABP() {
  return PxBroadPhaseTypeEnum::eABP;
}
PxBroadPhaseTypeEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxBroadPhaseTypeEnum_ePABP() {
  return PxBroadPhaseTypeEnum::ePABP;
}
PxBroadPhaseTypeEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxBroadPhaseTypeEnum_eGPU() {
  return PxBroadPhaseTypeEnum::eGPU;
}

// $PxCapsuleClimbingModeEnum
PxCapsuleClimbingModeEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxCapsuleClimbingModeEnum_eEASY() {
  return PxCapsuleClimbingModeEnum::eEASY;
}
PxCapsuleClimbingModeEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxCapsuleClimbingModeEnum_eCONSTRAINED() {
  return PxCapsuleClimbingModeEnum::eCONSTRAINED;
}

// $PxCombineModeEnum
PxCombineModeEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxCombineModeEnum_eAVERAGE() {
  return PxCombineModeEnum::eAVERAGE;
}
PxCombineModeEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxCombineModeEnum_eMIN() {
  return PxCombineModeEnum::eMIN;
}
PxCombineModeEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxCombineModeEnum_eMULTIPLY() {
  return PxCombineModeEnum::eMULTIPLY;
}
PxCombineModeEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxCombineModeEnum_eMAX() {
  return PxCombineModeEnum::eMAX;
}

// $PxConstraintFlagEnum
PxConstraintFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxConstraintFlagEnum_eBROKEN() {
  return PxConstraintFlagEnum::eBROKEN;
}
PxConstraintFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxConstraintFlagEnum_eCOLLISION_ENABLED() {
  return PxConstraintFlagEnum::eCOLLISION_ENABLED;
}
PxConstraintFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxConstraintFlagEnum_eVISUALIZATION() {
  return PxConstraintFlagEnum::eVISUALIZATION;
}
PxConstraintFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxConstraintFlagEnum_eDRIVE_LIMITS_ARE_FORCES() {
  return PxConstraintFlagEnum::eDRIVE_LIMITS_ARE_FORCES;
}
PxConstraintFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxConstraintFlagEnum_eIMPROVED_SLERP() {
  return PxConstraintFlagEnum::eIMPROVED_SLERP;
}
PxConstraintFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxConstraintFlagEnum_eDISABLE_PREPROCESSING() {
  return PxConstraintFlagEnum::eDISABLE_PREPROCESSING;
}
PxConstraintFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxConstraintFlagEnum_eENABLE_EXTENDED_LIMITS() {
  return PxConstraintFlagEnum::eENABLE_EXTENDED_LIMITS;
}
PxConstraintFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxConstraintFlagEnum_eGPU_COMPATIBLE() {
  return PxConstraintFlagEnum::eGPU_COMPATIBLE;
}
PxConstraintFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxConstraintFlagEnum_eALWAYS_UPDATE() {
  return PxConstraintFlagEnum::eALWAYS_UPDATE;
}
PxConstraintFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxConstraintFlagEnum_eDISABLE_CONSTRAINT() {
  return PxConstraintFlagEnum::eDISABLE_CONSTRAINT;
}

// $PxContactPairFlagEnum
PxContactPairFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxContactPairFlagEnum_eREMOVED_SHAPE_0() {
  return PxContactPairFlagEnum::eREMOVED_SHAPE_0;
}
PxContactPairFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxContactPairFlagEnum_eREMOVED_SHAPE_1() {
  return PxContactPairFlagEnum::eREMOVED_SHAPE_1;
}
PxContactPairFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxContactPairFlagEnum_eACTOR_PAIR_HAS_FIRST_TOUCH() {
  return PxContactPairFlagEnum::eACTOR_PAIR_HAS_FIRST_TOUCH;
}
PxContactPairFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxContactPairFlagEnum_eACTOR_PAIR_LOST_TOUCH() {
  return PxContactPairFlagEnum::eACTOR_PAIR_LOST_TOUCH;
}
PxContactPairFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxContactPairFlagEnum_eINTERNAL_HAS_IMPULSES() {
  return PxContactPairFlagEnum::eINTERNAL_HAS_IMPULSES;
}
PxContactPairFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxContactPairFlagEnum_eINTERNAL_CONTACTS_ARE_FLIPPED() {
  return PxContactPairFlagEnum::eINTERNAL_CONTACTS_ARE_FLIPPED;
}

// $PxContactPairHeaderFlagEnum
PxContactPairHeaderFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxContactPairHeaderFlagEnum_eREMOVED_ACTOR_0() {
  return PxContactPairHeaderFlagEnum::eREMOVED_ACTOR_0;
}
PxContactPairHeaderFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxContactPairHeaderFlagEnum_eREMOVED_ACTOR_1() {
  return PxContactPairHeaderFlagEnum::eREMOVED_ACTOR_1;
}

// $PxControllerBehaviorFlagEnum
PxControllerBehaviorFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxControllerBehaviorFlagEnum_eCCT_CAN_RIDE_ON_OBJECT() {
  return PxControllerBehaviorFlagEnum::eCCT_CAN_RIDE_ON_OBJECT;
}
PxControllerBehaviorFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxControllerBehaviorFlagEnum_eCCT_SLIDE() {
  return PxControllerBehaviorFlagEnum::eCCT_SLIDE;
}
PxControllerBehaviorFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxControllerBehaviorFlagEnum_eCCT_USER_DEFINED_RIDE() {
  return PxControllerBehaviorFlagEnum::eCCT_USER_DEFINED_RIDE;
}

// $PxControllerCollisionFlagEnum
PxControllerCollisionFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxControllerCollisionFlagEnum_eCOLLISION_SIDES() {
  return PxControllerCollisionFlagEnum::eCOLLISION_SIDES;
}
PxControllerCollisionFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxControllerCollisionFlagEnum_eCOLLISION_UP() {
  return PxControllerCollisionFlagEnum::eCOLLISION_UP;
}
PxControllerCollisionFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxControllerCollisionFlagEnum_eCOLLISION_DOWN() {
  return PxControllerCollisionFlagEnum::eCOLLISION_DOWN;
}

// $PxControllerNonWalkableModeEnum
PxControllerNonWalkableModeEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxControllerNonWalkableModeEnum_ePREVENT_CLIMBING() {
  return PxControllerNonWalkableModeEnum::ePREVENT_CLIMBING;
}
PxControllerNonWalkableModeEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxControllerNonWalkableModeEnum_ePREVENT_CLIMBING_AND_FORCE_SLIDING() {
  return PxControllerNonWalkableModeEnum::ePREVENT_CLIMBING_AND_FORCE_SLIDING;
}

// $PxControllerShapeTypeEnum
PxControllerShapeTypeEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxControllerShapeTypeEnum_eBOX() {
  return PxControllerShapeTypeEnum::eBOX;
}
PxControllerShapeTypeEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxControllerShapeTypeEnum_eCAPSULE() {
  return PxControllerShapeTypeEnum::eCAPSULE;
}

// $PxConvexFlagEnum
PxConvexFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxConvexFlagEnum_e16_BIT_INDICES() {
  return PxConvexFlagEnum::e16_BIT_INDICES;
}
PxConvexFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxConvexFlagEnum_eCOMPUTE_CONVEX() {
  return PxConvexFlagEnum::eCOMPUTE_CONVEX;
}
PxConvexFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxConvexFlagEnum_eCHECK_ZERO_AREA_TRIANGLES() {
  return PxConvexFlagEnum::eCHECK_ZERO_AREA_TRIANGLES;
}
PxConvexFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxConvexFlagEnum_eQUANTIZE_INPUT() {
  return PxConvexFlagEnum::eQUANTIZE_INPUT;
}
PxConvexFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxConvexFlagEnum_eDISABLE_MESH_VALIDATION() {
  return PxConvexFlagEnum::eDISABLE_MESH_VALIDATION;
}
PxConvexFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxConvexFlagEnum_ePLANE_SHIFTING() {
  return PxConvexFlagEnum::ePLANE_SHIFTING;
}
PxConvexFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxConvexFlagEnum_eFAST_INERTIA_COMPUTATION() {
  return PxConvexFlagEnum::eFAST_INERTIA_COMPUTATION;
}
PxConvexFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxConvexFlagEnum_eSHIFT_VERTICES() {
  return PxConvexFlagEnum::eSHIFT_VERTICES;
}

// $PxConvexMeshCookingTypeEnum
PxConvexMeshCookingTypeEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxConvexMeshCookingTypeEnum_eQUICKHULL() {
  return PxConvexMeshCookingTypeEnum::eQUICKHULL;
}

// $PxConvexMeshGeometryFlagEnum
PxConvexMeshGeometryFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxConvexMeshGeometryFlagEnum_eTIGHT_BOUNDS() {
  return PxConvexMeshGeometryFlagEnum::eTIGHT_BOUNDS;
}

// $PxD6AxisEnum
PxD6AxisEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxD6AxisEnum_eX() {
  return PxD6AxisEnum::eX;
}
PxD6AxisEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxD6AxisEnum_eY() {
  return PxD6AxisEnum::eY;
}
PxD6AxisEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxD6AxisEnum_eZ() {
  return PxD6AxisEnum::eZ;
}
PxD6AxisEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxD6AxisEnum_eTWIST() {
  return PxD6AxisEnum::eTWIST;
}
PxD6AxisEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxD6AxisEnum_eSWING1() {
  return PxD6AxisEnum::eSWING1;
}
PxD6AxisEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxD6AxisEnum_eSWING2() {
  return PxD6AxisEnum::eSWING2;
}

// $PxD6DriveEnum
PxD6DriveEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxD6DriveEnum_eX() {
  return PxD6DriveEnum::eX;
}
PxD6DriveEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxD6DriveEnum_eY() {
  return PxD6DriveEnum::eY;
}
PxD6DriveEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxD6DriveEnum_eZ() {
  return PxD6DriveEnum::eZ;
}
PxD6DriveEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxD6DriveEnum_eSWING() {
  return PxD6DriveEnum::eSWING;
}
PxD6DriveEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxD6DriveEnum_eTWIST() {
  return PxD6DriveEnum::eTWIST;
}
PxD6DriveEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxD6DriveEnum_eSLERP() {
  return PxD6DriveEnum::eSLERP;
}

// $PxD6JointDriveFlagEnum
PxD6JointDriveFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxD6JointDriveFlagEnum_eACCELERATION() {
  return PxD6JointDriveFlagEnum::eACCELERATION;
}

// $PxD6MotionEnum
PxD6MotionEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxD6MotionEnum_eLOCKED() {
  return PxD6MotionEnum::eLOCKED;
}
PxD6MotionEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxD6MotionEnum_eLIMITED() {
  return PxD6MotionEnum::eLIMITED;
}
PxD6MotionEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxD6MotionEnum_eFREE() {
  return PxD6MotionEnum::eFREE;
}

// $PxDebugColorEnum
PxDebugColorEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxDebugColorEnum_eARGB_BLACK() {
  return PxDebugColorEnum::eARGB_BLACK;
}
PxDebugColorEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxDebugColorEnum_eARGB_RED() {
  return PxDebugColorEnum::eARGB_RED;
}
PxDebugColorEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxDebugColorEnum_eARGB_GREEN() {
  return PxDebugColorEnum::eARGB_GREEN;
}
PxDebugColorEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxDebugColorEnum_eARGB_BLUE() {
  return PxDebugColorEnum::eARGB_BLUE;
}
PxDebugColorEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxDebugColorEnum_eARGB_YELLOW() {
  return PxDebugColorEnum::eARGB_YELLOW;
}
PxDebugColorEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxDebugColorEnum_eARGB_MAGENTA() {
  return PxDebugColorEnum::eARGB_MAGENTA;
}
PxDebugColorEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxDebugColorEnum_eARGB_CYAN() {
  return PxDebugColorEnum::eARGB_CYAN;
}
PxDebugColorEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxDebugColorEnum_eARGB_WHITE() {
  return PxDebugColorEnum::eARGB_WHITE;
}
PxDebugColorEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxDebugColorEnum_eARGB_GREY() {
  return PxDebugColorEnum::eARGB_GREY;
}
PxDebugColorEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxDebugColorEnum_eARGB_DARKRED() {
  return PxDebugColorEnum::eARGB_DARKRED;
}
PxDebugColorEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxDebugColorEnum_eARGB_DARKGREEN() {
  return PxDebugColorEnum::eARGB_DARKGREEN;
}
PxDebugColorEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxDebugColorEnum_eARGB_DARKBLUE() {
  return PxDebugColorEnum::eARGB_DARKBLUE;
}

// $PxDistanceJointFlagEnum
PxDistanceJointFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxDistanceJointFlagEnum_eMAX_DISTANCE_ENABLED() {
  return PxDistanceJointFlagEnum::eMAX_DISTANCE_ENABLED;
}
PxDistanceJointFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxDistanceJointFlagEnum_eMIN_DISTANCE_ENABLED() {
  return PxDistanceJointFlagEnum::eMIN_DISTANCE_ENABLED;
}
PxDistanceJointFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxDistanceJointFlagEnum_eSPRING_ENABLED() {
  return PxDistanceJointFlagEnum::eSPRING_ENABLED;
}

// $PxDynamicTreeSecondaryPrunerEnum
PxDynamicTreeSecondaryPrunerEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxDynamicTreeSecondaryPrunerEnum_eNONE() {
  return PxDynamicTreeSecondaryPrunerEnum::eNONE;
}
PxDynamicTreeSecondaryPrunerEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxDynamicTreeSecondaryPrunerEnum_eBUCKET() {
  return PxDynamicTreeSecondaryPrunerEnum::eBUCKET;
}
PxDynamicTreeSecondaryPrunerEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxDynamicTreeSecondaryPrunerEnum_eINCREMENTAL() {
  return PxDynamicTreeSecondaryPrunerEnum::eINCREMENTAL;
}
PxDynamicTreeSecondaryPrunerEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxDynamicTreeSecondaryPrunerEnum_eBVH() {
  return PxDynamicTreeSecondaryPrunerEnum::eBVH;
}

// $PxErrorCodeEnum
PxErrorCodeEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxErrorCodeEnum_eNO_ERROR() {
  return PxErrorCodeEnum::eNO_ERROR;
}
PxErrorCodeEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxErrorCodeEnum_eDEBUG_INFO() {
  return PxErrorCodeEnum::eDEBUG_INFO;
}
PxErrorCodeEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxErrorCodeEnum_eDEBUG_WARNING() {
  return PxErrorCodeEnum::eDEBUG_WARNING;
}
PxErrorCodeEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxErrorCodeEnum_eINVALID_PARAMETER() {
  return PxErrorCodeEnum::eINVALID_PARAMETER;
}
PxErrorCodeEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxErrorCodeEnum_eINVALID_OPERATION() {
  return PxErrorCodeEnum::eINVALID_OPERATION;
}
PxErrorCodeEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxErrorCodeEnum_eOUT_OF_MEMORY() {
  return PxErrorCodeEnum::eOUT_OF_MEMORY;
}
PxErrorCodeEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxErrorCodeEnum_eINTERNAL_ERROR() {
  return PxErrorCodeEnum::eINTERNAL_ERROR;
}
PxErrorCodeEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxErrorCodeEnum_eABORT() {
  return PxErrorCodeEnum::eABORT;
}
PxErrorCodeEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxErrorCodeEnum_ePERF_WARNING() {
  return PxErrorCodeEnum::ePERF_WARNING;
}
PxErrorCodeEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxErrorCodeEnum_eMASK_ALL() {
  return PxErrorCodeEnum::eMASK_ALL;
}

// $PxFilterFlagEnum
PxFilterFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxFilterFlagEnum_eKILL() {
  return PxFilterFlagEnum::eKILL;
}
PxFilterFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxFilterFlagEnum_eSUPPRESS() {
  return PxFilterFlagEnum::eSUPPRESS;
}
PxFilterFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxFilterFlagEnum_eCALLBACK() {
  return PxFilterFlagEnum::eCALLBACK;
}
PxFilterFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxFilterFlagEnum_eNOTIFY() {
  return PxFilterFlagEnum::eNOTIFY;
}
PxFilterFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxFilterFlagEnum_eDEFAULT() {
  return PxFilterFlagEnum::eDEFAULT;
}

// $PxFilterObjectFlagEnum
PxFilterObjectFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxFilterObjectFlagEnum_eKINEMATIC() {
  return PxFilterObjectFlagEnum::eKINEMATIC;
}
PxFilterObjectFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxFilterObjectFlagEnum_eTRIGGER() {
  return PxFilterObjectFlagEnum::eTRIGGER;
}

// $PxForceModeEnum
PxForceModeEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxForceModeEnum_eFORCE() {
  return PxForceModeEnum::eFORCE;
}
PxForceModeEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxForceModeEnum_eIMPULSE() {
  return PxForceModeEnum::eIMPULSE;
}
PxForceModeEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxForceModeEnum_eVELOCITY_CHANGE() {
  return PxForceModeEnum::eVELOCITY_CHANGE;
}
PxForceModeEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxForceModeEnum_eACCELERATION() {
  return PxForceModeEnum::eACCELERATION;
}

// $PxFrictionTypeEnum
PxFrictionTypeEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxFrictionTypeEnum_ePATCH() {
  return PxFrictionTypeEnum::ePATCH;
}
PxFrictionTypeEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxFrictionTypeEnum_eFRICTION_COUNT() {
  return PxFrictionTypeEnum::eFRICTION_COUNT;
}

// $PxGeometryTypeEnum
PxGeometryTypeEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxGeometryTypeEnum_eSPHERE() {
  return PxGeometryTypeEnum::eSPHERE;
}
PxGeometryTypeEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxGeometryTypeEnum_ePLANE() {
  return PxGeometryTypeEnum::ePLANE;
}
PxGeometryTypeEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxGeometryTypeEnum_eCAPSULE() {
  return PxGeometryTypeEnum::eCAPSULE;
}
PxGeometryTypeEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxGeometryTypeEnum_eBOX() {
  return PxGeometryTypeEnum::eBOX;
}
PxGeometryTypeEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxGeometryTypeEnum_eCONVEXMESH() {
  return PxGeometryTypeEnum::eCONVEXMESH;
}
PxGeometryTypeEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxGeometryTypeEnum_eTRIANGLEMESH() {
  return PxGeometryTypeEnum::eTRIANGLEMESH;
}
PxGeometryTypeEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxGeometryTypeEnum_eHEIGHTFIELD() {
  return PxGeometryTypeEnum::eHEIGHTFIELD;
}
PxGeometryTypeEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxGeometryTypeEnum_eCUSTOM() {
  return PxGeometryTypeEnum::eCUSTOM;
}

// $PxHeightFieldFlagEnum
PxHeightFieldFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxHeightFieldFlagEnum_eNO_BOUNDARY_EDGES() {
  return PxHeightFieldFlagEnum::eNO_BOUNDARY_EDGES;
}

// $PxHeightFieldFormatEnum
PxHeightFieldFormatEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxHeightFieldFormatEnum_eS16_TM() {
  return PxHeightFieldFormatEnum::eS16_TM;
}

// $PxHitFlagEnum
PxHitFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxHitFlagEnum_ePOSITION() {
  return PxHitFlagEnum::ePOSITION;
}
PxHitFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxHitFlagEnum_eNORMAL() {
  return PxHitFlagEnum::eNORMAL;
}
PxHitFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxHitFlagEnum_eUV() {
  return PxHitFlagEnum::eUV;
}
PxHitFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxHitFlagEnum_eASSUME_NO_INITIAL_OVERLAP() {
  return PxHitFlagEnum::eASSUME_NO_INITIAL_OVERLAP;
}
PxHitFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxHitFlagEnum_eANY_HIT() {
  return PxHitFlagEnum::eANY_HIT;
}
PxHitFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxHitFlagEnum_eMESH_MULTIPLE() {
  return PxHitFlagEnum::eMESH_MULTIPLE;
}
PxHitFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxHitFlagEnum_eMESH_BOTH_SIDES() {
  return PxHitFlagEnum::eMESH_BOTH_SIDES;
}
PxHitFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxHitFlagEnum_ePRECISE_SWEEP() {
  return PxHitFlagEnum::ePRECISE_SWEEP;
}
PxHitFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxHitFlagEnum_eMTD() {
  return PxHitFlagEnum::eMTD;
}
PxHitFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxHitFlagEnum_eFACE_INDEX() {
  return PxHitFlagEnum::eFACE_INDEX;
}
PxHitFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxHitFlagEnum_eDEFAULT() {
  return PxHitFlagEnum::eDEFAULT;
}
PxHitFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxHitFlagEnum_eMODIFIABLE_FLAGS() {
  return PxHitFlagEnum::eMODIFIABLE_FLAGS;
}

// $PxIDENTITYEnum
PxIDENTITYEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxIDENTITYEnum_PxIdentity() {
  return PxIDENTITYEnum::PxIdentity;
}

// $PxJointActorIndexEnum
PxJointActorIndexEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxJointActorIndexEnum_eACTOR0() {
  return PxJointActorIndexEnum::eACTOR0;
}
PxJointActorIndexEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxJointActorIndexEnum_eACTOR1() {
  return PxJointActorIndexEnum::eACTOR1;
}

// $PxMaterialFlagEnum
PxMaterialFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxMaterialFlagEnum_eDISABLE_FRICTION() {
  return PxMaterialFlagEnum::eDISABLE_FRICTION;
}
PxMaterialFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxMaterialFlagEnum_eDISABLE_STRONG_FRICTION() {
  return PxMaterialFlagEnum::eDISABLE_STRONG_FRICTION;
}
PxMaterialFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxMaterialFlagEnum_eCOMPLIANT_ACCELERATION_SPRING() {
  return PxMaterialFlagEnum::eCOMPLIANT_ACCELERATION_SPRING;
}

// $PxMeshCookingHintEnum
PxMeshCookingHintEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxMeshCookingHintEnum_eSIM_PERFORMANCE() {
  return PxMeshCookingHintEnum::eSIM_PERFORMANCE;
}
PxMeshCookingHintEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxMeshCookingHintEnum_eCOOKING_PERFORMANCE() {
  return PxMeshCookingHintEnum::eCOOKING_PERFORMANCE;
}

// $PxMeshFlagEnum
PxMeshFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxMeshFlagEnum_eFLIPNORMALS() {
  return PxMeshFlagEnum::eFLIPNORMALS;
}
PxMeshFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxMeshFlagEnum_e16_BIT_INDICES() {
  return PxMeshFlagEnum::e16_BIT_INDICES;
}

// $PxMeshGeometryFlagEnum
PxMeshGeometryFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxMeshGeometryFlagEnum_eDOUBLE_SIDED() {
  return PxMeshGeometryFlagEnum::eDOUBLE_SIDED;
}

// $PxMeshMidPhaseEnum
PxMeshMidPhaseEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxMeshMidPhaseEnum_eBVH33() {
  return PxMeshMidPhaseEnum::eBVH33;
}
PxMeshMidPhaseEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxMeshMidPhaseEnum_eBVH34() {
  return PxMeshMidPhaseEnum::eBVH34;
}

// $PxMeshPreprocessingFlagEnum
PxMeshPreprocessingFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxMeshPreprocessingFlagEnum_eWELD_VERTICES() {
  return PxMeshPreprocessingFlagEnum::eWELD_VERTICES;
}
PxMeshPreprocessingFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxMeshPreprocessingFlagEnum_eDISABLE_CLEAN_MESH() {
  return PxMeshPreprocessingFlagEnum::eDISABLE_CLEAN_MESH;
}
PxMeshPreprocessingFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxMeshPreprocessingFlagEnum_eDISABLE_ACTIVE_EDGES_PRECOMPUTE() {
  return PxMeshPreprocessingFlagEnum::eDISABLE_ACTIVE_EDGES_PRECOMPUTE;
}
PxMeshPreprocessingFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxMeshPreprocessingFlagEnum_eFORCE_32BIT_INDICES() {
  return PxMeshPreprocessingFlagEnum::eFORCE_32BIT_INDICES;
}

// $PxPairFilteringModeEnum
PxPairFilteringModeEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxPairFilteringModeEnum_eKEEP() {
  return PxPairFilteringModeEnum::eKEEP;
}
PxPairFilteringModeEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxPairFilteringModeEnum_eSUPPRESS() {
  return PxPairFilteringModeEnum::eSUPPRESS;
}
PxPairFilteringModeEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxPairFilteringModeEnum_eKILL() {
  return PxPairFilteringModeEnum::eKILL;
}
PxPairFilteringModeEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxPairFilteringModeEnum_eDEFAULT() {
  return PxPairFilteringModeEnum::eDEFAULT;
}

// $PxPairFlagEnum
PxPairFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxPairFlagEnum_eSOLVE_CONTACT() {
  return PxPairFlagEnum::eSOLVE_CONTACT;
}
PxPairFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxPairFlagEnum_eMODIFY_CONTACTS() {
  return PxPairFlagEnum::eMODIFY_CONTACTS;
}
PxPairFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxPairFlagEnum_eNOTIFY_TOUCH_FOUND() {
  return PxPairFlagEnum::eNOTIFY_TOUCH_FOUND;
}
PxPairFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxPairFlagEnum_eNOTIFY_TOUCH_PERSISTS() {
  return PxPairFlagEnum::eNOTIFY_TOUCH_PERSISTS;
}
PxPairFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxPairFlagEnum_eNOTIFY_TOUCH_LOST() {
  return PxPairFlagEnum::eNOTIFY_TOUCH_LOST;
}
PxPairFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxPairFlagEnum_eNOTIFY_TOUCH_CCD() {
  return PxPairFlagEnum::eNOTIFY_TOUCH_CCD;
}
PxPairFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxPairFlagEnum_eNOTIFY_THRESHOLD_FORCE_FOUND() {
  return PxPairFlagEnum::eNOTIFY_THRESHOLD_FORCE_FOUND;
}
PxPairFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxPairFlagEnum_eNOTIFY_THRESHOLD_FORCE_PERSISTS() {
  return PxPairFlagEnum::eNOTIFY_THRESHOLD_FORCE_PERSISTS;
}
PxPairFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxPairFlagEnum_eNOTIFY_THRESHOLD_FORCE_LOST() {
  return PxPairFlagEnum::eNOTIFY_THRESHOLD_FORCE_LOST;
}
PxPairFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxPairFlagEnum_eNOTIFY_CONTACT_POINTS() {
  return PxPairFlagEnum::eNOTIFY_CONTACT_POINTS;
}
PxPairFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxPairFlagEnum_eDETECT_DISCRETE_CONTACT() {
  return PxPairFlagEnum::eDETECT_DISCRETE_CONTACT;
}
PxPairFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxPairFlagEnum_eDETECT_CCD_CONTACT() {
  return PxPairFlagEnum::eDETECT_CCD_CONTACT;
}
PxPairFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxPairFlagEnum_ePRE_SOLVER_VELOCITY() {
  return PxPairFlagEnum::ePRE_SOLVER_VELOCITY;
}
PxPairFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxPairFlagEnum_ePOST_SOLVER_VELOCITY() {
  return PxPairFlagEnum::ePOST_SOLVER_VELOCITY;
}
PxPairFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxPairFlagEnum_eCONTACT_EVENT_POSE() {
  return PxPairFlagEnum::eCONTACT_EVENT_POSE;
}
PxPairFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxPairFlagEnum_eNEXT_FREE() {
  return PxPairFlagEnum::eNEXT_FREE;
}
PxPairFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxPairFlagEnum_eCONTACT_DEFAULT() {
  return PxPairFlagEnum::eCONTACT_DEFAULT;
}
PxPairFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxPairFlagEnum_eTRIGGER_DEFAULT() {
  return PxPairFlagEnum::eTRIGGER_DEFAULT;
}

// $PxPrismaticJointFlagEnum
PxPrismaticJointFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxPrismaticJointFlagEnum_eLIMIT_ENABLED() {
  return PxPrismaticJointFlagEnum::eLIMIT_ENABLED;
}

// $PxPruningStructureTypeEnum
PxPruningStructureTypeEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxPruningStructureTypeEnum_eNONE() {
  return PxPruningStructureTypeEnum::eNONE;
}
PxPruningStructureTypeEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxPruningStructureTypeEnum_eDYNAMIC_AABB_TREE() {
  return PxPruningStructureTypeEnum::eDYNAMIC_AABB_TREE;
}
PxPruningStructureTypeEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxPruningStructureTypeEnum_eSTATIC_AABB_TREE() {
  return PxPruningStructureTypeEnum::eSTATIC_AABB_TREE;
}

// $PxPvdInstrumentationFlagEnum
PxPvdInstrumentationFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxPvdInstrumentationFlagEnum_eDEBUG() {
  return PxPvdInstrumentationFlagEnum::eDEBUG;
}
PxPvdInstrumentationFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxPvdInstrumentationFlagEnum_ePROFILE() {
  return PxPvdInstrumentationFlagEnum::ePROFILE;
}
PxPvdInstrumentationFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxPvdInstrumentationFlagEnum_eMEMORY() {
  return PxPvdInstrumentationFlagEnum::eMEMORY;
}
PxPvdInstrumentationFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxPvdInstrumentationFlagEnum_eALL() {
  return PxPvdInstrumentationFlagEnum::eALL;
}

// $PxQueryFlagEnum
PxQueryFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxQueryFlagEnum_eSTATIC() {
  return PxQueryFlagEnum::eSTATIC;
}
PxQueryFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxQueryFlagEnum_eDYNAMIC() {
  return PxQueryFlagEnum::eDYNAMIC;
}
PxQueryFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxQueryFlagEnum_ePREFILTER() {
  return PxQueryFlagEnum::ePREFILTER;
}
PxQueryFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxQueryFlagEnum_ePOSTFILTER() {
  return PxQueryFlagEnum::ePOSTFILTER;
}
PxQueryFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxQueryFlagEnum_eANY_HIT() {
  return PxQueryFlagEnum::eANY_HIT;
}
PxQueryFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxQueryFlagEnum_eNO_BLOCK() {
  return PxQueryFlagEnum::eNO_BLOCK;
}

// $PxQueryHitType
PxQueryHitType EMSCRIPTEN_KEEPALIVE emscripten_enum_PxQueryHitType_eNONE() {
  return PxQueryHitType::eNONE;
}
PxQueryHitType EMSCRIPTEN_KEEPALIVE emscripten_enum_PxQueryHitType_eBLOCK() {
  return PxQueryHitType::eBLOCK;
}
PxQueryHitType EMSCRIPTEN_KEEPALIVE emscripten_enum_PxQueryHitType_eTOUCH() {
  return PxQueryHitType::eTOUCH;
}

// $PxRevoluteJointFlagEnum
PxRevoluteJointFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxRevoluteJointFlagEnum_eLIMIT_ENABLED() {
  return PxRevoluteJointFlagEnum::eLIMIT_ENABLED;
}
PxRevoluteJointFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxRevoluteJointFlagEnum_eDRIVE_ENABLED() {
  return PxRevoluteJointFlagEnum::eDRIVE_ENABLED;
}
PxRevoluteJointFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxRevoluteJointFlagEnum_eDRIVE_FREESPIN() {
  return PxRevoluteJointFlagEnum::eDRIVE_FREESPIN;
}

// $PxRigidBodyFlagEnum
PxRigidBodyFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxRigidBodyFlagEnum_eKINEMATIC() {
  return PxRigidBodyFlagEnum::eKINEMATIC;
}
PxRigidBodyFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxRigidBodyFlagEnum_eUSE_KINEMATIC_TARGET_FOR_SCENE_QUERIES() {
  return PxRigidBodyFlagEnum::eUSE_KINEMATIC_TARGET_FOR_SCENE_QUERIES;
}
PxRigidBodyFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxRigidBodyFlagEnum_eENABLE_CCD() {
  return PxRigidBodyFlagEnum::eENABLE_CCD;
}
PxRigidBodyFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxRigidBodyFlagEnum_eENABLE_CCD_FRICTION() {
  return PxRigidBodyFlagEnum::eENABLE_CCD_FRICTION;
}
PxRigidBodyFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxRigidBodyFlagEnum_eENABLE_POSE_INTEGRATION_PREVIEW() {
  return PxRigidBodyFlagEnum::eENABLE_POSE_INTEGRATION_PREVIEW;
}
PxRigidBodyFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxRigidBodyFlagEnum_eENABLE_SPECULATIVE_CCD() {
  return PxRigidBodyFlagEnum::eENABLE_SPECULATIVE_CCD;
}
PxRigidBodyFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxRigidBodyFlagEnum_eENABLE_CCD_MAX_CONTACT_IMPULSE() {
  return PxRigidBodyFlagEnum::eENABLE_CCD_MAX_CONTACT_IMPULSE;
}
PxRigidBodyFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxRigidBodyFlagEnum_eRETAIN_ACCELERATIONS() {
  return PxRigidBodyFlagEnum::eRETAIN_ACCELERATIONS;
}

// $PxRigidDynamicLockFlagEnum
PxRigidDynamicLockFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxRigidDynamicLockFlagEnum_eLOCK_LINEAR_X() {
  return PxRigidDynamicLockFlagEnum::eLOCK_LINEAR_X;
}
PxRigidDynamicLockFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxRigidDynamicLockFlagEnum_eLOCK_LINEAR_Y() {
  return PxRigidDynamicLockFlagEnum::eLOCK_LINEAR_Y;
}
PxRigidDynamicLockFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxRigidDynamicLockFlagEnum_eLOCK_LINEAR_Z() {
  return PxRigidDynamicLockFlagEnum::eLOCK_LINEAR_Z;
}
PxRigidDynamicLockFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxRigidDynamicLockFlagEnum_eLOCK_ANGULAR_X() {
  return PxRigidDynamicLockFlagEnum::eLOCK_ANGULAR_X;
}
PxRigidDynamicLockFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxRigidDynamicLockFlagEnum_eLOCK_ANGULAR_Y() {
  return PxRigidDynamicLockFlagEnum::eLOCK_ANGULAR_Y;
}
PxRigidDynamicLockFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxRigidDynamicLockFlagEnum_eLOCK_ANGULAR_Z() {
  return PxRigidDynamicLockFlagEnum::eLOCK_ANGULAR_Z;
}

// $PxSceneFlagEnum
PxSceneFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxSceneFlagEnum_eENABLE_ACTIVE_ACTORS() {
  return PxSceneFlagEnum::eENABLE_ACTIVE_ACTORS;
}
PxSceneFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxSceneFlagEnum_eENABLE_CCD() {
  return PxSceneFlagEnum::eENABLE_CCD;
}
PxSceneFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxSceneFlagEnum_eDISABLE_CCD_RESWEEP() {
  return PxSceneFlagEnum::eDISABLE_CCD_RESWEEP;
}
PxSceneFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxSceneFlagEnum_eENABLE_PCM() {
  return PxSceneFlagEnum::eENABLE_PCM;
}
PxSceneFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxSceneFlagEnum_eDISABLE_CONTACT_REPORT_BUFFER_RESIZE() {
  return PxSceneFlagEnum::eDISABLE_CONTACT_REPORT_BUFFER_RESIZE;
}
PxSceneFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxSceneFlagEnum_eDISABLE_CONTACT_CACHE() {
  return PxSceneFlagEnum::eDISABLE_CONTACT_CACHE;
}
PxSceneFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxSceneFlagEnum_eREQUIRE_RW_LOCK() {
  return PxSceneFlagEnum::eREQUIRE_RW_LOCK;
}
PxSceneFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxSceneFlagEnum_eENABLE_STABILIZATION() {
  return PxSceneFlagEnum::eENABLE_STABILIZATION;
}
PxSceneFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxSceneFlagEnum_eENABLE_AVERAGE_POINT() {
  return PxSceneFlagEnum::eENABLE_AVERAGE_POINT;
}
PxSceneFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxSceneFlagEnum_eEXCLUDE_KINEMATICS_FROM_ACTIVE_ACTORS() {
  return PxSceneFlagEnum::eEXCLUDE_KINEMATICS_FROM_ACTIVE_ACTORS;
}
PxSceneFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxSceneFlagEnum_eENABLE_GPU_DYNAMICS() {
  return PxSceneFlagEnum::eENABLE_GPU_DYNAMICS;
}
PxSceneFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxSceneFlagEnum_eENABLE_ENHANCED_DETERMINISM() {
  return PxSceneFlagEnum::eENABLE_ENHANCED_DETERMINISM;
}
PxSceneFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxSceneFlagEnum_eENABLE_FRICTION_EVERY_ITERATION() {
  return PxSceneFlagEnum::eENABLE_FRICTION_EVERY_ITERATION;
}
PxSceneFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxSceneFlagEnum_eENABLE_DIRECT_GPU_API() {
  return PxSceneFlagEnum::eENABLE_DIRECT_GPU_API;
}
PxSceneFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxSceneFlagEnum_eMUTABLE_FLAGS() {
  return PxSceneFlagEnum::eMUTABLE_FLAGS;
}

// $PxSceneQueryUpdateModeEnum
PxSceneQueryUpdateModeEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxSceneQueryUpdateModeEnum_eBUILD_ENABLED_COMMIT_ENABLED() {
  return PxSceneQueryUpdateModeEnum::eBUILD_ENABLED_COMMIT_ENABLED;
}
PxSceneQueryUpdateModeEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxSceneQueryUpdateModeEnum_eBUILD_ENABLED_COMMIT_DISABLED() {
  return PxSceneQueryUpdateModeEnum::eBUILD_ENABLED_COMMIT_DISABLED;
}
PxSceneQueryUpdateModeEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxSceneQueryUpdateModeEnum_eBUILD_DISABLED_COMMIT_DISABLED() {
  return PxSceneQueryUpdateModeEnum::eBUILD_DISABLED_COMMIT_DISABLED;
}

// $PxShapeFlagEnum
PxShapeFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxShapeFlagEnum_eSIMULATION_SHAPE() {
  return PxShapeFlagEnum::eSIMULATION_SHAPE;
}
PxShapeFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxShapeFlagEnum_eSCENE_QUERY_SHAPE() {
  return PxShapeFlagEnum::eSCENE_QUERY_SHAPE;
}
PxShapeFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxShapeFlagEnum_eTRIGGER_SHAPE() {
  return PxShapeFlagEnum::eTRIGGER_SHAPE;
}
PxShapeFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxShapeFlagEnum_eVISUALIZATION() {
  return PxShapeFlagEnum::eVISUALIZATION;
}

// $PxSolverTypeEnum
PxSolverTypeEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxSolverTypeEnum_ePGS() {
  return PxSolverTypeEnum::ePGS;
}
PxSolverTypeEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxSolverTypeEnum_eTGS() {
  return PxSolverTypeEnum::eTGS;
}

// $PxSphericalJointFlagEnum
PxSphericalJointFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxSphericalJointFlagEnum_eLIMIT_ENABLED() {
  return PxSphericalJointFlagEnum::eLIMIT_ENABLED;
}

// $PxTetrahedronMeshAnalysisResultEnum
PxTetrahedronMeshAnalysisResultEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxTetrahedronMeshAnalysisResultEnum_eVALID() {
  return PxTetrahedronMeshAnalysisResultEnum::eVALID;
}
PxTetrahedronMeshAnalysisResultEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxTetrahedronMeshAnalysisResultEnum_eDEGENERATE_TETRAHEDRON() {
  return PxTetrahedronMeshAnalysisResultEnum::eDEGENERATE_TETRAHEDRON;
}
PxTetrahedronMeshAnalysisResultEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxTetrahedronMeshAnalysisResultEnum_eMESH_IS_PROBLEMATIC() {
  return PxTetrahedronMeshAnalysisResultEnum::eMESH_IS_PROBLEMATIC;
}
PxTetrahedronMeshAnalysisResultEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxTetrahedronMeshAnalysisResultEnum_eMESH_IS_INVALID() {
  return PxTetrahedronMeshAnalysisResultEnum::eMESH_IS_INVALID;
}

// $PxTetrahedronMeshFlagEnum
PxTetrahedronMeshFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxTetrahedronMeshFlagEnum_e16_BIT_INDICES() {
  return PxTetrahedronMeshFlagEnum::e16_BIT_INDICES;
}

// $PxTetrahedronMeshFormatEnum
PxTetrahedronMeshFormatEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxTetrahedronMeshFormatEnum_eTET_MESH() {
  return PxTetrahedronMeshFormatEnum::eTET_MESH;
}
PxTetrahedronMeshFormatEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxTetrahedronMeshFormatEnum_eHEX_MESH() {
  return PxTetrahedronMeshFormatEnum::eHEX_MESH;
}

// $PxTriangleMeshAnalysisResultEnum
PxTriangleMeshAnalysisResultEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxTriangleMeshAnalysisResultEnum_eVALID() {
  return PxTriangleMeshAnalysisResultEnum::eVALID;
}
PxTriangleMeshAnalysisResultEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxTriangleMeshAnalysisResultEnum_eZERO_VOLUME() {
  return PxTriangleMeshAnalysisResultEnum::eZERO_VOLUME;
}
PxTriangleMeshAnalysisResultEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxTriangleMeshAnalysisResultEnum_eOPEN_BOUNDARIES() {
  return PxTriangleMeshAnalysisResultEnum::eOPEN_BOUNDARIES;
}
PxTriangleMeshAnalysisResultEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxTriangleMeshAnalysisResultEnum_eSELF_INTERSECTIONS() {
  return PxTriangleMeshAnalysisResultEnum::eSELF_INTERSECTIONS;
}
PxTriangleMeshAnalysisResultEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxTriangleMeshAnalysisResultEnum_eINCONSISTENT_TRIANGLE_ORIENTATION() {
  return PxTriangleMeshAnalysisResultEnum::eINCONSISTENT_TRIANGLE_ORIENTATION;
}
PxTriangleMeshAnalysisResultEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxTriangleMeshAnalysisResultEnum_eCONTAINS_ACUTE_ANGLED_TRIANGLES() {
  return PxTriangleMeshAnalysisResultEnum::eCONTAINS_ACUTE_ANGLED_TRIANGLES;
}
PxTriangleMeshAnalysisResultEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxTriangleMeshAnalysisResultEnum_eEDGE_SHARED_BY_MORE_THAN_TWO_TRIANGLES() {
  return PxTriangleMeshAnalysisResultEnum::eEDGE_SHARED_BY_MORE_THAN_TWO_TRIANGLES;
}
PxTriangleMeshAnalysisResultEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxTriangleMeshAnalysisResultEnum_eCONTAINS_DUPLICATE_POINTS() {
  return PxTriangleMeshAnalysisResultEnum::eCONTAINS_DUPLICATE_POINTS;
}
PxTriangleMeshAnalysisResultEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxTriangleMeshAnalysisResultEnum_eCONTAINS_INVALID_POINTS() {
  return PxTriangleMeshAnalysisResultEnum::eCONTAINS_INVALID_POINTS;
}
PxTriangleMeshAnalysisResultEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxTriangleMeshAnalysisResultEnum_eREQUIRES_32BIT_INDEX_BUFFER() {
  return PxTriangleMeshAnalysisResultEnum::eREQUIRES_32BIT_INDEX_BUFFER;
}
PxTriangleMeshAnalysisResultEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxTriangleMeshAnalysisResultEnum_eTRIANGLE_INDEX_OUT_OF_RANGE() {
  return PxTriangleMeshAnalysisResultEnum::eTRIANGLE_INDEX_OUT_OF_RANGE;
}
PxTriangleMeshAnalysisResultEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxTriangleMeshAnalysisResultEnum_eMESH_IS_PROBLEMATIC() {
  return PxTriangleMeshAnalysisResultEnum::eMESH_IS_PROBLEMATIC;
}
PxTriangleMeshAnalysisResultEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxTriangleMeshAnalysisResultEnum_eMESH_IS_INVALID() {
  return PxTriangleMeshAnalysisResultEnum::eMESH_IS_INVALID;
}

// $PxTriangleMeshFlagEnum
PxTriangleMeshFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxTriangleMeshFlagEnum_e16_BIT_INDICES() {
  return PxTriangleMeshFlagEnum::e16_BIT_INDICES;
}
PxTriangleMeshFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxTriangleMeshFlagEnum_eADJACENCY_INFO() {
  return PxTriangleMeshFlagEnum::eADJACENCY_INFO;
}

// $PxTriggerPairFlagEnum
PxTriggerPairFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxTriggerPairFlagEnum_eREMOVED_SHAPE_TRIGGER() {
  return PxTriggerPairFlagEnum::eREMOVED_SHAPE_TRIGGER;
}
PxTriggerPairFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxTriggerPairFlagEnum_eREMOVED_SHAPE_OTHER() {
  return PxTriggerPairFlagEnum::eREMOVED_SHAPE_OTHER;
}
PxTriggerPairFlagEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxTriggerPairFlagEnum_eNEXT_FREE() {
  return PxTriggerPairFlagEnum::eNEXT_FREE;
}

// $PxVehicleAxesEnum
PxVehicleAxesEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxVehicleAxesEnum_ePosX() {
  return PxVehicleAxesEnum::ePosX;
}
PxVehicleAxesEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxVehicleAxesEnum_eNegX() {
  return PxVehicleAxesEnum::eNegX;
}
PxVehicleAxesEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxVehicleAxesEnum_ePosY() {
  return PxVehicleAxesEnum::ePosY;
}
PxVehicleAxesEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxVehicleAxesEnum_eNegY() {
  return PxVehicleAxesEnum::eNegY;
}
PxVehicleAxesEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxVehicleAxesEnum_ePosZ() {
  return PxVehicleAxesEnum::ePosZ;
}
PxVehicleAxesEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxVehicleAxesEnum_eNegZ() {
  return PxVehicleAxesEnum::eNegZ;
}

// $PxVehicleClutchAccuracyModeEnum
PxVehicleClutchAccuracyModeEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxVehicleClutchAccuracyModeEnum_eESTIMATE() {
  return PxVehicleClutchAccuracyModeEnum::eESTIMATE;
}
PxVehicleClutchAccuracyModeEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxVehicleClutchAccuracyModeEnum_eBEST_POSSIBLE() {
  return PxVehicleClutchAccuracyModeEnum::eBEST_POSSIBLE;
}

// $PxVehicleCommandNonLinearResponseParamsEnum
PxVehicleCommandNonLinearResponseParamsEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxVehicleCommandNonLinearResponseParamsEnum_eMAX_NB_COMMAND_VALUES() {
  return PxVehicleCommandNonLinearResponseParamsEnum::eMAX_NB_COMMAND_VALUES;
}

// $PxVehicleCommandValueResponseTableEnum
PxVehicleCommandValueResponseTableEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxVehicleCommandValueResponseTableEnum_eMAX_NB_SPEED_RESPONSES() {
  return PxVehicleCommandValueResponseTableEnum::eMAX_NB_SPEED_RESPONSES;
}

// $PxVehicleDirectDriveTransmissionCommandStateEnum
PxVehicleDirectDriveTransmissionCommandStateEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxVehicleDirectDriveTransmissionCommandStateEnum_eREVERSE() {
  return PxVehicleDirectDriveTransmissionCommandStateEnum::eREVERSE;
}
PxVehicleDirectDriveTransmissionCommandStateEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxVehicleDirectDriveTransmissionCommandStateEnum_eNEUTRAL() {
  return PxVehicleDirectDriveTransmissionCommandStateEnum::eNEUTRAL;
}
PxVehicleDirectDriveTransmissionCommandStateEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxVehicleDirectDriveTransmissionCommandStateEnum_eFORWARD() {
  return PxVehicleDirectDriveTransmissionCommandStateEnum::eFORWARD;
}

// $PxVehicleEngineDriveTransmissionCommandStateEnum
PxVehicleEngineDriveTransmissionCommandStateEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxVehicleEngineDriveTransmissionCommandStateEnum_eAUTOMATIC_GEAR() {
  return PxVehicleEngineDriveTransmissionCommandStateEnum::eAUTOMATIC_GEAR;
}

// $PxVehicleGearboxParamsEnum
PxVehicleGearboxParamsEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxVehicleGearboxParamsEnum_eMAX_NB_GEARS() {
  return PxVehicleGearboxParamsEnum::eMAX_NB_GEARS;
}

// $PxVehicleLimitsEnum
PxVehicleLimitsEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxVehicleLimitsEnum_eMAX_NB_WHEELS() {
  return PxVehicleLimitsEnum::eMAX_NB_WHEELS;
}
PxVehicleLimitsEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxVehicleLimitsEnum_eMAX_NB_AXLES() {
  return PxVehicleLimitsEnum::eMAX_NB_AXLES;
}

// $PxVehiclePhysXActorUpdateModeEnum
PxVehiclePhysXActorUpdateModeEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxVehiclePhysXActorUpdateModeEnum_eAPPLY_VELOCITY() {
  return PxVehiclePhysXActorUpdateModeEnum::eAPPLY_VELOCITY;
}
PxVehiclePhysXActorUpdateModeEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxVehiclePhysXActorUpdateModeEnum_eAPPLY_ACCELERATION() {
  return PxVehiclePhysXActorUpdateModeEnum::eAPPLY_ACCELERATION;
}

// $PxVehiclePhysXConstraintLimitsEnum
PxVehiclePhysXConstraintLimitsEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxVehiclePhysXConstraintLimitsEnum_eNB_DOFS_PER_PXCONSTRAINT() {
  return PxVehiclePhysXConstraintLimitsEnum::eNB_DOFS_PER_PXCONSTRAINT;
}
PxVehiclePhysXConstraintLimitsEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxVehiclePhysXConstraintLimitsEnum_eNB_DOFS_PER_WHEEL() {
  return PxVehiclePhysXConstraintLimitsEnum::eNB_DOFS_PER_WHEEL;
}
PxVehiclePhysXConstraintLimitsEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxVehiclePhysXConstraintLimitsEnum_eNB_WHEELS_PER_PXCONSTRAINT() {
  return PxVehiclePhysXConstraintLimitsEnum::eNB_WHEELS_PER_PXCONSTRAINT;
}
PxVehiclePhysXConstraintLimitsEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxVehiclePhysXConstraintLimitsEnum_eNB_CONSTRAINTS_PER_VEHICLE() {
  return PxVehiclePhysXConstraintLimitsEnum::eNB_CONSTRAINTS_PER_VEHICLE;
}

// $PxVehiclePhysXRoadGeometryQueryTypeEnum
PxVehiclePhysXRoadGeometryQueryTypeEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxVehiclePhysXRoadGeometryQueryTypeEnum_eNONE() {
  return PxVehiclePhysXRoadGeometryQueryTypeEnum::eNONE;
}
PxVehiclePhysXRoadGeometryQueryTypeEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxVehiclePhysXRoadGeometryQueryTypeEnum_eRAYCAST() {
  return PxVehiclePhysXRoadGeometryQueryTypeEnum::eRAYCAST;
}
PxVehiclePhysXRoadGeometryQueryTypeEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxVehiclePhysXRoadGeometryQueryTypeEnum_eSWEEP() {
  return PxVehiclePhysXRoadGeometryQueryTypeEnum::eSWEEP;
}

// $PxVehiclePhysXSuspensionLimitConstraintParamsDirectionSpecifierEnum
PxVehiclePhysXSuspensionLimitConstraintParamsDirectionSpecifierEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxVehiclePhysXSuspensionLimitConstraintParamsDirectionSpecifierEnum_eSUSPENSION() {
  return PxVehiclePhysXSuspensionLimitConstraintParamsDirectionSpecifierEnum::eSUSPENSION;
}
PxVehiclePhysXSuspensionLimitConstraintParamsDirectionSpecifierEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxVehiclePhysXSuspensionLimitConstraintParamsDirectionSpecifierEnum_eROAD_GEOMETRY_NORMAL() {
  return PxVehiclePhysXSuspensionLimitConstraintParamsDirectionSpecifierEnum::eROAD_GEOMETRY_NORMAL;
}
PxVehiclePhysXSuspensionLimitConstraintParamsDirectionSpecifierEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxVehiclePhysXSuspensionLimitConstraintParamsDirectionSpecifierEnum_eNONE() {
  return PxVehiclePhysXSuspensionLimitConstraintParamsDirectionSpecifierEnum::eNONE;
}

// $PxVehicleSimulationContextTypeEnum
PxVehicleSimulationContextTypeEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxVehicleSimulationContextTypeEnum_eDEFAULT() {
  return PxVehicleSimulationContextTypeEnum::eDEFAULT;
}
PxVehicleSimulationContextTypeEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxVehicleSimulationContextTypeEnum_ePHYSX() {
  return PxVehicleSimulationContextTypeEnum::ePHYSX;
}

// $PxVehicleSuspensionJounceCalculationTypeEnum
PxVehicleSuspensionJounceCalculationTypeEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxVehicleSuspensionJounceCalculationTypeEnum_eRAYCAST() {
  return PxVehicleSuspensionJounceCalculationTypeEnum::eRAYCAST;
}
PxVehicleSuspensionJounceCalculationTypeEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxVehicleSuspensionJounceCalculationTypeEnum_eSWEEP() {
  return PxVehicleSuspensionJounceCalculationTypeEnum::eSWEEP;
}

// $PxVehicleTireDirectionModesEnum
PxVehicleTireDirectionModesEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxVehicleTireDirectionModesEnum_eLONGITUDINAL() {
  return PxVehicleTireDirectionModesEnum::eLONGITUDINAL;
}
PxVehicleTireDirectionModesEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxVehicleTireDirectionModesEnum_eLATERAL() {
  return PxVehicleTireDirectionModesEnum::eLATERAL;
}

// $PxVisualizationParameterEnum
PxVisualizationParameterEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxVisualizationParameterEnum_eSCALE() {
  return PxVisualizationParameterEnum::eSCALE;
}
PxVisualizationParameterEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxVisualizationParameterEnum_eWORLD_AXES() {
  return PxVisualizationParameterEnum::eWORLD_AXES;
}
PxVisualizationParameterEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxVisualizationParameterEnum_eBODY_AXES() {
  return PxVisualizationParameterEnum::eBODY_AXES;
}
PxVisualizationParameterEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxVisualizationParameterEnum_eBODY_MASS_AXES() {
  return PxVisualizationParameterEnum::eBODY_MASS_AXES;
}
PxVisualizationParameterEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxVisualizationParameterEnum_eBODY_LIN_VELOCITY() {
  return PxVisualizationParameterEnum::eBODY_LIN_VELOCITY;
}
PxVisualizationParameterEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxVisualizationParameterEnum_eBODY_ANG_VELOCITY() {
  return PxVisualizationParameterEnum::eBODY_ANG_VELOCITY;
}
PxVisualizationParameterEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxVisualizationParameterEnum_eCONTACT_POINT() {
  return PxVisualizationParameterEnum::eCONTACT_POINT;
}
PxVisualizationParameterEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxVisualizationParameterEnum_eCONTACT_NORMAL() {
  return PxVisualizationParameterEnum::eCONTACT_NORMAL;
}
PxVisualizationParameterEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxVisualizationParameterEnum_eCONTACT_ERROR() {
  return PxVisualizationParameterEnum::eCONTACT_ERROR;
}
PxVisualizationParameterEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxVisualizationParameterEnum_eCONTACT_FORCE() {
  return PxVisualizationParameterEnum::eCONTACT_FORCE;
}
PxVisualizationParameterEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxVisualizationParameterEnum_eACTOR_AXES() {
  return PxVisualizationParameterEnum::eACTOR_AXES;
}
PxVisualizationParameterEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxVisualizationParameterEnum_eCOLLISION_AABBS() {
  return PxVisualizationParameterEnum::eCOLLISION_AABBS;
}
PxVisualizationParameterEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxVisualizationParameterEnum_eCOLLISION_SHAPES() {
  return PxVisualizationParameterEnum::eCOLLISION_SHAPES;
}
PxVisualizationParameterEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxVisualizationParameterEnum_eCOLLISION_AXES() {
  return PxVisualizationParameterEnum::eCOLLISION_AXES;
}
PxVisualizationParameterEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxVisualizationParameterEnum_eCOLLISION_COMPOUNDS() {
  return PxVisualizationParameterEnum::eCOLLISION_COMPOUNDS;
}
PxVisualizationParameterEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxVisualizationParameterEnum_eCOLLISION_FNORMALS() {
  return PxVisualizationParameterEnum::eCOLLISION_FNORMALS;
}
PxVisualizationParameterEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxVisualizationParameterEnum_eCOLLISION_EDGES() {
  return PxVisualizationParameterEnum::eCOLLISION_EDGES;
}
PxVisualizationParameterEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxVisualizationParameterEnum_eCOLLISION_STATIC() {
  return PxVisualizationParameterEnum::eCOLLISION_STATIC;
}
PxVisualizationParameterEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxVisualizationParameterEnum_eCOLLISION_DYNAMIC() {
  return PxVisualizationParameterEnum::eCOLLISION_DYNAMIC;
}
PxVisualizationParameterEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxVisualizationParameterEnum_eJOINT_LOCAL_FRAMES() {
  return PxVisualizationParameterEnum::eJOINT_LOCAL_FRAMES;
}
PxVisualizationParameterEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxVisualizationParameterEnum_eJOINT_LIMITS() {
  return PxVisualizationParameterEnum::eJOINT_LIMITS;
}
PxVisualizationParameterEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxVisualizationParameterEnum_eCULL_BOX() {
  return PxVisualizationParameterEnum::eCULL_BOX;
}
PxVisualizationParameterEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxVisualizationParameterEnum_eMBP_REGIONS() {
  return PxVisualizationParameterEnum::eMBP_REGIONS;
}
PxVisualizationParameterEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxVisualizationParameterEnum_eSIMULATION_MESH() {
  return PxVisualizationParameterEnum::eSIMULATION_MESH;
}
PxVisualizationParameterEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxVisualizationParameterEnum_eSDF() {
  return PxVisualizationParameterEnum::eSDF;
}
PxVisualizationParameterEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxVisualizationParameterEnum_eNUM_VALUES() {
  return PxVisualizationParameterEnum::eNUM_VALUES;
}
PxVisualizationParameterEnum EMSCRIPTEN_KEEPALIVE emscripten_enum_PxVisualizationParameterEnum_eFORCE_DWORD() {
  return PxVisualizationParameterEnum::eFORCE_DWORD;
}

}


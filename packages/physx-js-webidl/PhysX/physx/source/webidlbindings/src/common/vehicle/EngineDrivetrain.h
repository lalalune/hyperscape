// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions
// are met:
//  * Redistributions of source code must retain the above copyright
//    notice, this list of conditions and the following disclaimer.
//  * Redistributions in binary form must reproduce the above copyright
//    notice, this list of conditions and the following disclaimer in the
//    documentation and/or other materials provided with the distribution.
//  * Neither the name of NVIDIA CORPORATION nor the names of its
//    contributors may be used to endorse or promote products derived
//    from this software without specific prior written permission.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS ''AS IS'' AND ANY
// EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
// IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
// PURPOSE ARE DISCLAIMED.  IN NO EVENT SHALL THE COPYRIGHT OWNER OR
// CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
// EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
// PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
// PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY
// OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
// (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
// OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
//
// Copyright (c) 2008-2022 NVIDIA Corporation. All rights reserved.
// Copyright (c) 2004-2008 AGEIA Technologies, Inc. All rights reserved.
// Copyright (c) 2001-2004 NovodeX AG. All rights reserved.  

#pragma once

#include "vehicle2/PxVehicleAPI.h"
#include "PhysXIntegration.h"

namespace snippetvehicle2
{

using namespace physx;
using namespace physx::vehicle2;

struct EngineDrivetrainParams
{
	PxVehicleAutoboxParams autoboxParams;
	PxVehicleClutchCommandResponseParams clutchCommandResponseParams;
	PxVehicleEngineParams engineParams;
	PxVehicleGearboxParams gearBoxParams;
	PxVehicleMultiWheelDriveDifferentialParams multiWheelDifferentialParams;
	PxVehicleFourWheelDriveDifferentialParams fourWheelDifferentialParams;
	PxVehicleTankDriveDifferentialParams tankDifferentialParams;
	PxVehicleClutchParams clutchParams;

	EngineDrivetrainParams transformAndScale(
		const PxVehicleFrame& srcFrame, const PxVehicleFrame& trgFrame, const PxVehicleScale& srcScale, const PxVehicleScale& trgScale) const;

	PX_FORCE_INLINE bool isValid(const PxVehicleAxleDescription& axleDesc) const
	{
		if (!autoboxParams.isValid(gearBoxParams))
			return false;
		if (!clutchCommandResponseParams.isValid())
			return false;
		if (!engineParams.isValid())
			return false;
		if (!gearBoxParams.isValid())
			return false;
		if (!multiWheelDifferentialParams.isValid(axleDesc))
			return false;
		if (!fourWheelDifferentialParams.isValid(axleDesc))
			return false;
		if (!tankDifferentialParams.isValid(axleDesc))
			return false;
		if (!clutchParams.isValid())
			return false;
		return true;
	}
};

struct EngineDrivetrainState
{
	PxVehicleEngineDriveThrottleCommandResponseState throttleCommandResponseState;
	PxVehicleAutoboxState autoboxState;
	PxVehicleClutchCommandResponseState clutchCommandResponseState;
	PxVehicleDifferentialState differentialState;
	PxVehicleWheelConstraintGroupState wheelConstraintGroupState;
	PxVehicleEngineState engineState;
	PxVehicleGearboxState gearboxState;
	PxVehicleClutchSlipState clutchState;

	PX_FORCE_INLINE void setToDefault()
	{
		throttleCommandResponseState.setToDefault();
		autoboxState.setToDefault();
		clutchCommandResponseState.setToDefault();
		differentialState.setToDefault();
		wheelConstraintGroupState.setToDefault();
		engineState.setToDefault();
		gearboxState.setToDefault();
		clutchState.setToDefault();
	}
};


//
//This class holds the parameters, state and logic needed to implement a vehicle that
//is using an engine drivetrain with gears, clutch etc.
//
//See BaseVehicle for more details on the snippet code design.
//
class EngineDriveVehicle
	: public PhysXActorVehicle
	, public PxVehicleEngineDriveCommandResponseComponent
	, public PxVehicleFourWheelDriveDifferentialStateComponent
	, public PxVehicleMultiWheelDriveDifferentialStateComponent
	, public PxVehicleTankDriveDifferentialStateComponent
	, public PxVehicleEngineDriveActuationStateComponent
	, public PxVehicleEngineDrivetrainComponent
{
public:

	enum Enum
	{
		eDIFFTYPE_FOURWHEELDRIVE,
		eDIFFTYPE_MULTIWHEELDRIVE,
		eDIFFTYPE_TANKDRIVE
	};

	bool initialize(PxPhysics& physics, const PxCookingParams& params, PxMaterial& defaultMaterial,
		Enum differentialType, bool addPhysXBeginEndComponents=true);
	
	virtual void initComponentSequence(bool addPhysXBeginEndComponents);

	virtual void getDataForPhysXActorBeginComponent(
		const PxVehicleAxleDescription*& axleDescription,
		const PxVehicleCommandState*& commands,
		const PxVehicleEngineDriveTransmissionCommandState*& transmissionCommands,
		const PxVehicleGearboxParams*& gearParams,
		const PxVehicleGearboxState*& gearState,
		const PxVehicleEngineParams*& engineParams,
		PxVehiclePhysXActor*& physxActor,
		PxVehiclePhysXSteerState*& physxSteerState,
		PxVehiclePhysXConstraints*& physxConstraints,
		PxVehicleRigidBodyState*& rigidBodyState,
		PxVehicleArrayData<PxVehicleWheelRigidBody1dState>& wheelRigidBody1dStates,
		PxVehicleEngineState*& engineState)
	{
		axleDescription = &baseParams.axleDescription;
		commands = &commandState;
		physxActor = &physXState.physxActor;
		physxSteerState = &physXState.physxSteerState;
		physxConstraints = &physXState.physxConstraints;
		rigidBodyState = &baseState.rigidBodyState;
		wheelRigidBody1dStates.setData(baseState.wheelRigidBody1dStates);

		transmissionCommands = &transmissionCommandState;
		gearParams = &engineDriveParams.gearBoxParams;
		gearState =  &engineDriveState.gearboxState;
		engineParams = &engineDriveParams.engineParams;
		engineState =  &engineDriveState.engineState;
	}

	virtual void getDataForPhysXActorEndComponent(
		const PxVehicleAxleDescription*& axleDescription,
		const PxVehicleRigidBodyState*& rigidBodyState,
		PxVehicleArrayData<const PxVehicleWheelParams>& wheelParams,
		PxVehicleArrayData<const PxTransform>& wheelShapeLocalPoses,
		PxVehicleArrayData<const PxVehicleWheelRigidBody1dState>& wheelRigidBody1dStates,
		PxVehicleArrayData<const PxVehicleWheelLocalPose>& wheelLocalPoses,
		const PxVehicleGearboxState*& gearState,
		const PxReal*& throttle,
		PxVehiclePhysXActor*& physxActor)
	{
		axleDescription = &baseParams.axleDescription;
		rigidBodyState = &baseState.rigidBodyState;
		wheelParams.setData(baseParams.wheelParams);
		wheelShapeLocalPoses.setData(physXParams.physxWheelShapeLocalPoses);
		wheelRigidBody1dStates.setData(baseState.wheelRigidBody1dStates);
		wheelLocalPoses.setData(baseState.wheelLocalPoses);
		physxActor = &physXState.physxActor;

		gearState = &engineDriveState.gearboxState;
		throttle = &commandState.throttle;
	}

	virtual void getDataForEngineDriveCommandResponseComponent(
		const PxVehicleAxleDescription*& axleDescription,
		PxVehicleSizedArrayData<const PxVehicleBrakeCommandResponseParams>& brakeResponseParams,
		const PxVehicleSteerCommandResponseParams*& steerResponseParams,
		PxVehicleSizedArrayData<const PxVehicleAckermannParams>& ackermannParams,
		const PxVehicleGearboxParams*& gearboxParams,
		const PxVehicleClutchCommandResponseParams*& clutchResponseParams,
		const PxVehicleEngineParams*& engineParams,
		const PxVehicleRigidBodyState*& rigidBodyState,
		const PxVehicleEngineState*& engineState,
		const PxVehicleAutoboxParams*& autoboxParams,
		const PxVehicleCommandState*& commands,
		const PxVehicleEngineDriveTransmissionCommandState*& transmissionCommands,
		PxVehicleArrayData<PxReal>& brakeResponseStates,
		PxVehicleEngineDriveThrottleCommandResponseState*& throttleResponseState,
		PxVehicleArrayData<PxReal>& steerResponseStates,
		PxVehicleGearboxState*& gearboxResponseState,
		PxVehicleClutchCommandResponseState*& clutchResponseState,
		PxVehicleAutoboxState*& autoboxState)
	{
		axleDescription = &baseParams.axleDescription;
		brakeResponseParams.setDataAndCount(baseParams.brakeResponseParams, sizeof(baseParams.brakeResponseParams) / sizeof(PxVehicleBrakeCommandResponseParams));
		steerResponseParams = &baseParams.steerResponseParams;
		ackermannParams.setDataAndCount(baseParams.ackermannParams, sizeof(baseParams.ackermannParams)/sizeof(PxVehicleAckermannParams));
		gearboxParams = &engineDriveParams.gearBoxParams;
		clutchResponseParams = &engineDriveParams.clutchCommandResponseParams;
		engineParams = &engineDriveParams.engineParams;
		rigidBodyState = &baseState.rigidBodyState;
		engineState = &engineDriveState.engineState;
		autoboxParams = &engineDriveParams.autoboxParams;
		commands = &commandState;
		transmissionCommands = (Enum::eDIFFTYPE_TANKDRIVE == differentialType) ? &tankDriveTransmissionCommandState : &transmissionCommandState;
		brakeResponseStates.setData(baseState.brakeCommandResponseStates);
		throttleResponseState = &engineDriveState.throttleCommandResponseState;
		steerResponseStates.setData(baseState.steerCommandResponseStates);
		gearboxResponseState = &engineDriveState.gearboxState;
		clutchResponseState = &engineDriveState.clutchCommandResponseState;
		autoboxState = &engineDriveState.autoboxState;
	}

	virtual void getDataForFourWheelDriveDifferentialStateComponent(
		const PxVehicleAxleDescription*& axleDescription,
		const PxVehicleFourWheelDriveDifferentialParams*& differentialParams,
		PxVehicleArrayData<const PxVehicleWheelRigidBody1dState>& wheelRigidbody1dStates,
		PxVehicleDifferentialState*& differentialState, PxVehicleWheelConstraintGroupState*& wheelConstraintGroups)
	{
		axleDescription = &baseParams.axleDescription;
		differentialParams = &engineDriveParams.fourWheelDifferentialParams;
		wheelRigidbody1dStates.setData(baseState.wheelRigidBody1dStates);
		differentialState = &engineDriveState.differentialState;
		wheelConstraintGroups = &engineDriveState.wheelConstraintGroupState;
	}

	virtual void getDataForMultiWheelDriveDifferentialStateComponent(
		const PxVehicleAxleDescription*& axleDescription,
		const PxVehicleMultiWheelDriveDifferentialParams*& differentialParams,
		PxVehicleDifferentialState*& differentialState)
	{
		axleDescription = &baseParams.axleDescription;
		differentialParams = &engineDriveParams.multiWheelDifferentialParams;
		differentialState = &engineDriveState.differentialState;
	}

	virtual void getDataForTankDriveDifferentialStateComponent(
		const PxVehicleAxleDescription *&axleDescription,
		const PxVehicleTankDriveTransmissionCommandState*& tankDriveTransmissionCommands,
		PxVehicleArrayData<const PxVehicleWheelParams>& wheelParams,
		const PxVehicleTankDriveDifferentialParams *& differentialParams,
		PxVehicleDifferentialState *& differentialState,
		PxVehicleWheelConstraintGroupState*& wheelConstraintGroups)
	{
		axleDescription = &baseParams.axleDescription;
		tankDriveTransmissionCommands = &tankDriveTransmissionCommandState;
		wheelParams.setData(baseParams.wheelParams);
		differentialParams = &engineDriveParams.tankDifferentialParams;
		differentialState = &engineDriveState.differentialState;
		wheelConstraintGroups = &engineDriveState.wheelConstraintGroupState;
	}

	virtual void getDataForEngineDriveActuationStateComponent(
		const PxVehicleAxleDescription*& axleDescription, 
		const PxVehicleGearboxParams*& gearboxParams,
		PxVehicleArrayData<const PxReal>& brakeResponseStates,
		const PxVehicleEngineDriveThrottleCommandResponseState*& throttleResponseState,
		const PxVehicleGearboxState*& gearboxState,
		const PxVehicleDifferentialState*& differentialState,
		const PxVehicleClutchCommandResponseState*& clutchResponseState,
		PxVehicleArrayData<PxVehicleWheelActuationState>& actuationStates)
	{
		axleDescription = &baseParams.axleDescription;
		gearboxParams = &engineDriveParams.gearBoxParams;
		brakeResponseStates.setData(baseState.brakeCommandResponseStates);
		throttleResponseState = &engineDriveState.throttleCommandResponseState;
		gearboxState = &engineDriveState.gearboxState;
		differentialState = &engineDriveState.differentialState;
		clutchResponseState = &engineDriveState.clutchCommandResponseState;
		actuationStates.setData(baseState.actuationStates);
	}

	virtual void getDataForEngineDrivetrainComponent(
		const PxVehicleAxleDescription*& axleDescription,
		PxVehicleArrayData<const PxVehicleWheelParams>& wheelParams,
		const PxVehicleEngineParams*& engineParams,
		const PxVehicleClutchParams*& clutchParams,
		const PxVehicleGearboxParams*& gearboxParams, 
		PxVehicleArrayData<const PxReal>& brakeResponseStates,
		PxVehicleArrayData<const PxVehicleWheelActuationState>& actuationStates,
		PxVehicleArrayData<const PxVehicleTireForce>& tireForces,
		const PxVehicleEngineDriveThrottleCommandResponseState*& throttleResponseState,
		const PxVehicleClutchCommandResponseState*& clutchResponseState,
		const PxVehicleDifferentialState*& differentialState,
		const PxVehicleWheelConstraintGroupState*& constraintGroupState,
		PxVehicleArrayData<PxVehicleWheelRigidBody1dState>& wheelRigidBody1dStates,
		PxVehicleEngineState*& engineState,
		PxVehicleGearboxState*& gearboxState,
		PxVehicleClutchSlipState*& clutchState)
	{
		axleDescription = &baseParams.axleDescription;
		wheelParams.setData(baseParams.wheelParams);
		engineParams = &engineDriveParams.engineParams;
		clutchParams = &engineDriveParams.clutchParams;
		gearboxParams = &engineDriveParams.gearBoxParams;
		brakeResponseStates.setData(baseState.brakeCommandResponseStates);
		actuationStates.setData(baseState.actuationStates);
		tireForces.setData(baseState.tireForces);
		throttleResponseState = &engineDriveState.throttleCommandResponseState;
		clutchResponseState = &engineDriveState.clutchCommandResponseState;
		differentialState = &engineDriveState.differentialState;
		constraintGroupState = Enum::eDIFFTYPE_TANKDRIVE == differentialType ? &engineDriveState.wheelConstraintGroupState : NULL;
		wheelRigidBody1dStates.setData(baseState.wheelRigidBody1dStates);
		engineState = &engineDriveState.engineState;
		gearboxState = &engineDriveState.gearboxState;
		clutchState = &engineDriveState.clutchState;
	}


	//Parameters and states of the vehicle's engine drivetrain.
	EngineDrivetrainParams engineDriveParams;
	EngineDrivetrainState engineDriveState;

	//The commands that will control the vehicle's transmission
	PxVehicleEngineDriveTransmissionCommandState transmissionCommandState;
	PxVehicleTankDriveTransmissionCommandState tankDriveTransmissionCommandState;

	//The type of differential that will be used.
	//If eDIFFTYPE_TANKDRIVE is chosen then the vehicle's transmission
	//commands are stored in mTankDriveTransmissionCommandState.  
	//If eDIFFTYPE_FOURWHEELDRIVE or eDIFFTYPE_MULTIWHEELDRIVE is chosen
	//then the vehicle's transmission commands are stored in 
	//mTransmissionCommandState
	Enum differentialType;
};

}//namespace snippetvehicle2

typedef snippetvehicle2::EngineDriveVehicle::Enum EngineDriveVehicleEnum;

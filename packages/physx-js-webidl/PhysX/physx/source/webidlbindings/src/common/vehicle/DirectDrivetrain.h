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

struct DirectDrivetrainParams
{
	PxVehicleDirectDriveThrottleCommandResponseParams directDriveThrottleResponseParams;

	DirectDrivetrainParams transformAndScale(
		const PxVehicleFrame& srcFrame, const PxVehicleFrame& trgFrame, const PxVehicleScale& srcScale, const PxVehicleScale& trgScale) const;

	PX_FORCE_INLINE bool isValid(const PxVehicleAxleDescription& axleDesc) const
	{
		if (!directDriveThrottleResponseParams.isValid(axleDesc))
			return false;

		return true;
	}
};

struct DirectDrivetrainState
{
	PxReal directDriveThrottleResponseStates[PxVehicleLimits::eMAX_NB_WHEELS];

	PX_FORCE_INLINE void setToDefault()
	{
		PxMemZero(this, sizeof(DirectDrivetrainState));
	}
};


//
//This class holds the parameters, state and logic needed to implement a vehicle that
//is using a direct drivetrain.
//
//See BaseVehicle for more details on the snippet code design.
//
class DirectDriveVehicle
	: public PhysXActorVehicle
	, public PxVehicleDirectDriveCommandResponseComponent
	, public PxVehicleDirectDriveActuationStateComponent
	, public PxVehicleDirectDrivetrainComponent
{
public:
	bool initialize(PxPhysics& physics, const PxCookingParams& params, PxMaterial& defaultMaterial, bool addPhysXBeginEndComponents = true);
	
	virtual void initComponentSequence(bool addPhysXBeginEndComponents);

	void getDataForDirectDriveCommandResponseComponent(
		const PxVehicleAxleDescription*& axleDescription,
		PxVehicleSizedArrayData<const PxVehicleBrakeCommandResponseParams>& brakeResponseParams,
		const PxVehicleDirectDriveThrottleCommandResponseParams*& throttleResponseParams,
		const PxVehicleSteerCommandResponseParams*& steerResponseParams,
		PxVehicleSizedArrayData<const PxVehicleAckermannParams>& ackermannParams,
		const PxVehicleCommandState*& commands, const PxVehicleDirectDriveTransmissionCommandState*& transmissionCommands,
		const PxVehicleRigidBodyState*& rigidBodyState,
		PxVehicleArrayData<PxReal>& brakeResponseStates, PxVehicleArrayData<PxReal>& throttleResponseStates, 
		PxVehicleArrayData<PxReal>& steerResponseStates)
	{
		axleDescription = &baseParams.axleDescription;
		brakeResponseParams.setDataAndCount(baseParams.brakeResponseParams, sizeof(baseParams.brakeResponseParams) / sizeof(PxVehicleBrakeCommandResponseParams));
		throttleResponseParams = &directDriveParams.directDriveThrottleResponseParams;
		steerResponseParams = &baseParams.steerResponseParams;
		ackermannParams.setDataAndCount(baseParams.ackermannParams, sizeof(baseParams.ackermannParams)/sizeof(PxVehicleAckermannParams));
		commands = &commandState;
		transmissionCommands = &transmissionCommandState;
		rigidBodyState = &baseState.rigidBodyState;
		brakeResponseStates.setData(baseState.brakeCommandResponseStates);
		throttleResponseStates.setData(directDriveState.directDriveThrottleResponseStates);
		steerResponseStates.setData(baseState.steerCommandResponseStates);
	}

	virtual void getDataForDirectDriveActuationStateComponent(
		const PxVehicleAxleDescription*& axleDescription,
		PxVehicleArrayData<const PxReal>& brakeResponseStates,
		PxVehicleArrayData<const PxReal>& throttleResponseStates,
		PxVehicleArrayData<PxVehicleWheelActuationState>& actuationStates)
	{
		axleDescription = &baseParams.axleDescription;
		brakeResponseStates.setData(baseState.brakeCommandResponseStates);
		throttleResponseStates.setData(directDriveState.directDriveThrottleResponseStates);
		actuationStates.setData(baseState.actuationStates);
	}

	virtual void getDataForDirectDrivetrainComponent(
		const PxVehicleAxleDescription*& axleDescription,
		PxVehicleArrayData<const PxReal>& brakeResponseStates,
		PxVehicleArrayData<const PxReal>& throttleResponseStates,
		PxVehicleArrayData<const PxVehicleWheelParams>& wheelParams,
		PxVehicleArrayData<const PxVehicleWheelActuationState>& actuationStates,
		PxVehicleArrayData<const PxVehicleTireForce>& tireForces,
		PxVehicleArrayData<PxVehicleWheelRigidBody1dState>& wheelRigidBody1dStates)
	{
		axleDescription = &baseParams.axleDescription;
		brakeResponseStates.setData(baseState.brakeCommandResponseStates);
		throttleResponseStates.setData(directDriveState.directDriveThrottleResponseStates);
		wheelParams.setData(baseParams.wheelParams);
		actuationStates.setData(baseState.actuationStates);
		tireForces.setData(baseState.tireForces);
		wheelRigidBody1dStates.setData(baseState.wheelRigidBody1dStates);
	}


	//Parameters and states of the vehicle's direct drivetrain.
	DirectDrivetrainParams directDriveParams;
	DirectDrivetrainState directDriveState;

	//The commands that will control the vehicle's transmission
	PxVehicleDirectDriveTransmissionCommandState transmissionCommandState;
};

}//namespace snippetvehicle2

/**
 * Model Analysis Service
 * Analyzes 3D models for hardpoints, armor placement, and rigging
 */
import { HardpointResult, ArmorPlacementResult, RiggingResult, BuildingAnalysisResult, WeaponType, ArmorSlot, CreatureType, BuildingType } from '../types';
export declare class ModelAnalysisService {
    /**
     * Analyze weapon for hardpoints
     */
    analyzeWeapon(modelUrl: string, weaponType: WeaponType): Promise<HardpointResult>;
    /**
     * Analyze armor for placement
     */
    analyzeArmor(modelUrl: string, armorSlot: ArmorSlot): Promise<ArmorPlacementResult>;
    /**
     * Analyze model for rigging
     */
    analyzeForRigging(modelUrl: string, creatureType: CreatureType): Promise<RiggingResult>;
    /**
     * Analyze building structure
     */
    analyzeBuilding(modelUrl: string, buildingType: BuildingType): Promise<BuildingAnalysisResult>;
    /**
     * Load geometry from model URL
     */
    private loadGeometry;
    /**
     * Calculate bounding box
     */
    private calculateBounds;
    /**
     * Detect weapon hardpoints
     */
    private detectWeaponHardpoints;
    /**
     * Determine armor placement
     */
    private determineArmorPlacement;
    /**
     * Generate rig for creature
     */
    private generateRig;
    /**
     * Analyze building structure
     */
    private analyzeBuildingStructure;
    /**
     * Get default animations for creature type
     */
    private getDefaultAnimations;
}
//# sourceMappingURL=ModelAnalysisService.d.ts.map
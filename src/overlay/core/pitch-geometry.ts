/**
 * ============================================================================
 * 🏟️ Pitch Geometry & Boost Pad Coordinates
 * ============================================================================
 *
 * Provides:
 * 1. World coordinate boundary safety margins
 * 2. Standard 34 Rocket League boost pad & pill coordinates (3:4 pitch)
 * ============================================================================
 */

export interface BoostPadDefinition {
  x: number;
  y: number;
  z: number;
  boostType: 'BoostType_Pad' | 'BoostType_Pill';
}

// 🛡️ Safe World Margins (9000 uu width x 12000 uu length, 3:4 aspect ratio)
export const SAFETY_MARGINS = {
  x: [-4500, 4500] as [number, number],
  y: [-6000, 6000] as [number, number],
  z: [0, 2000] as [number, number]
};

// ⚡ 34 Standard Rocket League Boost Locations (6 Full Pills + 28 Small Pads)
export const STANDARD_BOOST_LOCATIONS: readonly BoostPadDefinition[] = [
  // 6 Big Boost Pills (100% Boost)
  { x: 3072,  y: 4096,  z: 70.41, boostType: 'BoostType_Pill' },
  { x: -3072, y: 4096,  z: 70.41, boostType: 'BoostType_Pill' },
  { x: 3584,  y: 0,     z: 70.41, boostType: 'BoostType_Pill' },
  { x: -3584, y: 0,     z: 70.41, boostType: 'BoostType_Pill' },
  { x: 3072,  y: -4096, z: 70.41, boostType: 'BoostType_Pill' },
  { x: -3072, y: -4096, z: 70.41, boostType: 'BoostType_Pill' },

  // 28 Small Boost Pads (12% Boost)
  // Centerline / Midfield
  { x: 0,     y: 4240,  z: 63.71, boostType: 'BoostType_Pad' },
  { x: 0,     y: 2816,  z: 66.06, boostType: 'BoostType_Pad' },
  { x: 0,     y: 1024,  z: 65.53, boostType: 'BoostType_Pad' },
  { x: 0,     y: -1024, z: 65.94, boostType: 'BoostType_Pad' },
  { x: 0,     y: -2816, z: 66.5,  boostType: 'BoostType_Pad' },
  { x: 0,     y: -4240, z: 63.37, boostType: 'BoostType_Pad' },
  { x: 1024,  y: 0,     z: 68.7,  boostType: 'BoostType_Pad' },
  { x: -1024, y: 0,     z: 67.92, boostType: 'BoostType_Pad' },

  // Perimeter Lanes
  { x: 1792,  y: 4184,  z: 61.35, boostType: 'BoostType_Pad' },
  { x: -1792, y: 4184,  z: 60.92, boostType: 'BoostType_Pad' },
  { x: 3584,  y: 2484,  z: 67.86, boostType: 'BoostType_Pad' },
  { x: -3584, y: 2484,  z: 67.33, boostType: 'BoostType_Pad' },
  { x: 3584,  y: -2484, z: 68.36, boostType: 'BoostType_Pad' },
  { x: -3584, y: -2484, z: 66.78, boostType: 'BoostType_Pad' },
  { x: 1792,  y: -4184, z: 62.22, boostType: 'BoostType_Pad' },
  { x: -1792, y: -4184, z: 61.71, boostType: 'BoostType_Pad' },

  // Inner Diagonal Arcs
  { x: 940,   y: 3308,  z: 60.83, boostType: 'BoostType_Pad' },
  { x: -940,  y: 3308,  z: 61.05, boostType: 'BoostType_Pad' },
  { x: 1788,  y: 2302,  z: 67.7,  boostType: 'BoostType_Pad' },
  { x: -1788, y: 2302,  z: 67.9,  boostType: 'BoostType_Pad' },
  { x: 2048,  y: 1036,  z: 62.65, boostType: 'BoostType_Pad' },
  { x: -2048, y: 1036,  z: 62.72, boostType: 'BoostType_Pad' },
  { x: 2048,  y: -1036, z: 62.35, boostType: 'BoostType_Pad' },
  { x: -2048, y: -1036, z: 62.65, boostType: 'BoostType_Pad' },
  { x: 1788,  y: -2302, z: 66.57, boostType: 'BoostType_Pad' },
  { x: -1788, y: -2302, z: 67.92, boostType: 'BoostType_Pad' },
  { x: 940,   y: -3308, z: 63.71, boostType: 'BoostType_Pad' },
  { x: -940,  y: -3308, z: 62.84, boostType: 'BoostType_Pad' }
];

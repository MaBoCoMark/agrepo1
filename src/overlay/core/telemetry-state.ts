import { emit } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { TelemetryBuffer, DEFAULT_TEAM_COLORS } from './component-types';

/**
 * Overlay Telemetry & Runtime State Management
 * Zero-allocation static buffers for 120Hz+ animation loops.
 */

export const previousData: TelemetryBuffer = {
  timeSeconds: -1,
  bOvertime: false,
  ballSpeed: -1,
  ballTeamNum: -1,
  myTeamNum: -1,
  myScore: -1,
  oppScore: -1,
  scoreDiff: -999,
  myPrimaryColor: '',
  mySecondaryColor: '',
  oppPrimaryColor: '',
  oppSecondaryColor: '',

  p1Name: '',
  p1Speed: -1,
  p1Boost: -1,
  p1HasCar: false,
  p1Boosting: false,
  p1OnGround: false,
  p1OnWall: false,
  p1Powersliding: false,
  p1Demolished: false,
  p1Supersonic: false,

  p2Name: '',
  p2Speed: -1,
  p2Boost: -1,
  p2HasCar: false,
  p2Boosting: false,
  p2OnGround: false,
  p2OnWall: false,
  p2Powersliding: false,
  p2Demolished: false,
  p2Supersonic: false,

  p3Name: '',
  p3Speed: -1,
  p3Boost: -1,
  p3HasCar: false,
  p3Boosting: false,
  p3OnGround: false,
  p3OnWall: false,
  p3Powersliding: false,
  p3Demolished: false,
  p3Supersonic: false
};

export const latestData: TelemetryBuffer = {
  timeSeconds: 0,
  bOvertime: false,
  ballSpeed: 0,
  ballTeamNum: 0,
  myTeamNum: 0,
  myScore: 0,
  oppScore: 0,
  scoreDiff: 0,
  myPrimaryColor: DEFAULT_TEAM_COLORS.myPrimaryColor,
  mySecondaryColor: DEFAULT_TEAM_COLORS.mySecondaryColor,
  oppPrimaryColor: DEFAULT_TEAM_COLORS.oppPrimaryColor,
  oppSecondaryColor: DEFAULT_TEAM_COLORS.oppSecondaryColor,

  p1Name: '-',
  p1Speed: 0,
  p1Boost: 0,
  p1HasCar: false,
  p1Boosting: false,
  p1OnGround: false,
  p1OnWall: false,
  p1Powersliding: false,
  p1Demolished: false,
  p1Supersonic: false,

  p2Name: '-',
  p2Speed: 0,
  p2Boost: 0,
  p2HasCar: false,
  p2Boosting: false,
  p2OnGround: false,
  p2OnWall: false,
  p2Powersliding: false,
  p2Demolished: false,
  p2Supersonic: false,

  p3Name: '-',
  p3Speed: 0,
  p3Boost: 0,
  p3HasCar: false,
  p3Boosting: false,
  p3OnGround: false,
  p3OnWall: false,
  p3Powersliding: false,
  p3Demolished: false,
  p3Supersonic: false
};

export function resetPreviousData(): void {
  previousData.timeSeconds = -1;
  previousData.bOvertime = false;
  previousData.ballSpeed = -1;
  previousData.ballTeamNum = -1;
  previousData.myTeamNum = -1;
  previousData.myScore = -1;
  previousData.oppScore = -1;
  previousData.scoreDiff = -999;
  previousData.myPrimaryColor = '';
  previousData.mySecondaryColor = '';
  previousData.oppPrimaryColor = '';
  previousData.oppSecondaryColor = '';

  previousData.p1Name = '';
  previousData.p1Speed = -1;
  previousData.p1Boost = -1;
  previousData.p1HasCar = false;
  previousData.p1Boosting = false;
  previousData.p1OnGround = false;
  previousData.p1OnWall = false;
  previousData.p1Powersliding = false;
  previousData.p1Demolished = false;
  previousData.p1Supersonic = false;

  previousData.p2Name = '';
  previousData.p2Speed = -1;
  previousData.p2Boost = -1;
  previousData.p2HasCar = false;
  previousData.p2Boosting = false;
  previousData.p2OnGround = false;
  previousData.p2OnWall = false;
  previousData.p2Powersliding = false;
  previousData.p2Demolished = false;
  previousData.p2Supersonic = false;

  previousData.p3Name = '';
  previousData.p3Speed = -1;
  previousData.p3Boost = -1;
  previousData.p3HasCar = false;
  previousData.p3Boosting = false;
  previousData.p3OnGround = false;
  previousData.p3OnWall = false;
  previousData.p3Powersliding = false;
  previousData.p3Demolished = false;
  previousData.p3Supersonic = false;
}

export interface OverlayState {
  isSimulating: boolean;
  isDevDashboardVisible: boolean;
  isCompetitiveVisible: boolean;
  isBallHitVisible: boolean;
  isBallHitSvgVisible: boolean;
  isLayoutEditing: boolean;
  isAutoSceneControl: boolean;
  hasReceivedDataSinceConnected: boolean;
  currentActiveScene: string;
}

export const overlayState: OverlayState = {
  isSimulating: false,
  isDevDashboardVisible: false,
  isCompetitiveVisible: false,
  isBallHitVisible: false,
  isBallHitSvgVisible: false,
  isLayoutEditing: false,
  isAutoSceneControl: true,
  hasReceivedDataSinceConnected: false,
  currentActiveScene: 'not-connected'
};

export async function setOverlayClickThrough(ignore: boolean): Promise<void> {
  try {
    await invoke('set_overlay_click_through', { ignore });
  } catch (err) {
    // fallback
  }
  try {
    await emit('toggle-overlay-click-through', { ignore });
  } catch (err) {
    // ignore
  }
}

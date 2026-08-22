import { TelemetryBuffer } from './component-types';

/**
 * ============================================================================
 * 🎮 Mock Telemetry Simulation Stream
 * ============================================================================
 */

export const mockSimState = {
  timeRaw: 270.0,
  ballSpeed: 43.0,
  ballSpeedDir: 1,
  ballTeamToggleTimer: 0,
  scoreTimer: 0,

  p1Boost: { val: 8.0, step: 0.45, dir: 1 },
  p2Boost: { val: 18.0, step: 0.75, dir: -1 },
  p3Boost: { val: 85.0, step: 0.55, dir: -1 },

  p1Speed: { val: 82.0, step: 0.6, dir: 1, max: 100 },
  p2Speed: { val: 55.0, step: 0.9, dir: -1, max: 100 },
  p3Speed: { val: 26.0, step: 0.4, dir: 1, max: 100 },

  frameCount: 0
};

export function updateMockStream(latestData: TelemetryBuffer): void {
  mockSimState.frameCount++;

  // 1. Time / countdown simulation
  mockSimState.timeRaw -= (1 / 120);
  if (mockSimState.timeRaw <= 0) {
    mockSimState.timeRaw = 300;
    latestData.bOvertime = !latestData.bOvertime;
  }
  latestData.timeSeconds = Math.floor(mockSimState.timeRaw);

  // 2. Ball speed & ball team
  mockSimState.ballSpeed += 0.3 * mockSimState.ballSpeedDir;
  if (mockSimState.ballSpeed >= 120) mockSimState.ballSpeedDir = -1;
  if (mockSimState.ballSpeed <= 10) mockSimState.ballSpeedDir = 1;
  latestData.ballSpeed = Math.floor(mockSimState.ballSpeed);

  mockSimState.ballTeamToggleTimer++;
  if (mockSimState.ballTeamToggleTimer > 240) {
    mockSimState.ballTeamToggleTimer = 0;
    latestData.ballTeamNum = latestData.ballTeamNum === 0 ? 1 : 0;
  }

  // 3. P1 Boost
  mockSimState.p1Boost.val += mockSimState.p1Boost.step * mockSimState.p1Boost.dir;
  if (mockSimState.p1Boost.val >= 100) { mockSimState.p1Boost.val = 100; mockSimState.p1Boost.dir = -1; }
  if (mockSimState.p1Boost.val <= 0) { mockSimState.p1Boost.val = 0; mockSimState.p1Boost.dir = 1; }
  latestData.p1Boost = Math.round(mockSimState.p1Boost.val);
  latestData.p1Boosting = mockSimState.p1Boost.dir < 0;
  latestData.p1HasCar = true;

  // 4. P2 Boost
  mockSimState.p2Boost.val += mockSimState.p2Boost.step * mockSimState.p2Boost.dir;
  if (mockSimState.p2Boost.val >= 100) { mockSimState.p2Boost.val = 100; mockSimState.p2Boost.dir = -1; }
  if (mockSimState.p2Boost.val <= 0) { mockSimState.p2Boost.val = 0; mockSimState.p2Boost.dir = 1; }
  latestData.p2Boost = Math.round(mockSimState.p2Boost.val);
  latestData.p2Boosting = mockSimState.p2Boost.dir < 0;
  latestData.p2HasCar = true;

  // 5. P3 Boost
  mockSimState.p3Boost.val += mockSimState.p3Boost.step * mockSimState.p3Boost.dir;
  if (mockSimState.p3Boost.val >= 100) { mockSimState.p3Boost.val = 100; mockSimState.p3Boost.dir = -1; }
  if (mockSimState.p3Boost.val <= 0) { mockSimState.p3Boost.val = 0; mockSimState.p3Boost.dir = 1; }
  latestData.p3Boost = Math.round(mockSimState.p3Boost.val);
  latestData.p3Boosting = mockSimState.p3Boost.dir < 0;
  latestData.p3HasCar = true;

  // 6. Speed simulation
  mockSimState.p1Speed.val += mockSimState.p1Speed.step * mockSimState.p1Speed.dir;
  if (mockSimState.p1Speed.val >= 95) mockSimState.p1Speed.dir = -1;
  if (mockSimState.p1Speed.val <= 10) mockSimState.p1Speed.dir = 1;
  latestData.p1Speed = Math.floor(mockSimState.p1Speed.val);
  latestData.p1Supersonic = latestData.p1Speed > 80;

  mockSimState.p2Speed.val += mockSimState.p2Speed.step * mockSimState.p2Speed.dir;
  if (mockSimState.p2Speed.val >= 90) mockSimState.p2Speed.dir = -1;
  if (mockSimState.p2Speed.val <= 5) mockSimState.p2Speed.dir = 1;
  latestData.p2Speed = Math.floor(mockSimState.p2Speed.val);
  latestData.p2Supersonic = latestData.p2Speed > 80;

  mockSimState.p3Speed.val += mockSimState.p3Speed.step * mockSimState.p3Speed.dir;
  if (mockSimState.p3Speed.val >= 85) mockSimState.p3Speed.dir = -1;
  if (mockSimState.p3Speed.val <= 0) mockSimState.p3Speed.dir = 1;
  latestData.p3Speed = Math.floor(mockSimState.p3Speed.val);
  latestData.p3Supersonic = latestData.p3Speed > 80;

  // 7. Score variations
  mockSimState.scoreTimer++;
  if (mockSimState.scoreTimer > 1200) {
    mockSimState.scoreTimer = 0;
    if (Math.random() > 0.5) {
      latestData.myScore += 1;
    } else {
      latestData.oppScore += 1;
    }
    latestData.scoreDiff = latestData.myScore - latestData.oppScore;
  }

  // 8. Booleans
  if (mockSimState.frameCount % 60 === 0) {
    latestData.p1OnGround = Math.random() > 0.3;
    latestData.p1OnWall = !latestData.p1OnGround && Math.random() > 0.5;
    latestData.p1Powersliding = Math.random() > 0.7;

    latestData.p2OnGround = Math.random() > 0.4;
    latestData.p2OnWall = !latestData.p2OnGround && Math.random() > 0.6;
    latestData.p2Powersliding = Math.random() > 0.8;

    latestData.p3OnGround = Math.random() > 0.2;
    latestData.p3OnWall = !latestData.p3OnGround && Math.random() > 0.7;
    latestData.p3Powersliding = Math.random() > 0.85;
  }
}

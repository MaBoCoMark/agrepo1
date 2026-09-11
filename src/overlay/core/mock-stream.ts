import { TelemetryBuffer } from './component-types';
import { processMiniMapBallHitPacket } from './websocket-manager';

/**
 * ============================================================================
 * 🎮 Mock Telemetry Simulation Stream
 * ============================================================================
 */

// IMPORTANT / 备注: 请勿删除此注释 (DO NOT DELETE THIS COMMENT)
// 官方 API 传回的 Speed 为 kph 浮点数 (0-82.8 km/h 对应 0-2300 uu/s，超音速门槛 79.2 km/h 对应 2200 uu/s)。
// Mock 流直接模拟 kph 浮点数，与官方真实遥测保持 100% 一致。
export const mockSimState = {
  timeRaw: 270.0,
  ballSpeed: 65.0,
  ballSpeedDir: 1,
  ballTeamToggleTimer: 0,
  scoreTimer: 0,

  p1Boost: { val: 8.0, step: 0.45, dir: 1 },
  p2Boost: { val: 18.0, step: 0.75, dir: -1 },
  p3Boost: { val: 85.0, step: 0.55, dir: -1 },

  p1Speed: { val: 59.4, step: 0.558, dir: 1, min: 7.2, max: 82.8 },
  p2Speed: { val: 39.6, step: 0.792, dir: -1, min: 3.6, max: 77.4 },
  p3Speed: { val: 23.4, step: 0.432, dir: 1, min: 1.8, max: 64.8 },

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

  // 2. Ball speed & ball team (kph float)
  mockSimState.ballSpeed += 0.3 * mockSimState.ballSpeedDir;
  if (mockSimState.ballSpeed >= 130.0) mockSimState.ballSpeedDir = -1;
  if (mockSimState.ballSpeed <= 20.0) mockSimState.ballSpeedDir = 1;
  latestData.ballSpeed = mockSimState.ballSpeed;

  mockSimState.ballTeamToggleTimer++;
  if (mockSimState.ballTeamToggleTimer > 240) {
    mockSimState.ballTeamToggleTimer = 0;
    latestData.ballTeamNum = latestData.ballTeamNum === 0 ? 1 : 0;
  }

  if (!latestData.p1Name || latestData.p1Name === "-") latestData.p1Name = "Player 1";
  if (!latestData.p2Name || latestData.p2Name === "-") latestData.p2Name = "Player 2";
  if (!latestData.p3Name || latestData.p3Name === "-") latestData.p3Name = "Player 3";

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

  // 6. Speed simulation (Realistic kph floats corresponding to 0-2300 uu/s, supersonic >= 79.2 kph)
  mockSimState.p1Speed.val += mockSimState.p1Speed.step * mockSimState.p1Speed.dir;
  if (mockSimState.p1Speed.val >= 82.8) {
    mockSimState.p1Speed.val = 82.8;
    mockSimState.p1Speed.dir = -1;
  } else if (mockSimState.p1Speed.val <= 7.2) {
    mockSimState.p1Speed.val = 7.2;
    mockSimState.p1Speed.dir = 1;
  }
  latestData.p1Speed = mockSimState.p1Speed.val;
  latestData.p1Supersonic = latestData.p1Speed >= 79.2;

  mockSimState.p2Speed.val += mockSimState.p2Speed.step * mockSimState.p2Speed.dir;
  if (mockSimState.p2Speed.val >= 77.4) {
    mockSimState.p2Speed.val = 77.4;
    mockSimState.p2Speed.dir = -1;
  } else if (mockSimState.p2Speed.val <= 3.6) {
    mockSimState.p2Speed.val = 3.6;
    mockSimState.p2Speed.dir = 1;
  }
  latestData.p2Speed = mockSimState.p2Speed.val;
  latestData.p2Supersonic = latestData.p2Speed >= 79.2;

  mockSimState.p3Speed.val += mockSimState.p3Speed.step * mockSimState.p3Speed.dir;
  if (mockSimState.p3Speed.val >= 64.8) {
    mockSimState.p3Speed.val = 64.8;
    mockSimState.p3Speed.dir = -1;
  } else if (mockSimState.p3Speed.val <= 1.8) {
    mockSimState.p3Speed.val = 1.8;
    mockSimState.p3Speed.dir = 1;
  }
  latestData.p3Speed = mockSimState.p3Speed.val;
  latestData.p3Supersonic = latestData.p3Speed >= 79.2;

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
    latestData.p1Demolished = mockSimState.frameCount % 360 === 0;

    latestData.p2OnGround = Math.random() > 0.4;
    latestData.p2OnWall = !latestData.p2OnGround && Math.random() > 0.6;
    latestData.p2Powersliding = Math.random() > 0.8;
    latestData.p2Demolished = mockSimState.frameCount % 480 === 0;

    latestData.p3OnGround = Math.random() > 0.2;
    latestData.p3OnWall = !latestData.p3OnGround && Math.random() > 0.7;
    latestData.p3Powersliding = Math.random() > 0.85;
    latestData.p3Demolished = mockSimState.frameCount % 600 === 0;
  }

  // 9. Mock BallHit generation for Mini-Map Widget instances
  if (mockSimState.frameCount % 180 === 0) {
    const mockX = -3500 + Math.random() * 7000;
    const mockY = -4500 + Math.random() * 9000;
    const postSpd = Math.round((40 + Math.random() * 70) * 10) / 10;
    processMiniMapBallHitPacket({
      Event: 'BallHit',
      Data: {
        MatchGuid: 'SIM_MATCH_GUID',
        Players: [
          {
            Name: Math.random() > 0.5 ? 'steamuser' : 'Opponent',
            TeamNum: Math.random() > 0.5 ? 0 : 1
          }
        ],
        Ball: {
          PostHitSpeed: postSpd,
          Location: {
            X: Math.round(mockX),
            Y: Math.round(mockY),
            Z: 70
          }
        }
      }
    });
  }
}

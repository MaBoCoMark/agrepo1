import { TelemetryBuffer } from './component-types';
import { DevDashboardDomNodes } from './dom-cache';
import { updateBoostMeterElement } from './boost-meter';

/**
 * ============================================================================
 * 🎛️ Developer Dashboard High-Speed Renderer
 * ============================================================================
 *
 * Granular property change checking:
 * if (previousData.prop !== latestData.prop) {
 *   updateDevDashboardDOM();
 *   previousData.prop = latestData.prop;
 * }
 * ============================================================================
 */

function formatMinutesSeconds(totalSeconds: number): string {
  const isNegative = totalSeconds < 0;
  const absSeconds = Math.abs(Math.trunc(totalSeconds));
  const mins = Math.floor(absSeconds / 60);
  const secs = absSeconds % 60;
  const formattedSecs = secs.toString().padStart(2, '0');
  return `${isNegative ? '-' : ''}${mins}:${formattedSecs}` || '0:00';
}

function updateBoolUI(val: boolean, el: HTMLElement | null): void {
  if (!el) return;
  el.className = val ? 'status-dot bool-on' : 'status-dot bool-off';
}

function updateScoreDiffUI(diff: number, el: HTMLElement | null): void {
  if (!el) return;
  if (diff === 0) {
    el.textContent = '0';
    el.className = 'global-val score-diff-text score-tie';
  } else if (diff > 0) {
    el.textContent = `+${diff}`;
    el.className = 'global-val score-diff-text score-pos';
  } else {
    el.textContent = `${diff}`;
    el.className = 'global-val score-diff-text score-neg';
  }
}

export function renderDevDashboard(
  latestData: TelemetryBuffer,
  previousData: TelemetryBuffer,
  devDom: DevDashboardDomNodes
): void {
  // 1. Time / Countdown
  if (latestData.timeSeconds !== previousData.timeSeconds) {
    if (devDom.countdown) devDom.countdown.textContent = formatMinutesSeconds(latestData.timeSeconds);
    previousData.timeSeconds = latestData.timeSeconds;
  }

  // 2. Overtime
  if (latestData.bOvertime !== previousData.bOvertime) {
    if (devDom.overtime) updateBoolUI(latestData.bOvertime, devDom.overtime);
    previousData.bOvertime = latestData.bOvertime;
  }

  // 3. Ball Speed
  if (latestData.ballSpeed !== previousData.ballSpeed) {
    if (devDom.ballSpeed) devDom.ballSpeed.textContent = `${latestData.ballSpeed} KPH`;
    previousData.ballSpeed = latestData.ballSpeed;
  }

  // 4. Ball Team
  if (latestData.ballTeamNum !== previousData.ballTeamNum) {
    if (devDom.ballTeam) devDom.ballTeam.textContent = latestData.ballTeamNum.toString();
    previousData.ballTeamNum = latestData.ballTeamNum;
  }

  // 5. Score Diff
  if (latestData.scoreDiff !== previousData.scoreDiff) {
    if (devDom.scoreDiff) updateScoreDiffUI(latestData.scoreDiff, devDom.scoreDiff);
    previousData.scoreDiff = latestData.scoreDiff;
  }

  // 6. Match Score
  if (latestData.myScore !== previousData.myScore || latestData.oppScore !== previousData.oppScore) {
    if (devDom.matchScore) devDom.matchScore.textContent = `${latestData.myScore} - ${latestData.oppScore}`;
    previousData.myScore = latestData.myScore;
    previousData.oppScore = latestData.oppScore;
  }

  // 7. Team Colors
  if (latestData.myPrimaryColor !== previousData.myPrimaryColor) {
    if (devDom.myPrimaryColor) devDom.myPrimaryColor.style.backgroundColor = latestData.myPrimaryColor;
    previousData.myPrimaryColor = latestData.myPrimaryColor;
  }
  if (latestData.mySecondaryColor !== previousData.mySecondaryColor) {
    if (devDom.mySecondaryColor) devDom.mySecondaryColor.style.backgroundColor = latestData.mySecondaryColor;
    previousData.mySecondaryColor = latestData.mySecondaryColor;
  }
  if (latestData.oppPrimaryColor !== previousData.oppPrimaryColor) {
    if (devDom.oppPrimaryColor) devDom.oppPrimaryColor.style.backgroundColor = latestData.oppPrimaryColor;
    previousData.oppPrimaryColor = latestData.oppPrimaryColor;
  }
  if (latestData.oppSecondaryColor !== previousData.oppSecondaryColor) {
    if (devDom.oppSecondaryColor) devDom.oppSecondaryColor.style.backgroundColor = latestData.oppSecondaryColor;
    previousData.oppSecondaryColor = latestData.oppSecondaryColor;
  }

  // ----------------------------------------------------
  // --- P1 (Target) ---
  // ----------------------------------------------------
  if (latestData.p1Name !== previousData.p1Name) {
    if (devDom.p1Name) devDom.p1Name.textContent = latestData.p1Name;
    previousData.p1Name = latestData.p1Name;
  }
  if (latestData.p1Speed !== previousData.p1Speed) {
    if (devDom.p1Speed) devDom.p1Speed.textContent = latestData.p1Speed.toString();
    previousData.p1Speed = latestData.p1Speed;
  }
  if (latestData.p1Boost !== previousData.p1Boost) {
    updateBoostMeterElement(
      devDom.p1BoostBar,
      devDom.p1BoostVal,
      devDom.p1BoostCell,
      latestData.p1Boost,
      devDom.p1BoostState
    );
    previousData.p1Boost = latestData.p1Boost;
  }
  if (latestData.p1HasCar !== previousData.p1HasCar) {
    if (devDom.p1HasCar) updateBoolUI(latestData.p1HasCar, devDom.p1HasCar);
    previousData.p1HasCar = latestData.p1HasCar;
  }
  if (latestData.p1Boosting !== previousData.p1Boosting) {
    if (devDom.p1Boosting) updateBoolUI(latestData.p1Boosting, devDom.p1Boosting);
    previousData.p1Boosting = latestData.p1Boosting;
  }
  if (latestData.p1OnGround !== previousData.p1OnGround) {
    if (devDom.p1OnGround) updateBoolUI(latestData.p1OnGround, devDom.p1OnGround);
    previousData.p1OnGround = latestData.p1OnGround;
  }
  if (latestData.p1OnWall !== previousData.p1OnWall) {
    if (devDom.p1OnWall) updateBoolUI(latestData.p1OnWall, devDom.p1OnWall);
    previousData.p1OnWall = latestData.p1OnWall;
  }
  if (latestData.p1Powersliding !== previousData.p1Powersliding) {
    if (devDom.p1Powersliding) updateBoolUI(latestData.p1Powersliding, devDom.p1Powersliding);
    previousData.p1Powersliding = latestData.p1Powersliding;
  }
  if (latestData.p1Demolished !== previousData.p1Demolished) {
    if (devDom.p1Demolished) updateBoolUI(latestData.p1Demolished, devDom.p1Demolished);
    previousData.p1Demolished = latestData.p1Demolished;
  }
  if (latestData.p1Supersonic !== previousData.p1Supersonic) {
    if (devDom.p1Supersonic) updateBoolUI(latestData.p1Supersonic, devDom.p1Supersonic);
    previousData.p1Supersonic = latestData.p1Supersonic;
  }

  // ----------------------------------------------------
  // --- P2 ---
  // ----------------------------------------------------
  if (latestData.p2Name !== previousData.p2Name) {
    if (devDom.p2Name) devDom.p2Name.textContent = latestData.p2Name;
    previousData.p2Name = latestData.p2Name;
  }
  if (latestData.p2Speed !== previousData.p2Speed) {
    if (devDom.p2Speed) devDom.p2Speed.textContent = latestData.p2Speed.toString();
    previousData.p2Speed = latestData.p2Speed;
  }
  if (latestData.p2Boost !== previousData.p2Boost) {
    updateBoostMeterElement(
      devDom.p2BoostBar,
      devDom.p2BoostVal,
      devDom.p2BoostCell,
      latestData.p2Boost,
      devDom.p2BoostState
    );
    previousData.p2Boost = latestData.p2Boost;
  }
  if (latestData.p2HasCar !== previousData.p2HasCar) {
    if (devDom.p2HasCar) updateBoolUI(latestData.p2HasCar, devDom.p2HasCar);
    previousData.p2HasCar = latestData.p2HasCar;
  }
  if (latestData.p2Boosting !== previousData.p2Boosting) {
    if (devDom.p2Boosting) updateBoolUI(latestData.p2Boosting, devDom.p2Boosting);
    previousData.p2Boosting = latestData.p2Boosting;
  }
  if (latestData.p2OnGround !== previousData.p2OnGround) {
    if (devDom.p2OnGround) updateBoolUI(latestData.p2OnGround, devDom.p2OnGround);
    previousData.p2OnGround = latestData.p2OnGround;
  }
  if (latestData.p2OnWall !== previousData.p2OnWall) {
    if (devDom.p2OnWall) updateBoolUI(latestData.p2OnWall, devDom.p2OnWall);
    previousData.p2OnWall = latestData.p2OnWall;
  }
  if (latestData.p2Powersliding !== previousData.p2Powersliding) {
    if (devDom.p2Powersliding) updateBoolUI(latestData.p2Powersliding, devDom.p2Powersliding);
    previousData.p2Powersliding = latestData.p2Powersliding;
  }
  if (latestData.p2Demolished !== previousData.p2Demolished) {
    if (devDom.p2Demolished) updateBoolUI(latestData.p2Demolished, devDom.p2Demolished);
    previousData.p2Demolished = latestData.p2Demolished;
  }
  if (latestData.p2Supersonic !== previousData.p2Supersonic) {
    if (devDom.p2Supersonic) updateBoolUI(latestData.p2Supersonic, devDom.p2Supersonic);
    previousData.p2Supersonic = latestData.p2Supersonic;
  }

  // ----------------------------------------------------
  // --- P3 ---
  // ----------------------------------------------------
  if (latestData.p3Name !== previousData.p3Name) {
    if (devDom.p3Name) devDom.p3Name.textContent = latestData.p3Name;
    previousData.p3Name = latestData.p3Name;
  }
  if (latestData.p3Speed !== previousData.p3Speed) {
    if (devDom.p3Speed) devDom.p3Speed.textContent = latestData.p3Speed.toString();
    previousData.p3Speed = latestData.p3Speed;
  }
  if (latestData.p3Boost !== previousData.p3Boost) {
    updateBoostMeterElement(
      devDom.p3BoostBar,
      devDom.p3BoostVal,
      devDom.p3BoostCell,
      latestData.p3Boost,
      devDom.p3BoostState
    );
    previousData.p3Boost = latestData.p3Boost;
  }
  if (latestData.p3HasCar !== previousData.p3HasCar) {
    if (devDom.p3HasCar) updateBoolUI(latestData.p3HasCar, devDom.p3HasCar);
    previousData.p3HasCar = latestData.p3HasCar;
  }
  if (latestData.p3Boosting !== previousData.p3Boosting) {
    if (devDom.p3Boosting) updateBoolUI(latestData.p3Boosting, devDom.p3Boosting);
    previousData.p3Boosting = latestData.p3Boosting;
  }
  if (latestData.p3OnGround !== previousData.p3OnGround) {
    if (devDom.p3OnGround) updateBoolUI(latestData.p3OnGround, devDom.p3OnGround);
    previousData.p3OnGround = latestData.p3OnGround;
  }
  if (latestData.p3OnWall !== previousData.p3OnWall) {
    if (devDom.p3OnWall) updateBoolUI(latestData.p3OnWall, devDom.p3OnWall);
    previousData.p3OnWall = latestData.p3OnWall;
  }
  if (latestData.p3Powersliding !== previousData.p3Powersliding) {
    if (devDom.p3Powersliding) updateBoolUI(latestData.p3Powersliding, devDom.p3Powersliding);
    previousData.p3Powersliding = latestData.p3Powersliding;
  }
  if (latestData.p3Demolished !== previousData.p3Demolished) {
    if (devDom.p3Demolished) updateBoolUI(latestData.p3Demolished, devDom.p3Demolished);
    previousData.p3Demolished = latestData.p3Demolished;
  }
  if (latestData.p3Supersonic !== previousData.p3Supersonic) {
    if (devDom.p3Supersonic) updateBoolUI(latestData.p3Supersonic, devDom.p3Supersonic);
    previousData.p3Supersonic = latestData.p3Supersonic;
  }
}

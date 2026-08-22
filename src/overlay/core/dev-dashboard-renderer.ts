import { TelemetryBuffer } from './component-types';
import { DevDashboardDomNodes } from './dom-cache';
import { updateBoostMeterElement } from './boost-meter';

/**
 * ============================================================================
 * 🎛️ Developer Dashboard High-Speed Renderer
 * ============================================================================
 *
 * Abstracted out of overlay.ts to keep the core competitive loop streamlined.
 * Zero `querySelector` or DOM lookups during execution.
 * Only updates properties if values change relative to `previousData`.
 * GPU accelerated boost meter transforms.
 * ============================================================================
 */

function formatMinutesSeconds(totalSeconds: number): string {
  const isNegative = totalSeconds < 0;
  const absSeconds = Math.abs(Math.trunc(totalSeconds));
  const mins = Math.floor(absSeconds / 60);
  const secs = absSeconds % 60;
  const formattedSecs = secs.toString().padStart(2, '0');
  return `${isNegative ? '-' : ''}${mins}:${formattedSecs}`;
}

function updateBoolUI(val: boolean, el: HTMLElement | null) {
  if (!el) return;
  el.className = val ? 'status-dot bool-on' : 'status-dot bool-off';
}

function updateScoreDiffUI(diff: number, el: HTMLElement | null) {
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
  if (latestData.timeSeconds !== previousData.timeSeconds && devDom.countdown) {
    devDom.countdown.textContent = formatMinutesSeconds(latestData.timeSeconds);
  }

  // 2. Overtime
  if (latestData.bOvertime !== previousData.bOvertime && devDom.overtime) {
    updateBoolUI(latestData.bOvertime, devDom.overtime);
  }

  // 3. Ball Speed
  if (latestData.ballSpeed !== previousData.ballSpeed && devDom.ballSpeed) {
    devDom.ballSpeed.textContent = `${latestData.ballSpeed} KPH`;
  }

  // 4. Ball Team
  if (latestData.ballTeamNum !== previousData.ballTeamNum && devDom.ballTeam) {
    devDom.ballTeam.textContent = latestData.ballTeamNum.toString();
  }

  // 5. Score Diff
  if (latestData.scoreDiff !== previousData.scoreDiff && devDom.scoreDiff) {
    updateScoreDiffUI(latestData.scoreDiff, devDom.scoreDiff);
  }

  // 6. Match Score
  if ((latestData.myScore !== previousData.myScore || latestData.oppScore !== previousData.oppScore) && devDom.matchScore) {
    devDom.matchScore.textContent = `${latestData.myScore} - ${latestData.oppScore}`;
  }

  // 7. Team Colors
  if (latestData.myPrimaryColor !== previousData.myPrimaryColor && devDom.myPrimaryColor) {
    devDom.myPrimaryColor.style.backgroundColor = latestData.myPrimaryColor;
  }
  if (latestData.mySecondaryColor !== previousData.mySecondaryColor && devDom.mySecondaryColor) {
    devDom.mySecondaryColor.style.backgroundColor = latestData.mySecondaryColor;
  }
  if (latestData.oppPrimaryColor !== previousData.oppPrimaryColor && devDom.oppPrimaryColor) {
    devDom.oppPrimaryColor.style.backgroundColor = latestData.oppPrimaryColor;
  }
  if (latestData.oppSecondaryColor !== previousData.oppSecondaryColor && devDom.oppSecondaryColor) {
    devDom.oppSecondaryColor.style.backgroundColor = latestData.oppSecondaryColor;
  }

  // ----------------------------------------------------
  // --- P1 (Target) ---
  // ----------------------------------------------------
  if (latestData.p1Name !== previousData.p1Name && devDom.p1Name) {
    devDom.p1Name.textContent = latestData.p1Name;
  }
  if (latestData.p1Speed !== previousData.p1Speed && devDom.p1Speed) {
    devDom.p1Speed.textContent = latestData.p1Speed.toString();
  }
  if (latestData.p1Boost !== previousData.p1Boost) {
    updateBoostMeterElement(
      devDom.p1BoostBar,
      devDom.p1BoostVal,
      devDom.p1BoostCell,
      latestData.p1Boost,
      devDom.p1BoostState
    );
  }
  if (latestData.p1HasCar !== previousData.p1HasCar) {
    updateBoolUI(latestData.p1HasCar, devDom.p1HasCar);
  }
  if (latestData.p1Boosting !== previousData.p1Boosting) {
    updateBoolUI(latestData.p1Boosting, devDom.p1Boosting);
  }
  if (latestData.p1OnGround !== previousData.p1OnGround) {
    updateBoolUI(latestData.p1OnGround, devDom.p1OnGround);
  }
  if (latestData.p1OnWall !== previousData.p1OnWall) {
    updateBoolUI(latestData.p1OnWall, devDom.p1OnWall);
  }
  if (latestData.p1Powersliding !== previousData.p1Powersliding) {
    updateBoolUI(latestData.p1Powersliding, devDom.p1Powersliding);
  }
  if (latestData.p1Demolished !== previousData.p1Demolished) {
    updateBoolUI(latestData.p1Demolished, devDom.p1Demolished);
  }
  if (latestData.p1Supersonic !== previousData.p1Supersonic) {
    updateBoolUI(latestData.p1Supersonic, devDom.p1Supersonic);
  }

  // ----------------------------------------------------
  // --- P2 ---
  // ----------------------------------------------------
  if (latestData.p2HasCar) {
    if (latestData.p2Name !== previousData.p2Name && devDom.p2Name) {
      devDom.p2Name.textContent = latestData.p2Name;
    }
    if (latestData.p2Speed !== previousData.p2Speed && devDom.p2Speed) {
      devDom.p2Speed.textContent = latestData.p2Speed.toString();
    }
    if (latestData.p2Boost !== previousData.p2Boost) {
      updateBoostMeterElement(
        devDom.p2BoostBar,
        devDom.p2BoostVal,
        devDom.p2BoostCell,
        latestData.p2Boost,
        devDom.p2BoostState
      );
    }
    if (latestData.p2HasCar !== previousData.p2HasCar) {
      updateBoolUI(latestData.p2HasCar, devDom.p2HasCar);
    }
    if (latestData.p2Boosting !== previousData.p2Boosting) {
      updateBoolUI(latestData.p2Boosting, devDom.p2Boosting);
    }
    if (latestData.p2OnGround !== previousData.p2OnGround) {
      updateBoolUI(latestData.p2OnGround, devDom.p2OnGround);
    }
    if (latestData.p2OnWall !== previousData.p2OnWall) {
      updateBoolUI(latestData.p2OnWall, devDom.p2OnWall);
    }
    if (latestData.p2Powersliding !== previousData.p2Powersliding) {
      updateBoolUI(latestData.p2Powersliding, devDom.p2Powersliding);
    }
    if (latestData.p2Demolished !== previousData.p2Demolished) {
      updateBoolUI(latestData.p2Demolished, devDom.p2Demolished);
    }
    if (latestData.p2Supersonic !== previousData.p2Supersonic) {
      updateBoolUI(latestData.p2Supersonic, devDom.p2Supersonic);
    }
  }

  // ----------------------------------------------------
  // --- P3 ---
  // ----------------------------------------------------
  if (latestData.p3HasCar) {
    if (latestData.p3Name !== previousData.p3Name && devDom.p3Name) {
      devDom.p3Name.textContent = latestData.p3Name;
    }
    if (latestData.p3Speed !== previousData.p3Speed && devDom.p3Speed) {
      devDom.p3Speed.textContent = latestData.p3Speed.toString();
    }
    if (latestData.p3Boost !== previousData.p3Boost) {
      updateBoostMeterElement(
        devDom.p3BoostBar,
        devDom.p3BoostVal,
        devDom.p3BoostCell,
        latestData.p3Boost,
        devDom.p3BoostState
      );
    }
    if (latestData.p3HasCar !== previousData.p3HasCar) {
      updateBoolUI(latestData.p3HasCar, devDom.p3HasCar);
    }
    if (latestData.p3Boosting !== previousData.p3Boosting) {
      updateBoolUI(latestData.p3Boosting, devDom.p3Boosting);
    }
    if (latestData.p3OnGround !== previousData.p3OnGround) {
      updateBoolUI(latestData.p3OnGround, devDom.p3OnGround);
    }
    if (latestData.p3OnWall !== previousData.p3OnWall) {
      updateBoolUI(latestData.p3OnWall, devDom.p3OnWall);
    }
    if (latestData.p3Powersliding !== previousData.p3Powersliding) {
      updateBoolUI(latestData.p3Powersliding, devDom.p3Powersliding);
    }
    if (latestData.p3Demolished !== previousData.p3Demolished) {
      updateBoolUI(latestData.p3Demolished, devDom.p3Demolished);
    }
    if (latestData.p3Supersonic !== previousData.p3Supersonic) {
      updateBoolUI(latestData.p3Supersonic, devDom.p3Supersonic);
    }
  }
}

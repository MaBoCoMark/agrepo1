// 🌟 Rocket League WebSocket Event Types Definition & Registry
// This list is the central source of truth for all inspectable & manageable packet types.

export interface RLEventDefinition {
  key: string;
  name: string;
  desc: string;
}

export const ALL_ROCKET_LEAGUE_EVENTS: RLEventDefinition[] = [
  { key: 'UpdateState', name: 'UpdateState', desc: 'Continuous game telemetry state' },
  { key: 'TICK', name: 'TICK', desc: 'High-frequency simulation physics tick' },
  { key: 'GoalScored', name: 'GoalScored', desc: 'Goal scored event with scorer data' },
  { key: 'GoalReplayStart', name: 'GoalReplayStart', desc: 'Goal replay video playback begins' },
  { key: 'GoalReplayWillEnd', name: 'GoalReplayWillEnd', desc: 'Goal replay is concluding' },
  { key: 'GoalReplayEnd', name: 'GoalReplayEnd', desc: 'Goal replay finished' },
  { key: 'BallHit', name: 'BallHit', desc: 'Player contacted ball' },
  { key: 'BoostPickup', name: 'BoostPickup', desc: 'Player collected boost pad/pill' },
  { key: 'ClockUpdatedSeconds', name: 'ClockUpdatedSeconds', desc: 'Match timer second tick' },
  { key: 'CountdownBegin', name: 'CountdownBegin', desc: 'Kickoff countdown 3-2-1-GO' },
  { key: 'CrossbarHit', name: 'CrossbarHit', desc: 'Ball struck goalpost / crossbar' },
  { key: 'MatchCreated', name: 'MatchCreated', desc: 'Match room created' },
  { key: 'MatchInitialized', name: 'MatchInitialized', desc: 'Match initialized with teams' },
  { key: 'MatchEnded', name: 'MatchEnded', desc: 'Match concluded' },
  { key: 'MatchDestroyed', name: 'MatchDestroyed', desc: 'Match destroyed' },
  { key: 'MatchPaused', name: 'MatchPaused', desc: 'Match paused' },
  { key: 'MatchUnpaused', name: 'MatchUnpaused', desc: 'Match resumed' },
  { key: 'PlayerJoined', name: 'PlayerJoined', desc: 'Player joined server' },
  { key: 'PlayerLeft', name: 'PlayerLeft', desc: 'Player left server' },
  { key: 'PodiumStart', name: 'PodiumStart', desc: 'Winner victory podium sequence' },
  { key: 'ReplayCreated', name: 'ReplayCreated', desc: 'Replay file saved' },
  { key: 'RoundStarted', name: 'RoundStarted', desc: 'Kickoff round started' },
  { key: 'StatfeedEvent', name: 'StatfeedEvent', desc: 'In-game badge earned (Demolition, Save, Epic Save, Shot)' }
];

export const RL_EVENT_TYPES: string[] = ALL_ROCKET_LEAGUE_EVENTS.map((e) => e.key);

export const DEFAULT_ACTIVE_EVENTS: string[] = ['UpdateState'];

export const DEFAULT_LOW_FREQ_TRIGGERS: string[] = [
  'MatchCreated',
  'MatchInitialized',
  'RoundStarted',
  'CountdownBegin',
  'PlayerJoined',
  'PlayerLeft',
  'GoalScored',
  'PodiumStart',
  'MatchEnded',
  'MatchDestroyed'
];

export const DEFAULT_TIMELINE_EVENTS: string[] = ALL_ROCKET_LEAGUE_EVENTS.map((e) => e.key);

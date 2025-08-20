export interface JobStatusInfo {
  jobName: string;
  status: number;
  statusName: string;
  nextStart?: number;
  isScheduledToday: boolean;
  hasRunToday: boolean;
  isCurrentlyActive: boolean;
  visualState: 'COMPLETED_TODAY' | 'ACTIVE_NOW' | 'CURRENT_STATE';
  statusColor?: string;
  statusIcon: string;
}

export enum AutoSysStatus {
  RUNNING = 1,
  STARTING = 3,
  SUCCESS = 4,
  FAILURE = 5,
  TERMINATED = 6,
  ON_ICE = 7,
  INACTIVE = 8,
  ACTIVATED = 9,
  RESTART = 10,
  ON_HOLD = 11,
  QUE_WAIT = 12
}

export const STATUS_ICONS: { [key: number]: string } = {
  1: '▶',   // RUNNING
  3: '⟳',   // STARTING
  4: '✓',   // SUCCESS
  5: '✗',   // FAILURE
  6: '⊗',   // TERMINATED
  7: '❄',   // ON_ICE
  8: '○',   // INACTIVE
  9: '⏰',   // ACTIVATED
  10: '🔄',  // RESTART
  11: '⏸',  // ON_HOLD
  12: '⏳'   // QUE_WAIT
};

export const STATUS_NAMES: { [key: number]: string } = {
  1: 'RUNNING',
  3: 'STARTING',
  4: 'SUCCESS',
  5: 'FAILURE',
  6: 'TERMINATED',
  7: 'ON_ICE',
  8: 'INACTIVE',
  9: 'ACTIVATED',
  10: 'RESTART',
  11: 'ON_HOLD',
  12: 'QUE_WAIT'
};

// Color schemes for light and dark themes
export const STATUS_COLORS = {
  light: {
    // Completed statuses
    4: { normal: '#4CAF50', muted: '#E8F5E9', border: '#2E7D32' }, // SUCCESS
    5: { normal: '#F44336', muted: '#FFEBEE', border: '#D32F2F' }, // FAILURE
    6: { normal: '#FF9800', muted: '#FFF3E0', border: '#EF6C00' }, // TERMINATED
    
    // Active statuses
    1: { normal: '#2196F3', pulse: 'rgba(33, 150, 243, 0.3)', border: '#1976D2' }, // RUNNING
    3: { normal: '#00BCD4', border: '#0097A7' }, // STARTING
    9: { normal: '#FFC107', border: '#FFA000' }, // ACTIVATED
    
    // Hold/Wait statuses
    11: { normal: '#FFEB3B', border: '#FBC02D' }, // ON_HOLD
    12: { normal: '#3F51B5', border: '#303F9F' }, // QUE_WAIT
    
    // Inactive statuses
    7: { normal: '#03A9F4', border: '#0288D1' }, // ON_ICE
    8: { normal: '#9E9E9E', border: '#616161' }, // INACTIVE
    10: { normal: '#9C27B0', border: '#7B1FA2' }  // RESTART
  },
  dark: {
    // Completed statuses
    4: { normal: '#66BB6A', muted: '#1B5E20', border: '#4CAF50' }, // SUCCESS
    5: { normal: '#EF5350', muted: '#B71C1C', border: '#F44336' }, // FAILURE
    6: { normal: '#FFA726', muted: '#E65100', border: '#FF9800' }, // TERMINATED
    
    // Active statuses
    1: { normal: '#42A5F5', pulse: 'rgba(66, 165, 245, 0.3)', border: '#2196F3' }, // RUNNING
    3: { normal: '#26C6DA', border: '#00BCD4' }, // STARTING
    9: { normal: '#FFCA28', border: '#FFC107' }, // ACTIVATED
    
    // Hold/Wait statuses
    11: { normal: '#FFEE58', border: '#FFEB3B' }, // ON_HOLD
    12: { normal: '#5C6BC0', border: '#3F51B5' }, // QUE_WAIT
    
    // Inactive statuses
    7: { normal: '#29B6F6', border: '#03A9F4' }, // ON_ICE
    8: { normal: '#757575', border: '#424242' }, // INACTIVE
    10: { normal: '#AB47BC', border: '#9C27B0' }  // RESTART
  }
};
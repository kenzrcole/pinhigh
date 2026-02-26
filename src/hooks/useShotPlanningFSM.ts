import { useReducer, useCallback } from 'react';
import { ShotPlanningState, ShotPlanningContext, ClubStats } from '../types/smartCaddie';
import { GeoCoordinate } from '../types/courseData';
import { DispersionResult, HazardRisk } from '../types/smartCaddie';

type ShotPlanningAction =
  | { type: 'START_PLANNING'; club: ClubStats }
  | { type: 'SET_TARGET'; target: GeoCoordinate }
  | { type: 'UPDATE_DISPERSION'; dispersion: DispersionResult }
  | { type: 'UPDATE_RISK'; risk: HazardRisk }
  | { type: 'CHANGE_CLUB'; club: ClubStats }
  | { type: 'COMPLETE_SHOT' }
  | { type: 'CANCEL_PLANNING' };

interface FSMState {
  state: ShotPlanningState;
  context: ShotPlanningContext;
}

/**
 * Finite State Machine reducer for shot planning workflow.
 * Manages transitions between WALKING -> PLANNING_SHOT -> AIMING -> SHOT_COMPLETE states.
 *
 * @param currentState - Current FSM state with context
 * @param action - Action to process
 * @returns New FSM state
 */
function shotPlanningReducer(currentState: FSMState, action: ShotPlanningAction): FSMState {
  const { state, context } = currentState;

  switch (action.type) {
    case 'START_PLANNING':
      return {
        state: { type: 'PLANNING_SHOT', clubSelected: action.club.name },
        context: {
          ...context,
          selectedClub: action.club,
          targetPoint: null,
          dispersionData: null,
          riskAssessment: null,
        },
      };

    case 'SET_TARGET':
      if (state.type === 'PLANNING_SHOT' && context.selectedClub) {
        return {
          state: {
            type: 'AIMING',
            target: action.target,
            club: context.selectedClub,
          },
          context: {
            ...context,
            targetPoint: action.target,
          },
        };
      }
      return currentState;

    case 'UPDATE_DISPERSION':
      if (state.type === 'AIMING') {
        return {
          state,
          context: {
            ...context,
            dispersionData: action.dispersion,
          },
        };
      }
      return currentState;

    case 'UPDATE_RISK':
      if (state.type === 'AIMING') {
        return {
          state,
          context: {
            ...context,
            riskAssessment: action.risk,
          },
        };
      }
      return currentState;

    case 'CHANGE_CLUB':
      if (state.type === 'PLANNING_SHOT' || state.type === 'AIMING') {
        return {
          state: { type: 'PLANNING_SHOT', clubSelected: action.club.name },
          context: {
            ...context,
            selectedClub: action.club,
            dispersionData: null,
            riskAssessment: null,
          },
        };
      }
      return currentState;

    case 'COMPLETE_SHOT':
      return {
        state: { type: 'SHOT_COMPLETE' },
        context,
      };

    case 'CANCEL_PLANNING':
      return {
        state: { type: 'WALKING' },
        context: {
          selectedClub: null,
          targetPoint: null,
          dispersionData: null,
          riskAssessment: null,
        },
      };

    default:
      return currentState;
  }
}

const initialState: FSMState = {
  state: { type: 'WALKING' },
  context: {
    selectedClub: null,
    targetPoint: null,
    dispersionData: null,
    riskAssessment: null,
  },
};

/**
 * Custom hook providing Finite State Machine for shot planning workflow.
 * Manages state transitions and provides action dispatchers.
 *
 * @returns FSM state, context, and action dispatchers
 */
export function useShotPlanningFSM() {
  const [fsmState, dispatch] = useReducer(shotPlanningReducer, initialState);

  const startPlanning = useCallback((club: ClubStats) => {
    dispatch({ type: 'START_PLANNING', club });
  }, []);

  const setTarget = useCallback((target: GeoCoordinate) => {
    dispatch({ type: 'SET_TARGET', target });
  }, []);

  const updateDispersion = useCallback((dispersion: DispersionResult) => {
    dispatch({ type: 'UPDATE_DISPERSION', dispersion });
  }, []);

  const updateRisk = useCallback((risk: HazardRisk) => {
    dispatch({ type: 'UPDATE_RISK', risk });
  }, []);

  const changeClub = useCallback((club: ClubStats) => {
    dispatch({ type: 'CHANGE_CLUB', club });
  }, []);

  const completeShot = useCallback(() => {
    dispatch({ type: 'COMPLETE_SHOT' });
  }, []);

  const cancelPlanning = useCallback(() => {
    dispatch({ type: 'CANCEL_PLANNING' });
  }, []);

  return {
    state: fsmState.state,
    context: fsmState.context,
    startPlanning,
    setTarget,
    updateDispersion,
    updateRisk,
    changeClub,
    completeShot,
    cancelPlanning,
  };
}

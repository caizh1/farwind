import archive from './fixtures/legacy-defense.json';
import type {GateId} from '../src/data/defense';
import {validateDefense,type DefenseState,type RaidState} from '../src/game/systems/defenseState';
export function legacyDefense(s:DefenseState,gate:GateId,warning=false){
 const next=structuredClone(s),raid=structuredClone(archive.事件.find(r=>r.gateId===gate)) as RaidState;
 next.sequence=raid.sequence;next.completedSequence=raid.sequence-1;next.raid=raid;
 raid.phase=warning?'warning':'approach';raid.ageMs=0;return validateDefense(next);
}

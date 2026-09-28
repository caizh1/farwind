import {ENCOUNTERS,type WildernessDirection} from "../../data/maps/windbell/encounters";
import {campCleared,type EncounterState} from "./encounterState";
import type {GateId} from "../../data/defense";
export function regionalThreat(encounters:EncounterState,direction:WildernessDirection){
 const camp=ENCOUNTERS.find(d=>d.kind==="camp"&&d.direction===direction);
 const cleared=!!camp&&campCleared(encounters,camp.id);
 const patrols=ENCOUNTERS.filter(d=>d.direction===direction&&d.kind==="patrol");
 return {source:camp?.id??null,cleared,pressure:cleared?10:50,raidBudget:cleared?0:3,renewablePatrols:cleared?0:patrols.length,remaining:patrols.reduce((n,d)=>n+encounters.groups[d.id].members.filter(m=>!m.defeated).length,0)};
}
export const sourceAllowsRaid=(encounters:EncounterState,gate:GateId)=>regionalThreat(encounters,gate.split("-")[0] as WildernessDirection).raidBudget>0;

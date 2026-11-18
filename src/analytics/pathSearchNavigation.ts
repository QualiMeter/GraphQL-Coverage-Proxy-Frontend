import type {SchemaCoordinate} from '../api/runPaths';
export type RequestPathSelection={scope:string;runId:string;snapshotId:string;field:string;path:SchemaCoordinate[]};
export function pathSearchNavigation(scope:string,runId:string,snapshotId:string,path:readonly SchemaCoordinate[]):RequestPathSelection {
 if(!path.length)throw new Error('Путь не должен быть пустым.');
 const last=path[path.length-1];
 return {scope,runId,snapshotId,field:`${last.typeName}.${last.fieldName}`,path:path.map(c=>({...c}))};
}
export function pathForContext(selection:RequestPathSelection|null,scope:string,runId:string|undefined,snapshotId:string|null){return selection?.scope===scope&&selection.runId===runId&&selection.snapshotId===snapshotId?selection.path:undefined}

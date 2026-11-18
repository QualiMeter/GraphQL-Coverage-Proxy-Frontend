export type GitlabContext={scope:string;serviceId:string;snapshotId:string|null};
export function sameGitlabContext(a:GitlabContext,b:GitlabContext){return a.scope===b.scope&&a.serviceId===b.serviceId&&a.snapshotId===b.snapshotId}

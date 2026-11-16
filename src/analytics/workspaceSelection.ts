type Selection = {serviceId: string; snapshotId: string | null; runId: string | null};
const key = 'graphql-coverage.workspace';

export function readWorkspace(): Selection | null {
  try {
    const saved = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (saved && typeof saved.serviceId === 'string' &&
        (saved.snapshotId === null || typeof saved.snapshotId === 'string') &&
        (saved.runId === null || typeof saved.runId === 'string')) {
      return {serviceId:saved.serviceId, snapshotId:saved.snapshotId, runId:saved.runId};
    }
  } catch { /* Storage may be disabled. */ }
  return null;
}

export function saveWorkspace(selection: Selection) {
  try {localStorage.setItem(key, JSON.stringify(selection))}
  catch { /* The dashboard still works without storage. */ }
}

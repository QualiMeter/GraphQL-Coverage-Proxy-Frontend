import type {Session} from '../api/auth';
import {canCreateService} from './serviceCreation';

export type WorkspaceAction = 'service' | 'snapshot' | 'run';

export const workspaceActionCopy = {
  service: {title: 'Добавить сервис', login: 'Войдите, чтобы добавить GraphQL-сервис.'},
  snapshot: {title: 'Добавить снимок схемы', login: 'Войдите, чтобы добавить снимок схемы.'},
  run: {title: 'Новый прогон', login: 'Войдите, чтобы начать новый прогон.'},
} satisfies Record<WorkspaceAction, {title: string; login: string}>;

export function workspaceActionFor(action: WorkspaceAction, session: Session | null, mockSelected: boolean) {
  if (mockSelected && action === 'snapshot') return 'local-snapshot';
  if (mockSelected && action === 'run') return 'local-run';
  if (!session?.user.isActive || Date.parse(session.expiresAt) <= Date.now()) return 'login';
  if (!canCreateService(session)) return 'denied';
  if (action === 'service') return 'create-service';
  if (action === 'snapshot') return 'remote-snapshot';
  return 'run-unavailable';
}

export type WorkspaceIntent = {
  action: WorkspaceAction;
  outcome: ReturnType<typeof workspaceActionFor>;
};

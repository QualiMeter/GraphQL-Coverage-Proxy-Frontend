import {describe, expect, it} from 'vitest';
import type {Role, Session} from '../api/auth';
import {workspaceActionFor} from './workspaceActions';

const actions = ['service', 'snapshot', 'run'] as const;
function session(role: Role): Session {
  return {
    user: {id: 'user', username: 'tester', role, isActive: true},
    csrfToken: 'test-token',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  };
}

describe('workspace action routing', () => {
  it('opens login for each anonymous action', () => {
    expect(actions.map(action => workspaceActionFor(action, null))).toEqual(['login', 'login', 'login']);
  });

  it.each(['viewer', 'analyst'] as const)('explains permissions for %s without requesting another login', role => {
    expect(actions.map(action => workspaceActionFor(action, session(role)))).toEqual(['denied', 'denied', 'denied']);
  });

  it.each(['operator', 'admin'] as const)('routes authorized %s actions to the backend', role => {
    expect(actions.map(action => workspaceActionFor(action, session(role)))).toEqual([
      'create-service', 'remote-snapshot', 'create-run',
    ]);
  });

  it('routes expired sessions to login', () => {
    const expired = {...session('operator'), expiresAt: new Date(0).toISOString()};
    expect(actions.map(action => workspaceActionFor(action, expired))).toEqual(['login', 'login', 'login']);
  });
});

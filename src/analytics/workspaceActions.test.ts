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
  it('opens login for each anonymous backend action', () => {
    expect(actions.map(action => workspaceActionFor(action, null, false))).toEqual(['login', 'login', 'login']);
  });

  it.each(['viewer', 'analyst'] as const)('explains permissions for %s and does not ask for another login', role => {
    expect(actions.map(action => workspaceActionFor(action, session(role), false))).toEqual(['denied', 'denied', 'denied']);
  });

  it.each(['operator', 'admin'] as const)('offers backend actions for %s', role => {
    expect(actions.map(action => workspaceActionFor(action, session(role), false))).toEqual([
      'create-service', 'remote-snapshot', 'create-run',
    ]);
  });

  it('preserves anonymous mock actions and still requires login to create a real service', () => {
    expect(actions.map(action => workspaceActionFor(action, null, true))).toEqual(['login', 'local-snapshot', 'local-run']);
  });

  it('routes expired sessions to login', () => {
    const expired = {...session('operator'), expiresAt: new Date(0).toISOString()};
    expect(actions.map(action => workspaceActionFor(action, expired, false))).toEqual(['login', 'login', 'login']);
  });
});

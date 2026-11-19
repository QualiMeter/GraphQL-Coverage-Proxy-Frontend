import {it,expect} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {GitlabLaunchForm} from './GitlabLaunchForm';
import {CreateRunDialog} from './RunDialogs';
it('offers both run creation modes without changing the ordinary form',()=>{const html=renderToStaticMarkup(createElement(CreateRunDialog,{serviceId:'service',serviceName:'API',snapshotName:'Snapshot',endpointNote:'endpoint',onCreate:async()=>null,onGitlab:async()=>null,onHistory:()=>{},onClose:()=>{}}));expect(html).toContain('Обычный прогон');expect(html).toContain('Запустить через GitLab CI');expect(html).toContain('Создать прогон')});
it('has branch selection and optional name but no GitLab credentials or host inputs',()=>{const html=renderToStaticMarkup(createElement(GitlabLaunchForm,{serviceId:'service',serviceName:'API',snapshotName:'Snapshot',onLaunch:async()=>null,onBusy:()=>{},onLock:()=>{},onClose:()=>{},onHistory:()=>{}}));expect(html).toContain('Поиск среди загруженных веток');expect(html).toContain('Название прогона (необязательно)');expect(html).toContain('Запустить E2E-тесты');expect(html).not.toMatch(/type="password"|name="token"|name="host"|projectId/)});

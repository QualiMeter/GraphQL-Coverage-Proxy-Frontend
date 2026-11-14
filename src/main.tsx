import React from 'react';
import {createRoot} from 'react-dom/client';
import AnalyticsApp from './analytics/AnalyticsApp';
createRoot(document.getElementById('root')!).render(<React.StrictMode>{import.meta.env.VITE_DATA_SOURCE==='api'?<div style={{padding:32,fontFamily:'system-ui'}}><h1>GraphQL Coverage Proxy</h1><p>API-режим ожидает подтверждённого контракта backend. Данные mock не подставляются.</p></div>:<AnalyticsApp/>}</React.StrictMode>);

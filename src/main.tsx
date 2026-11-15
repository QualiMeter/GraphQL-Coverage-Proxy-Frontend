import React from 'react';
import {createRoot} from 'react-dom/client';
import AnalyticsApp from './analytics/AnalyticsApp';

createRoot(document.getElementById('root')!).render(<React.StrictMode><AnalyticsApp/></React.StrictMode>);

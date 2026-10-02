import React from 'react';
import { createRoot } from 'react-dom/client';
import MobileAppV2 from './MobileAppV2';
import './mobile-app-v2.css';

createRoot(document.getElementById('root')!).render(<React.StrictMode><MobileAppV2 /></React.StrictMode>);

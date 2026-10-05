import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import MobileAppConcept from './MobileAppConcept';
import './mobile-app.css';

createRoot(document.getElementById('root')!).render(<StrictMode><MobileAppConcept /></StrictMode>);

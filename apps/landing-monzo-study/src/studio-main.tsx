import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import HomepageStudio from './HomepageStudio';
import './combined.css';
import './studio.css';

createRoot(document.getElementById('root')!).render(<StrictMode><HomepageStudio /></StrictMode>);

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import GreenPages, { type GreenPage } from './GreenPages';
import '../editorial.css';
import './together.css';
import './story-notes.css';
import './pages.css';

const root = document.getElementById('root')!;
createRoot(root).render(<StrictMode><GreenPages page={root.dataset.page as GreenPage} /></StrictMode>);

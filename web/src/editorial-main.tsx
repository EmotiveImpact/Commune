import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import EditorialMock from './EditorialMock';
import './editorial.css';

createRoot(document.getElementById('root')!).render(<StrictMode><EditorialMock /></StrictMode>);

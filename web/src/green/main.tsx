import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import TogetherMock from './TogetherMock';
import '../editorial.css';
import './together.css';

createRoot(document.getElementById('root')!).render(<StrictMode><TogetherMock /></StrictMode>);

import './polish.css';

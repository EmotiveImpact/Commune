import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import CombinedMock from './CombinedMock';
import './combined.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CombinedMock />
  </StrictMode>,
);

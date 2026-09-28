import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import BusinessMock from './BusinessMock';
import './business.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BusinessMock />
  </StrictMode>,
);

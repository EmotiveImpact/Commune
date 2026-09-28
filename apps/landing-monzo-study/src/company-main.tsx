import React from 'react';
import { createRoot } from 'react-dom/client';
import CompanyPages from './CompanyPages';

const page = document.getElementById('root')?.dataset.page;
if (page === 'how' || page === 'life' || page === 'pricing' || page === 'journal' || page === 'about') {
  createRoot(document.getElementById('root')!).render(<React.StrictMode><CompanyPages page={page} /></React.StrictMode>);
}

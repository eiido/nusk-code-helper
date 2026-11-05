import React from 'react';
import { createRoot } from 'react-dom/client';
import HelperApp from '../components/helper-app';
import codes from '../data/codes.json';
createRoot(document.getElementById('root')!).render(<HelperApp initialCodes={codes}/>);

import React from 'react';
import ReactDOM from 'react-dom/client';
import AnalysisPage from './AnalysisPage.jsx';
import {HashRouter, Routes, Route } from 'react-router-dom';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <Routes>
        <Route path="/" element={<AnalysisPage />} />
      </Routes>
    </HashRouter>
  </React.StrictMode>
);
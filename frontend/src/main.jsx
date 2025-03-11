import React from 'react';
import ReactDOM from 'react-dom/client';
import AnalysisPage from './AnalysisPage.jsx';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AnalysisPage />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
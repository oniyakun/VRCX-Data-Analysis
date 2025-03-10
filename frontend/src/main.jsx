import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import AnalysisPage from './AnalysisPage.jsx';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/analysis" element={<AnalysisPage />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
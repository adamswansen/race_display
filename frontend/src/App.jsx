import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Display from './pages/Display';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/display" element={<Display />} />
    </Routes>
  );
}

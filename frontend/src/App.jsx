import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Display from './pages/Display';
import RunnerDisplay from './pages/RunnerDisplay';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/display" element={<RunnerDisplay />} />
      <Route path="/builder" element={<Display />} />
    </Routes>
  );
}

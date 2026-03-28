import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import Applications from './pages/Applications';
import Kanban from './pages/Kanban';
import ApplicationDetail from './pages/ApplicationDetail';
import Resumes from './pages/Resumes';
import Today from './pages/Today';
import Settings from './pages/Settings';
import Demo from './pages/Demo';
import Connections from './pages/Connections';
import Analytics from './pages/Analytics';

function App() {
  // Initialize dark mode from localStorage
  useEffect(() => {
    const dark = localStorage.getItem('theme') === 'dark';
    if (dark) document.documentElement.classList.add('dark');
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="today" element={<Today />} />
          <Route path="applications" element={<Applications />} />
          <Route path="applications/:id" element={<ApplicationDetail />} />
          <Route path="kanban" element={<Kanban />} />
          <Route path="resumes" element={<Resumes />} />
          <Route path="connections" element={<Connections />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="settings" element={<Settings />} />
          <Route path="demo" element={<Demo />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;

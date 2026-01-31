import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import EventEditor from './pages/EventEditor';
import Scanner from './pages/Scanner';
import PublicAttendance from './pages/PublicAttendance';
import CheckInDashboard from './pages/CheckInDashboard';

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/scanner" element={<Scanner />} />
          <Route path="/public" element={<PublicAttendance />} />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <CheckInDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/event-editor"
            element={
              <ProtectedRoute>
                <EventEditor />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;

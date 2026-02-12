import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Home from './pages/Home';
import Login from './pages/Login';
import EventEditor from './pages/EventEditor';
import Scanner from './pages/Scanner';
import PublicAttendance from './pages/PublicAttendance';
import CheckInDashboard from './pages/CheckInDashboard';
import CertificateAdmin from './pages/CertificateAdmin';
import CertificateClaim from './pages/CertificateClaim';

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/home" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/scanner" element={<Scanner />} />
          <Route path="/public" element={<PublicAttendance />} />
          <Route path="/certificate/claim" element={<CertificateClaim />} />


          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <CheckInDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/dashboard/certificates"
            element={
              <ProtectedRoute>
                <CertificateAdmin />
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

          {/* Redirect root to home */}
          <Route path="/" element={<Navigate to="/home" replace />} />

          {/* Catch all - redirect to home */}
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;

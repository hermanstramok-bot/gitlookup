import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { I18nProvider } from './context/I18nContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout'; // импортируем Layout
import Login from './pages/Login';
import Register from './pages/Register';
import Library from './pages/Library';
import Vocab from './pages/Vocab';
import Reader from './pages/Reader';
import VideoReader from './pages/VideoReader';
import Trainer from './pages/Trainer';
import Settings from './pages/Settings';

function App() {
  return (
    <I18nProvider>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout>
                  <Library />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/vocab"
            element={
              <ProtectedRoute>
                <Layout>
                  <Vocab />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/read/:id"
            element={
              <ProtectedRoute>
                <Layout>
                  <Reader />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/video/:id"
            element={
              <ProtectedRoute>
                <Layout>
                  <VideoReader />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/trainer"
            element={
              <ProtectedRoute>
                <Layout>
                  <Trainer />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Layout>
                  <Settings />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
    </I18nProvider>
  );
}

export default App;
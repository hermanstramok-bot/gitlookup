import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import Header from "./components/Header";
import Footer from "./components/Footer";
import Library from "./pages/Library";
import Reader from "./pages/Reader";
import Vocab from "./pages/Vocab";
import VideoReader from './pages/VideoReader';
import Trainer from './pages/Trainer';
import './index.css'
import Settings from './pages/Settings';

function NotFound() {
  return (
    <div className="text-center py-12">
      <h1 className="text-4xl font-bold text-gray-700 dark:text-gray-200">404</h1>
      <p className="text-gray-500 dark:text-gray-400 mt-2">Страница не найдена</p>
    </div>
  );
}

// Компонент, который содержит Routes с анимацией
function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Library />} />
        <Route path="/read/:id" element={<Reader />} />
        <Route path="/vocab" element={<Vocab />} />
        <Route path="/video/:id" element={<VideoReader />} />
        <Route path="/trainer" element={<Trainer />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <Router>
      <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-300">
        <Header />
        <main className="flex-grow">
          <AnimatedRoutes />
        </main>
        <Footer />
      </div>
    </Router>
  );
}
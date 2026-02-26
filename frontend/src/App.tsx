import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import Factors from './pages/Factors';
import DataQuality from './pages/DataQuality';
import MapView from './pages/MapView';
import Settings from './pages/Settings';
import MiningValuation from './pages/MiningValuation';
import NetLiquidAssets from './pages/NetLiquidAssets';
import DebtTracker from './pages/DebtTracker';
import Valuation from './pages/Valuation';

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/valuation/:ticker" element={<Valuation />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/projects/:ticker" element={<Projects />} />
        <Route path="/mining-valuation" element={<MiningValuation />} />
        <Route path="/net-liquid-assets" element={<NetLiquidAssets />} />
        <Route path="/debt" element={<DebtTracker />} />
        <Route path="/factors" element={<Factors />} />
        <Route path="/data-quality" element={<DataQuality />} />
        <Route path="/map" element={<MapView />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Layout>
  );
}

export default App;

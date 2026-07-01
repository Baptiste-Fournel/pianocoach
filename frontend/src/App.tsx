import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Repertoire from "./pages/Repertoire";
import Journal from "./pages/Journal";
import Scales from "./pages/Scales";
import Tempo from "./pages/Tempo";
import Reading from "./pages/Reading";
import Milestones from "./pages/Milestones";
import Skills from "./pages/Skills";
import Generator from "./pages/Generator";
import Polyrhythm from "./pages/Polyrhythm";
import Piano from "./pages/Piano";
import Solfege from "./pages/Solfege";
import Resources from "./pages/Resources";
import Coach from "./pages/Coach";
import Videos from "./pages/Videos";
import SettingsPage from "./pages/Settings";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="repertoire" element={<Repertoire />} />
        <Route path="journal" element={<Journal />} />
        <Route path="gammes" element={<Scales />} />
        <Route path="tempo" element={<Tempo />} />
        <Route path="lecture" element={<Reading />} />
        <Route path="jalons" element={<Milestones />} />
        <Route path="competences" element={<Skills />} />
        <Route path="seance" element={<Generator />} />
        <Route path="polyrythmie" element={<Polyrhythm />} />
        <Route path="piano" element={<Piano />} />
        <Route path="solfege" element={<Solfege />} />
        <Route path="ressources" element={<Resources />} />
        <Route path="coach" element={<Coach />} />
        <Route path="videos" element={<Videos />} />
        <Route path="reglages" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}

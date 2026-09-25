import { Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { AgentDetail } from './pages/AgentDetail'
import { Agents } from './pages/Agents'
import { Overview } from './pages/Overview'
import { RunDetail } from './pages/RunDetail'
import { RunsPage, SystemsPage } from './pages/Simple'

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Overview />} />
        <Route path="agents" element={<Agents />} />
        <Route path="agents/:agentId" element={<AgentDetail />} />
        <Route path="runs" element={<RunsPage />} />
        <Route path="runs/:runId" element={<RunDetail />} />
        <Route path="systems" element={<SystemsPage />} />
        <Route path="*" element={<Overview />} />
      </Route>
    </Routes>
  )
}

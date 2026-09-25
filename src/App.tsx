import { Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { AgentDetail } from './pages/AgentDetail'
import { Agents } from './pages/Agents'
import { NotFound } from './pages/NotFound'
import { Overview } from './pages/Overview'
import { Profile } from './pages/Profile'
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
        <Route path="profile" element={<Profile />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}

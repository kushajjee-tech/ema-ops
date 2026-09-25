import { Compass } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card, Empty } from '../components/ui'
import { useDocumentTitle } from '../lib/useDocumentTitle'

export function NotFound() {
  useDocumentTitle('Page not found')
  return (
    <Card>
      <Empty icon={<Compass className="size-6 text-slate-300" />} title="Page not found">
        <Link to="/" className="text-indigo-600 hover:underline">Back to Overview</Link>
      </Empty>
    </Card>
  )
}

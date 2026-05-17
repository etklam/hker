import { getServerUser } from '@/server/auth'
import { listForUser } from '@/server/services/space-service'
import { SpaceClientView } from './SpaceClientView'

export default async function SpacePage() {
  const user = await getServerUser()
  const initialSpaces = user ? await listForUser(user.id) : []
  return <SpaceClientView initialSpaces={initialSpaces} />
}

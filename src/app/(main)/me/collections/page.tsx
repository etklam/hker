import { getServerUser } from '@/server/auth'
import { listForUser } from '@/server/services/collection-service'
import { CollectionsClientView } from './CollectionsClientView'

export default async function MyCollectionsPage() {
  const user = await getServerUser()
  const initialCollections = user ? await listForUser(user.id) : []
  return <CollectionsClientView initialCollections={initialCollections} />
}

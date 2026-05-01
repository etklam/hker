import { getServerUser } from '@/server/auth'
import { listForUser } from '@/server/services/family-todo-space-service'
import { FamilyTodoClientView } from './FamilyTodoClientView'

export default async function FamilyTodoPage() {
  const user = await getServerUser()
  const initialSpaces = user ? await listForUser(user.id) : []
  return <FamilyTodoClientView initialSpaces={initialSpaces} />
}

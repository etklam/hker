export interface AuthUser {
  id: number
  email: string | null
  displayName: string | null
  avatarUrl: string | null
}

export interface SessionResponse {
  authenticated: boolean
  user: AuthUser | null
}

export interface Collection {
  id: number
  title: string
  description: string | null
  icon: string | null
  visibility: 'private' | 'unlisted' | 'public'
  sortOrder: number
  linkCount: number
  access: 'owner' | 'editor' | 'viewer' | 'none'
  createdAt: string
  updatedAt: string
}

export interface Link {
  id: number
  collectionId: number
  title: string
  url: string
  description: string | null
  faviconUrl: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface PublisherInfo {
  id: number
  displayName: string | null
  avatarUrl: string | null
}

export interface MarketplaceListing {
  id: number
  collection: Collection
  publisher: PublisherInfo | null
  publishedAt: string
  subscriberCount: number
  forkCount: number
}

export interface MarketplaceDetail {
  listing: MarketplaceListing
  links: Link[]
}

export interface PageResponse<T> {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

export interface InviteLink {
  id: number
  token: string
  role: 'viewer' | 'editor'
  maxUses: number | null
  useCount: number
  expiresAt: string | null
  url: string
}

export interface InviteInfo {
  collection: Collection
  role: string
  maxUses: number | null
  useCount: number
  expiresAt: string | null
  isValid: boolean
}

export interface InviteJoinResponse {
  collection: Collection
  role: string
}

export interface FamilyTodoInviteInfo {
  space: FamilyTodoSpace
  maxUses: number | null
  useCount: number
  expiresAt: string | null
  isValid: boolean
}

export interface Member {
  id: number
  userId: number
  role: string
  joinedAt: string
  displayName: string | null
  avatarUrl: string | null
  email: string | null
}

export type TodoPriority = 'low' | 'medium' | 'high' | 'urgent'

export interface UserBrief {
  id: number
  displayName: string | null
  avatarUrl: string | null
  email: string | null
}

export interface FamilyTodoSpace {
  id: number
  name: string
  ownerId: number
  role: string
  createdAt: string
  updatedAt: string
}

export interface TodoListResponse {
  id: number
  spaceId: number
  title: string
  sortOrder: number
  createdAt: string
}

export interface TodoResponse {
  id: number
  listId: number
  title: string
  description: string | null
  assignedTo: UserBrief | null
  priority: TodoPriority
  dueDate: string | null
  completed: boolean
  completedAt: string | null
  completedBy: UserBrief | null
  sortOrder: number
  createdBy: UserBrief
  createdAt: string
  updatedAt: string
}

export interface TodoListWithItems extends TodoListResponse {
  todos: TodoResponse[]
}

export interface BoardResponse {
  space: FamilyTodoSpace
  lists: TodoListWithItems[]
}

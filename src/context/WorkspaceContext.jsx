import { createContext, useContext, useMemo } from 'react'
import { useAuth } from './AuthContext'
import { supabase } from '../supabase'

const NULL_WORKSPACE_ID = '00000000-0000-0000-0000-000000000000'

const WorkspaceContext = createContext({
  workspaceId: null,
  workspaceLoading: false,
  wsQuery: (tableName) => supabase.from(tableName),
  addWsFilter: (q) => q,
  wsData: () => ({}),
})

export function WorkspaceProvider({ children }) {
  const { workspace, workspaceLoading } = useAuth()
  const workspaceId = workspace?.id ?? null

  // Returns a raw PostgrestQueryBuilder — call .select() on the result, then addWsFilter
  const wsQuery = useMemo(() => (tableName) => supabase.from(tableName), [])

  // Apply workspace filter to a PostgrestFilterBuilder (after .select() has been called)
  const addWsFilter = useMemo(() => (query) => {
    return query.eq('workspace_id', workspaceId ?? NULL_WORKSPACE_ID)
  }, [workspaceId])

  const wsData = useMemo(() => () => ({ workspace_id: workspaceId }), [workspaceId])

  return (
    <WorkspaceContext.Provider value={{ workspaceId, workspaceLoading, wsQuery, addWsFilter, wsData }}>
      {children}
    </WorkspaceContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useWorkspace = () => useContext(WorkspaceContext)

import { createContext, useContext, useMemo } from 'react'
import { useAuth } from './AuthContext'
import { supabase } from '../supabase'

const NULL_WORKSPACE_ID = '00000000-0000-0000-0000-000000000000'

const WorkspaceContext = createContext({
  workspaceId: null,
  wsQuery: () => supabase.from(''),
  wsData: () => ({}),
})

export function WorkspaceProvider({ children }) {
  const { workspace } = useAuth()
  const workspaceId = workspace?.id ?? null

  const wsQuery = useMemo(() => (tableName) => {
    const id = workspaceId ?? NULL_WORKSPACE_ID
    return supabase.from(tableName).eq('workspace_id', id)
  }, [workspaceId])

  const wsData = useMemo(() => () => ({ workspace_id: workspaceId }), [workspaceId])

  return (
    <WorkspaceContext.Provider value={{ workspaceId, wsQuery, wsData }}>
      {children}
    </WorkspaceContext.Provider>
  )
}

export const useWorkspace = () => useContext(WorkspaceContext)

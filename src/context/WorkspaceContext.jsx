import { createContext, useContext, useMemo } from 'react'
import { useAuth } from './AuthContext'
import { supabase } from '../supabase'

const NULL_WORKSPACE_ID = '00000000-0000-0000-0000-000000000000'

const WorkspaceContext = createContext({
  workspaceId: null,
  workspace: null,
  workspaceLoading: false,
  wsQuery: (tableName) => supabase.from(tableName),
  addWsFilter: (q) => q,
  wsData: () => ({}),
  getBusinessCategory: () => 'general',
  refreshWorkspace: () => Promise.resolve(),
})

export function WorkspaceProvider({ children }) {
  const { workspace, workspaceLoading, refreshWorkspace } = useAuth()
  const workspaceId = workspace?.id ?? null

  const wsQuery = useMemo(() => (tableName) => supabase.from(tableName), [])

  const addWsFilter = useMemo(() => (query) => {
    return query.eq('workspace_id', workspaceId ?? NULL_WORKSPACE_ID)
  }, [workspaceId])

  const wsData = useMemo(() => () => ({ workspace_id: workspaceId }), [workspaceId])

  const getBusinessCategory = useMemo(() => () => workspace?.business_category || 'general', [workspace])

  return (
    <WorkspaceContext.Provider value={{
      workspaceId, workspace, workspaceLoading,
      wsQuery, addWsFilter, wsData,
      getBusinessCategory, refreshWorkspace,
    }}>
      {children}
    </WorkspaceContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useWorkspace = () => useContext(WorkspaceContext)

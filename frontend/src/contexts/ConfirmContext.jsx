import React, { createContext, useContext, useRef, useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog'

const ConfirmContext = createContext(() => Promise.resolve(false))

/**
 * Provides an async `confirm(options)` used to replace window.confirm with a
 * styled AlertDialog. Returns a Promise<boolean>.
 *
 * options: { title, description, confirmText, cancelText, destructive }
 */
export function ConfirmProvider({ children }) {
  const [state, setState] = useState({ open: false, options: {} })
  const resolverRef = useRef(null)
  const resultRef = useRef(false)

  const confirm = useCallback(
    (options = {}) =>
      new Promise((resolve) => {
        resultRef.current = false
        resolverRef.current = resolve
        setState({ open: true, options })
      }),
    []
  )

  const onOpenChange = (open) => {
    if (!open) {
      setState((s) => ({ ...s, open: false }))
      const resolve = resolverRef.current
      resolverRef.current = null
      resolve?.(resultRef.current)
    }
  }

  const o = state.options

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog open={state.open} onOpenChange={onOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{o.title || 'Are you sure?'}</AlertDialogTitle>
            {o.description && <AlertDialogDescription>{o.description}</AlertDialogDescription>}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { resultRef.current = false }}>{o.cancelText || 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { resultRef.current = true }}
              className={o.destructive ? cn(buttonVariants({ variant: 'destructive' })) : undefined}
            >
              {o.confirmText || 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  )
}

export const useConfirm = () => useContext(ConfirmContext)

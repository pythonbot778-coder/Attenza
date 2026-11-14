// src/store/dialogStore.ts
import React from 'react'
import { create } from 'zustand'

export type DialogStatus = 'success' | 'warning' | 'error' | 'info' | 'confirm'
export type DialogMode = 'modal' | 'action-sheet'

export type DialogButtonStyle =
  | 'default'
  | 'primary'
  | 'secondary'
  | 'cancel'
  | 'destructive'
  | 'danger'
  | 'outline'

export interface DialogButton {
  text: string
  onPress?: () => void | Promise<void>
  style?: DialogButtonStyle
  variant?: DialogButtonStyle // alias for style
  loading?: boolean
  autoClose?: boolean // default: true
}

export interface DialogOptions {
  /**
   * Type can be either a status icon ('success' | 'warning' | 'error' | 'info' | 'confirm')
   * or a display mode ('modal' | 'action-sheet').
   */
  type?: DialogStatus | DialogMode | 'default'
  /** Presentation mode: 'modal' (default) or 'action-sheet' */
  mode?: DialogMode
  /** Explicit status icon */
  status?: DialogStatus
  title?: string
  message?: string
  buttons?: DialogButton[]
  customContent?: React.ReactNode
  /** Whether tapping the backdrop or hardware back button dismisses (default: true) */
  dismissable?: boolean
  /** Callback triggered when dialog is dismissed without selecting a primary action */
  onDismiss?: () => void
  /** Show an explicit close X button in the header (default: false) */
  showCloseButton?: boolean
}

export interface DialogState {
  dialog: DialogOptions | null
  isOpen: boolean
  showDialog: (options: DialogOptions) => void
  hideDialog: () => void
}

export const useDialogStore = create<DialogState>((set) => ({
  dialog: null,
  isOpen: false,
  showDialog: (options: DialogOptions) => {
    let mode: DialogMode = options.mode || 'modal'
    let status: DialogStatus | undefined = options.status

    if (options.type === 'action-sheet' || options.type === 'modal') {
      mode = options.type
    } else if (
      options.type === 'success' ||
      options.type === 'warning' ||
      options.type === 'error' ||
      options.type === 'info' ||
      options.type === 'confirm'
    ) {
      status = options.type
    }

    set({
      dialog: {
        ...options,
        mode,
        status,
        dismissable: options.dismissable !== false,
      },
      isOpen: true,
    })
  },
  hideDialog: () => set({ isOpen: false }),
}))

/**
 * Global helper to show an in-app dialog or action sheet.
 * Can be called from any component or plain typescript file.
 */
export const showDialog = (options: DialogOptions): void => {
  useDialogStore.getState().showDialog(options)
}

/**
 * Global helper to dismiss the currently visible dialog.
 */
export const hideDialog = (): void => {
  useDialogStore.getState().hideDialog()
}

/**
 * Convenience helper for a success modal.
 */
export const showSuccessDialog = (title: string, message?: string, onOk?: () => void): void => {
  showDialog({
    type: 'success',
    title,
    message,
    buttons: [{ text: 'OK', style: 'primary', onPress: onOk }],
  })
}

/**
 * Convenience helper for an error modal.
 */
export const showErrorDialog = (title: string, message?: string, onOk?: () => void): void => {
  showDialog({
    type: 'error',
    title,
    message,
    buttons: [{ text: 'OK', style: 'destructive', onPress: onOk }],
  })
}

/**
 * Convenience helper for a confirm modal (Cancel & Confirm buttons).
 */
export const showConfirmDialog = (
  title: string,
  message: string,
  onConfirm: () => void | Promise<void>,
  onCancel?: () => void,
  confirmText: string = 'Confirm',
  cancelText: string = 'Cancel',
  isDestructive: boolean = false
): void => {
  showDialog({
    type: 'confirm',
    title,
    message,
    buttons: [
      { text: cancelText, style: 'cancel', onPress: onCancel },
      { text: confirmText, style: isDestructive ? 'destructive' : 'primary', onPress: onConfirm },
    ],
  })
}

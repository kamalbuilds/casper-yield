"use client"

import React, { createContext, useCallback, useContext, useMemo, useState } from "react"
import { TransactionStatus } from "@make-software/csprclick-core-types"
import { useClickRef } from "@make-software/csprclick-ui"

type TxKind = "deposit" | "withdraw" | "harvest" | "rebalance"
type TxStatus = "idle" | "pending" | "success" | "failed"

type TxRecord = {
  kind: TxKind
  status: TxStatus
  hash?: string | null
  error?: string | null
  rawStatus?: string | null
  updatedAt?: number
}

type TransactionsContextValue = {
  transactions: Record<TxKind, TxRecord>
  sendTransaction: (
    kind: TxKind,
    txPayload: unknown,
    publicKeyHex: string,
    onSuccess?: () => void,
  ) => Promise<TxRecord>
  resetTransaction: (kind: TxKind) => void
}

const initialTransactions: Record<TxKind, TxRecord> = {
  deposit: { kind: "deposit", status: "idle" },
  withdraw: { kind: "withdraw", status: "idle" },
  harvest: { kind: "harvest", status: "idle" },
  rebalance: { kind: "rebalance", status: "idle" },
}

const TransactionsContext = createContext<TransactionsContextValue | undefined>(undefined)

function extractClickHash(result: { deployHash?: string | null; transactionHash?: string | null; hash?: string | null }) {
  return result.transactionHash ?? result.deployHash ?? result.hash ?? null
}

function extractFailureMessage(data: any): string | null {
  const failure =
    data?.execution_results?.[0]?.result?.Failure?.error_message ??
    data?.execution_results?.[0]?.result?.Failure ??
    data?.execution_results?.[0]?.result?.error_message ??
    data?.execution_results?.[0]?.result?.failure ??
    data?.execution_result?.error_message ??
    data?.error_message ??
    null
  return failure ? String(failure) : null
}

function statusFromClick(status: string, data: any): { status: TxStatus; error?: string | null } {
  if (data?.cancelled) {
    return { status: "failed", error: data?.error ?? "Transaction cancelled" }
  }
  if (data?.error) {
    return { status: "failed", error: String(data.error) }
  }
  if (status === TransactionStatus.SENT) return { status: "pending" }
  if (status === TransactionStatus.PROCESSED) {
    const failure = extractFailureMessage(data)
    return failure ? { status: "failed", error: failure } : { status: "success" }
  }
  if (
    status === TransactionStatus.CANCELLED ||
    status === TransactionStatus.EXPIRED ||
    status === TransactionStatus.TIMEOUT ||
    status === TransactionStatus.ERROR
  ) {
    return { status: "failed", error: extractFailureMessage(data) ?? "Transaction failed" }
  }
  return { status: "pending" }
}

export function TransactionsProvider({ children }: { children: React.ReactNode }) {
  const clickRef = useClickRef()
  const [transactions, setTransactions] = useState<Record<TxKind, TxRecord>>(initialTransactions)

  const updateTx = useCallback((kind: TxKind, next: Partial<TxRecord>) => {
    setTransactions((prev) => ({
      ...prev,
      [kind]: {
        ...prev[kind],
        ...next,
        updatedAt: Date.now(),
      },
    }))
  }, [])

  const resetTransaction = useCallback((kind: TxKind) => {
    setTransactions((prev) => ({
      ...prev,
      [kind]: { kind, status: "idle" },
    }))
  }, [])

  const sendTransaction = useCallback(
    async (kind: TxKind, txPayload: unknown, publicKeyHex: string, onSuccess?: () => void) => {
      if (!clickRef?.send) {
        throw new Error("Wallet connection is not ready")
      }

      updateTx(kind, { status: "pending", error: null, rawStatus: null, hash: null })

      try {
        // @ts-ignore - clickRef.send types may not be accurate
        const result = await clickRef.send(txPayload, publicKeyHex, (status: string, data: any) => {
          console.log(`Transaction ${kind} status:`, status, data)
          const mapped = statusFromClick(status, data)
          updateTx(kind, {
            status: mapped.status,
            rawStatus: status,
            error: mapped.error ?? null,
          })
          if (mapped.status === "success") {
            onSuccess?.()
          }
        })

        const hash = result ? extractClickHash(result) : null
        updateTx(kind, { hash })

        return {
          kind,
          status: transactions[kind]?.status ?? "pending",
          hash,
          error: transactions[kind]?.error ?? null,
          rawStatus: transactions[kind]?.rawStatus ?? null,
        }
      } catch (error: any) {
        const errorMessage = error?.message || "Transaction failed"
        updateTx(kind, { status: "failed", error: errorMessage })
        throw error
      }
    },
    [clickRef, transactions, updateTx],
  )

  const value = useMemo(
    () => ({
      transactions,
      sendTransaction,
      resetTransaction,
    }),
    [transactions, sendTransaction, resetTransaction],
  )

  return <TransactionsContext.Provider value={value}>{children}</TransactionsContext.Provider>
}

export function useTransactions() {
  const context = useContext(TransactionsContext)
  if (!context) {
    throw new Error("useTransactions must be used within TransactionsProvider")
  }
  return context
}

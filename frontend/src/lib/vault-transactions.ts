import { Args, CLValue, ContractCallBuilder, PublicKey } from "casper-js-sdk"
import { CONTRACT_HASHES, DEFAULT_NETWORK } from "../utils/constants"

const DEFAULT_PAYMENT_MOTES = 10_000_000_000 // 10 CSPR for contract calls

function normalizeHex(input: string) {
  return input.replace(/^0x/, "").replace(/^hash-/, "").replace(/^contract-package-/, "")
}

/**
 * Build a deposit transaction for the vault
 */
export function buildDepositTransaction(params: {
  amount: string // Amount in motes
  senderPublicKeyHex: string
  vaultId?: string
  chainName?: string
  paymentAmountMotes?: number
}) {
  const vaultPackageHash = normalizeHex(CONTRACT_HASHES.VAULT_PACKAGE)
  const chainName = params.chainName ?? DEFAULT_NETWORK
  const paymentAmount = params.paymentAmountMotes ?? DEFAULT_PAYMENT_MOTES

  const argsMap: Record<string, any> = {
    amount: CLValue.newCLUInt256(params.amount),
  }

  if (params.vaultId) {
    argsMap.vault_id = CLValue.newCLString(params.vaultId)
  }

  const args = Args.fromMap(argsMap)

  return new ContractCallBuilder()
    .byPackageHash(vaultPackageHash)
    .entryPoint("deposit")
    .from(PublicKey.fromHex(params.senderPublicKeyHex))
    .chainName(chainName)
    .payment(paymentAmount, 1)
    .runtimeArgs(args)
    .build()
}

/**
 * Build a withdraw transaction for the vault
 */
export function buildWithdrawTransaction(params: {
  shares: string // Shares to withdraw
  senderPublicKeyHex: string
  vaultId?: string
  chainName?: string
  paymentAmountMotes?: number
}) {
  const vaultPackageHash = normalizeHex(CONTRACT_HASHES.VAULT_PACKAGE)
  const chainName = params.chainName ?? DEFAULT_NETWORK
  const paymentAmount = params.paymentAmountMotes ?? DEFAULT_PAYMENT_MOTES

  const argsMap: Record<string, any> = {
    shares: CLValue.newCLUInt256(params.shares),
  }

  if (params.vaultId) {
    argsMap.vault_id = CLValue.newCLString(params.vaultId)
  }

  const args = Args.fromMap(argsMap)

  return new ContractCallBuilder()
    .byPackageHash(vaultPackageHash)
    .entryPoint("withdraw")
    .from(PublicKey.fromHex(params.senderPublicKeyHex))
    .chainName(chainName)
    .payment(paymentAmount, 1)
    .runtimeArgs(args)
    .build()
}

/**
 * Build a harvest transaction for the vault
 */
export function buildHarvestTransaction(params: {
  senderPublicKeyHex: string
  vaultId?: string
  chainName?: string
  paymentAmountMotes?: number
}) {
  const vaultPackageHash = normalizeHex(CONTRACT_HASHES.VAULT_PACKAGE)
  const chainName = params.chainName ?? DEFAULT_NETWORK
  const paymentAmount = params.paymentAmountMotes ?? DEFAULT_PAYMENT_MOTES

  const argsMap: Record<string, any> = {}

  if (params.vaultId) {
    argsMap.vault_id = CLValue.newCLString(params.vaultId)
  }

  const args = Args.fromMap(argsMap)

  return new ContractCallBuilder()
    .byPackageHash(vaultPackageHash)
    .entryPoint("harvest")
    .from(PublicKey.fromHex(params.senderPublicKeyHex))
    .chainName(chainName)
    .payment(paymentAmount, 1)
    .runtimeArgs(args)
    .build()
}

import React, { useState, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { useDeposit } from '../../hooks/useVault';
import { isValidCsprAmount, formatCspr } from '../../utils/formatters';

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  vaultId?: string;
  vaultName?: string;
  userBalance?: string;
}

export const DepositModal: React.FC<DepositModalProps> = ({
  isOpen,
  onClose,
  vaultId,
  vaultName = 'CasperYield Vault',
  userBalance = '0',
}) => {
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { mutate: deposit, isPending, isSuccess, isError } = useDeposit();

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setAmount(value);
    setError(null);

    if (value && !isValidCsprAmount(value)) {
      setError('Please enter a valid amount');
    }
  };

  const handleMaxClick = () => {
    setAmount(formatCspr(userBalance));
    setError(null);
  };

  const handleDeposit = () => {
    if (!isValidCsprAmount(amount)) {
      setError('Please enter a valid amount');
      return;
    }

    deposit(
      { amount, vaultId },
      {
        onSuccess: () => {
          setAmount('');
          setTimeout(onClose, 2000);
        },
        onError: (err) => {
          setError(err.message || 'Deposit failed');
        },
      }
    );
  };

  const handleClose = () => {
    if (!isPending) {
      setAmount('');
      setError(null);
      onClose();
    }
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/60" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-casper-dark p-6 shadow-xl transition-all">
                <Dialog.Title className="text-lg font-semibold text-white mb-4">
                  Deposit to {vaultName}
                </Dialog.Title>

                {isSuccess ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
                      <svg
                        className="w-8 h-8 text-green-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                    <p className="text-white font-medium">Deposit Submitted!</p>
                    <p className="text-gray-400 text-sm mt-1">
                      Your transaction is being processed.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Amount Input */}
                    <div className="mb-4">
                      <label className="block text-sm text-gray-400 mb-2">Amount</label>
                      <div className="relative">
                        <input
                          type="number"
                          value={amount}
                          onChange={handleAmountChange}
                          placeholder="0.00"
                          disabled={isPending}
                          className="w-full bg-casper-darker border border-casper-gray rounded-lg
                                   px-4 py-3 text-white placeholder-gray-500 focus:outline-none
                                   focus:border-casper-red disabled:opacity-50"
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center space-x-2">
                          <button
                            onClick={handleMaxClick}
                            className="text-xs text-casper-red hover:text-red-400"
                          >
                            MAX
                          </button>
                          <span className="text-gray-400">CSPR</span>
                        </div>
                      </div>
                      <div className="flex justify-between mt-1">
                        <span className="text-xs text-gray-500">
                          Balance: {formatCspr(userBalance)} CSPR
                        </span>
                        {error && (
                          <span className="text-xs text-red-500">{error}</span>
                        )}
                      </div>
                    </div>

                    {/* Info */}
                    <div className="bg-casper-darker rounded-lg p-4 mb-6">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">You will receive</span>
                        <span className="text-white">Vault Shares</span>
                      </div>
                      <div className="flex justify-between text-sm mt-2">
                        <span className="text-gray-400">Network Fee</span>
                        <span className="text-white">~10 CSPR</span>
                      </div>
                    </div>

                    {/* Error Message */}
                    {isError && (
                      <div className="mb-4 p-3 bg-red-500/10 border border-red-500/50 rounded-lg">
                        <p className="text-sm text-red-500">{error || 'Transaction failed'}</p>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex space-x-3">
                      <button
                        onClick={handleClose}
                        disabled={isPending}
                        className="flex-1 py-3 px-4 bg-casper-gray text-white rounded-lg
                                 font-medium hover:bg-casper-gray/80 disabled:opacity-50
                                 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleDeposit}
                        disabled={isPending || !amount || !!error}
                        className="flex-1 py-3 px-4 bg-casper-red text-white rounded-lg
                                 font-medium hover:bg-red-700 disabled:opacity-50
                                 disabled:cursor-not-allowed transition-colors"
                      >
                        {isPending ? 'Confirming...' : 'Deposit'}
                      </button>
                    </div>
                  </>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default DepositModal;

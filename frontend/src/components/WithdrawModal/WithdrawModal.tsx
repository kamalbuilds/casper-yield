import React, { useState, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { useWithdraw } from '../../hooks/useVault';
import { formatCspr } from '../../utils/formatters';

interface WithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  vaultId?: string;
  vaultName?: string;
  userShares?: string;
  shareValue?: string;
}

export const WithdrawModal: React.FC<WithdrawModalProps> = ({
  isOpen,
  onClose,
  vaultId,
  vaultName = 'CasperYield Vault',
  userShares = '0',
  shareValue = '0',
}) => {
  const [percentage, setPercentage] = useState(100);
  const [error, setError] = useState<string | null>(null);
  const { mutate: withdraw, isPending, isSuccess, isError } = useWithdraw();

  const calculateSharesFromPercentage = (pct: number): string => {
    const shares = BigInt(userShares);
    return ((shares * BigInt(pct)) / BigInt(100)).toString();
  };

  const handlePercentageChange = (pct: number) => {
    setPercentage(pct);
    setError(null);
  };

  const handleWithdraw = () => {
    if (percentage <= 0 || percentage > 100) {
      setError('Please select a valid percentage');
      return;
    }

    const shares = calculateSharesFromPercentage(percentage);
    if (shares === '0') {
      setError('Insufficient shares');
      return;
    }

    withdraw(
      { shares, vaultId },
      {
        onSuccess: () => {
          setTimeout(onClose, 2000);
        },
        onError: (err) => {
          setError(err.message || 'Withdrawal failed');
        },
      }
    );
  };

  const handleClose = () => {
    if (!isPending) {
      setPercentage(100);
      setError(null);
      onClose();
    }
  };

  const estimatedAmount = shareValue && shareValue !== '0'
    ? formatCspr((BigInt(shareValue) * BigInt(percentage)) / BigInt(100))
    : '0';

  const percentageButtons = [25, 50, 75, 100];

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
                  Withdraw from {vaultName}
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
                    <p className="text-white font-medium">Withdrawal Submitted!</p>
                    <p className="text-gray-400 text-sm mt-1">
                      Your transaction is being processed.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Current Position */}
                    <div className="bg-casper-darker rounded-lg p-4 mb-4">
                      <p className="text-sm text-gray-400">Your Position</p>
                      <p className="text-xl font-bold text-white">
                        {formatCspr(shareValue)} CSPR
                      </p>
                      <p className="text-sm text-gray-500">
                        {formatCspr(userShares)} shares
                      </p>
                    </div>

                    {/* Percentage Selector */}
                    <div className="mb-4">
                      <label className="block text-sm text-gray-400 mb-2">
                        Amount to Withdraw
                      </label>
                      <div className="grid grid-cols-4 gap-2 mb-3">
                        {percentageButtons.map((pct) => (
                          <button
                            key={pct}
                            onClick={() => handlePercentageChange(pct)}
                            disabled={isPending}
                            className={`py-2 rounded-lg font-medium transition-colors ${
                              percentage === pct
                                ? 'bg-casper-red text-white'
                                : 'bg-casper-gray text-gray-300 hover:bg-casper-gray/80'
                            } disabled:opacity-50`}
                          >
                            {pct}%
                          </button>
                        ))}
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={percentage}
                        onChange={(e) => handlePercentageChange(Number(e.target.value))}
                        disabled={isPending}
                        className="w-full h-2 bg-casper-gray rounded-lg appearance-none cursor-pointer
                                 disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                      <div className="text-center mt-2">
                        <span className="text-2xl font-bold text-white">{percentage}%</span>
                      </div>
                    </div>

                    {/* Withdrawal Info */}
                    <div className="bg-casper-darker rounded-lg p-4 mb-6">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">You will receive</span>
                        <span className="text-white">~{estimatedAmount} CSPR</span>
                      </div>
                      <div className="flex justify-between text-sm mt-2">
                        <span className="text-gray-400">Network Fee</span>
                        <span className="text-white">~10 CSPR</span>
                      </div>
                    </div>

                    {/* Error Message */}
                    {(isError || error) && (
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
                        onClick={handleWithdraw}
                        disabled={isPending || percentage <= 0}
                        className="flex-1 py-3 px-4 bg-casper-red text-white rounded-lg
                                 font-medium hover:bg-red-700 disabled:opacity-50
                                 disabled:cursor-not-allowed transition-colors"
                      >
                        {isPending ? 'Confirming...' : 'Withdraw'}
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

export default WithdrawModal;

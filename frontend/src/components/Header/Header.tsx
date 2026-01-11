import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useClickRef } from '@make-software/csprclick-ui';

interface NavLink {
  path: string;
  label: string;
}

const navLinks: NavLink[] = [
  { path: '/', label: 'Dashboard' },
  { path: '/vaults', label: 'Vaults' },
  { path: '/analytics', label: 'Analytics' },
];

export const Header: React.FC = () => {
  const location = useLocation();
  const clickRef = useClickRef();
  const [activeAccount, setActiveAccount] = useState<string | null>(null);

  useEffect(() => {
    clickRef?.on('csprclick:signed_in', async (evt: any) => {
      setActiveAccount(evt.account?.public_key || null);
    });
    clickRef?.on('csprclick:switched_account', async (evt: any) => {
      setActiveAccount(evt.account?.public_key || null);
    });
    clickRef?.on('csprclick:signed_out', async () => {
      setActiveAccount(null);
    });
    clickRef?.on('csprclick:disconnected', async () => {
      setActiveAccount(null);
    });

    // Check if already connected
    const account = clickRef?.getActiveAccount();
    if (account) {
      setActiveAccount(account.public_key);
    }
  }, [clickRef]);

  const handleConnect = async () => {
    try {
      await clickRef?.signIn();
    } catch (error) {
      console.error('Failed to connect wallet:', error);
    }
  };

  const handleDisconnect = async () => {
    try {
      await clickRef?.signOut();
      setActiveAccount(null);
    } catch (error) {
      console.error('Failed to disconnect wallet:', error);
    }
  };

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 8)}...${address.slice(-6)}`;
  };

  return (
    <header className="bg-casper-dark border-b border-casper-gray">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo and Brand */}
          <div className="flex items-center space-x-8">
            <Link to="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-casper-red rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">C</span>
              </div>
              <span className="text-white font-semibold text-xl">CasperYield</span>
            </Link>

            {/* Navigation Links */}
            <nav className="hidden md:flex space-x-6">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    location.pathname === link.path
                      ? 'text-white bg-casper-gray'
                      : 'text-gray-300 hover:text-white hover:bg-casper-gray/50'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Wallet Connection */}
          <div className="flex items-center">
            {activeAccount ? (
              <div className="flex items-center space-x-3">
                <span className="text-gray-300 text-sm font-mono">
                  {truncateAddress(activeAccount)}
                </span>
                <button
                  onClick={handleDisconnect}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={handleConnect}
                className="px-4 py-2 bg-casper-red hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Connect Wallet
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      <nav className="md:hidden border-t border-casper-gray">
        <div className="px-4 py-2 space-y-1">
          {navLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className={`block px-3 py-2 rounded-md text-base font-medium ${
                location.pathname === link.path
                  ? 'text-white bg-casper-gray'
                  : 'text-gray-300 hover:text-white hover:bg-casper-gray/50'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
};

export default Header;

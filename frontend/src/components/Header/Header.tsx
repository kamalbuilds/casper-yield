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

// Format balance from motes to CSPR
function formatBalance(value?: string | null): string {
  if (!value) return '0';
  const motes = Number(value);
  if (!Number.isFinite(motes)) return '0';
  return (motes / 1e9).toFixed(4);
}

export const Header: React.FC = () => {
  const location = useLocation();
  const clickRef = useClickRef();
  const [activeAccount, setActiveAccount] = useState<any>(null);

  useEffect(() => {
    if (!clickRef) return;

    const handleSignedIn = (evt: any) => {
      console.log('Signed in:', evt);
      setActiveAccount(evt.account || null);
    };

    const handleSwitchAccount = (evt: any) => {
      console.log('Account switched:', evt);
      setActiveAccount(evt.account || null);
    };

    const handleSignedOut = () => {
      console.log('Signed out');
      setActiveAccount(null);
    };

    const handleDisconnected = () => {
      console.log('Disconnected');
      setActiveAccount(null);
    };

    clickRef.on('csprclick:signed_in', handleSignedIn);
    clickRef.on('csprclick:switched_account', handleSwitchAccount);
    clickRef.on('csprclick:signed_out', handleSignedOut);
    clickRef.on('csprclick:disconnected', handleDisconnected);

    // Check if already connected
    const account = clickRef.getActiveAccount?.();
    if (account) {
      console.log('Already connected:', account);
      setActiveAccount(account);
    }

    return () => {
      clickRef.off('csprclick:signed_in', handleSignedIn);
      clickRef.off('csprclick:switched_account', handleSwitchAccount);
      clickRef.off('csprclick:signed_out', handleSignedOut);
      clickRef.off('csprclick:disconnected', handleDisconnected);
    };
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
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const publicKey = activeAccount?.public_key || activeAccount?.publicKey || '';
  const balance = formatBalance(
    activeAccount?.liquid_balance ?? activeAccount?.balance ?? null
  );

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
                <div className="text-right">
                  <span className="text-gray-300 text-sm font-mono block">
                    {truncateAddress(publicKey)}
                  </span>
                  <span className="text-gray-400 text-xs">
                    {balance} CSPR
                  </span>
                </div>
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

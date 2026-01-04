import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ClickUI } from '@make-software/csprclick-ui';

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
          <div className="flex items-center space-x-4">
            <ClickUI />
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

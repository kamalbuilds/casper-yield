import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { ClickProvider, ClickUI, DefaultThemes, buildTheme } from '@make-software/csprclick-ui';
import { ThemeProvider } from 'styled-components';
import { CsprClickInitOptions, CONTENT_MODE } from '@make-software/csprclick-core-types';
import App from './App';

const clickOptions: CsprClickInitOptions = {
  appName: 'CasperYield',
  contentMode: CONTENT_MODE.IFRAME,
  providers: ['casper-wallet', 'ledger', 'torus-wallet', 'casperdash', 'metamask-snap', 'casper-signer'],
  appId: '019bae3d-6be3-701a-805d-4e597064d668' // Empty for development - register at https://cspr.click for production
};

// Build theme using the proper method
const theme = buildTheme(DefaultThemes.csprclick).dark;

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <ClickProvider options={clickOptions}>
      <ThemeProvider theme={theme}>
        <ClickUI rootAppElement="body" />
        <App />
      </ThemeProvider>
    </ClickProvider>
  </React.StrictMode>
);

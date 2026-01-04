import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { ClickProvider } from '@make-software/csprclick-ui';
import { CsprClickInitOptions, CONTENT_MODE } from '@make-software/csprclick-core-types';
import App from './App';

const clickOptions: CsprClickInitOptions = {
  appName: 'CSPR.app',
  contentMode: CONTENT_MODE.IFRAME,
  providers: ['casper-wallet', 'ledger', 'metamask-snap'],
  appId: 'csprclick-template'
};

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <ClickProvider options={clickOptions}>
      <App />
    </ClickProvider>
  </React.StrictMode>
);

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import styled from 'styled-components';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Header } from './components';
import { Dashboard, VaultDetails, Analytics } from './pages';
import { TransactionsProvider } from './context/TransactionsContext';

// Create a Query Client for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      staleTime: 30000,
      refetchOnWindowFocus: false,
    },
  },
});

const MainContainer = styled.div`
  min-height: 100vh;
  background-color: #0F0F1A;
`;

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TransactionsProvider>
        <Router>
          <MainContainer>
            <Header />
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/vaults" element={<Dashboard />} />
              <Route path="/vaults/:vaultId" element={<VaultDetails />} />
              <Route path="/analytics" element={<Analytics />} />
            </Routes>
          </MainContainer>
        </Router>
      </TransactionsProvider>
    </QueryClientProvider>
  );
};

export default App;

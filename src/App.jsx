import { useState } from 'react';
import UploadView from './components/UploadView/UploadView.jsx';
import TransactionTable from './components/TransactionTable/TransactionTable.jsx';
import Dashboard from './components/Dashboard/Dashboard.jsx';
import LoadingSpinner from './components/shared/LoadingSpinner.jsx';
import ErrorBanner from './components/shared/ErrorBanner.jsx';
import './App.css';

export default function App() {
  const [view, setView] = useState('upload'); // 'upload' | 'review' | 'dashboard'
  const [transactions, setTransactions] = useState([]);
  const [monthlyIncome, setMonthlyIncome] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleAnalyze = async (file, income) => {
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('monthlyIncome', income);

      const res = await fetch('/api/analyze', { method: 'POST', body: formData });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Analysis failed. Please try again.');

      setTransactions(data.transactions);
      setMonthlyIncome(data.monthlyIncome);
      setView('review');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const updateTransaction = (id, updates) => {
    setTransactions((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));
  };

  return (
    <>
      {isLoading && <LoadingSpinner />}
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {view === 'upload' && <UploadView onAnalyze={handleAnalyze} />}

      {view === 'review' && (
        <TransactionTable
          transactions={transactions}
          onUpdate={updateTransaction}
          onViewDashboard={() => setView('dashboard')}
          onBack={() => setView('upload')}
        />
      )}

      {view === 'dashboard' && (
        <Dashboard
          transactions={transactions}
          monthlyIncome={monthlyIncome}
          onBack={() => setView('review')}
        />
      )}
    </>
  );
}

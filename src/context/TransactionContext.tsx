import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { Transaction } from '../types';
import { mockTransactions, getNewId } from '../data/mockData';
import { toast } from 'react-toastify';
import { useClients } from './ClientContext';
import { format } from 'date-fns';

interface TransactionContextProps {
  transactions: Transaction[];
  loading: boolean;
  error: string | null;
  getTransaction: (id: string) => Transaction | undefined;
  getClientTransactions: (clientId: string) => Transaction[];
  addTransaction: (transaction: Omit<Transaction, 'id' | 'date' | 'status'>) => void;
  deleteTransaction: (id: string) => void;
  transferFunds: (params: {
    fromClientId: string;
    fromAccountId: string;
    toClientId: string;
    toAccountId: string;
    amount: number;
    description: string;
    currency: string;
  }) => void;
}

const TransactionContext = createContext<TransactionContextProps | undefined>(undefined);

export const TransactionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { updateClientBalance } = useClients();

  useEffect(() => {
    // Simulate API fetch
    setTimeout(() => {
      try {
        // Load from localStorage if available, otherwise use mock data
        const storedTransactions = localStorage.getItem('volvy-bank-transactions');
        if (storedTransactions) {
          setTransactions(JSON.parse(storedTransactions));
        } else {
          setTransactions(mockTransactions);
        }
        setLoading(false);
      } catch (err) {
        setError('Failed to load transactions');
        setLoading(false);
      }
    }, 600);
  }, []);

  // Save to localStorage whenever transactions changes
  useEffect(() => {
    if (!loading && transactions.length > 0) {
      localStorage.setItem('volvy-bank-transactions', JSON.stringify(transactions));
    }
  }, [transactions, loading]);

  const getTransaction = (id: string) => {
    return transactions.find(transaction => transaction.id === id);
  };

  const getClientTransactions = (clientId: string) => {
    return transactions.filter(transaction => transaction.clientId === clientId);
  };

  const addTransaction = (transaction: Omit<Transaction, 'id' | 'date' | 'status'>) => {
    const newTransaction: Transaction = {
      ...transaction,
      id: getNewId('t'),
      date: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
      status: 'completed',
    };

    setTransactions(prevTransactions => [...prevTransactions, newTransaction]);
    
    // Update client balance for the specific account
    updateClientBalance(
      newTransaction.clientId,
      newTransaction.accountId,
      newTransaction.amount,
      newTransaction.type === 'deposit'
    );
    
    toast.success(`${newTransaction.type === 'deposit' ? 'Dépôt' : 'Retrait'} effectué avec succès!`);
  };

  const transferFunds = (params: {
    fromClientId: string;
    fromAccountId: string;
    toClientId: string;
    toAccountId: string;
    amount: number;
    description: string;
    currency: string;
  }) => {
    const { fromClientId, fromAccountId, toClientId, toAccountId, amount, description, currency } = params;

    // Create withdrawal transaction for sender
    const withdrawalTransaction: Transaction = {
      id: getNewId('t'),
      clientId: fromClientId,
      accountId: fromAccountId,
      type: 'transfer',
      amount,
      description: `Transfert vers ${description}`,
      date: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
      status: 'completed',
      currency,
      recipientAccountId: toAccountId,
      recipientClientId: toClientId
    };

    // Create deposit transaction for recipient
    const depositTransaction: Transaction = {
      id: getNewId('t'),
      clientId: toClientId,
      accountId: toAccountId,
      type: 'transfer',
      amount,
      description: `Transfert reçu de ${description}`,
      date: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
      status: 'completed',
      currency,
      recipientAccountId: fromAccountId,
      recipientClientId: fromClientId
    };

    setTransactions(prevTransactions => [...prevTransactions, withdrawalTransaction, depositTransaction]);

    // Update balances
    updateClientBalance(fromClientId, fromAccountId, amount, false); // Deduct from sender
    updateClientBalance(toClientId, toAccountId, amount, true); // Add to recipient

    toast.success('Transfert effectué avec succès!');
  };

  const deleteTransaction = (id: string) => {
    const transaction = transactions.find(t => t.id === id);
    
    if (transaction) {
      // Reverse the effect on client balance before deletion
      updateClientBalance(
        transaction.clientId,
        transaction.accountId,
        transaction.amount,
        transaction.type !== 'deposit' // If it was a deposit, we need to subtract, and vice versa
      );
      
      setTransactions(prevTransactions => 
        prevTransactions.filter(transaction => transaction.id !== id)
      );
      
      toast.success('Transaction supprimée avec succès!');
    }
  };

  return (
    <TransactionContext.Provider
      value={{
        transactions,
        loading,
        error,
        getTransaction,
        getClientTransactions,
        addTransaction,
        deleteTransaction,
        transferFunds
      }}
    >
      {children}
    </TransactionContext.Provider>
  );
};

export const useTransactions = () => {
  const context = useContext(TransactionContext);
  if (context === undefined) {
    throw new Error('useTransactions must be used within a TransactionProvider');
  }
  return context;
};
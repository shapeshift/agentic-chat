export type Transaction = {
  name: string;
  amount: number;
  status: string;
  type: string;
  date: string;
  from: string;
  to: string;
  transactionHash: string;
}

export type TransactionList = Transaction[];
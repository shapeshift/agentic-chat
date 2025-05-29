import { redirect } from 'next/navigation';

export default async function App() {
  return (
      redirect('/chat')
  );
}

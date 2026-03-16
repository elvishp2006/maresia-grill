import './App.css';
import { CATEGORIES } from './types';
import { formatMenuText } from './utils';
import { useMenuState } from './hooks/useMenuState';
import Header from './components/Header';
import CategoryCard from './components/CategoryCard';

export default function App() {
  const { complements, daySelection, loading, toggleItem, addItem, removeItem } = useMenuState();

  const now = new Date();
  const dateShort = now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

  const copyMenu = async () => {
    const text = formatMenuText(complements, daySelection);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      alert(text);
    }
  };

  if (loading) return <div className="app" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Carregando...</div>;

  return (
    <div className="app">
      <Header
        activeCount={daySelection.length}
        dateShort={dateShort}
        onCopy={copyMenu}
      />
      <main className="grid">
        {CATEGORIES.map(categoria => (
          <CategoryCard
            key={categoria}
            categoria={categoria}
            items={complements.filter(item => item.categoria === categoria)}
            daySelection={daySelection}
            onToggle={toggleItem}
            onAdd={addItem}
            onRemove={removeItem}
          />
        ))}
      </main>
    </div>
  );
}

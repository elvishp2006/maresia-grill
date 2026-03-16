import { useState } from 'react';
import './App.css';
import { formatMenuText } from './utils';
import { useMenuState } from './hooks/useMenuState';
import Header from './components/Header';
import CategoryCard from './components/CategoryCard';
import Toolbar from './components/Toolbar';
import AddForm from './components/AddForm';

export default function App() {
  const {
    categories,
    complements,
    daySelection,
    usageCounts,
    sortMode,
    loading,
    toggleSortMode,
    toggleItem,
    addItem,
    removeItem,
    renameItem,
    addCategory,
    moveCategory,
  } = useMenuState();

  const [search, setSearch] = useState('');
  const [showAddCategory, setShowAddCategory] = useState(false);

  const now = new Date();
  const dateShort = now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

  const copyMenu = async () => {
    const text = formatMenuText(complements, daySelection, categories);
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
      <Toolbar
        search={search}
        onSearchChange={setSearch}
        sortMode={sortMode}
        onToggleSort={toggleSortMode}
      />
      <main className="grid">
        {categories.map((categoria, idx) => (
          <CategoryCard
            key={categoria}
            categoria={categoria}
            items={complements.filter(item => item.categoria === categoria)}
            daySelection={daySelection}
            onToggle={toggleItem}
            onAdd={addItem}
            onRemove={removeItem}
            onRename={renameItem}
            search={search}
            sortMode={sortMode}
            usageCounts={usageCounts}
            onMoveUp={() => moveCategory(categoria, 'up')}
            onMoveDown={() => moveCategory(categoria, 'down')}
            isFirst={idx === 0}
            isLast={idx === categories.length - 1}
          />
        ))}

        {showAddCategory ? (
          <div className="category-card add-category-card">
            <AddForm
              onAdd={(nome) => { addCategory(nome); setShowAddCategory(false); }}
              onClose={() => setShowAddCategory(false)}
              placeholder="Nome da categoria..."
            />
          </div>
        ) : (
          <button
            type="button"
            className="add-category-btn"
            onClick={() => setShowAddCategory(true)}
          >
            + Nova categoria
          </button>
        )}
      </main>
    </div>
  );
}

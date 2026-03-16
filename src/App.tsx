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
    removeCategory,
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

  if (loading) return (
    <div className="max-w-[960px] mx-auto px-4 pt-4 flex justify-center items-center h-screen">
      Carregando...
    </div>
  );

  return (
    <div className="max-w-[960px] mx-auto px-4 pt-4 pb-[env(safe-area-inset-bottom,1rem)]">
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
      <main className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
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
            onRemoveCategory={() => removeCategory(categoria)}
            isFirst={idx === 0}
            isLast={idx === categories.length - 1}
          />
        ))}

        {showAddCategory ? (
          <div className="bg-[var(--bg-card)] border border-dashed border-[var(--border)] rounded-[6px] p-[14px]">
            <AddForm
              onAdd={(nome) => { addCategory(nome); setShowAddCategory(false); }}
              onClose={() => setShowAddCategory(false)}
              placeholder="Nome da categoria..."
            />
          </div>
        ) : (
          <button
            type="button"
            className="font-mono text-[13px] font-semibold text-[var(--accent)] bg-transparent border border-dashed border-[var(--border)] rounded-[6px] p-[14px] cursor-pointer w-full text-center touch-manipulation transition-colors hover:border-[var(--accent)] min-h-[60px]"
            onClick={() => setShowAddCategory(true)}
          >
            + Nova categoria
          </button>
        )}
      </main>
    </div>
  );
}

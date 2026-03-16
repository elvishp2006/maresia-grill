import { useState, useRef, useEffect } from 'react';
import { useHapticFeedback } from '../hooks/useHapticFeedback';

interface AddFormProps {
  onAdd: (nome: string) => void;
  onClose: () => void;
  placeholder?: string;
}

export default function AddForm({ onAdd, onClose, placeholder = 'Nome do item...' }: AddFormProps) {
  const [nome, setNome] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { lightTap, success } = useHapticFeedback();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    const trimmed = nome.trim();
    if (!trimmed) return;
    success();
    onAdd(trimmed);
    setNome('');
    onClose();
  };

  const handleClose = () => {
    lightTap();
    onClose();
  };

  return (
    <div className="mb-[10px] flex flex-col gap-[6px]">
      <input
        ref={inputRef}
        type="text"
        className="font-mono text-[16px] text-[var(--text)] bg-[rgba(240,235,224,0.05)] border border-[var(--border)] rounded px-[10px] py-2 w-full outline-none focus:border-[var(--accent)] placeholder:text-[var(--text-dim)] transition-colors"
        placeholder={placeholder}
        value={nome}
        onChange={e => setNome(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); if (e.key === 'Escape') handleClose(); }}
      />
      <div className="flex gap-[6px]">
        <button
          type="button"
          className="font-mono text-[12px] font-semibold bg-[var(--accent)] text-[var(--bg)] rounded px-3 py-[6px] border-none cursor-pointer min-h-[36px] hover:opacity-80 touch-manipulation transition-opacity"
          onClick={handleSubmit}
        >
          Adicionar
        </button>
        <button
          type="button"
          className="font-mono text-[12px] text-[var(--text-dim)] bg-transparent border border-[var(--border)] rounded px-3 py-[6px] cursor-pointer min-h-[36px] hover:opacity-80 touch-manipulation transition-opacity"
          onClick={handleClose}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

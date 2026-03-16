import { useState, useRef, useEffect } from 'react';

interface AddFormProps {
  onAdd: (nome: string) => void;
  onClose: () => void;
  placeholder?: string;
}

export default function AddForm({ onAdd, onClose, placeholder = 'Nome do item...' }: AddFormProps) {
  const [nome, setNome] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    const trimmed = nome.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setNome('');
    onClose();
  };

  return (
    <div className="add-form">
      <input
        ref={inputRef}
        type="text"
        className="add-input"
        placeholder={placeholder}
        value={nome}
        onChange={e => setNome(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); if (e.key === 'Escape') onClose(); }}
      />
      <div className="add-form-actions">
        <button type="button" className="add-submit-btn" onClick={handleSubmit}>Adicionar</button>
        <button type="button" className="add-cancel-btn" onClick={onClose}>Cancelar</button>
      </div>
    </div>
  );
}

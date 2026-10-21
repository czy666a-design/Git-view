import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface SelectOption { value: string; label: string; description?: string }
interface SelectProps {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  variant?: 'field' | 'quiet';
}

/** Shared single choice control. Focus stays on the combobox while its list is open. */
export function Select({ label, value, options, onChange, disabled, variant = 'field' }: SelectProps) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const search = useRef({ text: '', at: 0 });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [position, setPosition] = useState({ left: 0, top: 0, width: 0, maxHeight: 280 });
  const selected = options.find(option => option.value === value);
  const text = (option?: SelectOption) => option ? [option.label, option.description].filter(Boolean).join(' · ') : label;
  const show = () => {
    if (disabled || !options.length) return;
    setActive(Math.max(0, options.findIndex(option => option.value === value)));
    setOpen(true);
  };
  const choose = (index: number) => {
    const option = options[index];
    if (!option) return;
    setOpen(false);
    trigger.current?.focus({ preventScroll: true });
    if (option.value !== value) onChange(option.value);
  };

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      if (!trigger.current || !popup.current) return;
      const rect = trigger.current.getBoundingClientRect();
      const margin = 12, gap = 6;
      const width = Math.min(Math.max(rect.width, 240), 560, window.innerWidth - margin * 2);
      const below = window.innerHeight - rect.bottom - margin - gap;
      const above = rect.top - margin - gap;
      const upward = below < Math.min(200, popup.current.scrollHeight) && above > below;
      const maxHeight = Math.max(0, Math.min(280, upward ? above : below));
      const height = Math.min(maxHeight, popup.current.scrollHeight + 2);
      setPosition({ left: Math.max(margin, Math.min(rect.left, window.innerWidth - width - margin)),
        top: upward ? rect.top - gap - height : rect.bottom + gap, width, maxHeight });
    };
    place();
    window.addEventListener('resize', place);
    const scroll = (event: Event) => { if (!popup.current?.contains(event.target as Node)) place(); };
    window.addEventListener('scroll', scroll, true);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', scroll, true); };
  }, [open, options.length]);

  useEffect(() => {
    if (!open) return;
    popup.current?.querySelector(`#${CSS.escape(id)}-option-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active, id]);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!trigger.current?.contains(target) && !popup.current?.contains(target)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  useEffect(() => { setOpen(false); }, [disabled, value]);

  return <>
    <button ref={trigger} type="button" role="combobox" className={`select-trigger select-${variant}`}
      aria-label={label} data-value={value} aria-expanded={open} aria-haspopup="listbox" aria-controls={open ? id : undefined}
      aria-activedescendant={open ? `${id}-option-${active}` : undefined} disabled={disabled || !options.length}
      title={text(selected)} onBlur={() => setOpen(false)} onClick={() => open ? setOpen(false) : show()}
      onKeyDown={event => {
        if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); }
        else if (event.key === 'Tab') setOpen(false);
        else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
          event.preventDefault();
          if (!open) { show(); if (event.key === 'Home') setActive(0); if (event.key === 'End') setActive(options.length - 1); }
          else setActive(index => event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 :
            (index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length);
        } else if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault(); if (open) choose(active); else show();
        } else if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
          event.preventDefault();
          const now = Date.now();
          const prefix = (now - search.current.at < 700 ? search.current.text : '') + event.key.toLocaleLowerCase();
          search.current = { text: prefix, at: now };
          const index = options.findIndex(option => option.label.toLocaleLowerCase().startsWith(prefix));
          if (index >= 0) { if (!open) show(); setActive(index); }
        }
      }}>
      <span className="select-value">{text(selected)}</span>
      <svg className="select-chevron" aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="m6 9 6 6 6-6"/></svg>
    </button>
    {open && !disabled && createPortal(<div ref={popup} id={id} role="listbox" aria-label={label}
      className="select-menu" style={position} onMouseDown={event => event.preventDefault()}>
      {options.map((option, index) => <div key={option.value} id={`${id}-option-${index}`} role="option"
        aria-selected={option.value === value} data-value={option.value} className={`select-option ${index === active ? 'is-active' : ''}`}
        title={text(option)} onPointerMove={() => setActive(index)} onClick={() => choose(index)}>
        <span className="select-option-copy"><span>{option.label}</span>{option.description && <small>{option.description}</small>}</span>
        <svg className="select-check" aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m5 12 4 4L19 6"/></svg>
      </div>)}
    </div>, document.body)}
  </>;
}

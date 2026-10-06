import { useEffect, useRef, useState } from 'react';

// Matches max-height of .dropdown-menu in styles.css
const MAX_MENU_HEIGHT = 260;
// Room taken by the fixed tab bar at the bottom of the screen
const BOTTOM_BAR = 80;

// Themed replacement for a native <select>. Options are { value, label }.
export default function Dropdown({ id, value, options, onChange, placeholder, ariaLabel }) {
  const [open, setOpen] = useState(false);
  // Open upwards when the field is too close to the bottom of the screen
  const [upwards, setUpwards] = useState(false);
  const rootRef = useRef(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e) => {
      if (!rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  function toggle() {
    if (!open) {
      const { top, bottom } = rootRef.current.getBoundingClientRect();
      const menuHeight = Math.min(options.length * 46 + 14, MAX_MENU_HEIGHT);
      const below = window.innerHeight - bottom - BOTTOM_BAR;
      setUpwards(below < menuHeight && top > below);
    }
    setOpen((prev) => !prev);
  }

  function choose(optionValue) {
    onChange(optionValue);
    setOpen(false);
  }

  return (
    <div className={`dropdown ${open ? 'open' : ''} ${upwards ? 'up' : ''}`} ref={rootRef}>
      <button
        id={id}
        type="button"
        className="dropdown-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={toggle}
      >
        <span className={selected ? '' : 'placeholder'}>
          {selected ? selected.label : placeholder}
        </span>
        <span className="dropdown-caret" aria-hidden="true" />
      </button>

      {open && (
        <ul className="dropdown-menu" role="listbox">
          {options.map((option) => (
            <li key={option.value} role="option" aria-selected={option.value === value}>
              <button
                type="button"
                className={option.value === value ? 'selected' : ''}
                onClick={() => choose(option.value)}
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

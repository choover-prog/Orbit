"use client";

import Link from "next/link";
import { useState } from "react";

interface UtilityMenuProps {
  showPresenceLab: boolean;
}

export function UtilityMenu({ showPresenceLab }: UtilityMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="utility-menu">
      <button
        className="menu-trigger"
        type="button"
        aria-expanded={open}
        aria-controls="orbit-utility-navigation"
        onClick={() => setOpen((current) => !current)}
      >
        Menu
      </button>
      <nav
        id="orbit-utility-navigation"
        aria-label="Primary navigation"
        hidden={!open}
      >
        <Link href="/history" onClick={() => setOpen(false)}>
          History
        </Link>
        <Link href="/connections" onClick={() => setOpen(false)}>
          Connections
        </Link>
        <Link href="/settings" onClick={() => setOpen(false)}>
          Settings
        </Link>
        {showPresenceLab ? (
          <Link href="/design-lab/presence" onClick={() => setOpen(false)}>
            Presence Lab <span>Development</span>
          </Link>
        ) : null}
      </nav>
    </div>
  );
}

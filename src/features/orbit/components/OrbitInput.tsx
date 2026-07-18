"use client";

import { useState, type FormEvent } from "react";
import styles from "./QuietOrbit.module.css";

interface OrbitInputProps {
  onSubmit: (value: string) => void;
  onListen: () => void;
  disabled?: boolean;
}

export function OrbitInput({
  onSubmit,
  onListen,
  disabled = false,
}: OrbitInputProps) {
  const [value, setValue] = useState("");

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = value.trim();
    if (!next) return;
    onSubmit(next);
    setValue("");
  };

  return (
    <form
      className={styles.orbitInput}
      onSubmit={submit}
      aria-label="Ask Orbit"
    >
      <label className="sr-only" htmlFor="orbit-question">
        Ask Orbit
      </label>
      <input
        id="orbit-question"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Ask Orbit"
        autoComplete="off"
        disabled={disabled}
      />
      <button
        type="button"
        className={styles.listenButton}
        onClick={onListen}
        disabled={disabled}
      >
        Listen
      </button>
      <button
        type="submit"
        className={styles.sendButton}
        disabled={disabled || value.trim().length === 0}
      >
        Ask
      </button>
    </form>
  );
}

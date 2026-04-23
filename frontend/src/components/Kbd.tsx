interface KbdProps {
  children: React.ReactNode;
}

/** Keyboard shortcut chip: <Kbd>⌘</Kbd><Kbd>K</Kbd> */
export default function Kbd({ children }: KbdProps) {
  return <span className="kbd">{children}</span>;
}

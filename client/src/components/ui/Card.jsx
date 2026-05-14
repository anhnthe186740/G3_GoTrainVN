export function Card({ className = "", ...props }) {
  return <div className={`card p-6 ${className}`} {...props} />;
}

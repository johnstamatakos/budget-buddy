import './ErrorBanner.css';

export default function ErrorBanner({ message, onDismiss }) {
  return (
    <div className="error-banner">
      <span className="error-icon">!</span>
      <span className="error-message">{message}</span>
      <button className="error-close" onClick={onDismiss} aria-label="Dismiss">×</button>
    </div>
  );
}

import './LoadingSpinner.css';

export default function LoadingSpinner() {
  return (
    <div className="spinner-overlay">
      <div className="spinner-box">
        <div className="spinner" />
        <p>Analyzing your transactions with AI...</p>
        <p className="spinner-sub">This may take 15–30 seconds</p>
      </div>
    </div>
  );
}

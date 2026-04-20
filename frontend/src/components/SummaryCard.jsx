function SummaryCard({ title, value, subtitle, tone = "primary" }) {
  return (
    <div className="card border-0 shadow-sm h-100">
      <div className="card-body">
        <span className={`badge text-bg-${tone} bg-opacity-75 mb-3`}>{title}</span>
        <h2 className="h4 mb-1">{value}</h2>
        <p className="text-secondary mb-0">{subtitle}</p>
      </div>
    </div>
  );
}

export default SummaryCard;
